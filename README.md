# INDENTURE

**Everyone else encrypts the amounts. INDENTURE encrypts the _rule_ — and hides it even from the actor it governs.**

INDENTURE is an encrypted, self-enforcing mandate for autonomous agents that hold and move money. The limits — per-trade cap, total exposure, drawdown floor, payee allowlist — are committed on-chain as ciphertext and enforced homomorphically by the [Zama Protocol (FHEVM)](https://docs.zama.org/protocol). A non-compliant move is silently nullified to zero on-chain via a single `FHE.select`; it cannot even be expressed. And **the agent the mandate governs cannot read the limits it is bound by** — the leash is made of math and is invisible to everyone: the public, front-runners, _and the agent itself_.

## This is not "confidential settlement"

Confidential settlement hides the **amounts** of a transfer, or gates a transfer against a **known, public** compliance rule. INDENTURE is a different category:

- It hides the **rule itself**, not just the amount.
- Its adversary is an **insider** — a delegated agent holding the funds that might try to exceed its mandate — made mathematically incapable of doing so and kept **blind** to the limits so it cannot game or leak them.
- It is a **horizontal primitive**: one sealed-mandate engine that other contracts compose against _without decrypting it_, not a single-vertical app.

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

| Piece                                            | State                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `Indenture.sol` engine + Order I `Leash`         | ✅ built · 12 harness tests                                      |
| Order II `SealedSettlement` + `ConfidentialFeed` | ✅ built · 10 harness tests · cross-contract ACL probe (3 tests) |
| Leak-audit + blind-agent tests                   | ✅ passing (see `test/`)                                         |
| Real Sepolia tx hashes (happy + rejection paths) | ⏳ pending a funded deployer key — see `DEPLOYMENTS.md`          |
| Sealed Obsidian frontend (Orders I–II)           | ⏳ pending                                                       |
| Order III (Tier 2)                               | 📋 roadmap spec only                                             |

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

## Roadmap

**Order III — Collective Release (N-party private quorum).** A syndicate/group action that executes only at private quorum: "I commit capital only if ≥ K others also privately commit." K parties each escrow and submit an encrypted commit signal; the engine homomorphically tallies and releases only when the encrypted count ≥ an encrypted threshold. Individual commits never decrypt. Built on the same sealed engine, a new predicate shape.

## FHEVM notes

- **ACL is mandatory and minimal here.** Every encrypted value needs `FHE.allowThis` for the contract to reuse it and `FHE.allow(handle, account)` for an account to later use/decrypt it. INDENTURE default-denies everything and comments each grant with _why_ that address may touch that handle.
- **Local runs cleartext mode.** Anvil hosts a `CleartextFHEVMExecutor` mirroring each FHE op into a plaintext map — dev-only. Sepolia uses the real relayer + KMS.

## References

[Zama Protocol docs](https://docs.zama.org/) · [`@zama-fhe/sdk`](https://github.com/zama-ai/sdk) · [forge-fhevm](https://github.com/zama-ai/forge-fhevm) · [OpenZeppelin Confidential Contracts](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts)

## License

BSD-3-Clause-Clear. See [LICENSE](LICENSE).
