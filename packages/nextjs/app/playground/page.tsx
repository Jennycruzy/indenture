"use client";

import { useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { CloistraShell } from "~~/components/cloistra/CloistraShell";
import { ConnectGate } from "~~/components/cloistra/ConnectGate";
import { NotConfigured } from "~~/components/cloistra/NotConfigured";
import { useSenderTransfer } from "~~/hooks/cloistra/useCloistraActions";
import { useCorridor } from "~~/hooks/cloistra/useCorridor";

const DEMO_RECIPIENT = "0x0000000000000000000000000000000000000001" as Address;
const txLink = (h?: string) => (h ? `https://sepolia.etherscan.io/tx/${h}` : undefined);
const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "-");

type ScenarioKey = "clear" | "nullify";
type PlaygroundMode = "recorded" | "live";

const SCENARIOS: Record<
  ScenarioKey,
  {
    title: string;
    amount: bigint;
    intent: string;
    officer: string;
    payout: string;
    evidenceTx: string;
    evidenceLabel: string;
  }
> = {
  clear: {
    title: "Clear path",
    amount: 100n,
    intent: "Inside the demo cap. If custody and screening are still provisioned, this is the happy path.",
    officer: "Verified evidence decrypted moved = 100 clUSD.",
    payout: "Flutterwave sandbox paid 100 NGN after officer decrypt confirmed moved > 0.",
    evidenceTx: "0xbdbc826726c86c2ad8c4fdbe8fa7247fd592977954fb270c080e59ac6191a19c",
    evidenceLabel: "v2 clear evidence",
  },
  nullify: {
    title: "Nullified path",
    amount: 150n,
    intent: "Over the sealed demo cap. The sender still sees settlement, not the reason it failed.",
    officer: "Verified evidence decrypted moved = 0.",
    payout: "No payout was triggered because the decrypted moved amount was zero.",
    evidenceTx: "0xec0c3753c7af16fba37513b5467ed7f3e1d885fe94ffbd389b2a61bc5ec4f9d9",
    evidenceLabel: "v2 nullified evidence",
  },
};

