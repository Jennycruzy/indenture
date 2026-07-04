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

  client.watchEvent({
    address: cfg.chain.corridorAddress,
    event: CORRIDOR_TRANSFER,
    onLogs: logs => {
      for (const log of logs) {
        const { sender, recipient, nonce } = log.args as {
          sender: Address;
          recipient: Address;
          nonce: bigint;
        };
        partiesByNonce.set(nonce.toString(), { sender, recipient });
      }
    },
  });

  client.watchEvent({
    address: cfg.chain.engineAddress,
    event: SETTLED,
    onLogs: async logs => {
      for (const log of logs) {
        const { nonce, outcomeHandle } = log.args as { nonce: bigint; outcomeHandle: Hex };
        try {
          await handleSettled(deps, nonce, outcomeHandle, partiesByNonce);
        } catch (err) {
          console.error(`[offramp] settle nonce=${nonce} failed:`, (err as Error).message);
        }
      }
    },
  });

  console.log(
    `[offramp] listening — engine=${cfg.chain.engineAddress} corridor=${cfg.chain.corridorAddress} provider=${deps.provider.name}`,
  );
}

async function handleSettled(
  deps: ListenerDeps,
  nonce: bigint,
  outcomeHandle: Hex,
  partiesByNonce: Map<string, { sender: Address; recipient: Address }>,
): Promise<void> {
  const { cfg, decryptor, provider, beneficiaries } = deps;

  // 1. Officer-decrypt the sealed outcome. moved ∈ {0, amount}.
  const moved = await decryptor.decryptMoved(outcomeHandle, cfg.chain.engineAddress);

  // 2. THE GATE — a transfer nullified by ANY rule has moved == 0 → no fiat leg.
  if (moved <= 0n) {
    console.log(`[offramp] nonce=${nonce} nullified (moved=0) — no payout`);
    return;
  }

  // 3. Resolve the fiat beneficiary for the on-chain recipient.
  const parties = partiesByNonce.get(nonce.toString());
  if (!parties) {
    console.warn(`[offramp] nonce=${nonce} cleared but no CorridorTransfer seen yet — deferring`);
    return;
  }
  const beneficiary = await beneficiaries.resolve(parties.recipient);
  if (!beneficiary) {
    console.warn(`[offramp] nonce=${nonce} no fiat beneficiary mapped for ${parties.recipient} — skipping`);
    return;
  }

  // 4. Pay out (idempotent on nonce). `moved` is in confidential-token base units — map to
  //    local-currency units here (FX + decimals) per the corridor's settlement contract.
  const amount = mapToLocalAmount(moved, beneficiary.currency);
  const reference = `veil-${cfg.chain.corridorAddress}-${nonce}`;
  const result = await provider.payout({
    reference,
    amount,
    beneficiary,
    narration: `VEIL corridor clear nonce ${nonce}`,
  });
  console.log(
    `[offramp] nonce=${nonce} PAID ${amount} ${beneficiary.currency} via ${provider.name} id=${result.providerId} status=${result.status}`,
  );
}

/**
 * Map a decrypted `moved` (confidential-token base units) to a local-currency amount.
 * Placeholder 1:1 for the sandbox demo — wire the real FX rate + token decimals here.
 */
function mapToLocalAmount(moved: bigint, _currency: string): string {
  return moved.toString();
}
