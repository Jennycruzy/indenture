// AUTO-GENERATED from packages/foundry/out — do not edit by hand.
// Regenerate after a contract change: see scratchpad/gen-abis.mjs.
import type { Address } from "viem";

/** INDENTURE backbone — live on Sepolia (chainId 11155111). See DEPLOYMENTS.md. */
export const SEPOLIA_CHAIN_ID = 11155111 as const;

export const INDENTURE_ADDRESSES: Record<
  number,
  {
    engine: Address;
    token: Address;
    feed: Address;
  }
> = {
  [SEPOLIA_CHAIN_ID]: {
    engine: "0x58eba10730Fd1ee4E5b24AaAa7caE154cbC69C83",
    token: "0x366544F805e10e7320779d138Cca57FA0E4c5cdf",
    feed: "0x83Ee9a4d2A3f0851DDD022A114663524694571C4",
  },
};

/** Block the engine was deployed at — a floor for event queries. */
export const ENGINE_DEPLOY_BLOCK = 11179602n;

/**
 * The VEIL Corridor is deployed per-mandate (Phase C). Because the engine on
 * Sepolia predates the `commitMandateFor` / `settleCorridor` additions, the
 * live corridor address is filled in AFTER the updated engine + a Corridor are
 * redeployed. Until then this stays undefined and the UI reads the operator's
 * locally-deployed corridor from `NEXT_PUBLIC_CORRIDOR_ADDRESS` or the in-app
 * corridor picker. No address is ever hardcoded to fake a deployment.
 */
export const CORRIDOR_ADDRESSES: Record<number, Address | undefined> = {
  [SEPOLIA_CHAIN_ID]: (process.env.NEXT_PUBLIC_CORRIDOR_ADDRESS as Address | undefined) ?? undefined,
};

export function indentureFor(chainId: number | undefined) {
  if (chainId === undefined) return undefined;
  return INDENTURE_ADDRESSES[chainId];
}

export function corridorAddressFor(chainId: number | undefined): Address | undefined {
  if (chainId === undefined) return undefined;
  return CORRIDOR_ADDRESSES[chainId];
}
