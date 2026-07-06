"use client";

import Link from "next/link";
import { CipherGlyphs } from "~~/components/cloistra/CipherGlyphs";
import { CloistraShell } from "~~/components/cloistra/CloistraShell";
import { Reveal } from "~~/components/cloistra/Reveal";
import { SealedMandateCard } from "~~/components/cloistra/SealedMandateCard";

const stats = [
  { n: "FHEVM", l: "Zama · Sepolia" },
  { n: "ERC-7984", l: "confidential token" },
  { n: "3 rules", l: "one sealed predicate" },
  { n: "officer-only", l: "lawful decryption" },
];

const steps = [
  {
    n: "1",
    t: "Encrypt",
    b: "The sender encrypts the amount in the browser. No decryption key exists client-side — decryption lives with the FHEVM threshold KMS.",
  },
  {
    n: "2",
    t: "Adjudicate",
    b: "The corridor checks it against the sealed rulebook — cap, screening, velocity — homomorphically.",
  },
  {
    n: "3",
    t: "Settle",
    b: "A single FHE.select yields the moved amount or an encrypted zero. The outcome is sealed, even to the sender.",
  },
  {
    n: "4",
    t: "Audit",
    b: "Only the compliance officer can decrypt a flagged transfer, via EIP-712 — private to the world, accountable to the regulator.",
  },
];

const rules = [
  {
    n: "01",
    title: "Per-transfer cap",
    body: "The most a single transfer may move — held as ciphertext, compared homomorphically.",
  },
  {
    n: "02",
    title: "Recipient screening",
    body: "Allow / deny per recipient, default-deny. The address is public; whether it passes is sealed.",
  },
  {
    n: "03",
    title: "Velocity ceiling",
    body: "A per-sender encrypted running total that accumulates across transfers and resets on a public window.",
  },
];

const consoles = [
  {
    href: "/operator",
    title: "Operator",
    body: "Seal and rotate the policy — cap, screening, velocity ceiling. You commit it; you can never read it back.",
    glyph: "◈",
  },
  {
    href: "/sender",
    title: "Sender",
    body: "Submit a cross-border transfer and watch it adjudicate against a rulebook you cannot see.",
    glyph: "⟢",
  },
  {
    href: "/officer",
    title: "Compliance officer",
    body: "The one role that can decrypt a flagged transfer — via EIP-712, on the record.",
    glyph: "❖",
  },
];

