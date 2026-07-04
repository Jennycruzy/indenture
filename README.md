# VEIL

**Everyone else encrypts the payment and publishes the rules. VEIL seals the rules — the compliance line can't be scouted, copied, or leaked, yet every transfer is still checked against it.**

> **VEIL** is a confidential cross-border payment corridor whose **compliance rulebook is sealed**. It is
> built on the **INDENTURE** sealed-mandate engine (`Indenture.sol` — the internal engine name is
> unchanged; VEIL is the product face). The engine already encrypts _the rule_, not just the amount; VEIL
> re-casts it as a payment corridor and adds the one net-new primitive — an **encrypted per-sender velocity
> accumulator** — so the cap, the recipient screening, and the rolling velocity ceiling are all ciphertext.

Every compliance system on-chain today hides the **money** and publishes the **rules**: the amount is
encrypted, but the cap, the screening list, and the velocity ceiling are readable in the contract — so a
launderer can see exactly where the line is and structure right under it, a competitor can copy the
corridor's risk model, and the operator can leak it. Hide the money but publish the rules and you've secured
nothing that matters. **VEIL seals the rulebook itself.** Every transfer is still checked homomorphically
against the cap, the screening, and the velocity ceiling — but no one (not the sender, not a bad actor
probing the boundary, not a competitor, not the operator) can read where the compliance line sits. A breach
is silently nullified to zero via a single `FHE.select` and reveals **which rule failed to no one**. Only a
designated **compliance officer** can decrypt a specific flagged transfer to audit it.

## A category of its own

Confidential payments with _public_ compliance rules is the flagship pitch (ERC-7984 supports
KYC/sanctions/spending-limit checks in-contract). Sealing the **policy** — encrypting the thresholds
themselves so the boundary is unscoutable — is a different category:

- It hides the **rule itself**, not just the amount.
- Its adversary includes an **insider** — the operator, and the delegated corridor holding the funds — kept
  **blind** to the sealed policy so it cannot game or leak the line; and the audit capability is split out to
  a separate **compliance officer**, so it is private to the world yet accountable to the regulator.
- It is a **horizontal primitive**: one sealed-mandate engine that other contracts compose against _without
  decrypting it_, not a single-vertical app.

## The three sealed rules

Every transfer settles through one homomorphic predicate; a failing transfer is nullified to zero and leaks
nothing — not the amount, not any threshold, not even which rule caught it.

1. **Sealed per-transfer cap** — `FHE.le(amount, perTradeCap)` (reused from the engine).
2. **Sealed recipient screening** — a per-address `ebool`, explicit default-deny; the address is public,
   whether they pass is sealed (reused from the engine).
3. **Sealed rolling velocity ceiling** (net-new) — an **encrypted running total per sender** that accumulates
   across transfers and **resets on a public time-window boundary**, all without decryption. The window
   rollover uses the _public_ `block.timestamp` (time is not secret — only amounts are); the accumulator
   advances by the **actually-moved** amount, so a blocked transfer consumes no window budget; and the
   ceiling is an absolute sealed amount, so there is **no encrypted division** anywhere. Built in
   `orders/Corridor.sol`. See [`VEIL_DESIGN.md`](VEIL_DESIGN.md).

## Architecture

```
                 ┌──────────────────────────────────────────────┐
                 │                 Indenture.sol                 │
                 │       the sealed-mandate engine (primitive)   │
                 │  · holds/settles ERC-7984 confidential token  │
                 │  · enforces a SEALED, encrypted mandate        │
                 │  · agent is BLIND (ACL default-deny; decrypt   │
                 │    rights to the principal only)               │
                 │  · single settlement path via FHE.select       │
                 │  · advances encrypted state + public nonce     │
                 │  · emits public hash-chained receipts          │
                 └───────────────▲───────────────▲────────────────┘
              consumes the engine │               │
                        ┌─────────┘               └─────────┐
                 ┌──────┴───────┐           ┌───────────────┴────────────┐
                 │  Leash.sol   │           │ SealedSettlement.sol +      │
                 │  Order I     │           │ ConfidentialFeed.sol        │
                 │  1-party     │           │ Order II · 2-party ·        │
                 │  (MARQUEE)   │           │ cross-contract composability│
                 └──────────────┘           └────────────────────────────┘
```

The engine is standalone and consumer-agnostic. Each **Order** defines only _its_ predicate shape and feeds encrypted inputs into the engine — that separation _is_ the composability proof.

