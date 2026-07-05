"use client";

import type { Hex } from "viem";
import { CipherGlyphs } from "~~/components/cloistra/CipherGlyphs";
import type { GatePhase } from "~~/hooks/cloistra/useCloistraActions";

export type GateVerdict = "cleared" | "nullified";

/**
 * The sealed border checkpoint. Left: the sealed rulebook (cap · screening · ceiling),
 * all ciphertext. Right: the incoming transfer. A transfer is adjudicated against the
 * three sealed rows on-chain; the gate never reveals WHICH row a breach hit — it can't,
 * because the chain can't. The terminal state for a sender is "sealed" (outcome unknown
 * even to them). A `verdict` is only ever passed in the compliance-officer view, after a
 * real decrypt of the settlement outcome.
 */
export function SealedGate({
  phase,
  capHandle,
  ceilingHandle,
  screeningLabel = "sealed",
  verdict,
}: {
  phase: GatePhase;
  capHandle?: Hex;
  ceilingHandle?: Hex;
  screeningLabel?: string;
  verdict?: GateVerdict;
}) {
  const adjudicating = phase === "adjudicating" || phase === "encrypting";
  const cleared = verdict === "cleared";
  const nullified = verdict === "nullified";

  const gateClass = cleared ? "ob-gate-cleared ob-fuse" : "ob-gate-sealed";

  return (
    <div className={`ob-gate ${gateClass} ${adjudicating ? "ob-considering" : ""} p-5`}>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        {/* The sealed rulebook — three ciphertext rows */}
        <div className="ob-card p-4 flex flex-col justify-center gap-3">
          <div className="ob-mono text-[0.68rem] uppercase tracking-widest mb-1" style={{ color: "var(--ob-ink-dim)" }}>
            sealed rulebook
          </div>
          <Row label="per-transfer cap">
            <CipherGlyphs seed={capHandle} length={14} />
          </Row>
          <Row label="recipient screening">
            <span className="ob-cipher select-none text-sm">{screeningLabel}</span>
          </Row>
          <Row label="velocity ceiling">
            <CipherGlyphs seed={ceilingHandle} length={14} />
          </Row>
        </div>

        {/* The gate seam */}
        <div className="flex flex-col items-center justify-center gap-2 px-1">
          <div className={`ob-seam h-full ${cleared ? "opacity-30" : "opacity-100"}`} style={{ minHeight: 120 }} />
        </div>

        {/* The incoming transfer */}
        <div className="ob-card p-4 flex flex-col items-center justify-center text-center gap-2">
          <div className="ob-mono text-[0.68rem] uppercase tracking-widest" style={{ color: "var(--ob-ink-dim)" }}>
            transfer
          </div>
          {nullified ? (
            <div className="ob-crumble ob-mono text-lg font-semibold">nullified → 0</div>
          ) : cleared ? (
            <div className="ob-warm-text ob-display text-lg font-bold">cleared →</div>
          ) : adjudicating ? (
            <div className="ob-seal-text ob-display text-base font-semibold">adjudicating…</div>
          ) : phase === "sealed" ? (
            <div className="ob-seal-text ob-display text-base font-semibold">outcome sealed</div>
          ) : (
            <div className="ob-mono text-sm" style={{ color: "var(--ob-ink-faint)" }}>
              awaiting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="ob-mono text-[0.66rem]" style={{ color: "var(--ob-ink-faint)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
