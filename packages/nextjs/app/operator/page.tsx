"use client";

import { useState } from "react";
import { ConnectGate } from "~~/components/veil/ConnectGate";
import { NotConfigured } from "~~/components/veil/NotConfigured";
import { SealedValue } from "~~/components/veil/SealedValue";
import { VeilShell } from "~~/components/veil/VeilShell";
import { useCorridor } from "~~/hooks/veil/useCorridor";
import { useSealedHandles } from "~~/hooks/veil/useSealedHandles";
import { useOperatorActions } from "~~/hooks/veil/useVeilActions";

const txLink = (h?: string) => (h ? `https://sepolia.etherscan.io/tx/${h}` : undefined);

export default function OperatorPage() {
  const { configured, role } = useCorridor();
  const sealed = useSealedHandles();
  const { busy, message, lastTx, setCeiling, screenRecipient, fundCustody } = useOperatorActions();

  const [ceiling, setCeilingInput] = useState("");
  const [fundAmt, setFundAmt] = useState("");
  const [screenAddr, setScreenAddr] = useState("");

  const num = (s: string): bigint | undefined => {
    if (!/^\d+$/.test(s.trim())) return undefined;
    try {
      return BigInt(s.trim());
    } catch {
      return undefined;
    }
  };

  return (
    <VeilShell>
      <ConnectGate>
        {!configured ? (
          <NotConfigured />
        ) : (
          <>
            {role !== "operator" && (
              <div className="ob-card p-4 ob-mono text-[0.78rem]" style={{ color: "var(--ob-warm-a)" }}>
                You are connected as <strong>{role}</strong>, not the operator. You can view the sealed policy as
                glyphs, but rotating it requires the operator wallet — the contract enforces this on-chain, not the UI.
              </div>
            )}

            {/* The sealed policy — the operator sets these, yet can never read them back */}
            <section className="ob-card p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="ob-display font-semibold text-lg" style={{ color: "var(--ob-ink)" }}>
                  Sealed policy
                </h2>
                <span className="ob-chip">unscoutable · unleakable</span>
              </div>
              <p className="text-sm mb-3" style={{ color: "var(--ob-ink-dim)" }}>
                You committed these thresholds in ciphertext. Even you — the operator — hold no decrypt grant over them.
                Only the compliance officer can read where the line sits.
              </p>
              <SealedValue label="per-transfer cap" handle={sealed.perTradeCap} hint="set at mandate commit" />
              <SealedValue label="velocity ceiling" handle={sealed.ceiling} hint="per-sender, rolling window" />
              <SealedValue label="total exposure cap" handle={sealed.totalCap} hint="mandate lifetime" />
            </section>

            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ActionCard
                title="Seal / rotate ceiling"
                desc="Rule 3 — the per-sender velocity ceiling. Encrypted client-side; readable only by the officer."
              >
                <input
                  className="veil-input"
                  placeholder="ceiling amount"
                  value={ceiling}
                  onChange={e => setCeilingInput(e.target.value)}
                  inputMode="numeric"
                />
                <button
                  className="ob-btn ob-btn-seal w-full"
                  disabled={busy || num(ceiling) === undefined}
                  onClick={() => {
                    const v = num(ceiling);
                    if (v !== undefined) setCeiling(v);
                  }}
                >
                  {busy ? "sealing…" : "seal ceiling"}
                </button>
              </ActionCard>

              <ActionCard
                title="Screen a recipient"
                desc="Rule 2 — rotate a sealed allow/deny bit. Default-deny. The address is public; the verdict is sealed."
              >
                <input
                  className="veil-input"
                  placeholder="0x… recipient"
                  value={screenAddr}
                  onChange={e => setScreenAddr(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="ob-btn ob-btn-seal"
                    disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(screenAddr)}
                    onClick={() => screenRecipient(screenAddr as `0x${string}`, true)}
                  >
                    allow
                  </button>
                  <button
                    className="ob-btn ob-btn-danger"
                    disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(screenAddr)}
                    onClick={() => screenRecipient(screenAddr as `0x${string}`, false)}
                  >
                    deny
                  </button>
                </div>
              </ActionCard>

              <ActionCard
                title="Fund sealed custody"
                desc="Mint demo iUSD, authorise the engine, and pull an encrypted amount into custody."
              >
                <input
                  className="veil-input"
                  placeholder="amount"
                  value={fundAmt}
                  onChange={e => setFundAmt(e.target.value)}
                  inputMode="numeric"
                />
                <button
                  className="ob-btn w-full"
                  disabled={busy || num(fundAmt) === undefined}
                  onClick={() => {
                    const v = num(fundAmt);
                    if (v !== undefined) fundCustody(v);
                  }}
                >
                  {busy ? "funding…" : "fund custody"}
                </button>
              </ActionCard>
            </div>

            {message && (
              <div className="ob-card p-4">
                <p className="ob-mono text-sm" style={{ color: "var(--ob-ink)" }}>
                  {message}
                </p>
                {lastTx && (
                  <a className="ob-mono text-xs ob-seal-text" href={txLink(lastTx)} target="_blank" rel="noreferrer">
                    {lastTx} ↗
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </ConnectGate>
    </VeilShell>
  );
}

function ActionCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="ob-card p-5 flex flex-col gap-3">
      <div>
        <div className="ob-display font-semibold" style={{ color: "var(--ob-ink)" }}>
          {title}
        </div>
        <p className="text-[0.78rem] mt-1" style={{ color: "var(--ob-ink-dim)" }}>
          {desc}
        </p>
      </div>
      {children}
    </div>
  );
}
