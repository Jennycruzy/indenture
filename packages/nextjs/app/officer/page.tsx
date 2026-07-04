"use client";

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import type { Address, Hex } from "viem";
import { ConnectGate } from "~~/components/veil/ConnectGate";
import { NotConfigured } from "~~/components/veil/NotConfigured";
import { ReceiptRibbon } from "~~/components/veil/ReceiptRibbon";
import { SealedGate } from "~~/components/veil/SealedGate";
import { SealedValue } from "~~/components/veil/SealedValue";
import { VeilShell } from "~~/components/veil/VeilShell";
import { VelocityMeter } from "~~/components/veil/VelocityMeter";
import { useCorridor } from "~~/hooks/veil/useCorridor";
import { AuditTarget, useOfficerDecrypt } from "~~/hooks/veil/useOfficerDecrypt";
import { CorridorReceipt } from "~~/hooks/veil/useReceiptFeed";
import { useSealedHandles } from "~~/hooks/veil/useSealedHandles";

export default function OfficerPage() {
  const { configured, address: corridor, engine, mandateId, role } = useCorridor();
  const [auditSender, setAuditSender] = useState("");
  const senderAddr = isAddress(auditSender) ? (auditSender as Address) : undefined;
  const sealed = useSealedHandles(senderAddr);
  const [selected, setSelected] = useState<CorridorReceipt | undefined>();

  const isOfficer = role === "officer";

  // Assemble the audit targets with the contract whose ACL granted the officer decrypt rights.
  const targets = useMemo<AuditTarget[]>(() => {
    const t: AuditTarget[] = [];
    if (sealed.ceiling && corridor)
      t.push({ label: "Velocity ceiling", handle: sealed.ceiling, contractAddress: corridor });
    if (sealed.perTradeCap && engine)
      t.push({ label: "Per-transfer cap", handle: sealed.perTradeCap, contractAddress: engine });
    if (sealed.spent && corridor)
      t.push({ label: "Sender running total", handle: sealed.spent, contractAddress: corridor });
    if (selected?.outcomeHandle && engine)
      t.push({ label: "Flagged transfer outcome", handle: selected.outcomeHandle, contractAddress: engine });
    return t;
  }, [sealed.ceiling, sealed.perTradeCap, sealed.spent, corridor, engine, selected]);

  const { reveal, conceal, revealed, isAuthorizing, isDecrypting, error, values, hasTargets } =
    useOfficerDecrypt(targets);

  const val = (h?: Hex) => (h ? (values[h] as bigint | undefined) : undefined);
  const ceilingVal = val(sealed.ceiling);
  const capVal = val(sealed.perTradeCap);
  const spentVal = val(sealed.spent);
  const outcomeVal = val(selected?.outcomeHandle);
  const verdict = outcomeVal === undefined ? undefined : outcomeVal === 0n ? "nullified" : "cleared";

  return (
    <VeilShell>
      <ConnectGate>
        {!configured ? (
          <NotConfigured />
        ) : (
          <>
            <div className="ob-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="ob-display font-semibold text-lg" style={{ color: "var(--ob-ink)" }}>
                  Lawful audit
                </div>
                <p className="text-sm" style={{ color: "var(--ob-ink-dim)" }}>
                  Private to the world, accountable to the regulator. Decryption here is a real EIP-712 user-decryption
                  — no value is hardcoded.
                </p>
              </div>
              {isOfficer ? (
                <span className="ob-chip ob-audit-chip">compliance officer · key holder</span>
              ) : (
                <span className="ob-chip" style={{ borderColor: "var(--ob-crimson)", color: "var(--ob-crimson)" }}>
                  {role} · no decrypt grant
                </span>
              )}
            </div>

            {!isOfficer && (
              <div className="ob-card p-4 ob-mono text-[0.78rem]" style={{ color: "var(--ob-ink-dim)" }}>
                Your address holds no ACL decrypt grant over the sealed policy. If you attempt to reveal, the relayer
                will refuse — this is the blind-over-policy guarantee: only the compliance officer can read the line.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Audit targets → resolve on decrypt */}
              <section className="ob-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="ob-display font-semibold" style={{ color: "var(--ob-ink)" }}>
                    Sealed policy
                  </h2>
                  <div className="flex gap-2">
                    {revealed ? (
                      <button className="ob-btn" onClick={conceal}>
                        re-seal
                      </button>
                    ) : (
                      <button className="ob-btn ob-btn-seal" disabled={!hasTargets} onClick={reveal}>
                        {isAuthorizing ? "authorising…" : isDecrypting ? "decrypting…" : "decrypt (EIP-712)"}
                      </button>
                    )}
                  </div>
                </div>

                <SealedValue label="velocity ceiling" handle={sealed.ceiling} resolved={ceilingVal} />
                <SealedValue label="per-transfer cap" handle={sealed.perTradeCap} resolved={capVal} />
                <SealedValue
                  label="sender running total"
                  handle={sealed.spent}
                  resolved={spentVal}
                  hint={senderAddr ? undefined : "enter a sender address to audit"}
                />

                <label
                  className="ob-mono text-[0.7rem] uppercase tracking-wider mt-4 block"
                  style={{ color: "var(--ob-ink-dim)" }}
                >
                  audit sender
                </label>
                <input
                  className="veil-input mt-1"
                  placeholder="0x… sender to audit"
                  value={auditSender}
                  onChange={e => setAuditSender(e.target.value)}
                />

                {error && (
                  <div className="ob-mono text-[0.75rem] mt-3" style={{ color: "var(--ob-crimson)" }}>
                    {error}
                  </div>
                )}
              </section>

              {/* Resolved velocity + selected outcome */}
              <section className="flex flex-col gap-4">
                <VelocityMeter
                  spentHandle={sealed.spent}
                  ceilingHandle={sealed.ceiling}
                  resolvedSpent={spentVal}
                  resolvedCeiling={ceilingVal}
                />
                <div className="ob-card p-4">
                  <div
                    className="ob-mono text-[0.72rem] uppercase tracking-wider mb-2"
                    style={{ color: "var(--ob-ink-dim)" }}
                  >
                    flagged transfer
                  </div>
                  {selected ? (
                    <>
                      <div className="ob-mono text-sm mb-2" style={{ color: "var(--ob-ink)" }}>
                        #{selected.nonce.toString()} · {selected.sender.slice(0, 6)}… → {selected.recipient.slice(0, 6)}
                        …
                      </div>
                      {outcomeVal === undefined ? (
                        <div className="ob-mono text-sm" style={{ color: "var(--ob-ink-faint)" }}>
                          outcome sealed — decrypt to reveal whether it cleared or was nullified
                        </div>
                      ) : verdict === "nullified" ? (
                        <div className="ob-crumble ob-mono text-base font-semibold">
                          nullified → 0 (a rule caught it)
                        </div>
                      ) : (
                        <div className="ob-audit-text ob-resolve ob-mono text-base font-semibold">
                          cleared · moved {outcomeVal.toString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ob-mono text-sm" style={{ color: "var(--ob-ink-faint)" }}>
                      pick a receipt from the ribbon below to audit its sealed outcome
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* The gate mirrors the audited verdict */}
            {selected && (
              <SealedGate
                phase="sealed"
                capHandle={sealed.perTradeCap}
                ceilingHandle={sealed.ceiling}
                verdict={verdict}
              />
            )}

            <ReceiptRibbon
              corridor={corridor}
              engine={engine}
              mandateId={mandateId}
              onSelect={setSelected}
              selectedNonce={selected?.nonce}
            />
          </>
        )}
      </ConnectGate>
    </VeilShell>
  );
}