export default function PlaygroundPage() {
  const { configured, ceilingSet } = useCorridor();
  const { phase, message, lastTx, canTransfer, submit, reset } = useSenderTransfer();
  const [selected, setSelected] = useState<ScenarioKey>("clear");
  const [mode, setMode] = useState<PlaygroundMode>("recorded");
  const [recordedStep, setRecordedStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const scenario = SCENARIOS[selected];
  const busy = phase === "encrypting" || phase === "adjudicating";
  const liveTx = txLink(lastTx);
  const recordingDone = mode === "recorded" && recordedStep >= 4;
  const senderView =
    mode === "recorded"
      ? recordedStep >= 3
        ? "settled, outcome sealed"
        : "ready to submit a sealed amount"
      : phase === "sealed"
        ? "settled, outcome sealed"
        : "amount input only";
  const publicView =
    mode === "recorded"
      ? recordedStep >= 2
        ? `evidence tx ${short(scenario.evidenceTx)}, nonce ordering, ciphertext handles`
        : "addresses, timing, nonce ordering"
      : lastTx
        ? `tx ${short(lastTx)}, nonce ordering, ciphertext handles`
        : "addresses, timing, nonce ordering";

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const clearRecordedTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const runScenario = (key: ScenarioKey) => {
    const next = SCENARIOS[key];
    setSelected(key);
    void submit(DEMO_RECIPIENT, next.amount);
  };

  const runRecorded = (key: ScenarioKey) => {
    clearRecordedTimers();
    setSelected(key);
    setRecordedStep(1);
    timers.current = [2, 3, 4].map((step, i) => setTimeout(() => setRecordedStep(step), 650 * (i + 1)));
  };

  const resetRecorded = () => {
    clearRecordedTimers();
    setRecordedStep(0);
  };

  return (
    <CloistraShell>
      {!configured ? (
        <NotConfigured />
      ) : (
        <>
          <section className="ob-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="ob-mono text-[0.72rem] uppercase tracking-wider ob-seal-text">judge playground</div>
                <h1 className="ob-display text-3xl font-bold mt-1" style={{ color: "var(--ob-ink)" }}>
                  Click the two paths. The public story stays sealed.
                </h1>
                <p className="text-sm mt-3" style={{ color: "var(--ob-ink-dim)" }}>
                  Recorded evidence mode plays instantly from verified Sepolia runs. Live mode submits a real encrypted
                  transfer against the active corridor. The point is the contrast: the sender and public observer see
                  the same kind of settled transaction, while only the officer path can decrypt whether{" "}
                  <span className="ob-mono">moved</span> was 100 clUSD or zero.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="ob-chip">recipient {short(DEMO_RECIPIENT)}</span>
                <span className="ob-chip">token clUSD</span>
                <span className="ob-chip" style={{ borderColor: ceilingSet ? "var(--ob-seal-b)" : "var(--ob-line)" }}>
                  {ceilingSet ? "ceiling sealed" : "ceiling unset"}
                </span>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <section className="ob-card p-5 flex flex-col gap-4">
              <div>
                <h2 className="ob-display text-xl font-semibold" style={{ color: "var(--ob-ink)" }}>
                  Playground controls
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--ob-ink-dim)" }}>
                  Start in recorded evidence mode for a no-wallet click-through. Switch to live mode when you want a
                  sender wallet to encrypt and submit on Sepolia.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className={`ob-chip cursor-pointer ${mode === "recorded" ? "ob-audit-chip" : ""}`}
                  onClick={() => {
                    setMode("recorded");
                    reset();
                  }}
                >
                  recorded evidence
                </button>
                <button
                  className={`ob-chip cursor-pointer ${mode === "live" ? "ob-audit-chip" : ""}`}
                  onClick={() => {
                    setMode("live");
                    resetRecorded();
                  }}
                >
                  live wallet
                </button>
              </div>

              {mode === "recorded" ? (
                <>
                  <div
                    className="rounded-lg p-3 ob-mono text-[0.72rem]"
                    style={{
                      background: "var(--ob-bg-2)",
                      border: "1px solid var(--ob-line)",
                      color: "var(--ob-ink-dim)",
                    }}
                  >
                    recorded evidence mode — no wallet, no new transaction. The timeline replays verified Sepolia
                    outcomes linked in the evidence panel.
                  </div>
                  <ScenarioButtons
                    selected={selected}
                    disabled={recordedStep > 0 && recordedStep < 4}
                    onRun={runRecorded}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="ob-btn ob-btn-warm"
                      disabled={recordedStep > 0 && recordedStep < 4}
                      onClick={() => runRecorded(selected)}
                    >
                      {recordedStep > 0 && recordedStep < 4
                        ? "playing..."
                        : `play ${scenario.amount.toString()} clUSD evidence`}
                    </button>
                    {recordedStep > 0 && (
                      <button className="ob-btn" onClick={resetRecorded}>
                        reset
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <ConnectGate>
                  <ScenarioButtons
                    selected={selected}
                    disabled={!canTransfer || !ceilingSet || busy}
                    onRun={runScenario}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="ob-btn ob-btn-warm"
                      disabled={!canTransfer || !ceilingSet || busy}
                      onClick={() => runScenario(selected)}
                    >
                      {busy ? "running..." : `run ${scenario.amount.toString()} clUSD`}
                    </button>
                    {phase !== "idle" && (
                      <button className="ob-btn" onClick={reset}>
                        reset
                      </button>
                    )}
                    {liveTx && (
                      <a className="ob-btn no-underline" href={liveTx} target="_blank" rel="noreferrer">
                        view live tx
                      </a>
                    )}
                  </div>
                </ConnectGate>
              )}

              <StatusRail mode={mode} phase={phase} recordedStep={recordedStep} />

              {message && (
                <div
                  className="rounded-lg p-4 ob-mono text-sm"
                  style={{
                    background: "var(--ob-bg-2)",
                    border: "1px solid var(--ob-line)",
                    color: phase === "error" ? "var(--ob-crimson)" : "var(--ob-ink)",
                  }}
                >
                  {message}
                </div>
              )}
            </section>

            <section className="ob-card p-5 flex flex-col gap-3">
              <div>
                <div className="ob-mono text-[0.7rem] uppercase tracking-wider" style={{ color: "var(--ob-ink-dim)" }}>
                  selected path
                </div>
                <h2 className="ob-display text-xl font-semibold" style={{ color: "var(--ob-ink)" }}>
                  {scenario.title}: {scenario.amount.toString()} clUSD
                </h2>
              </div>
              <Perspective label="Sender sees" value={senderView} />
              <Perspective label="Public sees" value={publicView} />
              <Perspective
                label="Officer sees"
                value={recordingDone || mode === "live" ? scenario.officer : "awaiting authorized decrypt evidence"}
                accent
              />
              <Perspective
                label="Payout rail"
                value={
                  recordingDone || mode === "live" ? scenario.payout : "payout decision remains hidden until decrypt"
                }
              />
              <a
                className="ob-btn ob-btn-seal no-underline justify-center"
                href={`https://sepolia.etherscan.io/tx/${scenario.evidenceTx}`}
                target="_blank"
                rel="noreferrer"
              >
                {scenario.evidenceLabel}
              </a>
            </section>
          </div>
        </>
      )}
    </CloistraShell>
  );
}

function ScenarioButtons({
  selected,
  disabled,
  onRun,
}: {
  selected: ScenarioKey;
  disabled: boolean;
  onRun: (key: ScenarioKey) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(["clear", "nullify"] as const).map(key => {
        const s = SCENARIOS[key];
        const active = selected === key;
        return (
          <button
            key={key}
            className="text-left rounded-lg p-4 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--ob-bg-2)",
              border: `1px solid ${active ? "var(--ob-seal-b)" : "var(--ob-line)"}`,
            }}
            disabled={disabled}
            onClick={() => onRun(key)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="ob-display font-semibold" style={{ color: "var(--ob-ink)" }}>
                {s.title}
              </span>
              <span className="ob-chip">{s.amount.toString()} clUSD</span>
            </div>
            <p className="text-[0.78rem] mt-2" style={{ color: "var(--ob-ink-dim)" }}>
              {s.intent}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function StatusRail({
  mode,
  phase,
  recordedStep,
}: {
  mode: PlaygroundMode;
  phase: ReturnType<typeof useSenderTransfer>["phase"];
  recordedStep: number;
}) {
  const liveItems = [
    { label: "Encrypt in browser", active: phase === "encrypting", done: phase !== "idle" },
    { label: "Submit sealed transfer", active: phase === "adjudicating", done: phase === "sealed" },
    { label: "Sender receives sealed settlement", active: phase === "sealed", done: phase === "sealed" },
    { label: "Officer decrypt / payout evidence", active: false, done: phase === "sealed" },
  ];
  const items = [
    { label: "Load recorded Sepolia evidence", active: recordedStep === 1, done: recordedStep > 1 },
    { label: "Replay sealed transfer", active: recordedStep === 2, done: recordedStep > 2 },
    { label: "Show sender/public view", active: recordedStep === 3, done: recordedStep > 3 },
    { label: "Reveal officer/payout evidence", active: recordedStep === 4, done: recordedStep === 4 },
  ];
  const shown = mode === "recorded" ? items : liveItems;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
      {shown.map((item, i) => (
        <div
          key={item.label}
          className="rounded-lg p-3"
          style={{
            background: "var(--ob-bg-2)",
            borderColor: item.active || item.done ? "var(--ob-seal-b)" : "var(--ob-line)",
            borderStyle: "solid",
            borderWidth: 1,
            color: item.active || item.done ? "var(--ob-ink)" : "var(--ob-ink-dim)",
          }}
        >
          <div className="ob-mono text-[0.68rem] uppercase tracking-wider">step {i + 1}</div>
          <div className="text-sm mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function Perspective({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border-t pt-3" style={{ borderColor: "var(--ob-line)" }}>
      <div className="ob-mono text-[0.68rem] uppercase tracking-wider" style={{ color: "var(--ob-ink-dim)" }}>
        {label}
      </div>
      <p className="text-sm mt-1" style={{ color: accent ? "var(--ob-seal-a)" : "var(--ob-ink)" }}>
        {value}
      </p>
    </div>
  );
}
