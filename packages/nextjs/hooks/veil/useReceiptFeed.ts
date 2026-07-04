"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import type { Address, Hex } from "viem";
import { usePublicClient } from "wagmi";
import { ENGINE_DEPLOY_BLOCK } from "~~/contracts/indenture/addresses";

const CORRIDOR_TRANSFER_EVENT = parseAbiItem(
  "event CorridorTransfer(address indexed sender, address indexed recipient, uint256 indexed nonce)",
);
const SETTLED_EVENT = parseAbiItem(
  "event Settled(bytes32 indexed id, uint256 indexed nonce, bytes32 receipt, bytes32 outcomeHandle)",
);

export type CorridorReceipt = {
  sender: Address;
  recipient: Address;
  /** The public clientNonce this transfer was submitted against. */
  nonce: bigint;
  txHash: Hex;
  blockNumber: bigint;
  /** The engine's sealed outcome handle for the resulting settlement (moved amount),
   *  decryptable by the compliance officer only. Present once the Settled log is matched. */
  outcomeHandle?: Hex;
  receipt?: Hex;
};

/**
 * The public receipt ribbon: reads the corridor's CorridorTransfer ordering (sender →
 * recipient at nonce N) and matches each to the engine's Settled log for the sealed
 * outcome handle. Everything here is public *ordering and routing* — no amount, no
 * threshold, no pass/fail bit. The outcome handle is a ciphertext ref, meaningful only
 * to whoever holds ACL decrypt rights (the compliance officer).
 */
export function useReceiptFeed(corridor?: Address, engine?: Address, mandateId?: Hex) {
  const client = usePublicClient();

  return useQuery<CorridorReceipt[]>({
    queryKey: ["veil-receipts", corridor, engine, mandateId],
    enabled: Boolean(client && corridor && engine && mandateId),
    refetchInterval: 12_000,
    queryFn: async () => {
      if (!client || !corridor || !engine || !mandateId) return [];

      const [transferLogs, settledLogs] = await Promise.all([
        client.getLogs({
          address: corridor,
          event: CORRIDOR_TRANSFER_EVENT,
          fromBlock: ENGINE_DEPLOY_BLOCK,
          toBlock: "latest",
        }),
        client.getLogs({
          address: engine,
          event: SETTLED_EVENT,
          args: { id: mandateId },
          fromBlock: ENGINE_DEPLOY_BLOCK,
          toBlock: "latest",
        }),
      ]);

      // Settled.nonce is the POST-increment nonce (clientNonce + 1); a CorridorTransfer
      // submitted at clientNonce N maps to the Settled log with nonce N + 1.
      const settledByPreNonce = new Map<bigint, { outcomeHandle: Hex; receipt: Hex }>();
      for (const log of settledLogs) {
        const n = log.args.nonce;
        if (n === undefined) continue;
        settledByPreNonce.set(n - 1n, {
          outcomeHandle: log.args.outcomeHandle as Hex,
          receipt: log.args.receipt as Hex,
        });
      }

      return transferLogs
        .map(log => {
          const nonce = log.args.nonce ?? 0n;
          const matched = settledByPreNonce.get(nonce);
          return {
            sender: log.args.sender as Address,
            recipient: log.args.recipient as Address,
            nonce,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            outcomeHandle: matched?.outcomeHandle,
            receipt: matched?.receipt,
          } satisfies CorridorReceipt;
        })
        .sort((a, b) => Number(b.nonce - a.nonce));
    },
  });
}
