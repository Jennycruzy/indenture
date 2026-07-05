/**
 * Full-loop prover (off-ramp half, real fiat leg).
 *
 * Drives the SAME `processSettlement` gate the live listener uses, with:
 *   - a `moved` value taken from a REAL on-chain settle (the Corridor harness happy path
 *     clears a transfer of 80 → moved = 80n; see packages/foundry/test/Corridor.t.sol), and
 *   - the REAL Flutterwave v3 sandbox provider + beneficiary from .env.local.
 *
 * The officer-decrypt is stubbed here to the known cleared value because a live KMS decrypt
 * needs a funded-beyond-one-tx Sepolia corridor (Gate C/C2); the gate, provider, idempotency
 * key and payout call are all the production code path. Prints the real provider reference id.
 *
 * Run: pnpm --filter @indenture/offramp exec tsx scripts/prove-loop.ts [movedAmount]
 */
import { loadConfig } from "../src/config.js";
import { FlutterwaveProvider } from "../src/providers/flutterwave.js";
import { loadBeneficiaries } from "../src/beneficiary.js";
import { processSettlement, type ListenerDeps } from "../src/listener.js";
import type { OfficerDecryptor } from "../src/officer.js";
import type { Address, Hex } from "viem";

async function main() {
  const cfg = loadConfig();
  if (!cfg.flutterwave.secretKey.includes("_TEST")) {
    throw new Error("Refusing a non-test Flutterwave key — sandbox-only.");
  }

  // moved = the real cleared amount from the on-chain settle (harness happy path = 80).
  const moved = BigInt(process.argv[2] ?? "80");

  // Stand in for the officer's KMS user-decryption of the sealed `outcomeHandle`.
  const decryptor: OfficerDecryptor = { decryptMoved: async () => moved };

  const provider = new FlutterwaveProvider(cfg.flutterwave);
  const beneficiaries = loadBeneficiaries(cfg.beneficiariesJson);
  const deps: ListenerDeps = { cfg, decryptor, provider, beneficiaries };

  // The recipient is the on-chain address mapped in BENEFICIARIES_JSON.
  const recipient = "0x0000000000000000000000000000000000000001" as Address;
  const settlement = {
    nonce: 1n,
    outcomeHandle: ("0x" + "11".repeat(32)) as Hex,
    sender: "0x0000000000000000000000000000000000000002" as Address,
    recipient,
  };

  console.log(
    `[prove-loop] settle → officer-decrypt moved=${moved} → gate → ${provider.name} payout…`,
  );
  const out = await processSettlement(deps, settlement);
  console.log("[prove-loop] outcome:", JSON.stringify(out, null, 2));
  if (out.kind !== "paid") process.exitCode = 1;
}

main().catch((err) => {
  console.error("[prove-loop] error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
