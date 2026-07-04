import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
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
 * Real relayer user-decryption as the compliance officer (@zama-fhe/sdk v3, Sepolia).
 *
 * Wiring note (verify-never-assume; VERIFICATION.md §5b/§6e): the exact createInstance /
 * userDecrypt method signatures are pinned to @zama-fhe/sdk v3 — the same core the frontend's
 * `useUserDecrypt` wraps. Confirm them against the installed package before the first Sepolia
 * run. This class isolates that single call, so enabling it is a one-file change (Gate C2).
 */
export class ZamaOfficerDecryptor implements OfficerDecryptor {
  constructor(private readonly cfg: Config) {}

  async decryptMoved(handle: Hex, contractAddress: Address): Promise<bigint> {
    const officer = privateKeyToAccount(this.cfg.officer.privateKey);

    // The real relayer user-decryption flow, to enable in one place (Gate C2):
    //   1. const instance = await createInstance(SepoliaConfig)                 // @zama-fhe/sdk
    //   2. const { publicKey, privateKey } = instance.generateKeypair()
    //   3. const eip712 = instance.createEIP712(publicKey, [contractAddress], start, durationDays)
    //   4. const signature = await officer.signTypedData(eip712)                // proves officer identity
    //   5. const res = await instance.userDecrypt(
    //          [{ handle, contractAddress }], privateKey, publicKey, signature,
    //          [contractAddress], officer.address, start, durationDays)
    //   6. return BigInt(res[handle])
    throw new Error(
      "ZamaOfficerDecryptor not wired: confirm @zama-fhe/sdk v3 userDecrypt signature and enable (Gate C2). " +
        `officer=${officer.address} handle=${handle} contract=${contractAddress}`,
    );
  }
}
