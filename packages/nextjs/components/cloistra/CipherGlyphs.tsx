"use client";

import { useMemo } from "react";
import { ZERO_HANDLE } from "@zama-fhe/sdk";

const GLYPHS = "▚▞▙▟◤◥◣◢⬡⬢⌁⎔⏣░▒▓╱╲∷⟊⟒⌖⧉⟁⋄";

/** A stable, deterministic glyph-string derived from a ciphertext handle. Same handle →
 *  same shimmer (so it reads as a fixed sealed value), but it is NEVER a number and carries
 *  no information about the plaintext — it is a visual stand-in for "sealed material". */
function glyphsFromSeed(seed: string, len: number): string {
  let h = 2166136261 >>> 0;
  const out: string[] = [];
  const src = seed.length ? seed : "unsealed";
  for (let i = 0; i < len; i++) {
    h ^= src.charCodeAt((i * 7 + 3) % src.length);
    h = Math.imul(h, 16777619) >>> 0;
    out.push(GLYPHS[(h + i * 131) % GLYPHS.length]);
  }
  return out.join("");
}

export function CipherGlyphs({
  seed,
  length = 20,
  className = "",
}: {
  seed?: string;
  length?: number;
  className?: string;
}) {
  const unsealed = !seed || seed === ZERO_HANDLE;
  const text = useMemo(() => glyphsFromSeed(seed ?? "", length), [seed, length]);

  if (unsealed) {
    return (
      <span className={`ob-mono text-[0.8rem] ${className}`} style={{ color: "var(--ob-ink-faint)" }}>
        — unsealed —
      </span>
    );
  }
  return (
    <span
      className={`ob-cipher select-none ${className}`}
      aria-label="sealed value"
      title="sealed — decryptable only by the compliance officer"
    >
      {text}
    </span>
  );
}
