"use client";

import { useCloistraStore } from "~~/hooks/cloistra/store";

/**
 * The scout's-eye toggle. Flips the view to what an outside on-chain observer sees:
 * only sealed glyphs — no amounts, no thresholds, no pass/fail. The visual proof that a
 * launderer probing the boundary, or a competitor copying the risk model, learns nothing.
 */
export function ScoutToggle() {
  const scout = useCloistraStore(s => s.scoutMode);
  const toggle = useCloistraStore(s => s.toggleScout);

  return (
    <button
      onClick={toggle}
      className={`ob-chip cursor-pointer transition-all ${scout ? "ob-audit-chip" : ""}`}
      style={scout ? undefined : { borderColor: "var(--ob-line)" }}
      title="See the corridor as an outside on-chain observer does — only sealed glyphs"
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ background: scout ? "var(--ob-audit)" : "var(--ob-ink-faint)" }}
      />
      scout&rsquo;s-eye {scout ? "ON" : "OFF"}
    </button>
  );
}
