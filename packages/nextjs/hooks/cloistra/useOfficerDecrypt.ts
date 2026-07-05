"use client";

import { useCallback, useMemo, useState } from "react";
import { useAllow, useIsAllowed, useUserDecrypt } from "@zama-fhe/react-sdk";
import { ZERO_HANDLE } from "@zama-fhe/sdk";
import type { Address, Hex } from "viem";

export type AuditTarget = {
  /** A short label for the sealed value being audited (e.g. "Velocity ceiling"). */
  label: string;
  /** The ciphertext handle to decrypt. */
  handle: Hex;
  /** The contract whose ACL granted the officer decrypt rights on this handle
   *  (the corridor for the ceiling / per-sender total, the engine for mandate limits). */
  contractAddress: Address;
};

/**
 * The lawful-audit path. The compliance officer authorises once (FHE keypair + EIP-712
 * session), then user-decrypts the selected sealed handles. Every value here was granted
 * to the officer ONLY via ACL in the contracts — a sender or operator running this same
 * hook gets a visible "not allowed" rather than a cleartext value (the blind-over-policy
 * guarantee). No value is ever hardcoded; each is a real relayer user-decryption.
 */
export function useOfficerDecrypt(targets: AuditTarget[]) {
  const [revealed, setRevealed] = useState(false);

  const liveTargets = useMemo(() => targets.filter(t => t.handle && t.handle !== ZERO_HANDLE), [targets]);

  const contractAddresses = useMemo(
    () => Array.from(new Set(liveTargets.map(t => t.contractAddress))) as Address[],
    [liveTargets],
  );

  const handles = useMemo(
    () => liveTargets.map(t => ({ handle: t.handle as `0x${string}`, contractAddress: t.contractAddress })),
    [liveTargets],
  );

  const { mutate: allow, isPending: isAuthorizing } = useAllow();
  // useIsAllowed types its config as a non-empty tuple; the reveal path is gated by
  // `hasTargets`, so an empty set never actually decrypts.
  const { data: isAllowed } = useIsAllowed({ contractAddresses: contractAddresses as [Address, ...Address[]] });

  const decrypt = useUserDecrypt({ handles }, { enabled: revealed && Boolean(isAllowed) && handles.length > 0 });

  const reveal = useCallback(() => {
    setRevealed(true);
    if (!isAllowed && contractAddresses.length > 0) allow(contractAddresses);
  }, [isAllowed, contractAddresses, allow]);

  const conceal = useCallback(() => setRevealed(false), []);

  /** handle → cleartext value (undefined until resolved). euint64 → bigint, ebool → boolean. */
  const values = useMemo(() => {
    const out: Record<string, bigint | boolean | undefined> = {};
    for (const t of liveTargets)
      out[t.handle] = decrypt.data?.[t.handle as `0x${string}`] as bigint | boolean | undefined;
    return out;
  }, [liveTargets, decrypt.data]);

  return {
    reveal,
    conceal,
    revealed,
    isAuthorizing,
    isDecrypting: decrypt.isFetching,
    isAllowed: Boolean(isAllowed),
    error: decrypt.error?.message,
    values,
    hasTargets: liveTargets.length > 0,
  };
}
