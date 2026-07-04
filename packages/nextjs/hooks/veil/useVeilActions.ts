"use client";

import { useCallback, useState } from "react";
import { useEncrypt } from "@zama-fhe/react-sdk";
import { bytesToHex } from "viem";
import type { Address, Hex } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { corridorAbi } from "~~/contracts/indenture/Corridor";
import { demoConfidentialTokenAbi } from "~~/contracts/indenture/DemoConfidentialToken";
import { indentureAbi } from "~~/contracts/indenture/Indenture";
import { useCorridor } from "~~/hooks/veil/useCorridor";

// FHE settlement is compute-heavy; cap under Sepolia's per-tx block gas limit (16,777,216).
const FHE_GAS = 15_000_000n;

function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // Surface the human line, not the whole stack.
  return raw.split("\n")[0];
}

/** The sender's gate phases. Note: whether the transfer CLEARED or was NULLIFIED is
 *  sealed on-chain — the sender never learns it here. Only the compliance officer can
 *  decrypt the outcome. So the terminal phase is "sealed", not "cleared"/"dissolved". */
export type GatePhase = "idle" | "encrypting" | "adjudicating" | "sealed" | "error";

export function useSenderTransfer() {
  const { address: corridor, nonce, ceilingSet, refetch } = useCorridor();
  const { address: account } = useAccount();
  const encrypt = useEncrypt();
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<GatePhase>("idle");
  const [message, setMessage] = useState("");
  const [lastTx, setLastTx] = useState<Hex | undefined>();

  const canTransfer = Boolean(
    corridor && account && nonce !== undefined && ceilingSet && phase !== "encrypting" && phase !== "adjudicating",
  );

  const submit = useCallback(
    async (recipient: Address, amount: bigint) => {
      if (!corridor || !account || nonce === undefined) return;
      setLastTx(undefined);
      try {
        setPhase("encrypting");
        setMessage("Encrypting your amount client-side — the browser never holds the FHE key.");
        const enc = await encrypt.mutateAsync({
          values: [{ value: amount, type: "euint64" }],
          contractAddress: corridor,
          userAddress: account,
        });

        setPhase("adjudicating");
        setMessage("Adjudicating against the sealed rulebook on-chain…");
        const tx = await writeContractAsync({
          address: corridor,
          abi: corridorAbi,
          functionName: "transfer",
          args: [nonce, recipient, bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
          gas: FHE_GAS,
        });
        setLastTx(tx);
        setPhase("sealed");
        setMessage(
          "Adjudicated on-chain. The outcome is sealed — even to you. Only the compliance officer can audit it.",
        );
        refetch();
      } catch (e) {
        setPhase("error");
        setMessage(errMsg(e));
      }
    },
    [corridor, account, nonce, encrypt, writeContractAsync, refetch],
  );

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage("");
    setLastTx(undefined);
  }, []);

  return { phase, message, lastTx, canTransfer, submit, reset };
}

export function useOperatorActions() {
  const { address: corridor, engine, mandateId, token: tokenFromChain } = useCorridorToken();
  const { address: account } = useAccount();
  const encrypt = useEncrypt();
  const { writeContractAsync } = useWriteContract();

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [lastTx, setLastTx] = useState<Hex | undefined>();

  const wrap = useCallback(async (label: string, run: () => Promise<Hex | undefined>) => {
    setBusy(true);
    setLastTx(undefined);
    try {
      setMessage(label);
      const tx = await run();
      if (tx) setLastTx(tx);
      return tx;
    } catch (e) {
      setMessage(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  /** Rule 3 — seal the per-sender velocity ceiling. Encrypted bound to (corridor, operator);
   *  the ceiling is decrypt-granted to the compliance officer ONLY. */
  const setCeiling = useCallback(
    (ceiling: bigint) =>
      wrap("Sealing the velocity ceiling — encrypted client-side…", async () => {
        if (!corridor || !account) return;
        const enc = await encrypt.mutateAsync({
          values: [{ value: ceiling, type: "euint64" }],
          contractAddress: corridor,
          userAddress: account,
        });
        const tx = await writeContractAsync({
          address: corridor,
          abi: corridorAbi,
          functionName: "setCeiling",
          args: [bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
          gas: FHE_GAS,
        });
        setMessage("Sealed velocity ceiling committed. Readable only by the compliance officer.");
        return tx;
      }),
    [wrap, corridor, account, encrypt, writeContractAsync],
  );

  /** Rule 2 — rotate a recipient's sealed screening bit (default-deny). Encrypted bound to
   *  (engine, operator); the address is public, whether they pass screening is sealed. */
  const screenRecipient = useCallback(
    (recipient: Address, allowed: boolean) =>
      wrap(allowed ? "Sealing an allow bit for the recipient…" : "Sealing a deny bit…", async () => {
        if (!engine || !mandateId || !account) return;
        const enc = await encrypt.mutateAsync({
          values: [{ value: allowed, type: "ebool" }],
          contractAddress: engine,
          userAddress: account,
        });
        const tx = await writeContractAsync({
          address: engine,
          abi: indentureAbi,
          functionName: "setPayeeAllowed",
          args: [mandateId, recipient, bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
          gas: FHE_GAS,
        });
        setMessage("Recipient screening rotated in ciphertext — the event reveals nothing.");
        return tx;
      }),
    [wrap, engine, mandateId, account, encrypt, writeContractAsync],
  );

  /** Fund the corridor's sealed custody: mint demo iUSD (cleartext) to the operator, authorise the
   *  engine as operator on the token, then pull an ENCRYPTED amount into custody via `fund`. */
  const fundCustody = useCallback(
    (amount: bigint) =>
      wrap("Funding sealed custody…", async () => {
        if (!engine || !mandateId || !account || !tokenFromChain) return;
        await writeContractAsync({
          address: tokenFromChain,
          abi: demoConfidentialTokenAbi,
          functionName: "mint",
          args: [account, amount],
        });
        const until = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // uint48 → number in viem; 24h operator window
        await writeContractAsync({
          address: tokenFromChain,
          abi: demoConfidentialTokenAbi,
          functionName: "setOperator",
          args: [engine, until],
        });
        const enc = await encrypt.mutateAsync({
          values: [{ value: amount, type: "euint64" }],
          contractAddress: engine,
          userAddress: account,
        });
        const tx = await writeContractAsync({
          address: engine,
          abi: indentureAbi,
          functionName: "fund",
          args: [mandateId, bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
          gas: FHE_GAS,
        });
        setMessage("Sealed custody funded. The balance is a ciphertext handle.");
        return tx;
      }),
    [wrap, engine, mandateId, account, tokenFromChain, encrypt, writeContractAsync],
  );

  return { busy, message, lastTx, setCeiling, screenRecipient, fundCustody };
}

/** Small helper: the corridor + its engine + the mandate's custody token, read from chain. */
function useCorridorToken() {
  const info = useCorridor();
  const tokenRead = useReadMandateToken(info.engine, info.mandateId);
  return { ...info, token: tokenRead };
}

function useReadMandateToken(engine?: Address, mandateId?: Hex): Address | undefined {
  const read = useReadContract({
    address: engine,
    abi: indentureAbi,
    functionName: "mandateToken",
    args: mandateId ? [mandateId] : undefined,
    query: { enabled: Boolean(engine && mandateId) },
  });
  return read.data as Address | undefined;
}