- **Order I — The Leash** (marquee): a fund/treasury delegates execution to a blind autonomous agent that is _physically incapable_ of exceeding its sealed caps/drawdown floor or paying a non-allowlisted counterparty. The agent cannot see the leash it runs on.
- **Order II — Sealed Settlement** (composability proof): a parametric option whose payout releases iff an **independent** `ConfidentialFeed` contract's sealed value ≥ the writer's sealed strike. The feed's ciphertext flows into the mandate predicate _across a contract boundary_ via the ACL, and **the strike stays sealed even after settlement**.
- **VEIL Corridor** (`orders/Corridor.sol`): the confidential cross-border payment corridor. Re-casts the engine as a corridor (operator / sender / compliance officer) and adds the **sealed per-sender velocity accumulator** (Rule 3) on top of the reused sealed cap + screening. Audit disclosure is moved from the operator to a distinct compliance officer.
- **Order III — Collective Release** (Tier 2 / roadmap): N-party private quorum release. Spec only for now — see [Roadmap](#roadmap).

## The honest design choices

These are deliberate and are documented with their _why_ in the contract comments:

- **Drawdown without encrypted division.** "Equity must stay ≥ `pct`% of the high-water mark" is a cross-multiplied integer inequality (`equity·100 ≥ peak·pct`), never a ciphertext division — division compiles to an iterative bit-serial circuit that blows the per-tx compute budget and truncates invisibly.
- **Encrypted, rotatable allowlist.** The payee address is necessarily public, but _whether it is allowed_ is a per-address `ebool` with explicit default-deny, decrypt-granted to the principal only. The principal rotates a flag in ciphertext without revealing which payee changed.
- **Strong privacy by default; selective disclosure as a capability.** The predicate outcome stays encrypted — nothing leaks, not even pass/fail. Only the principal (via ACL + EIP-712 user-decryption) can decrypt a specific settlement's outcome to audit.
- **Replay + forgery resistance.** A monotonic per-mandate `nonce` advances atomically with the encrypted running state (stale moves revert on-chain). A hand-crafted ciphertext with no valid input-verification proof reverts at `FHE.fromExternal` — a real on-chain ZK rejection, not a frontend guard.
- **Public hash-chained receipts.** Each settlement stamps `keccak256(prevReceipt, nonce, payee, outcomeCommitment)` — tamper-evident public ordering that settlements _happened_, while amounts and limits stay sealed.
- **The blind-agent proof.** The mandate handles (caps, drawdown, every allowlist flag) have **no ACL decrypt grant to the agent** — only to the principal. This is asserted by tests (see below) and is the demonstration of the whole idea.

## Status — honest carve-outs

> **This is an unaudited demonstration** of one primitive across predicate shapes. It is not production-ready and has not been audited.

| Piece                                                                         | State                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Indenture.sol` engine + Order I `Leash`                                      | ✅ built · 12 harness tests                                                                             |
| Order II `SealedSettlement` + `ConfidentialFeed`                              | ✅ built · 10 harness tests · cross-contract ACL probe (3 tests)                                        |
| **VEIL `Corridor` — sealed velocity accumulator**                             | ✅ built · 14 harness tests (cap/screen/velocity/rollover/combined/disclosure/leak-audit)               |
| Leak-audit + blind-agent + officer-disclosure                                 | ✅ passing (see `test/`) — **42/42 total**                                                              |
| Backbone live on Sepolia (engine + cToken + feed)                             | ✅ deployed + verified — see `DEPLOYMENTS.md`                                                           |
| Corridor Sepolia hashes (compliant + every rejection + officer audit decrypt) | ⏳ pending — needs a funded key (Gate C)                                                                |
| Off-ramp sandbox payout (on-chain-triggered)                                  | ⏳ pending — needs a PSP sandbox key (Gate C2)                                                          |
| Sealed Corridor frontend (operator/sender/officer + scout's-eye)              | ✅ built · `tsc` + `next build` clean — wallet-driven Sepolia runs pending a deployed Corridor (Gate C) |
| Order III (Tier 2)                                                            | 📋 roadmap spec only                                                                                    |

**Real infra vs. local harness — stated plainly:** the local test suite runs on **Zama's own cleartext harness** (`forge-fhevm`) for fast iteration — that is a Zama-provided test host, _not_ the real coprocessor. **The real coprocessor, threshold-KMS decryption, and relayer only run on Sepolia**, so the definition of done is real Sepolia transaction hashes (tracked in `DEPLOYMENTS.md`), not green local tests. Nothing here fakes the relayer, encryption, input proof, ACL, user-decryption, or confidential transfer.

Every API name, signature, import path, and address used was verified against the installed package source and recorded in [`VERIFICATION.md`](VERIFICATION.md) (including the cross-contract ACL pattern for Order II and where the docs drift from the packages).

## Contracts & tests

```
packages/foundry/
├── src/
│   ├── Indenture.sol                     # the sealed-mandate engine (primitive)
│   ├── orders/Leash.sol                  # Order I — the blind single agent (marquee)
│   ├── orders/SealedSettlement.sol       # Order II — cross-contract consumer
│   ├── orders/ConfidentialFeed.sol       # Order II — independent sealed-value oracle
│   └── mocks/DemoConfidentialToken.sol   # ERC-7984 demo cToken for custody
├── script/DeployIndenture.s.sol          # deploys engine + token + feed to Sepolia
└── test/
    ├── Indenture.t.sol                    # Order I + engine (12) incl. leak-audit & blind-agent
    ├── SealedSettlement.t.sol             # Order II (10) incl. sealed-strike & composition
    └── CrossContractProbe.t.sol           # throwaway cross-contract ACL proof (3)
```

Run the suite (28 tests, on the cleartext harness):

```bash
pnpm install            # node deps + husky
pnpm contracts:install  # forge soldeer install
pnpm contracts:test     # forge test -vv
```

## Deploying to Sepolia

Real FHE only runs on Sepolia. You need a deployer funded with Sepolia ETH.

```bash
cp .env.example .env.local
# then set:
DEPLOYER_PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
ETHERSCAN_API_KEY=...            # optional, enables --verify
```

```bash
scripts/deploy-indenture-sepolia.sh   # deploys engine + demo cToken + ConfidentialFeed
```

Per-mandate consumers (`Leash`, `SealedSettlement`) are deployed from the frontend, where the principal generates the client-side encrypted mandate inputs via the SDK. Record all addresses + tx hashes in [`DEPLOYMENTS.md`](DEPLOYMENTS.md).

## Running the Sealed Corridor UI

The `packages/nextjs` app is the **Sealed Corridor** — three role views over one corridor, in a near-black "border checkpoint whose rulebook is sealed" design language.

```bash
cd packages/nextjs
cp .env.example .env.local      # set NEXT_PUBLIC_ALCHEMY_API_KEY, NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID
# once a Corridor is deployed (Gate C): NEXT_PUBLIC_CORRIDOR_ADDRESS=0x…  (or paste it into the in-app corridor bar)
pnpm dev                        # http://localhost:3000
```

- **`/operator`** — seal & rotate the policy (velocity ceiling, recipient screening, fund custody). Every value renders as shimmering ciphertext glyphs; the operator sets them yet holds no decrypt grant.
- **`/sender`** — submit a transfer through the sealed gate; the amount is encrypted client-side and the outcome is sealed even to you. A sealed per-sender velocity meter shows a ceiling exists, never where.
- **`/officer`** — connect as the compliance officer and decrypt a flagged transfer's sealed outcome via EIP-712 (authoritative-green resolve). Sender/operator get a visible "no decrypt grant."
- **Scout's-eye toggle** (every view) — render the corridor as an outside on-chain observer sees it: only sealed glyphs, no amounts, no thresholds, no pass/fail.

Client-side encryption uses `@zama-fhe/react-sdk` v3 (`useEncrypt`); user-decryption uses `useUserDecrypt` + `useAllow` (EIP-712). The browser never holds the FHE key. Every on-chain action is a wallet-approved tx firing the real FHEVM path; a rule breach is nullified **on-chain** (`FHE.select → 0`), never guarded in the frontend. See [`VERIFICATION.md` §5b](VERIFICATION.md).

## Roadmap

**Order III — Collective Release (N-party private quorum).** A syndicate/group action that executes only at private quorum: "I commit capital only if ≥ K others also privately commit." K parties each escrow and submit an encrypted commit signal; the engine homomorphically tallies and releases only when the encrypted count ≥ an encrypted threshold. Individual commits never decrypt. Built on the same sealed engine, a new predicate shape.

## FHEVM notes

- **ACL is mandatory and minimal here.** Every encrypted value needs `FHE.allowThis` for the contract to reuse it and `FHE.allow(handle, account)` for an account to later use/decrypt it. INDENTURE default-denies everything and comments each grant with _why_ that address may touch that handle.
- **Local runs cleartext mode.** Anvil hosts a `CleartextFHEVMExecutor` mirroring each FHE op into a plaintext map — dev-only. Sepolia uses the real relayer + KMS.

## References

[Zama Protocol docs](https://docs.zama.org/) · [`@zama-fhe/sdk`](https://github.com/zama-ai/sdk) · [forge-fhevm](https://github.com/zama-ai/forge-fhevm) · [OpenZeppelin Confidential Contracts](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts)

## License

BSD-3-Clause-Clear. See [LICENSE](LICENSE).
