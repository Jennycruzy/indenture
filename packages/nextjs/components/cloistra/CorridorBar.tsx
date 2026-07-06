"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { isAddress } from "viem";
import type { Address } from "viem";
import { useCloistraStore } from "~~/hooks/cloistra/store";
import { useCorridor } from "~~/hooks/cloistra/useCorridor";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

const roleChip: Record<string, { label: string; cls?: string }> = {
  operator: { label: "operator" },
  officer: { label: "compliance officer", cls: "ob-audit-chip" },
  sender: { label: "sender" },
  disconnected: { label: "not connected" },
};

/** The active-corridor bar: which corridor everything points at, the connected wallet's
 *  role, and a picker to change corridors. The address is the only thing persisted; every
 *  role is read from chain. */
export function CorridorBar() {
  const { address, configured, operator, complianceOfficer, ceilingSet, isLoading } = useCorridor();
  const pathname = usePathname();
  const setActive = useCloistraStore(s => s.setActive);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Label the bar by the console you're viewing, not the connected wallet — so the chip and the
  // active tab always agree. Each page separately checks whether your wallet holds the role.
  const consoleRole = pathname === "/operator" ? "operator" : pathname === "/officer" ? "officer" : "sender";

  const apply = () => {
    if (isAddress(draft)) {
      setActive({ address: draft as Address });
      setEditing(false);
      setDraft("");
    }
  };

  const chip = roleChip[consoleRole];

  return (
    <div className="ob-card p-3 flex flex-wrap items-center gap-3 justify-between">
      <div className="flex flex-wrap items-center gap-3">
        {consoleRole === "operator" && (
          <>
            <span className="ob-mono text-[0.7rem] uppercase tracking-wider" style={{ color: "var(--ob-ink-dim)" }}>
              corridor
            </span>
            <span className="ob-mono text-sm" style={{ color: "var(--ob-ink)" }}>
              {configured ? short(address) : "none configured"}
            </span>
          </>
        )}
        <span className={`ob-chip ${chip.cls ?? ""}`}>{chip.label}</span>
        {configured && (
          <span className="ob-chip" style={{ borderColor: ceilingSet ? "var(--ob-seal-b)" : "var(--ob-line)" }}>
            {isLoading ? "loading…" : ceilingSet ? "ceiling sealed" : "ceiling unset"}
          </span>
        )}
      </div>

      {consoleRole === "operator" && (
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="0x… corridor address"
                className="ob-mono text-xs px-3 py-1.5 rounded-lg outline-none"
                style={{
                  background: "var(--ob-bg-2)",
                  border: "1px solid var(--ob-line)",
                  color: "var(--ob-ink)",
                  minWidth: 260,
                }}
              />
              <button className="ob-btn ob-btn-seal" disabled={!isAddress(draft)} onClick={apply}>
                set
              </button>
              <button className="ob-btn" onClick={() => setEditing(false)}>
                cancel
              </button>
            </>
          ) : (
            <button className="ob-btn" onClick={() => setEditing(true)}>
              {configured ? "change corridor" : "set corridor"}
            </button>
          )}
        </div>
      )}

      {configured && (consoleRole === "operator" || consoleRole === "officer") && (
        <div className="w-full pt-1 ob-mono text-[0.66rem]" style={{ color: "var(--ob-ink-faint)" }}>
          {consoleRole === "operator" ? (
            <span>operator {short(operator)}</span>
          ) : (
            <span>officer {short(complianceOfficer)}</span>
          )}
        </div>
      )}
    </div>
  );
}
