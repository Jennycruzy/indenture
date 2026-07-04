"use client";

import type { Hex } from "viem";
import { CipherGlyphs } from "~~/components/veil/CipherGlyphs";

function formatResolved(v: bigint | boolean | undefined, unit?: string): string {
  if (typeof v === "boolean") return v ? "ALLOWED" : "DENIED";
  if (typeof v === "bigint") return unit ? `${v.toString()} ${unit}` : v.toString();
  return "";
}

/**
 * A single sealed policy value. In the operator/sender views it is always glyphs.
 * In the compliance-officer view, once a real EIP-712 user-decryption resolves, it
 * "focus-pulls" into cleartext with the authoritative-green accent — the one moment
 * of lawful revelation.
 */
export function SealedValue({
  label,
  handle,
  resolved,
  unit,
  length = 22,
  hint,
}: {
  label: string;
  handle?: Hex;
  resolved?: bigint | boolean;
  unit?: string;
  length?: number;
  hint?: string;
}) {
  const isResolved = resolved !== undefined;
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b" style={{ borderColor: "var(--ob-line)" }}>
      <div className="flex flex-col">
        <span className="ob-mono text-[0.72rem] uppercase tracking-wider" style={{ color: "var(--ob-ink-dim)" }}>
          {label}
        </span>
        {hint && (
          <span className="text-[0.68rem]" style={{ color: "var(--ob-ink-faint)" }}>
            {hint}
          </span>
        )}
      </div>
      {isResolved ? (
        <span className="ob-mono ob-resolve ob-audit-text text-sm font-semibold">{formatResolved(resolved, unit)}</span>
      ) : (
        <CipherGlyphs seed={handle} length={length} />
      )}
    </div>
  );
}
