# CLOISTRA_DESIGN.md — sealing the compliance rulebook

> **CLOISTRA** is the product face; **`Cloistra` / `Cloistra.sol`** stay the internal engine names
> (the repo, deploy scripts, and verified Sepolia addresses depend on them). This document records the
> design rationale: the role re-cast, the three sealed rules incl. the encrypted velocity accumulator,
> and the compliance-officer disclosure model. Everything here is implemented and exercised by the
> gate in `VERIFICATION.md`.

---

## 0. Thesis

Everyone else encrypts the **payment** and publishes the **rules** — the amount is ciphertext but the
cap, the screening list, and the velocity ceiling are readable, so a launderer can see exactly where the
line is and structure under it, a competitor can copy the corridor's risk model, and the operator can
leak it. **CLOISTRA seals the rulebook itself.** The cap, the recipient screening, and the per-sender
velocity ceiling are all ciphertext; every payment is still checked against them homomorphically; but
no one — not the sender, not a bad actor probing the boundary, not a competitor, not the operator — can
read where the compliance line sits. Only a designated **compliance officer** can decrypt a specific
flagged transfer to audit it.

---

## 1. Role re-cast (copy layer; Solidity identifiers unchanged)

| Engine concept (existing)              | CLOISTRA corridor meaning                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `principal` (mandate committer)        | **corridor operator** — the licensed remittance provider that sets the sealed policy |
| `agent` (delegated mover)              | **sender** — the party submitting a cross-border payment (via the `Corridor`)        |
| `perTradeCap` (sealed)                 | **sealed per-transfer cap** (Rule 1)                                                 |
| `_payeeAllowed[addr]` `ebool` (sealed) | **sealed recipient screening** (Rule 2, default-deny)                                |
| principal-only decrypt (audit)         | **compliance-officer-only decrypt** (the regulator/audit role)                       |
| a settlement                           | **a cross-border transfer**                                                          |
| Order II sealed feed                   | optional **sealed sanctions/risk feed** (kept as composability proof)                |

**NEW role — the compliance officer.** A distinct address, NOT the operator and NOT the sender. It is
the only address granted ACL decrypt rights over the sealed policy and the flagged-transfer outcomes.
It performs audit via ACL + EIP-712 user-decryption.

---

## 2. The three sealed rules — one homomorphic predicate

Every transfer settles through a single predicate; a failing transfer is nullified to zero by the
engine's existing single `FHE.select` and leaks nothing — **not even which rule failed**.

- **Rule 1 — sealed per-transfer cap (EXISTS).** `FHE.le(amount, perTradeCap)`. Reused unchanged from the engine.
- **Rule 2 — sealed recipient screening (EXISTS).** Per-address `ebool` `_payeeAllowed[recipient]`, explicit
  default-deny. Recipient address is public; whether they pass screening is sealed. Reused unchanged.
- **Rule 3 — sealed rolling velocity ceiling (NET-NEW).** "Has this sender exceeded their sealed
  rolling ceiling?" — an encrypted running total per sender that accumulates across transfers and resets
  on a public time-window boundary, all without decryption. Built in the new `orders/Corridor.sol`.

The Corridor computes Rule 3 as a sealed `ebool` and hands it to the engine as the `extraOk` predicate;
the engine ANDs it into Rules 1+2 (+ the pre-existing custody + drawdown checks) and settles once.

---

## 3. The velocity accumulator (Rule 3) — the deep, net-new core

Per-sender state, held in `Corridor.sol`:

```solidity
mapping(address => euint64) sealedSpent;   // encrypted running total in the current window
mapping(address => uint256) windowStart;   // PUBLIC window anchor (block time is public)
euint64 sealedMonthlyCeiling;              // the sealed ceiling (operator-set ciphertext)
uint256 constant WINDOW = 30 days;         // rolling window length (public)
```

On each transfer (amount internalized from the sender via `FHE.fromExternal`):

```solidity
// 1. Decide window rollover IN THE CLEAR — block.timestamp is public; only AMOUNTS are secret.
bool rolled = block.timestamp >= windowStart[sender] + WINDOW;   // public comparison — allowed
euint64 carried = rolled ? FHE.asEuint64(0) : sealedSpent[sender]; // plaintext branch on a public bool

// 2. The sealed velocity predicate (no decryption, no division).
euint64 wouldBe = FHE.add(carried, amount);
ebool withinVelocity = FHE.le(wouldBe, sealedMonthlyCeiling);

// 3. Hand the engine the sealed amount + the sealed predicate; it ANDs Rules 1+2 and settles once.
FHE.allowTransient(amount, engine);
FHE.allowTransient(withinVelocity, engine);
(bytes32 receipt, euint64 moved) = engine.settleCorridor(id, nonce, recipient, amount, withinVelocity);

// 4. Advance the accumulator by the ACTUALLY-MOVED amount (0 if the transfer was nullified for ANY
//    reason). A blocked transfer must NOT consume window budget — this is why we need `moved`, not
//    the proposed amount. moved ∈ {0, amount}, so no underflow, no division.
euint64 newSpent = FHE.add(carried, moved);
sealedSpent[sender] = newSpent;
if (rolled) windowStart[sender] = block.timestamp;  // reset the public anchor on rollover

FHE.allowThis(newSpent);                 // Corridor reuses it next transfer
FHE.allow(newSpent, complianceOfficer);  // ONLY the officer may audit it — not sender, not operator
```

### Honest engineering notes (baked into the code comments)

- **The window rollover uses the PUBLIC `block.timestamp`.** Time is not secret — only _amounts_ are.
  So the reset is a plaintext branch on a public bool (`rolled`), needing no encrypted branching. This
  is the correct, honest design; we do not pretend the timestamp is hidden.
