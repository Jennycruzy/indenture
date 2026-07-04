"use client";

/** Shown when no active corridor address is set. A VEIL corridor is deployed per-mandate,
 *  so the UI needs an address before it can read the sealed policy from chain. */
export function NotConfigured() {
  return (
    <div className="ob-card p-8 text-center space-y-2">
      <div className="ob-seal-text ob-display text-lg font-bold">No corridor configured</div>
      <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
        Set an active corridor address in the bar above (or via{" "}
        <span className="ob-mono">NEXT_PUBLIC_CORRIDOR_ADDRESS</span>). A VEIL corridor is deployed per-mandate against
        the INDENTURE engine.
      </p>
    </div>
  );
}
