"use client";

import Link from "next/link";
import { CorridorBar } from "~~/components/cloistra/CorridorBar";
import { RoleTabs } from "~~/components/cloistra/RoleTabs";
import { ScoutToggle } from "~~/components/cloistra/ScoutToggle";
import { ThemeToggle } from "~~/components/cloistra/ThemeToggle";
import { useCloistraStore } from "~~/hooks/cloistra/store";

/** The common frame for every CLOISTRA view: the obsidian world, the brand, role tabs, the
 *  scout's-eye toggle, and the active-corridor bar. */
export function CloistraShell({
  children,
  showCorridorBar = true,
}: {
  children: React.ReactNode;
  showCorridorBar?: boolean;
}) {
  const scout = useCloistraStore(s => s.scoutMode);

  return (
    <div className={`obsidian w-full ${scout ? "ob-scout" : ""}`}>
      <div className="ob-aurora" aria-hidden />
      <div className="relative z-[1] max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="group flex items-center gap-3 no-underline">
            <span className="ob-seal-mark" aria-hidden>
              <span className="ob-seal-mark-glyph">◈</span>
            </span>
            <span className="flex items-baseline gap-3">
              <span className="ob-display text-2xl font-bold tracking-tight" style={{ color: "var(--ob-ink)" }}>
                CLOISTRA
              </span>
              <span className="hidden sm:inline text-xs" style={{ color: "var(--ob-ink-dim)" }}>
                the sealed compliance corridor
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2.5">
            <ScoutToggle />
            <ThemeToggle />
          </div>
        </header>

        <RoleTabs />

        {scout && (
          <div className="ob-card p-3 ob-mono text-[0.72rem]" style={{ color: "var(--ob-ink-dim)" }}>
            scout&rsquo;s-eye ON — you are seeing the corridor as an outside on-chain observer does: only sealed glyphs,
            no amounts, no thresholds, no pass/fail. A launderer probing the boundary learns nothing.
          </div>
        )}

        {showCorridorBar && <CorridorBar />}

        {children}
      </div>
    </div>
  );
}
