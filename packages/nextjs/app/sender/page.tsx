"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { CloistraShell } from "~~/components/cloistra/CloistraShell";
import { ConnectGate } from "~~/components/cloistra/ConnectGate";
import { NotConfigured } from "~~/components/cloistra/NotConfigured";
import { ReceiptRibbon } from "~~/components/cloistra/ReceiptRibbon";
import { SealedGate } from "~~/components/cloistra/SealedGate";
import { VelocityMeter } from "~~/components/cloistra/VelocityMeter";
import { useSenderTransfer } from "~~/hooks/cloistra/useCloistraActions";
import { useCorridor } from "~~/hooks/cloistra/useCorridor";
import { useSealedHandles } from "~~/hooks/cloistra/useSealedHandles";

const txLink = (h?: string) => (h ? `https://sepolia.etherscan.io/tx/${h}` : undefined);

export default function SenderPage() {
  const { configured, address: corridor, engine, mandateId, ceilingSet } = useCorridor();
  const { address: account } = useAccount();
  const sealed = useSealedHandles(account);
  const { phase, message, lastTx, canTransfer, submit, reset } = useSenderTransfer();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");

  const amountValid = /^\d+$/.test(amount.trim()) && amount.trim() !== "";
  const recipientValid = /^0x[0-9a-fA-F]{40}$/.test(recipient);

  return (
    <CloistraShell>
      <ConnectGate>
        {!configured ? (
          <NotConfigured />
        ) : (
          <>
            <SealedGate phase={phase} capHandle={sealed.perTradeCap} ceilingHandle={sealed.ceiling} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Submit a transfer */}
              <section className="ob-card p-5 flex flex-col gap-3">
                <h2 className="ob-display font-semibold text-lg" style={{ color: "var(--ob-ink)" }}>
                  Submit a transfer
                </h2>
                <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
                  Your amount is encrypted in the browser and adjudicated against a rulebook you cannot read. If it
                  breaches any sealed rule it is nullified to zero on-chain — and you will never learn which rule caught
                  it.
                </p>

                <label
                  className="ob-mono text-[0.7rem] uppercase tracking-wider"
                  style={{ color: "var(--ob-ink-dim)" }}
                >
                  recipient
                </label>
                <input
                  className="cloistra-input"
                  placeholder="0x… beneficiary"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />

                <label
                  className="ob-mono text-[0.7rem] uppercase tracking-wider"
                  style={{ color: "var(--ob-ink-dim)" }}
                >
                  amount (sealed)
                </label>
                <input
                  className="cloistra-input"
                  placeholder="amount — encrypted before it leaves your browser"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  inputMode="numeric"
                />

                {!ceilingSet && (
                  <div className="ob-mono text-[0.72rem]" style={{ color: "var(--ob-warm-a)" }}>
                    The operator has not sealed the velocity ceiling yet — transfers revert until they do.
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    className="ob-btn ob-btn-warm flex-1"
                    disabled={!canTransfer || !amountValid || !recipientValid}
                    onClick={() => submit(recipient as `0x${string}`, BigInt(amount.trim()))}
                  >
                    {phase === "encrypting"
                      ? "encrypting…"
                      : phase === "adjudicating"
                        ? "adjudicating…"
                        : "send through the gate"}
                  </button>
                  {phase !== "idle" && (
                    <button className="ob-btn" onClick={reset}>
                      new
                    </button>
                  )}
                </div>

                {message && (
                  <div
                    className="ob-mono text-sm mt-1"
                    style={{ color: phase === "error" ? "var(--ob-crimson)" : "var(--ob-ink)" }}
                  >
                    {message}
                    {lastTx && (
                      <>
                        {" "}
                        <a className="ob-seal-text" href={txLink(lastTx)} target="_blank" rel="noreferrer">
                          view tx ↗
                        </a>
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* The sealed velocity meter — you know a ceiling exists, never where */}
              <section className="flex flex-col gap-4">
                <VelocityMeter spentHandle={sealed.spent} ceilingHandle={sealed.ceiling} />
                <div className="ob-card p-4">
                  <p className="text-[0.8rem]" style={{ color: "var(--ob-ink-dim)" }}>
                    Your rolling total is sealed even to you. You know a ceiling exists; you cannot see where it sits or
                    how close you are. That is the point — a line you can&rsquo;t see is a line you can&rsquo;t
                    structure around.
                  </p>
                </div>
              </section>
            </div>

            <ReceiptRibbon corridor={corridor} engine={engine} mandateId={mandateId} />
          </>
        )}
      </ConnectGate>
    </CloistraShell>
  );
}
