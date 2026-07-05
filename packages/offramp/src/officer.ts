import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { MemoryStorage, SepoliaConfig, ZamaSDK } from "@zama-fhe/sdk";
import { RelayerNode } from "@zama-fhe/sdk/node";
import { ViemSigner } from "@zama-fhe/sdk/viem";
import type { Config } from "./config.js";

/**
 * The compliance-officer decrypt seam. Given the engine's sealed `moved` outcome
 * handle, return the cleartext amount. Only the officer identity holds the ACL grant
 * over this handle (blind-over-policy: the sender/operator get "not allowed").
 *
 * The real implementation performs a genuine relayer user-decryption (EIP-712,
 * @zama-fhe/sdk on Sepolia) — it is NEVER a plaintext lookup. The listener's gate
 * depends only on this interface, so it is fully testable with an injected fake.
 */
export interface OfficerDecryptor {
  /** Decrypt one euint64 handle granted to the officer; returns its cleartext value. */
  decryptMoved(handle: Hex, contractAddress: Address): Promise<bigint>;
}

/**
 * Real relayer user-decryption as the compliance officer (`@zama-fhe/sdk` v3, Sepolia).
 *
 * Uses the Node worker-thread relayer (`RelayerNode`) + a viem-backed signer (`ViemSigner`)
 * driven by the officer key — the SAME core the frontend's `useAllow` / `useUserDecrypt` wrap.
 * The flow: `sdk.allow([contract])` performs the one-time EIP-712 authorization (signed
 * non-interactively by the officer key, cached in storage), then `sdk.userDecrypt([...])`
 * does the threshold user-decryption. The contract ACL-grants `moved` to the officer ONLY,
 * so a sender/operator running this would be rejected — this is genuine, not a plaintext read.
 */
export class ZamaOfficerDecryptor implements OfficerDecryptor {
  private sdk: ZamaSDK | null = null;
  private readonly allowed = new Set<string>();

  constructor(private readonly cfg: Config) {}

  /** Lazily build the SDK once (worker pool + WASM load are deferred to the first decrypt). */
  private ensureSdk(): ZamaSDK {
    if (this.sdk) return this.sdk;

    const account = privateKeyToAccount(this.cfg.officer.privateKey);
    const transport = http(this.cfg.chain.rpcUrl);
    const publicClient = createPublicClient({ chain: sepolia, transport });
    const walletClient = createWalletClient({ account, chain: sepolia, transport });

    const relayer = new RelayerNode({
      transports: { [SepoliaConfig.chainId]: SepoliaConfig },
      getChainId: async () => SepoliaConfig.chainId,
      poolSize: 1, // one decrypt worker — each loads the full FHE WASM (~50–100 MB)
    });
    const signer = new ViemSigner({ walletClient, publicClient });

    this.sdk = new ZamaSDK({ relayer, signer, storage: new MemoryStorage() });
    return this.sdk;
  }

  async decryptMoved(handle: Hex, contractAddress: Address): Promise<bigint> {
    const sdk = this.ensureSdk();

    // One-time EIP-712 authorization per contract (cached); the officer key signs non-interactively.
    const key = contractAddress.toLowerCase();
    if (!this.allowed.has(key)) {
      await sdk.allow([contractAddress]);
      this.allowed.add(key);
    }

    const values = await sdk.userDecrypt([{ handle, contractAddress }]);
    const moved = values[handle];
    if (typeof moved !== "bigint") {
      throw new Error(
        `officer decrypt returned a non-numeric value for ${handle}: ${String(moved)}`,
      );
    }
    return moved;
  }
}
