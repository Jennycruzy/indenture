# CLOISTRA

CLOISTRA is a confidential compliance corridor for cross-border transfers, built on fully homomorphic encryption via the FHEVM.

It encrypts more than the payment amount. The compliance rulebook itself is sealed: transfer caps, recipient screening, and per-sender velocity ceilings are committed as FHE ciphertext and checked on-chain homomorphically — the thresholds are never decrypted, not even to be enforced. A transfer either moves the encrypted amount or settles to encrypted zero, and the public event stream does not reveal which rule decided the outcome.

The result is a payment corridor where senders, operators, outside observers, and competitors cannot probe the policy boundary, while a designated compliance officer can decrypt selected handles for audit via threshold user-decryption.

## The Problem

Every payment corridor runs on compliance thresholds: a cap per transfer, a screening list, a velocity ceiling per sender. Today those thresholds are effectively public — and a published boundary is an exploitable one:

- **Launderers structure under it.** If the cap is visible, transfers arrive at cap-minus-one, split and paced to slide exactly beneath the ceiling.
- **Bad actors probe it.** Even without the number, a corridor that _rejects_ a transfer reveals where the line is; a few probing payments map the whole rulebook.
- **Insiders leak it.** The operator's own staff can read the risk model, so it travels — to competitors and to the people it is supposed to catch.
- **Competitors copy it.** A corridor's screening and velocity model is its underwriting edge, and publishing it on-chain gives that edge away.

Confidential-payment systems so far encrypt the **amount** but publish the **rules**, so none of this changes. The fix has to be a rulebook that is _enforced by everyone but readable by no one_ — and a transfer that fails must die silently (settle to encrypted zero) so even the fact of rejection teaches an attacker nothing. That is what CLOISTRA builds. Crucially, sealed cannot mean unaccountable: a designated compliance officer must still be able to decrypt a flagged transfer for lawful audit.

## Why We Built It on Zama's FHEVM

A rulebook with those properties cannot be built from ordinary encryption or zero-knowledge alone: a ZK prover must know the policy to prove against it, and plain ciphertext cannot be compared on-chain. Fully homomorphic encryption is the one primitive that lets a public contract evaluate `amount ≤ cap`, `spent + amount ≤ ceiling`, and `recipient allowed?` while every operand stays encrypted.

Zama's FHEVM protocol is what turns that primitive into a deployable Ethereum contract — and it supplies every layer this build needs, live on Sepolia today: the `@fhevm/solidity` library for homomorphic operations in Solidity, the coprocessor that executes them, the on-chain ACL that turns "who may read what" into an enforced contract-level policy, the input verifier that rejects forged ciphertexts at the transaction boundary, and the relayer + threshold KMS that make officer audit a cryptographic user-decryption instead of a trusted server. The client story is covered by the same stack: `@zama-fhe/react-sdk` in the browser, `@zama-fhe/sdk` in the server-side off-ramp, and `forge-fhevm` for the test harness. No other stack offers this end to end.

CLOISTRA exercises the depth of that stack, not just encrypted storage:

- **Homomorphic policy evaluation** — five rules folded into one encrypted predicate, settled by a single `FHE.select` that leaks nothing, not even which rule failed.
- **The ACL as a compliance instrument** — the operator commits the policy but holds no decrypt rights over it; the corridor contract receives compute-only transient grants; only the compliance officer can decrypt. "Private to the world, accountable to the regulator" is written directly in ACL grants.
- **Cross-contract ciphertext composition** — the corridor chains the engine's sealed `moved` outcome into its encrypted velocity accumulator in the same transaction without decrypting it, and an independent feed's ciphertext enters the settlement predicate across a contract boundary.
- **Threshold user-decryption as the audit path** — officer audit in the browser and the fiat off-ramp gate on the server both run real EIP-712 user-decryptions through the relayer and threshold KMS.

## FHE At Every Confidential Boundary

Every sealed, confidential, or private value in CLOISTRA is FHEVM ciphertext, and every operation on one is homomorphic. There is no secondary privacy mechanism — no trusted server, no commit-reveal, no plaintext mirror anywhere.

