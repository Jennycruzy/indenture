"use client";

import { CipherGlyphs } from "~~/components/cloistra/CipherGlyphs";

/**
 * The hero's centrepiece: a stylised sealed mandate. Every policy value and the settled outcome
 * render as shimmering ciphertext glyphs — the product's core idea made tangible. Purely
 * decorative (deterministic seeds, no real handles), so it is safe to render anywhere.
 */
const rules = [
  { key: "per-transfer cap", seed: "cap-01" },
  { key: "recipient screening", seed: "screen-02" },
  { key: "velocity ceiling", seed: "velocity-03" },
];

export function SealedMandateCard() {
  return (
    <div className="ob-panel p-6 md:p-7 w-full">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="ob-mono text-[0.7rem] tracking-widest uppercase" style={{ color: "var(--ob-ink-dim)" }}>
            Mandate
          </span>
          <span className="ob-mono text-[0.66rem]" style={{ color: "var(--ob-ink-faint)" }}>
            0x3d22…67b0
          </span>
        </div>
        <span className="ob-chip" style={{ borderColor: "rgba(99,102,241,0.4)", color: "var(--ob-seal-a)" }}>
          <span aria-hidden>◈</span> sealed
        </span>
      </div>

      <div className="mb-4">
        {rules.map(r => (
          <div key={r.key} className="ob-panel-row">
            <span className="ob-panel-key">{r.key}</span>
            <CipherGlyphs seed={r.seed} length={14} className="text-[0.95rem]" />
          </div>
        ))}
      </div>

      <div className="ob-rule-label my-4">one predicate</div>

      <div
        className="ob-gate ob-gate-sealed rounded-xl p-4 flex items-center justify-between"
        style={{ background: "linear-gradient(180deg, rgba(16,19,28,0.8), rgba(6,7,10,0.6))" }}
      >
        <div>
          <div
            className="ob-mono text-[0.66rem] uppercase tracking-widest mb-1"
            style={{ color: "var(--ob-ink-faint)" }}
          >
            transfer #4 · settled
          </div>
          <div className="ob-mono text-sm" style={{ color: "var(--ob-ink-dim)" }}>
            moved <CipherGlyphs seed="outcome-moved" length={8} className="text-[0.9rem]" />
          </div>
        </div>
        <div className="text-right">
          <div
            className="ob-mono text-[0.66rem] uppercase tracking-widest mb-1"
            style={{ color: "var(--ob-ink-faint)" }}
          >
            outcome
          </div>
          <div className="ob-mono text-sm ob-seal-text font-semibold">sealed</div>
        </div>
      </div>

      <p className="ob-mono text-[0.72rem] mt-4 leading-relaxed" style={{ color: "var(--ob-ink-faint)" }}>
        cleared or nullified — decryptable only by the compliance officer.
      </p>
    </div>
  );
}
