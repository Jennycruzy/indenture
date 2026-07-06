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
> = {
  [SEPOLIA_CHAIN_ID]: {
    engine: "0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee",
    token: "0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2",
    feed: "0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6",
    corridor: "0xD77489caCa9C6549CCeD4A500B46019BE2d225c4",
  },
};

/** Block the fresh CLOISTRA engine was deployed at — a floor for event queries. */
export const ENGINE_DEPLOY_BLOCK = BigInt(process.env.NEXT_PUBLIC_CLOISTRA_DEPLOY_BLOCK ?? "11217667");

/**
 * The CLOISTRA Corridor is deployed per mandate. `NEXT_PUBLIC_CORRIDOR_ADDRESS`
 * can override the checked-in Sepolia corridor for alternate deployments.
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