- **No encrypted division anywhere.** The ceiling is an absolute sealed amount, not a percentage. (If a
  percentage were ever wanted, cross-multiply — never divide ciphertext, exactly as the drawdown floor
  already does in the engine.)
- **The accumulator advances by `moved`, never by the proposed amount.** A transfer nullified by the
  cap, screening, custody, drawdown, _or_ velocity contributes 0 to the running total, so budget is
  consumed only by money that actually moved.
- **No uninitialized-handle reads.** A fresh sender has `windowStart == 0`, which makes `rolled == true`,
  so `carried` is a fresh `FHE.asEuint64(0)` and the uninitialized `sealedSpent[sender]` handle is never
  read. Whenever `rolled == false`, `sealedSpent[sender]` was set by a prior transfer. Invariant holds.

---

## 4. Why the engine needs `settleCorridor` (and why it is safe)

The engine's `settle` / `settleWithCondition` return only a `bytes32` receipt, so a consumer cannot see
the sealed `moved` outcome. The velocity accumulator _requires_ it (§3 step 4). So the engine gains one
**additive** entrypoint:

```solidity
function settleCorridor(bytes32 id, uint256 nonce, address payee, euint64 amount, ebool extraOk)
    external returns (bytes32 receipt, euint64 moved);
```

It delegates to the same internal `_settle` (the single fund-out path is preserved), and additionally
`FHE.allowTransient(moved, msg.sender)` so the calling consumer can chain `moved` into its own encrypted
accounting **in the same tx, without decrypting it**.

**Safety argument — this does not weaken any guarantee:**

- `moved ∈ {0, amount}`. Granting the agent _compute_ rights on it does **not** grant _decrypt_ rights:
  user-decryption (EIP-712) requires a granted **EOA** as well, and none is given here. The consumer is a
  contract; a contract compute-grant decrypts nothing (the existing `SealedSettlement` sealed-strike test
  relies on exactly this fact).
- The agent still receives **no** grant over any _policy_ handle (cap, total, drawdown, screening flag,
  ceiling). The blind-agent-over-policy guarantee is untouched.
- No cleartext is emitted; `moved` is an opaque handle. The leak-audit guarantee is untouched.

`settle` and `settleWithCondition` keep their exact signatures, so the engine's pre-existing tests are unaffected.

---

## 5. Compliance-officer disclosure model

**Requirement:** audit-decrypt belongs to the compliance officer, not the operator; the operator and
sender must NOT be able to decrypt the sealed policy at runtime.

**Mechanism — a backward-compatible `complianceOfficer` on the mandate:**

- `Mandate` carries `address complianceOfficer`.
- The legacy `commitMandate(...)` sets `complianceOfficer = msg.sender` (the principal). Every audit grant
  in the engine (`fund`, `setPayeeAllowed`, `_settle`) targets `m.complianceOfficer`. For legacy mandates
  `complianceOfficer == principal`, so the grants are **identical** and the pre-existing engine tests pass
  unchanged.
- `commitMandateFor(..., address complianceOfficer)` sets a _distinct_ officer. For a CLOISTRA corridor
  the operator commits with `complianceOfficer = <officer address>`; the operator (principal) is then
  granted **no** decrypt rights — it can commit, fund, screen, and rotate (all compute-only via
  `allowThis`, which the engine holds), but it cannot read the sealed policy or the flagged outcomes.

**What the officer — and only the officer — can decrypt:**

| Sealed handle                             | Where                  | Granted to         |
| ----------------------------------------- | ---------------------- | ------------------ |
| per-transfer cap, total cap, drawdown     | engine `Mandate`       | compliance officer |
| every recipient screening flag            | engine `_payeeAllowed` | compliance officer |
| running spent / custody / high-water mark | engine `Mandate`       | compliance officer |
| a specific settlement's `moved` outcome   | engine `_settle`       | compliance officer |
| the velocity ceiling                      | `Corridor`             | compliance officer |
| per-sender velocity running total         | `Corridor`             | compliance officer |

The **sender** and **operator** are asserted (by test, on the ACL) to have **no** decrypt rights over any
of the above. The agent (the `Corridor` contract) holds compute-only rights where needed and decrypts
nothing. This is "private to the world, accountable to the regulator" — the property that makes it
_compliance_, not just secrecy.

---

## 6. Anti-scouting property (the thesis, made checkable)

- A breach nullifies to zero via the engine's single `FHE.select` and reveals **which rule failed to
  no one** — the same discipline the engine already uses for cap/screening now also covers velocity.
- No event, getter, or revert string exposes the cap, the ceiling, any screening flag, `sealedSpent`,
  or the pass/fail boolean (leak-audit test, extended to the Corridor).
- Even the _sender_ sees their own velocity headroom only as sealed glyphs — they know a ceiling exists,
  never where it is. This is what a launderer probing the boundary, or a competitor copying the model,
  learns: nothing.

---

## 7. Design → code map

| Design element                                                         | Where it lives                             |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `complianceOfficer` + `commitMandateFor` + `settleCorridor` (additive) | `packages/foundry/src/Cloistra.sol`        |
| velocity accumulator, three-rule predicate, officer grants             | `packages/foundry/src/orders/Corridor.sol` |
| cap/screen/velocity/rollover/combined/disclosure/leak-audit tests      | `packages/foundry/test/Corridor.t.sol`     |
| live Sepolia corridor tx hashes and payout evidence                    | `DEPLOYMENTS.md`                           |
| off-ramp listener (officer decrypt → sandbox payout)                   | `packages/offramp`                         |
| corridor UI (operator / sender / officer + scout's-eye)                | `packages/nextjs`                          |
