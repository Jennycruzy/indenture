"use client";

import Link from "next/link";
import { CipherGlyphs } from "~~/components/veil/CipherGlyphs";
import { VeilShell } from "~~/components/veil/VeilShell";

const rules = [
  {
    n: "01",
    title: "Sealed per-transfer cap",
    body: "The maximum a single transfer may move — held as ciphertext, checked homomorphically.",
  },
  {
    n: "02",
    title: "Sealed recipient screening",
    body: "Allow / deny per recipient, default-deny. The address is public; whether they pass is sealed.",
  },
  {
    n: "03",
    title: "Sealed velocity ceiling",
    body: "A per-sender encrypted running total that accumulates across transfers and resets on a public window — no decryption, no division.",
  },
];

const consoles = [
  {
    href: "/operator",
    title: "Operator console",
    body: "Seal and rotate the policy — cap, screening, and velocity ceiling. You commit it; you can never read it.",
  },
  {
    href: "/sender",
    title: "Sender corridor",
    body: "Submit a cross-border transfer. Watch it adjudicate against a rulebook you cannot see.",
  },
  {
    href: "/officer",
    title: "Compliance audit",
    body: "The one role that can decrypt a flagged transfer — via EIP-712, on the record.",
  },
];

export default function Home() {
  return (
    <VeilShell showCorridorBar={false}>
      {/* Hero */}
      <section className="ob-card p-8 md:p-10">
        <div className="ob-chip mb-5">a category of its own</div>
        <h1 className="ob-display text-3xl md:text-5xl font-bold leading-tight" style={{ color: "var(--ob-ink)" }}>
          Everyone else encrypts the payment
          <br />
          and <span className="ob-seal-text">publishes the rules</span>.
        </h1>
        <p className="ob-display text-2xl md:text-3xl font-semibold mt-3">
          VEIL seals the <span className="ob-warm-text">rules</span>.
        </p>
        <p className="mt-5 max-w-2xl text-base md:text-lg" style={{ color: "var(--ob-ink-dim)" }}>
          The cap, the screening list, and the velocity ceiling are all ciphertext. Every transfer is still checked
          against them — but no one can read where the compliance line sits. Not the sender, not a bad actor probing it,
          not a competitor, not the operator. Only a designated compliance officer can decrypt a specific flagged
          transfer to audit it.
        </p>
        <div className="flex flex-wrap gap-3 mt-7">
          <Link href="/sender" className="ob-btn ob-btn-warm no-underline">
            Enter the corridor →
          </Link>
          <Link href="/operator" className="ob-btn ob-btn-seal no-underline">
            Seal a policy
          </Link>
          <Link href="/officer" className="ob-btn no-underline">
            Audit a transfer
          </Link>
        </div>
      </section>

      {/* The three sealed rules */}
      <section>
        <h2 className="ob-mono text-[0.72rem] uppercase tracking-widest mb-3" style={{ color: "var(--ob-ink-dim)" }}>
          one predicate · three sealed rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rules.map(r => (
            <div key={r.n} className="ob-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="ob-mono text-sm" style={{ color: "var(--ob-ink-faint)" }}>
                  {r.n}
                </span>
                <CipherGlyphs seed={`${r.n}-${r.title}`} length={12} />
              </div>
              <div className="ob-display font-semibold text-lg mb-1" style={{ color: "var(--ob-ink)" }}>
                {r.title}
              </div>
              <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
                {r.body}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm mt-3" style={{ color: "var(--ob-ink-faint)" }}>
          A breach nullifies the transfer to zero via a single <span className="ob-mono">FHE.select</span> — and reveals
          which rule caught it to no one, because the chain can&rsquo;t. That is the anti-scouting property.
        </p>
      </section>

      {/* Consoles */}
      <section>
        <h2 className="ob-mono text-[0.72rem] uppercase tracking-widest mb-3" style={{ color: "var(--ob-ink-dim)" }}>
          three roles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {consoles.map(c => (
            <Link
              key={c.href}
              href={c.href}
              className="ob-card p-5 no-underline transition-transform hover:-translate-y-0.5"
            >
              <div className="ob-display font-semibold text-lg mb-1" style={{ color: "var(--ob-ink)" }}>
                {c.title}
              </div>
              <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
                {c.body}
              </p>
              <span className="ob-seal-text ob-mono text-xs mt-3 inline-block">open →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Honesty footer */}
      <section className="ob-card p-5">
        <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
          <span className="ob-mono ob-audit-text">honest bounds:</span> the confidential transfer and the sealed
          compliance policy are real on Sepolia via the FHEVM coprocessor / KMS / relayer. Local tests use Zama&rsquo;s
          cleartext harness. The optional naira off-ramp is a licensed provider&rsquo;s <strong>sandbox</strong> payout
          proving the integration — not production money movement. The engine identifier stays{" "}
          <span className="ob-mono">Indenture</span>; VEIL is the product face.
        </p>
      </section>
    </VeilShell>
  );
}