export default function Home() {
  return (
    <CloistraShell showCorridorBar={false}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="ob-grid-mesh relative pt-4 md:pt-12 pb-6">
        <div className="relative z-10 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-12 items-center">
          <Reveal>
            <span className="ob-kicker">
              <span className="ob-kicker-dot" /> Live on Sepolia · FHEVM
            </span>
            <h1 className="ob-hero-title mt-5">
              Seal the <span className="ob-shine">rules</span>,
              <br />
              not just the amount.
            </h1>
            <p className="ob-hero-sub mt-5">
              Everyone else encrypts the payment and publishes the policy. CLOISTRA encrypts the{" "}
              <span style={{ color: "var(--ob-ink)" }}>policy itself</span> — the cap, the recipient screening, the
              velocity ceiling — and still enforces every one on-chain. No sender, observer, competitor, or operator can
              read where the compliance line sits.
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/sender" className="ob-btn ob-btn-warm no-underline">
                Enter the corridor →
              </Link>
              <Link href="#how" className="ob-btn ob-btn-seal no-underline">
                How it works
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-9 gap-y-4 mt-9">
              {stats.map(s => (
                <div key={s.l}>
                  <div className="ob-stat-n">{s.n}</div>
                  <div className="ob-stat-l mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140} className="relative">
            <div className="ob-bloom" aria-hidden />
            <div className="relative ob-float">
              <SealedMandateCard />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="scroll-mt-6 pt-8">
        <Reveal>
          <div className="ob-section-eyebrow mb-2">how it works</div>
          <h2 className="ob-display text-2xl md:text-[2rem] font-semibold mb-7" style={{ color: "var(--ob-ink)" }}>
            A transfer crosses in four moves.
          </h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="ob-card p-5">
              <div className="ob-step-num mb-4">{s.n}</div>
              <div className="ob-display font-semibold text-lg mb-1.5" style={{ color: "var(--ob-ink)" }}>
                {s.t}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
                {s.b}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── The three sealed rules ───────────────────────────────────────── */}
      <section className="pt-10">
        <Reveal>
          <div className="ob-section-eyebrow mb-2">one predicate · three sealed rules</div>
          <h2 className="ob-display text-2xl md:text-[2rem] font-semibold mb-7" style={{ color: "var(--ob-ink)" }}>
            Checked against thresholds no one can read.
          </h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {rules.map((r, i) => (
            <Reveal key={r.n} delay={i * 90} className="ob-card p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="ob-mono text-sm" style={{ color: "var(--ob-ink-faint)" }}>
                  {r.n}
                </span>
                <CipherGlyphs seed={`${r.n}-${r.title}`} length={12} />
              </div>
              <div className="ob-display font-semibold text-lg mb-1.5" style={{ color: "var(--ob-ink)" }}>
                {r.title}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
                {r.body}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="text-sm mt-4 max-w-3xl" style={{ color: "var(--ob-ink-faint)" }}>
            A breach nullifies the transfer to zero through a single <span className="ob-mono">FHE.select</span> — and
            reveals which rule caught it to no one, because the chain can&rsquo;t.
          </p>
        </Reveal>
      </section>

      {/* ── Why it matters ───────────────────────────────────────────────── */}
      <Reveal as="section" className="ob-panel p-7 md:p-10 mt-10">
        <div className="relative z-10 max-w-3xl">
          <div className="ob-section-eyebrow mb-3">the anti-scouting property</div>
          <h2 className="ob-display text-2xl md:text-4xl font-bold leading-tight" style={{ color: "var(--ob-ink)" }}>
            A line you can&rsquo;t see is a line you can&rsquo;t <span className="ob-warm-text">structure around</span>.
          </h2>
          <p className="mt-5 text-base md:text-lg leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
            Publish your compliance thresholds and sophisticated actors probe them — splitting transfers just under the
            cap, routing around the screening list, pacing beneath the velocity ceiling. CLOISTRA keeps the boundary in
            ciphertext. Every transfer is still checked; none of them reveal where the edge is — not even which rule
            nullified a blocked one.
          </p>
        </div>
      </Reveal>

      {/* ── The three roles ──────────────────────────────────────────────── */}
      <section className="pt-10">
        <Reveal>
          <div className="ob-section-eyebrow mb-2">three roles</div>
          <h2 className="ob-display text-2xl md:text-[2rem] font-semibold mb-7" style={{ color: "var(--ob-ink)" }}>
            Take a seat at the corridor.
          </h2>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-3">
          {consoles.map((c, i) => (
            <Reveal key={c.href} delay={i * 90}>
              <Link href={c.href} className="ob-card ob-card-link p-6 no-underline flex flex-col h-full">
                <div className="ob-display text-2xl mb-3" style={{ color: "var(--ob-seal-b)" }} aria-hidden>
                  {c.glyph}
                </div>
                <div className="ob-display font-semibold text-lg mb-1.5" style={{ color: "var(--ob-ink)" }}>
                  {c.title}
                </div>
                <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--ob-ink-dim)" }}>
                  {c.body}
                </p>
                <span className="ob-seal-text ob-mono text-xs mt-4 inline-block">open console →</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Honest bounds ────────────────────────────────────────────────── */}
      <Reveal as="footer" className="ob-card p-5 mt-10">
        <p className="text-sm leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
          <span className="ob-mono ob-audit-text">honest bounds:</span> the confidential transfer and the sealed
          compliance policy are real on Sepolia via the FHEVM coprocessor, KMS, and relayer. Local tests use
          Zama&rsquo;s cleartext harness. The optional naira off-ramp is a licensed provider&rsquo;s{" "}
          <strong style={{ color: "var(--ob-ink)" }}>sandbox</strong> payout proving the integration — not production
          money movement.
        </p>
      </Reveal>
    </CloistraShell>
  );
}
