import type { Address } from "viem";

/** CLOISTRA backbone target chain. See DEPLOYMENTS.md. */
export const SEPOLIA_CHAIN_ID = 11155111 as const;

export const CLOISTRA_ADDRESSES: Partial<
  Record<
    number,
    {
      engine: Address;
      token: Address;
      feed: Address;
      corridor: Address;
    }
  >
> = {};

/** Block the fresh CLOISTRA engine was deployed at — a floor for event queries. */
export const ENGINE_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_CLOISTRA_DEPLOY_BLOCK ?? "0");

/**
 * The CLOISTRA Corridor is deployed per mandate. `NEXT_PUBLIC_CORRIDOR_ADDRESS`
 * must be set after a fresh Cloistra deployment.
 */
export const CORRIDOR_ADDRESSES: Record<number, Address | undefined> = {
  [SEPOLIA_CHAIN_ID]:
    (process.env.NEXT_PUBLIC_CORRIDOR_ADDRESS as Address | undefined) ?? CLOISTRA_ADDRESSES[SEPOLIA_CHAIN_ID]?.corridor,
};

export function cloistraFor(chainId: number | undefined) {
  if (chainId === undefined) return undefined;
  return CLOISTRA_ADDRESSES[chainId];
}

export function corridorAddressFor(chainId: number | undefined): Address | undefined {
  if (chainId === undefined) return undefined;
  return CORRIDOR_ADDRESSES[chainId];
}
