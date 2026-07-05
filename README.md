# CLOISTRA

CLOISTRA is a confidential compliance corridor for cross-border transfers.

It encrypts more than the payment amount. The compliance rulebook itself is sealed: transfer caps, recipient screening, and per-sender velocity ceilings are committed as ciphertext and checked on-chain without exposing the thresholds. A transfer either moves the encrypted amount or settles to encrypted zero, and the public event stream does not reveal which rule decided the outcome.

The result is a payment corridor where senders, operators, outside observers, and competitors cannot probe the policy boundary, while a designated compliance officer can decrypt selected handles for audit.

## What Is Built

- `Cloistra.sol`: sealed-mandate engine for confidential-token custody and homomorphic policy checks
- `Corridor.sol`: cross-border transfer corridor with sealed per-sender velocity accounting
- `DemoConfidentialToken.sol`: ERC-7984 confidential token used for demos and tests
- `ConfidentialFeed.sol` and `SealedSettlement.sol`: cross-contract sealed-predicate proof
- `Leash.sol`: single-agent composability proof
- Next.js operator, sender, and officer consoles
- server-side off-ramp listener with a Flutterwave payout adapter

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
- The off-ramp listener must run outside the frontend.
- Provider payout logic should only execute after authorized officer decryption confirms `moved > 0`.

## License

BSD-3-Clause-Clear
