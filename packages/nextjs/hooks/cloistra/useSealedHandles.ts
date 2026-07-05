"use client";

import type { Address, Hex } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { cloistraAbi } from "~~/contracts/cloistra/Cloistra";
import { corridorAbi } from "~~/contracts/cloistra/Corridor";
import { useCorridor } from "~~/hooks/cloistra/useCorridor";

export type SealedHandles = {
  /** Rule 3 — the sealed velocity ceiling (handle lives under the corridor's ACL). */
  ceiling?: Hex;
  /** The connected/queried sender's sealed in-window running total (corridor ACL). */
  spent?: Hex;
  /** Rules 1 + engine limits — perTradeCap / totalCap / drawdownPct (engine ACL). */
  perTradeCap?: Hex;
  totalCap?: Hex;
  drawdownPct?: Hex;
  corridor?: Address;
  engine?: Address;
};

/**
 * Reads every sealed policy handle for the active corridor. These are public on-chain
 * refs — meaningful ONLY to whoever holds ACL decrypt rights (the compliance officer).
 * The views render them as shimmering glyph-strings; exposing a handle is not a leak.
 */
export function useSealedHandles(sender?: Address): SealedHandles {
  const { address: corridor, engine, mandateId } = useCorridor();

  const ceilingRead = useReadContract({
    address: corridor,
    abi: corridorAbi,
    functionName: "sealedCeiling",
    query: { enabled: Boolean(corridor) },
  });

  const spentRead = useReadContract({
    address: corridor,
    abi: corridorAbi,
    functionName: "sealedSpent",
    args: sender ? [sender] : undefined,
    query: { enabled: Boolean(corridor && sender) },
  });

  const limitsRead = useReadContracts({
    allowFailure: true,
    contracts:
      engine && mandateId
        ? [{ address: engine, abi: cloistraAbi, functionName: "sealedLimits", args: [mandateId] } as const]
        : [],
    query: { enabled: Boolean(engine && mandateId) },
  });

  const limits = limitsRead.data?.[0]?.result as readonly [Hex, Hex, Hex] | undefined;

  return {
    ceiling: ceilingRead.data as Hex | undefined,
    spent: spentRead.data as Hex | undefined,
    perTradeCap: limits?.[0],
    totalCap: limits?.[1],
    drawdownPct: limits?.[2],
    corridor,
    engine,
  };
}
