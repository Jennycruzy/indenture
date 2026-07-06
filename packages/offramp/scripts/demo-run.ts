/**
 * Demo runner — send a batch of corridor transfers that never stalls at the drawdown floor.
 *
 * PRIVACY INVARIANT: the auto-fund cadence and amount depend ONLY on the public transfer counter,
 * never on the sealed custody / high-water mark / outcome. The runner never reads or decrypts any
 * sealed value. So the on-chain `Funded` footprint is a fixed public schedule — one top-up per
 * transfer, of a constant (sealed) amount — and is uncorrelated with how many transfers actually
 * cleared. It reveals nothing beyond the already-public transfer count. (Keying a top-up off the
 * sealed custody level is what would leak cleared-volume; this deliberately does not.)
 *
 * WHY IT NEVER STALLS: two sealed rules can block a repeated single-sender run — the drawdown floor
 * (custody must stay >= drawdownPct% of the high-water mark) and the per-sender velocity ceiling.
 * The floor is handled by the autoFund above (every cleared transfer removes at most `amount` and we
 * pre-fund exactly `amount` before each, so custody is net non-decreasing). The velocity ceiling is
 * per sender, and one sender would exhaust it, so at setup the operator sets a generous ceiling once.
 * Both are fixed, data-independent setup/schedule values — neither reads a sealed value — so they add
 * no leak. (A real corridor keeps a tight ceiling and relies on distinct senders each having their
 * own window; this single-key demo trades that for repeatability.)
 *
 * Usage: pnpm --filter @cloistra/offramp exec tsx scripts/demo-run.ts <count> [amount]
 * Env:   DEPLOYER_PRIVATE_KEY (operator, also the sender here) plus the chain vars from loadConfig.
 */
import { bytesToHex, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { loadConfig } from "../src/config.js";
import { makeWriter, confirm } from "./lib/writer.js";
import { engineAbi, corridorAbi, tokenAbi } from "./lib/abi.js";
import { requireKey, requireAmount } from "./lib/args.js";

const RECIPIENT = "0x0000000000000000000000000000000000000001" as Address; // screened-in test beneficiary
const OPERATOR_WINDOW_SECONDS = 24 * 60 * 60;
const DEMO_CEILING = 1_000_000n; // generous per-sender velocity ceiling so a single sender never binds
// FHE-touching txs are modest on Sepolia; cap below the block limit (see fund-custody.ts).
const MINT_GAS = 1_500_000n;
const FHE_GAS = 3_000_000n;

async function main() {
  const count = Number(requireAmount(process.argv[2], "demo-run.ts <count> [amount]"));
  const amount = process.argv[3]
    ? requireAmount(process.argv[3], "demo-run.ts <count> [amount]")
    : 100n;

  const cfg = loadConfig();
  const w = makeWriter(requireKey("DEPLOYER_PRIVATE_KEY"), cfg.chain.rpcUrl);
  const { account, publicClient, walletClient } = w;
  const operator = account.address;
  const { engineAddress: engine, corridorAddress: corridor } = cfg.chain;

  try {
    const mandateId = (await publicClient.readContract({
      address: corridor,
      abi: corridorAbi,
      functionName: "mandateId",
    })) as Hex;
    const token = (await publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: "mandateToken",
      args: [mandateId],
    })) as Address;

    // One-time setup: mint enough custody token to cover one `amount` top-up per transfer, and
    // authorize the engine to pull it. Both are independent of any transfer outcome.
    console.log(`[setup] mint ${amount * BigInt(count)} + authorize engine…`);
    await confirm(
      publicClient,
      "mint",
      await walletClient.writeContract({
        account,
        chain: sepolia,
        address: token,
        abi: tokenAbi,
        functionName: "mint",
        args: [operator, amount * BigInt(count)],
        gas: MINT_GAS,
      }),
    );
    const until = Math.floor(Date.now() / 1000) + OPERATOR_WINDOW_SECONDS;
    await confirm(
      publicClient,
      "setOperator",
      await walletClient.writeContract({
        account,
        chain: sepolia,
        address: token,
        abi: tokenAbi,
        functionName: "setOperator",
        args: [engine, until],
      }),
    );

    // Set a generous per-sender velocity ceiling once so a single-key demo never binds on velocity.
    // A fixed setup value — independent of any sealed state — so it adds no leak.
    console.log(`[setup] setCeiling ${DEMO_CEILING}…`);
    const cEnc = await w.relayer.encrypt({
      values: [{ value: DEMO_CEILING, type: "euint64" }],
      contractAddress: corridor,
      userAddress: operator,
    });
    await confirm(
      publicClient,
      "setCeiling",
      await walletClient.writeContract({
        account,
        chain: sepolia,
        address: corridor,
        abi: corridorAbi,
        functionName: "setCeiling",
        args: [bytesToHex(cEnc.handles[0]!), bytesToHex(cEnc.inputProof)],
        gas: FHE_GAS,
      }),
    );

    const blocks: bigint[] = [];
    for (let i = 0; i < count; i++) {
      // autoFund on the fixed public schedule (one `amount` per transfer) — no sealed read.
      console.log(`[${i + 1}/${count}] autoFund ${amount}…`);
      const fEnc = await w.relayer.encrypt({
        values: [{ value: amount, type: "euint64" }],
        contractAddress: engine,
        userAddress: operator,
      });
      await confirm(
        publicClient,
        "fund",
        await walletClient.writeContract({
          account,
          chain: sepolia,
          address: engine,
          abi: engineAbi,
          functionName: "fund",
          args: [mandateId, bytesToHex(fEnc.handles[0]!), bytesToHex(fEnc.inputProof)],
          gas: FHE_GAS,
        }),
      );

      const nonce = (await publicClient.readContract({
        address: engine,
        abi: engineAbi,
        functionName: "mandateNonce",
        args: [mandateId],
      })) as bigint;
      console.log(`[${i + 1}/${count}] transfer ${amount} @ nonce ${nonce}…`);
      const tEnc = await w.relayer.encrypt({
        values: [{ value: amount, type: "euint64" }],
        contractAddress: corridor,
        userAddress: operator,
      });
      const receipt = await confirm(
        publicClient,
        "transfer",
        await walletClient.writeContract({
          account,
          chain: sepolia,
          address: corridor,
          abi: corridorAbi,
          functionName: "transfer",
          args: [nonce, RECIPIENT, bytesToHex(tEnc.handles[0]!), bytesToHex(tEnc.inputProof)],
          gas: FHE_GAS,
        }),
      );
      blocks.push(receipt.blockNumber);
    }

    console.log(`\nsent ${count} transfers, settled in blocks: ${blocks.join(", ")}`);
    console.log("process each settlement with: scripts/process-corridor-block.ts <block>");
  } finally {
    w.dispose();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
