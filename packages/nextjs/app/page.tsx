import Link from "next/link";
import { CloistraShell } from "~~/components/cloistra/CloistraShell";
import { SealedMandateCard } from "~~/components/cloistra/SealedMandateCard";

const stats = [
  ["rules", "encrypted"],
  ["outcomes", "sealed"],
  ["auditor", "designated"],
] as const;

const steps = [
  {
    title: "Encrypt the payment",
    body: "The sender submits a confidential amount with a proof bound to the active corridor.",
  },
  {
    title: "Evaluate sealed policy",
    body: "Caps, recipient screening, custody checks, and velocity limits stay unreadable while the contract computes.",
  },
  {
    title: "Settle without leaking",
    body: "The public sees the same receipt shape whether the transfer clears or is silently nullified.",
  },
] as const;

export default function Home() {
  return (
    <CloistraShell showRoleTabs={false} showCorridorBar={false}>
      <main className="ob-grid-mesh relative overflow-hidden pt-4">
        <section className="relative z-10 grid min-h-[calc(100vh-9rem)] grid-cols-1 items-center gap-10 pb-12 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="max-w-3xl">
            <div className="ob-kicker">
              <span className="ob-kicker-dot" /> Sepolia corridor live
            </div>
            <h1 className="ob-hero-title mt-5">
              CLOISTRA keeps the <span className="ob-shine">rulebook sealed</span>.
            </h1>
            <p className="ob-hero-sub mt-5">
              A confidential payment corridor where the amount, the compliance thresholds, and the pass/fail outcome
              remain encrypted while the chain still enforces the policy.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/playground" className="ob-btn ob-btn-warm no-underline">
                enter corridor
              </Link>
              <Link href="/docs" className="ob-btn ob-btn-seal no-underline">
                read docs
              </Link>
            </div>
            <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
              {stats.map(([label, value]) => (
                <div key={label} className="ob-card p-3">
                  <div className="ob-stat-n">{value}</div>
                  <div className="ob-stat-l mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="ob-bloom" aria-hidden />
            <div className="ob-float relative z-10">
              <SealedMandateCard />
            </div>
          </div>
        </section>

        <section className="relative z-10 grid grid-cols-1 gap-3 pb-10 md:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="ob-card ob-card-link p-5">
              <span className="ob-step-num">{index + 1}</span>
              <h2 className="ob-display mt-4 text-xl font-semibold" style={{ color: "var(--ob-ink)" }}>
                {step.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ob-ink-dim)" }}>
                {step.body}
              </p>
            </article>
          ))}
        </section>
      </main>
    </CloistraShell>
  );
}
