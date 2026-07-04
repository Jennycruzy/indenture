# TRANSFORM_STATE.md — inventory before touching anything (Law 1)

> Snapshot of the `indenture` repo taken at the start of the VEIL transformation.
> **Read off disk, not from the build prompt.** Where the prompt and the repo disagree,
> the repo wins and the discrepancy is recorded here (Law 1).

Recorded: 2026-07-04 · branch `main` · scaffold = fork of `zama-ai/fhevm-react-template`.

---

## 1. What exists on disk

### Solidity — `packages/foundry/`

| Path                                  | Role                                       | Notes                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/Indenture.sol`                   | **the sealed-mandate engine** (primitive)  | ERC-7984 custody; sealed per-trade cap, total cap, drawdown floor, per-payee `ebool` allowlist; single `FHE.select` fund-out via internal `_settle`; principal-only audit grants; blind agent; public hash-chained receipts. |
| `src/orders/Leash.sol`                | Order I — the blind single agent           | Registered as the mandate `agent`; internalizes the agent's amount and calls `engine.settle`.                                                                                                                                |
| `src/orders/SealedSettlement.sol`     | Order II — cross-contract composability    | Sealed strike/notional; reads a `ConfidentialFeed` value across a contract boundary; `engine.settleWithCondition(..., inTheMoney)`.                                                                                          |
| `src/orders/ConfidentialFeed.sol`     | Order II — independent sealed-value oracle | Publisher posts a sealed value; grants a consumer persistent cross-tx compute rights.                                                                                                                                        |
| `src/mocks/DemoConfidentialToken.sol` | ERC-7984 demo cToken (`iUSD`)              | Open `mint`; custody token for demos.                                                                                                                                                                                        |
| `src/FHECounter.sol`                  | template counter                           | Pipeline smoke test only.                                                                                                                                                                                                    |
| `script/DeployIndenture.s.sol`        | backbone deploy                            | Deploys engine + token + feed; per-mandate consumers deploy from the frontend.                                                                                                                                               |

### Tests — `packages/foundry/test/` (all on Zama's `forge-fhevm` cleartext harness)

| Suite                      | Count  | Covers                                                                                                                                                                                 |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Indenture.t.sol`          | 12     | compliant move, each limit breach nullified, default-deny payee, rotate allowlist, replay revert, forged-input revert, receipt chain, leak-audit, blind-agent, principal-only decrypt. |
| `SealedSettlement.t.sol`   | 10     | ITM payout, OTM→0, at-the-money boundary, ANDed-with-mandate composition, sealed strike after settlement, feed compute-grant only to consumer, blind agent, replay, access control.    |
| `CrossContractProbe.t.sol` | 3      | isolated cross-contract ACL grant proof (positive + recompute + ungranted-reverts).                                                                                                    |
| `FHECounter.t.sol`         | 3      | template pipeline smoke test.                                                                                                                                                          |
| **Total**                  | **28** |                                                                                                                                                                                        |

### Docs

- `README.md` — INDENTURE positioning ("encrypts the rule, not the amount; blind to the agent").
- `VERIFICATION.md` — pinned versions + verified FHEVM API surface (read from installed packages).
- `DEPLOYMENTS.md` — Sepolia backbone live; per-mandate + settlement tx hashes still `TBD`.
- `SECURITY.md`, `LICENSE` (BSD-3-Clause-Clear).

### Frontend — `packages/nextjs/` (not yet inventoried in depth; Phase D)

Next.js 15 / React 19 / wagmi 2 / viem 2 / RainbowKit 2 / `@zama-fhe/sdk` `^3` / `@zama-fhe/react-sdk` `^3`.
Uncommitted working changes at snapshot: `styles/globals.css` (modified), `contracts/indenture/` (untracked).

---

## 2. What passes (Law 1 — confirm before touching)

`forge test` run 2026-07-04 on this machine (forge 1.7.1):

```
CorridorTest           14 passed   ← Phase B (net-new: velocity accumulator, rollover, officer-only decrypt)
CrossContractProbeTest  3 passed
FHECounterTest          3 passed
IndentureTest          12 passed
SealedSettlementTest   10 passed
--------------------------------
TOTAL                  42 passed · 0 failed · 0 skipped
```

