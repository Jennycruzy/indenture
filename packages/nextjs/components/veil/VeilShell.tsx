"use client";

import Link from "next/link";
import { CorridorBar } from "~~/components/veil/CorridorBar";
import { RoleTabs } from "~~/components/veil/RoleTabs";
import { ScoutToggle } from "~~/components/veil/ScoutToggle";
import { useVeilStore } from "~~/hooks/veil/store";

/** The common frame for every VEIL view: the obsidian world, the brand, role tabs, the
 *  scout's-eye toggle, and the active-corridor bar. */
export function VeilShell({
  children,
  showCorridorBar = true,
}: {
  children: React.ReactNode;
  showCorridorBar?: boolean;
}) {
  const scout = useVeilStore(s => s.scoutMode);

  return (
    <div className={`obsidian w-full ${scout ? "ob-scout" : ""}`}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-baseline gap-3 no-underline">
            <span className="ob-display text-2xl font-bold tracking-tight" style={{ color: "var(--ob-ink)" }}>
              VEIL
            </span>
            <span className="text-xs" style={{ color: "var(--ob-ink-dim)" }}>
              the sealed compliance corridor
            </span>
          </Link>
          <ScoutToggle />
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
