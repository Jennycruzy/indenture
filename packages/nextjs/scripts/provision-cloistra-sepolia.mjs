import { SepoliaConfig } from "@zama-fhe/sdk/node";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  parseAbi,
  parseEther,
  toHex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const ROOT = resolve(process.cwd(), "../..");
const CHAIN_ID = 11155111;
const FHE_GAS = 15_000_000n;

const ENGINE = "0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee";
const TOKEN = "0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2";
const CORRIDOR = "0xD77489caCa9C6549CCeD4A500B46019BE2d225c4";
const MANDATE_ID = "0x4ab98a4eba409938ffa21845d4f1c7c6f2c5cc1237c82f6088bfb25858e89d0d";

const DEFAULTS = {
  perTradeCap: 100n,
  totalCap: 100_000n,
  drawdownPct: 80n,
  custody: 10_000n,
  velocityCeiling: 1_000_000n,
  senderTransfer: 80n,
  senderEth: parseEther("0.005"),
  recipient: "0x0000000000000000000000000000000000000001",
};

const cloistraAbi = parseAbi([
  "function commitMandateFor(bytes32 id,address agent,address token,address complianceOfficer,bytes32 perTradeCapExt,bytes perTradeProof,bytes32 totalCapExt,bytes totalProof,bytes32 drawdownPctExt,bytes drawdownProof)",
  "function fund(bytes32 id,bytes32 amountExt,bytes inputProof)",
  "function setPayeeAllowed(bytes32 id,address payee,bytes32 allowedExt,bytes inputProof)",
  "function mandatePrincipal(bytes32 id) view returns (address)",
  "function mandateToken(bytes32 id) view returns (address)",
  "function mandateNonce(bytes32 id) view returns (uint256)",
]);

const corridorAbi = parseAbi([
  "function ceilingSet() view returns (bool)",
  "function setCeiling(bytes32 ceilingExt,bytes inputProof)",
  "function transfer(uint256 clientNonce,address recipient,bytes32 amountExt,bytes inputProof) returns (bytes32)",
]);

const tokenAbi = parseAbi([
  "function mint(address to,uint64 amount) returns (bytes32)",
  "function setOperator(address operator,uint48 until)",
]);

