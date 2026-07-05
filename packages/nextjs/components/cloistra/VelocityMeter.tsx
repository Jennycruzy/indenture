"use client";

import type { Hex } from "viem";
import { CipherGlyphs } from "~~/components/cloistra/CipherGlyphs";

/**
 * The per-sender velocity meter. Even the sender sees only sealed glyphs — they know a
 * ceiling EXISTS, never where it sits. In the officer view, `resolvedSpent`/`resolvedCeiling`
 * turn it into a real fill bar (authoritative green). This is the anti-scouting property
 * on screen: you can't structure around a line you can't see.
 */
export function VelocityMeter({
  spentHandle,
  ceilingHandle,
  resolvedSpent,
  resolvedCeiling,
}: {
  spentHandle?: Hex;
  ceilingHandle?: Hex;
  resolvedSpent?: bigint;
  resolvedCeiling?: bigint;
}) {
  const resolved = resolvedSpent !== undefined && resolvedCeiling !== undefined && resolvedCeiling > 0n;
  const pct = resolved ? Math.min(100, Number((resolvedSpent! * 100n) / resolvedCeiling!)) : undefined;

  return (
    <div className="ob-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="ob-mono text-[0.72rem] uppercase tracking-wider" style={{ color: "var(--ob-ink-dim)" }}>
          rolling velocity · this window
        </span>
        {resolved ? (
          <span className="ob-mono ob-audit-text text-xs font-semibold">
            {resolvedSpent!.toString()} / {resolvedCeiling!.toString()}
          </span>
        ) : (
          <span className="ob-chip">sealed</span>
        )}
      </div>

      {/* the meter track */}
      <div
        className="relative h-3 rounded-full overflow-hidden"
        style={{ background: "var(--ob-bg-2)", border: "1px solid var(--ob-line)" }}
      >
        {resolved ? (
          <div
            className="h-full rounded-full ob-resolve"
            style={{
              width: `${pct}%`,
              background: pct! >= 100 ? "var(--ob-null)" : "var(--ob-audit)",
              transition: "width 700ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        ) : (
          // sealed: an indeterminate aurora shimmer — no readable fill
          <div
            className="h-full w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--ob-seal-a), var(--ob-seal-b), var(--ob-seal-c), var(--ob-seal-a))",
              backgroundSize: "300% 100%",
              animation: "ob-haze 5.5s ease-in-out infinite",
              opacity: 0.5,
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <div className="ob-mono text-[0.66rem]" style={{ color: "var(--ob-ink-faint)" }}>
            spent in window
          </div>
          {resolvedSpent !== undefined ? (
            <span className="ob-mono ob-resolve ob-audit-text text-sm font-semibold">{resolvedSpent.toString()}</span>
          ) : (
            <CipherGlyphs seed={spentHandle} length={14} />
          )}
        </div>
        <div className="text-right">
          <div className="ob-mono text-[0.66rem]" style={{ color: "var(--ob-ink-faint)" }}>
            ceiling
          </div>
          {resolvedCeiling !== undefined ? (
            <span className="ob-mono ob-resolve ob-audit-text text-sm font-semibold">{resolvedCeiling.toString()}</span>
          ) : (
            <CipherGlyphs seed={ceilingHandle} length={14} />
          )}
        </div>
      </div>
    </div>
  );
}