**Baseline: the pre-VEIL floor was 28/28; after Phase B it is 42/42** on the cleartext harness. This is
the regression floor (Law 4): the original 28 must stay green (adapted only where roles were renamed,
never weakened) and the 14 new `Corridor.t.sol` tests — compliant clear, cap breach, screened-out,
velocity breach across transfers, window rollover resets the encrypted total, at-ceiling boundary,
per-sender independence, officer-only decrypt, blind-corridor, forged-input revert, replay, leak-audit —
must remain green after every change.

---

## 3. What is deployed on Sepolia (from `DEPLOYMENTS.md`)

Network: Sepolia (chainId `11155111`). FHEVM host addresses selected by `ZamaEthereumConfig` (none hardcoded).
Deployer / feed publisher: `0x69eb1bAA26BffCD0fA9089aa2187F6Ca3e2A54f6` (burner).

| Contract                       | Address                                      | Deploy tx               | Block      |
| ------------------------------ | -------------------------------------------- | ----------------------- | ---------- |
| `Indenture` (engine)           | `0x58eba10730Fd1ee4E5b24AaAa7caE154cbC69C83` | `0xd1e36e90…1de2ecff`   | 11,179,602 |
| `DemoConfidentialToken` (iUSD) | `0x366544F805e10e7320779d138Cca57FA0E4c5cdf` | `0xc02bf976…f25bc5f757` | 11,179,774 |
| `ConfidentialFeed`             | `0x83Ee9a4d2A3f0851DDD022A114663524694571C4` | `0xbd9d34ec…307dcfb74b` | 11,179,777 |

Per-mandate consumers (`Leash`, `SealedSettlement`) and all encrypted settlement tx hashes: still `TBD`
(driven from the frontend against the real relayer/KMS). The Corridor + its Sepolia flows are net-new.

---

## 4. Prompt ↔ repo discrepancies (Law 1: repo wins, report don't overwrite)

1. **`packages/foundry/src` vs `packages/foundry/src`.** The prompt referenced `packages/foundry/src` and
   also `orders/…`; both are correct on disk. No conflict — noted for completeness.
2. **Solidity config base.** The prompt sketch used `SepoliaConfig`; the installed `@fhevm-solidity 0.11.1`
   exposes the on-chain base as **`ZamaEthereumConfig`** (chooses host addresses by chainId).
   Already recorded in `VERIFICATION.md §2`. VEIL keeps `ZamaEthereumConfig`.
3. **"Don't bloat `Indenture.sol`" vs "move audit-decrypt grants from principal to the compliance
   officer" (Phase B step 3).** These conflict because the cap + screening handles live _in_ the engine
   and are currently granted to `principal`. Resolution (see `VEIL_DESIGN.md §5`): a **backward-compatible**
   engine extension — a `complianceOfficer` field that **defaults to the principal** so all 28 existing
   tests pass unchanged, plus a new `commitMandateFor(...)` entrypoint that sets a _distinct_ officer and
   routes every audit grant to it. No renames; the core `_settle` fund-out path is untouched in spirit.
4. **Velocity accumulator needs the settled amount.** The prompt's §3 reference logic advances
   `sealedSpent += moved`, but the engine's `settle`/`settleWithCondition` return only a `bytes32` receipt,
   so a consumer cannot see `moved`. Resolution: an **additive** `settleCorridor(...)` that returns the
   sealed `moved` handle and grants the agent transient compute rights on it (existing signatures
   untouched; verified not to weaken the blind-agent or leak guarantees — see `VEIL_DESIGN.md §4`).

## 5. Reality check on the credential-gated phases

- **Phase C (real Sepolia corridor tx hashes)** requires a funded `DEPLOYER_PRIVATE_KEY` + `SEPOLIA_RPC_URL`.
  Per Law 3/8, these outcomes CANNOT be faked; they are produced only against the real coprocessor/KMS/relayer.
- **Phase C2 (sandbox off-ramp payout)** — Flutterwave v3 sandbox key wired + read-verified (Nigeria/NGN);
  a real payout run still needs a funded test balance + a deployed Corridor (Phase C).
- **Phase D (frontend)** definition-of-done is wallet-approved txs against the deployed Corridor.

These three depend on user-provided secrets / network access. The engine + Corridor + full test suite
(Phases A–B) are built and verified locally here; C/C2/D are handed off with an explicit credential ask.
