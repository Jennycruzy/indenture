"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import { cloistraAbi } from "~~/contracts/cloistra/Cloistra";
import { corridorAbi } from "~~/contracts/cloistra/Corridor";
import { corridorAddressFor } from "~~/contracts/cloistra/addresses";
import { useCloistraStore } from "~~/hooks/cloistra/store";

export type CorridorRole = "operator" | "officer" | "sender" | "disconnected";

export type CorridorInfo = {
  /** The active corridor address (from the in-app picker, else NEXT_PUBLIC_CORRIDOR_ADDRESS). */
  address?: Address;
  configured: boolean;
  engine?: Address;
  operator?: Address;
  complianceOfficer?: Address;
  mandateId?: Hex;
  /** Rolling window length in seconds (public — block time is not secret). */
  window?: bigint;
  /** Whether the operator has committed the sealed velocity ceiling yet. */
  ceilingSet: boolean;
  /** The current mandate nonce (public monotonic; a sender must submit against it). */
  nonce?: bigint;
  /** The connected wallet's role in this corridor. */
  role: CorridorRole;
  isLoading: boolean;
  refetch: () => void;
};

/**
 * Resolves the active CLOISTRA corridor entirely from chain. The only thing kept
 * locally is the corridor address; operator / compliance-officer / engine /
 * mandate id / window / nonce are all read on-chain, so no sealed-policy fact
 * is ever cached client-side.
 */
export function useCorridor(): CorridorInfo {
  const chainId = useChainId();
  const { address: account } = useAccount();
  const storeAddress = useCloistraStore(s => s.active?.address);

  const address = (storeAddress ?? corridorAddressFor(chainId)) as Address | undefined;
  const configured = Boolean(address);

  const corridor = address ? ({ address, abi: corridorAbi } as const) : undefined;

  const batch = useReadContracts({
    allowFailure: true,
    contracts: corridor
      ? [
          { ...corridor, functionName: "engine" },
          { ...corridor, functionName: "operator" },
          { ...corridor, functionName: "complianceOfficer" },
          { ...corridor, functionName: "mandateId" },
          { ...corridor, functionName: "window" },
          { ...corridor, functionName: "ceilingSet" },
        ]
      : [],
    query: { enabled: configured },
  });

  const engine = batch.data?.[0]?.result as Address | undefined;
  const operator = batch.data?.[1]?.result as Address | undefined;
  const complianceOfficer = batch.data?.[2]?.result as Address | undefined;
  const mandateId = batch.data?.[3]?.result as Hex | undefined;
  const window = batch.data?.[4]?.result as bigint | undefined;
  const ceilingSet = Boolean(batch.data?.[5]?.result);

  // The mandate nonce lives on the engine, keyed by mandate id — a dependent read.
  const nonceRead = useReadContract({
    address: engine,
    abi: cloistraAbi,
    functionName: "mandateNonce",
    args: mandateId ? [mandateId] : undefined,
    query: { enabled: Boolean(engine && mandateId) },
  });
  const nonce = nonceRead.data as bigint | undefined;

  const role: CorridorRole = useMemo(() => {
    if (!account) return "disconnected";
    const a = account.toLowerCase();
    if (operator && a === operator.toLowerCase()) return "operator";
    if (complianceOfficer && a === complianceOfficer.toLowerCase()) return "officer";
    return "sender";
  }, [account, operator, complianceOfficer]);

  return {
    address,
    configured,
    engine,
    operator,
    complianceOfficer,
    mandateId,
    window,
    ceilingSet,
    nonce,
    role,
    isLoading: batch.isLoading || nonceRead.isLoading,
    refetch: () => {
      batch.refetch();
      nonceRead.refetch();
    },
  };
}