| Confidential surface                               | How it is implemented                                                                                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Policy values (caps, drawdown, screening, ceiling) | `euint64` / `ebool` from [`@fhevm/solidity`](https://github.com/zama-ai/fhevm); compared with `FHE.le` / `FHE.ge` / `FHE.and`, never decrypted on-chain                          |
| Settlement outcome                                 | one `FHE.select` yields the moved amount or encrypted zero — no branch, no pass/fail bit, nothing to observe                                                                     |
| Encrypted inputs                                   | `FHE.fromExternal` with input-verification proofs — a forged or proofless ciphertext reverts on-chain at the input boundary                                                      |
| Who may read what                                  | the FHEVM on-chain ACL (`FHE.allow` / `FHE.allowThis` / `FHE.allowTransient`) — officer-only audit, blind operator, and blind agent are all expressed and enforced as ACL grants |
| Custody token                                      | ERC-7984 confidential token (OpenZeppelin confidential-contracts, FHEVM-native) — balances and transfer amounts are ciphertext                                                   |
| Browser encryption                                 | `useEncrypt` from `@zama-fhe/react-sdk` — amounts are encrypted client-side; no decryption key ever exists in the browser                                                        |
| Officer audit (frontend)                           | `useUserDecrypt` from `@zama-fhe/react-sdk` — EIP-712-authorized user-decryption through the FHEVM relayer and threshold KMS                                                     |
| Off-ramp gate (server)                             | `ZamaSDK` from `@zama-fhe/sdk` — the listener performs a genuine relayer user-decryption as the compliance officer before any fiat payout fires; never a plaintext lookup        |
| Chain wiring                                       | `ZamaEthereumConfig` selects the FHEVM host, ACL, KMS verifier, and input verifier by chainId — no hardcoded infrastructure addresses                                            |

## What Is Built

- `Cloistra.sol`: sealed-mandate engine for confidential-token custody and homomorphic policy checks
- `Corridor.sol`: cross-border transfer corridor with sealed per-sender velocity accounting
- `DemoConfidentialToken.sol`: ERC-7984 confidential token used for demos and tests
- `ConfidentialFeed.sol` and `SealedSettlement.sol`: cross-contract sealed-predicate proof
- `Leash.sol`: single-agent composability proof
- Next.js operator, sender, and officer consoles
- server-side off-ramp listener with a Flutterwave payout adapter

## Sepolia Addresses

The current Cloistra deployment on Sepolia:

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| `Cloistra` engine       | `0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee` |
| `DemoConfidentialToken` | `0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2` |
| `ConfidentialFeed`      | `0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6` |
| `Corridor`              | `0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b` |

Deployment blocks, transaction links, gas usage, and verification status are tracked in [DEPLOYMENTS.md](DEPLOYMENTS.md).

## How It Works

Every corridor transfer is checked against one combined encrypted predicate.

| Rule                | Public input             | Sealed state                          |
| ------------------- | ------------------------ | ------------------------------------- |
| Per-transfer cap    | transfer submission      | amount and cap                        |
| Recipient screening | recipient address        | whether the recipient passes policy   |
| Per-sender velocity | sender and window anchor | sender total, ceiling, and headroom   |
| Custody/drawdown    | transaction ordering     | custody balance and drawdown boundary |

If the predicate passes, the sealed moved amount is the requested amount. If it fails, the moved amount is encrypted zero. Both outcomes remain ciphertext until the compliance officer decrypts a selected handle.

## Roles

**Operator**

Runs the corridor, commits sealed mandate limits, funds custody, rotates recipient screening, and sets the sealed velocity ceiling. The operator can administer policy without receiving decrypt rights over the policy boundary.

**Sender**

Encrypts a transfer amount in the browser, submits the recipient and ciphertext to the corridor, and receives a processed transaction without learning the rule-by-rule result.

**Compliance Officer**

Receives decrypt grants for policy handles and settlement outcomes. The officer can audit selected transfers through FHEVM user-decryption and EIP-712 approval.

**Off-Ramp Listener**

Runs server-side. It watches settlement events, asks the officer decryptor for the sealed `moved` amount, and triggers the payout rail only when `moved > 0`.

## Transfer Flow

1. The operator deploys or selects a `Corridor`.
2. The operator commits a mandate into `Cloistra.sol` with a compliance officer.
3. The operator funds confidential-token custody.
4. The operator sets recipient screening and the sealed velocity ceiling.
5. A sender encrypts an amount in the browser.
6. The sender calls `Corridor.transfer`.
7. The corridor computes the sealed velocity predicate.
8. `Cloistra.sol` combines velocity, cap, screening, custody, and drawdown checks.
9. The engine settles with one encrypted outcome: moved amount or zero.
10. The corridor updates the sender's encrypted velocity total by the actual moved amount.
11. The compliance officer can decrypt selected outcomes for audit.
12. The off-ramp listener can trigger payout after officer decryption confirms `moved > 0`.

## Off-Ramp Rail

CLOISTRA includes a server-side off-ramp rail that demonstrates how a sealed on-chain outcome can drive fiat payout infrastructure.

The listener pairs:

- on-chain `Settled` and `CorridorTransfer` events
- officer decryption of the sealed `moved` handle
- idempotent payout references keyed by corridor and nonce
- a Flutterwave v3 adapter for NGN bank-transfer flows

The payout provider is behind a typed `PayoutProvider` interface, so additional rails can be added without changing the corridor contracts.

For the hosted demo, the frontend and listener are intentionally split:

- the Next.js app can run on Vercel because encryption, wallet signing, chain reads, and officer browser decrypts are client-side flows against Sepolia and the Zama relayer
- the off-ramp listener runs permanently on an always-on VPS as `cloistra-offramp.service`, because it is a long-lived Sepolia event watcher with a Node/FHE worker

There is no HTTP dependency between Vercel and the VPS. The frontend writes Sepolia transactions; the VPS reads Sepolia events and triggers Flutterwave sandbox payouts after officer decryption confirms `moved > 0`.

## Repository Layout

```text
packages/foundry/
  src/
    Cloistra.sol
    orders/Corridor.sol
    orders/Leash.sol
    orders/SealedSettlement.sol
    orders/ConfidentialFeed.sol
    mocks/DemoConfidentialToken.sol
  script/
    DeployCloistra.s.sol
    DeployCorridor.s.sol
  test/
    Cloistra.t.sol
    Corridor.t.sol
    SealedSettlement.t.sol
    CrossContractProbe.t.sol

packages/nextjs/
  app/
    operator/
    sender/
    officer/
  components/cloistra/
  hooks/cloistra/
  contracts/cloistra/

packages/offramp/
  src/
    listener.ts
    officer.ts
    providers/flutterwave.ts
```

## Running Locally

Install dependencies:

```bash
pnpm install
pnpm contracts:install
```

Run the verification gate:

```bash
pnpm cloistra:gate
```

Run the frontend:

```bash
pnpm start
```

Start a local Anvil + FHEVM stack:

```bash
pnpm chain
```

Deploy the local contracts into an already running local stack:

```bash
pnpm deploy:localhost
```

## Sepolia Deployment

Deploy the shared Cloistra backbone:

```bash
cp .env.example .env.local
# set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
# set ETHERSCAN_API_KEY when source verification is needed
pnpm deploy:sepolia
```

Deploy a corridor against the backbone:

```bash
cd packages/foundry
forge script script/DeployCorridor.s.sol:DeployCorridor --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

Current deployment status, addresses, transaction links, and gas usage are tracked in [DEPLOYMENTS.md](DEPLOYMENTS.md).

## Frontend

The app exposes three operational views:

- `/operator`: commit sealed policy, fund custody, screen recipients, set velocity ceiling
- `/sender`: submit encrypted transfers through a corridor
- `/officer`: audit selected policy handles and settlement outcomes

The UI also includes a scout's-eye mode showing what an outside observer can infer: addresses, ordering, nonces, receipt hashes, and ciphertext handles, but not limits, amounts, screening decisions, or pass/fail reasons.

### Vercel Environment

The hosted frontend only needs public browser configuration:

```text
NEXT_PUBLIC_ALCHEMY_API_KEY=<Alchemy Sepolia API key>
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=<WalletConnect project id>
NEXT_PUBLIC_CORRIDOR_ADDRESS=0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b
NEXT_PUBLIC_CLOISTRA_DEPLOY_BLOCK=11210843
```

Do not put off-ramp secrets in Vercel. `OFFICER_PRIVATE_KEY`, `FLW_SECRET_KEY`, `SEPOLIA_RPC_URL`, `BENEFICIARIES_JSON`, and related listener env vars belong only on the VPS.

## Verification

The main gate is:

```bash
pnpm cloistra:gate
```

It runs:

- old-name scan
- Foundry build
- 39 Foundry tests
- frontend typecheck
- off-ramp typecheck
- Prettier check

Additional frontend checks:

```bash
pnpm --filter ./packages/nextjs lint
pnpm --filter ./packages/nextjs build
```

## Security Notes

- The contracts are unaudited.
- Local tests use Zama's cleartext FHEVM harness.
- Live encrypted execution and user-decryption require supported FHEVM infrastructure.
- Private keys and provider credentials stay server-side.
- The off-ramp listener must run outside the frontend; the hosted demo runs it as a persistent VPS systemd service.
- Provider payout logic should only execute after authorized officer decryption confirms `moved > 0`.

## License

BSD-3-Clause-Clear