function loadEnv(path) {
  const out = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed
      .slice(idx + 1)
      .replace(/\s+#.*$/, "")
      .trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function hexValue(value) {
  return typeof value === "string" ? value : bytesToHex(value);
}

async function createFheInstance(rpcUrl) {
  const sdkPackagePath = fileURLToPath(import.meta.resolve("@zama-fhe/sdk/package.json"));
  const packageNodeModules = resolve(dirname(sdkPackagePath), "../..");
  const relayerPath = resolve(packageNodeModules, "@zama-fhe/relayer-sdk/lib/node.js");
  const { createInstance } = await import(pathToFileURL(relayerPath).href);

  return createInstance({ ...SepoliaConfig, network: rpcUrl, batchRpcCalls: false });
}

async function encryptValue(fhe, { value, type, contractAddress, userAddress }) {
  const input = fhe.createEncryptedInput(contractAddress, userAddress);
  switch (type) {
    case "ebool":
      input.addBool(Boolean(value));
      break;
    case "euint64":
      input.add64(value);
      break;
    default:
      throw new Error(`Unsupported FHE type in provisioning script: ${type}`);
  }
  return input.encrypt();
}

async function send(publicClient, walletClient, label, request) {
  const estimatedGas = await publicClient
    .estimateContractGas({ ...request, account: walletClient.account.address })
    .catch(() => request.gas);
  const gas = estimatedGas ? (estimatedGas * 13n) / 10n : request.gas;
  const hash = await walletClient.writeContract({ ...request, gas });
  console.log(`${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  return receipt;
}

async function main() {
  const rootEnv = loadEnv(resolve(ROOT, ".env.local"));
  const offEnv = loadEnv(resolve(ROOT, "packages/offramp/.env.local"));
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? rootEnv.SEPOLIA_RPC_URL ?? offEnv.SEPOLIA_RPC_URL;
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? rootEnv.DEPLOYER_PRIVATE_KEY;
  const officerKey = process.env.OFFICER_PRIVATE_KEY ?? offEnv.OFFICER_PRIVATE_KEY;
  const recipient = getAddress(process.env.CLOISTRA_RECIPIENT ?? DEFAULTS.recipient);
  const transferOnly = process.env.CLOISTRA_TRANSFER_ONLY === "1";
  const senderTransfer = BigInt(process.env.CLOISTRA_TRANSFER_AMOUNT ?? DEFAULTS.senderTransfer);

  if (!rpcUrl) throw new Error("Missing SEPOLIA_RPC_URL");
  if (!deployerKey) throw new Error("Missing DEPLOYER_PRIVATE_KEY");
  if (!officerKey) throw new Error("Missing OFFICER_PRIVATE_KEY");

  const operator = privateKeyToAccount(deployerKey);
  const officer = privateKeyToAccount(officerKey);
  const senderKey = process.env.SENDER_PRIVATE_KEY ?? generatePrivateKey();
  const sender = privateKeyToAccount(senderKey);

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const operatorClient = createWalletClient({ account: operator, chain: sepolia, transport: http(rpcUrl) });
  const senderClient = createWalletClient({ account: sender, chain: sepolia, transport: http(rpcUrl) });
  const fhe = await createFheInstance(rpcUrl);

  try {
    console.log(`operator: ${operator.address}`);
    console.log(`officer:  ${officer.address}`);
    console.log(`sender:   ${sender.address}${process.env.SENDER_PRIVATE_KEY ? "" : " (ephemeral)"}`);
    console.log(`recipient:${recipient}`);
    console.log(`operator balance: ${formatEther(await publicClient.getBalance({ address: operator.address }))} ETH`);

    if (transferOnly) {
      console.log("transfer-only mode: using existing provisioned corridor");
    } else {
      const principal = await publicClient
        .readContract({ address: ENGINE, abi: cloistraAbi, functionName: "mandatePrincipal", args: [MANDATE_ID] })
        .catch(() => undefined);

      if (!principal || principal === "0x0000000000000000000000000000000000000000") {
        console.log("encrypting mandate limits...");
        const perTrade = await encryptValue(fhe, {
          value: DEFAULTS.perTradeCap,
          type: "euint64",
          contractAddress: ENGINE,
          userAddress: operator.address,
        });
        const total = await encryptValue(fhe, {
          value: DEFAULTS.totalCap,
          type: "euint64",
          contractAddress: ENGINE,
          userAddress: operator.address,
        });
        const drawdown = await encryptValue(fhe, {
          value: DEFAULTS.drawdownPct,
          type: "euint64",
          contractAddress: ENGINE,
          userAddress: operator.address,
        });
        await send(publicClient, operatorClient, "commit mandate", {
          address: ENGINE,
          abi: cloistraAbi,
          functionName: "commitMandateFor",
          args: [
            MANDATE_ID,
            CORRIDOR,
            TOKEN,
            officer.address,
            hexValue(perTrade.handles[0]),
            hexValue(perTrade.inputProof),
            hexValue(total.handles[0]),
            hexValue(total.inputProof),
            hexValue(drawdown.handles[0]),
            hexValue(drawdown.inputProof),
          ],
          gas: FHE_GAS,
        });
      } else {
        console.log(`mandate already committed by ${principal}`);
      }

      await send(publicClient, operatorClient, "mint demo custody token", {
        address: TOKEN,
        abi: tokenAbi,
        functionName: "mint",
        args: [operator.address, DEFAULTS.custody],
      });
      const until = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
      await send(publicClient, operatorClient, "authorize engine as token operator", {
        address: TOKEN,
        abi: tokenAbi,
        functionName: "setOperator",
        args: [ENGINE, until],
      });
      const custody = await encryptValue(fhe, {
        value: DEFAULTS.custody,
        type: "euint64",
        contractAddress: ENGINE,
        userAddress: operator.address,
      });
      await send(publicClient, operatorClient, "fund sealed custody", {
        address: ENGINE,
        abi: cloistraAbi,
        functionName: "fund",
        args: [MANDATE_ID, hexValue(custody.handles[0]), hexValue(custody.inputProof)],
        gas: FHE_GAS,
      });

      const allowed = await encryptValue(fhe, {
        value: true,
        type: "ebool",
        contractAddress: ENGINE,
        userAddress: operator.address,
      });
      await send(publicClient, operatorClient, "allow recipient", {
        address: ENGINE,
        abi: cloistraAbi,
        functionName: "setPayeeAllowed",
        args: [MANDATE_ID, recipient, hexValue(allowed.handles[0]), hexValue(allowed.inputProof)],
        gas: FHE_GAS,
      });

      const ceilingSet = await publicClient.readContract({
        address: CORRIDOR,
        abi: corridorAbi,
        functionName: "ceilingSet",
      });
      if (!ceilingSet) {
        const ceiling = await encryptValue(fhe, {
          value: DEFAULTS.velocityCeiling,
          type: "euint64",
          contractAddress: CORRIDOR,
          userAddress: operator.address,
        });
        await send(publicClient, operatorClient, "set velocity ceiling", {
          address: CORRIDOR,
          abi: corridorAbi,
          functionName: "setCeiling",
          args: [hexValue(ceiling.handles[0]), hexValue(ceiling.inputProof)],
          gas: FHE_GAS,
        });
      } else {
        console.log("velocity ceiling already set");
      }
    }

    const senderBalance = await publicClient.getBalance({ address: sender.address });
    if (senderBalance < parseEther("0.001")) {
      const hash = await operatorClient.sendTransaction({ to: sender.address, value: DEFAULTS.senderEth });
      console.log(`fund sender gas: ${hash}`);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`fund sender reverted: ${hash}`);
    }

    const nonce = await publicClient.readContract({
      address: ENGINE,
      abi: cloistraAbi,
      functionName: "mandateNonce",
      args: [MANDATE_ID],
    });
    const transfer = await encryptValue(fhe, {
      value: senderTransfer,
      type: "euint64",
      contractAddress: CORRIDOR,
      userAddress: sender.address,
    });
    await send(publicClient, senderClient, "sender transfer", {
      address: CORRIDOR,
      abi: corridorAbi,
      functionName: "transfer",
      args: [nonce, recipient, hexValue(transfer.handles[0]), hexValue(transfer.inputProof)],
      gas: FHE_GAS,
    });

    console.log("provisioning complete");
    console.log(`sender_address=${sender.address}`);
  } finally {
    fhe.destroy?.();
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
