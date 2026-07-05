import { createPublicClient, http, parseAbiItem, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import type { Config } from "./config.js";
import type { OfficerDecryptor } from "./officer.js";
import type { PayoutProvider } from "./providers/types.js";
import type { BeneficiaryResolver } from "./beneficiary.js";

// Engine emits the sealed outcome handle; corridor emits public ordering (sender/recipient/nonce).
const SETTLED = parseAbiItem(
  "event Settled(bytes32 indexed id, uint256 indexed nonce, bytes32 receipt, bytes32 outcomeHandle)",
);
const CORRIDOR_TRANSFER = parseAbiItem(
  "event CorridorTransfer(address indexed sender, address indexed recipient, uint256 indexed nonce)",
);

export type ListenerDeps = {
  cfg: Config;
  decryptor: OfficerDecryptor;
  provider: PayoutProvider;
  beneficiaries: BeneficiaryResolver;
};

/** One settled corridor transfer: sealed outcome + the public parties, correlated by nonce. */
export type Settlement = {
  nonce: bigint;
  outcomeHandle: Hex;
  sender: Address;
  recipient: Address;
};

/** What the off-ramp did with one settlement. */
export type PayoutOutcome =
  | { kind: "paid"; amount: string; currency: string; providerId: string; status: string }
  | { kind: "nullified" }
  | { kind: "no-beneficiary"; recipient: Address };

/**
 * The gate + payout — the one place the loop's off-ramp half lives, so both the live
 * listener and any integration driver run the SAME code. Officer-decrypts the sealed
 * outcome and fires the payout ONLY when `moved > 0` (VERIFICATION.md §6e).
 */
export async function processSettlement(
  deps: ListenerDeps,
  ev: Settlement,
): Promise<PayoutOutcome> {
  const { cfg, decryptor, provider, beneficiaries } = deps;

  // 1. Officer-decrypt the sealed outcome. moved ∈ {0, amount}.
  const moved = await decryptor.decryptMoved(ev.outcomeHandle, cfg.chain.engineAddress);

  // 2. THE GATE — a transfer nullified by ANY rule has moved == 0 → no fiat leg.
  if (moved <= 0n) return { kind: "nullified" };

  // 3. Resolve the fiat beneficiary for the on-chain recipient.
  const beneficiary = await beneficiaries.resolve(ev.recipient);
  if (!beneficiary) return { kind: "no-beneficiary", recipient: ev.recipient };

  // 4. Pay out (idempotent on nonce). `moved` is in confidential-token base units — map to
  //    local-currency units here (FX + decimals) per the corridor's settlement contract.
  const amount = mapToLocalAmount(moved, beneficiary.currency);
  // Idempotent per (corridor, nonce); the suffix is a no-op in production and drives the sandbox
  // mock disburse callback in test mode (see Config.flutterwave.referenceSuffix).
  const reference = `cloistra-${cfg.chain.corridorAddress}-${ev.nonce}${cfg.flutterwave.referenceSuffix}`;
  const result = await provider.payout({
    reference,
    amount,
    beneficiary,
    narration: `CLOISTRA corridor clear nonce ${ev.nonce}`,
  });
  return {
    kind: "paid",
    amount,
    currency: beneficiary.currency,
    providerId: result.providerId,
    status: result.status,
  };
}

/**
 * The off-ramp listener. Neither `CorridorTransfer` (public ordering only) nor `Settled`
 * (a sealed `outcomeHandle`) reveals whether a transfer CLEARED (moved > 0) or was NULLIFIED
 * (moved = 0) — that is sealed. So the honest trigger (VERIFICATION.md §6e) is: officer-decrypt
 * `outcomeHandle`, and fire the sandbox payout ONLY when the cleartext `moved > 0`. The fiat leg
 * is thus genuinely caused by, and proportional to, a real on-chain clear — never a bare event.
 */
export async function runListener(deps: ListenerDeps): Promise<void> {
  const { cfg } = deps;
  const client = createPublicClient({ chain: sepolia, transport: http(cfg.chain.rpcUrl) });

  // Correlate CorridorTransfer (carries recipient) with Settled (carries outcomeHandle) by nonce.
  const partiesByNonce = new Map<string, { sender: Address; recipient: Address }>();
  const pendingSettledByNonce = new Map<string, Hex>();

  async function handleSettlement(transferNonce: bigint, outcomeHandle: Hex): Promise<void> {
    const key = transferNonce.toString();
    const parties = partiesByNonce.get(key);
    if (!parties) {
      pendingSettledByNonce.set(key, outcomeHandle);
      console.warn(
        `[offramp] transfer nonce=${transferNonce} settled but no CorridorTransfer seen yet — deferring`,
      );
      return;
    }
    try {
      const out = await processSettlement(deps, {
        nonce: transferNonce,
        outcomeHandle,
        ...parties,
      });
      logOutcome(transferNonce, deps.provider.name, out);
    } catch (err) {
      console.error(`[offramp] transfer nonce=${transferNonce} failed:`, (err as Error).message);
    }
  }

  client.watchEvent({
    address: cfg.chain.corridorAddress,
    event: CORRIDOR_TRANSFER,
    onLogs: (logs) => {
      for (const log of logs) {
        const { sender, recipient, nonce } = log.args as {
          sender: Address;
          recipient: Address;
          nonce: bigint;
        };
        const key = nonce.toString();
        partiesByNonce.set(key, { sender, recipient });
        const pending = pendingSettledByNonce.get(key);
        if (pending) {
          pendingSettledByNonce.delete(key);
          void handleSettlement(nonce, pending);
        }
      }
    },
  });

  client.watchEvent({
    address: cfg.chain.engineAddress,
    event: SETTLED,
    onLogs: async (logs) => {
      for (const log of logs) {
        const { nonce, outcomeHandle } = log.args as { nonce: bigint; outcomeHandle: Hex };
        // The engine emits the post-settlement mandate nonce; CorridorTransfer emits
        // the client nonce submitted by the sender.
        const transferNonce = nonce > 0n ? nonce - 1n : nonce;
        await handleSettlement(transferNonce, outcomeHandle);
      }
    },
  });

  console.log(
    `[offramp] listening — engine=${cfg.chain.engineAddress} corridor=${cfg.chain.corridorAddress} provider=${deps.provider.name}`,
  );
}

function logOutcome(nonce: bigint, provider: string, out: PayoutOutcome): void {
  switch (out.kind) {
    case "paid":
      return console.log(
        `[offramp] nonce=${nonce} PAID ${out.amount} ${out.currency} via ${provider} id=${out.providerId} status=${out.status}`,
      );
    case "nullified":
      return console.log(`[offramp] nonce=${nonce} nullified (moved=0) — no payout`);
    case "no-beneficiary":
      return console.warn(
        `[offramp] nonce=${nonce} no fiat beneficiary mapped for ${out.recipient} — skipping`,
      );
  }
}

/**
 * Map a decrypted `moved` (confidential-token base units) to a local-currency amount.
 * Placeholder 1:1 for the sandbox demo — wire the real FX rate + token decimals here.
 */
function mapToLocalAmount(moved: bigint, _currency: string): string {
  return moved.toString();
}
