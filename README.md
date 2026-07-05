# VEIL

VEIL is a confidential compliance corridor for cross-border transfers.

It does not only encrypt payment amounts. It encrypts the compliance rulebook itself: the transfer cap, recipient screening flag, and per-sender velocity ceiling are ciphertext. Every transfer is still checked on-chain against those rules, but the sender, operator, outside observers, and competing corridors cannot read the thresholds or probe where the boundary is.

If a transfer fails any sealed rule, VEIL settles the moved amount to zero on-chain. It does not reveal which rule failed. A designated compliance officer can later decrypt a specific outcome for audit.

## What VEIL Does

VEIL lets a corridor operator set private transfer rules and then lets senders submit encrypted transfer attempts through those rules.

The operator can:

- deploy or select a corridor
- commit sealed mandate limits
- fund confidential-token custody
- rotate recipient screening flags
- set a sealed per-sender velocity ceiling

The sender can:

- encrypt a transfer amount in the browser
- submit a recipient and encrypted amount to the corridor
- receive only a sealed outcome, not a rule-by-rule explanation

The compliance officer can:

- decrypt policy handles and settlement outcomes when auditing
- verify whether a transfer moved value or was nullified
- inspect flagged outcomes without giving the operator or sender blanket visibility

An outside observer can see:

- public addresses
- transaction ordering
- public nonces and receipt hashes
- ciphertext handles

An outside observer cannot see:

- transfer amounts
- compliance thresholds
- recipient screening decisions
- velocity headroom
- which sealed rule caused a zero settlement

## The Core Idea

Most confidential-payment systems hide the amount but publish the policy. That means the compliance line is public: an attacker can structure payments just below it, and a competitor can copy it.

VEIL hides the policy too.

The rule checks are homomorphic. The contracts compute over encrypted values without decrypting them. The final settlement path uses `FHE.select`: either the proposed amount moves, or zero moves. Both outcomes remain sealed until an authorized compliance officer decrypts them.

## The Three Sealed Rules

Every corridor transfer is checked against one combined encrypted predicate.

| Rule                | What it means                                        | What is public            | What is sealed                          |
| ------------------- | ---------------------------------------------------- | ------------------------- | --------------------------------------- |
| Per-transfer cap    | A single transfer cannot exceed the committed limit. | A transfer was submitted. | The limit and encrypted amount.         |
| Recipient screening | A recipient must be allowed by the corridor policy.  | The recipient address.    | Whether the recipient passes screening. |
| Per-sender velocity | A sender cannot exceed a rolling encrypted total.    | The time window anchor.   | Sender total, ceiling, and headroom.    |

If any rule fails, the engine moves `0`. The event stream does not say whether the cap, screening, velocity, custody, or drawdown rule caught the transfer.

## Roles

### Operator

The operator runs the corridor. It commits the sealed policy, funds custody, and manages recipient screening.

The operator does not receive decrypt rights over the sealed policy in a VEIL corridor. This matters: the operator can run the corridor without being able to leak or game the compliance line.

### Sender

The sender submits a transfer. The sender encrypts the amount client-side and signs the transaction.

The sender learns that the transaction was processed, but not the sealed policy boundary and not the rule-by-rule reason for a zero settlement.

### Compliance Officer

The compliance officer is the audit role. It is a separate address that receives decrypt grants over policy handles and settlement outcomes.

The officer can decrypt a specific flagged transfer using FHEVM user-decryption and EIP-712 approval. This is the accountability path: private to the public, inspectable by the authorized auditor.

### Provider Listener

The off-ramp listener is a server process. It watches for corridor settlement events, asks the compliance officer decryptor for the sealed `moved` amount, and calls a payout provider only if `moved > 0`.

The listener is not a source of compliance truth. It follows the on-chain sealed outcome.

## Transfer Flow

1. The operator deploys or selects a `Corridor`.
2. The operator commits a mandate into `Veil.sol` with a distinct compliance officer.
3. The operator funds confidential-token custody.
4. The operator sets recipient screening and the sealed velocity ceiling.
5. A sender encrypts an amount in the browser.
6. The sender calls `Corridor.transfer`.
7. The corridor computes the sealed velocity predicate.
8. `Veil.sol` combines velocity with cap, screening, custody, and drawdown checks.
9. `Veil.sol` settles through one path:
   - compliant transfer: encrypted `moved = amount`
   - failed transfer: encrypted `moved = 0`
10. The corridor updates the sender's encrypted velocity total by the actual moved amount.
11. The compliance officer can decrypt selected outcomes for audit.
12. The off-ramp listener can pay out fiat only after decrypting `moved > 0`.

## What Is Real Today

### Built and Tested

The current VEIL codebase has:

- `Veil.sol`: sealed-mandate engine
- `Corridor.sol`: cross-border corridor with sealed per-sender velocity
- `Leash.sol`: single-agent composability proof
- `SealedSettlement.sol` and `ConfidentialFeed.sol`: cross-contract sealed-predicate proof
- Next.js role UI for operator, sender, and officer
- off-ramp listener with a Flutterwave provider adapter

The mandatory gate is:

```bash
pnpm veil:gate
```

That gate verifies:

- no tracked source references to the previous project name
- contract build
- exactly 39 passing Foundry tests
- frontend typecheck
- off-ramp typecheck
- Prettier formatting

### Deployed on Sepolia

The VEIL backbone is deployed on Sepolia:

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| `Veil` engine           | `0x867f55aE8497fDA9ab4792FA9aEbbcfd7508B393` |
| `DemoConfidentialToken` | `0x01e256c9751aaECB591e0eEf8442a8F127D9bd55` |
| `ConfidentialFeed`      | `0xf07f473D7D195b64f9d904BC95b5B8c39D01bdA5` |

Deployment block: `11,209,245`.

Transaction links and gas usage are recorded in [DEPLOYMENTS.md](DEPLOYMENTS.md).

Source verification on Etherscan is complete for the `Veil` engine, `DemoConfidentialToken`, and `ConfidentialFeed`.

## What Is Not Done Yet

VEIL is not production software.

Still pending:

- a deployed Sepolia `Corridor` for the full operator/sender/officer flow
- real Sepolia evidence for compliant transfer, nullified transfer, velocity breach, and officer decrypt
- production security audit
- production custody model
- production compliance review
- production payout-provider approval and funding

Ethereum mainnet deployment is blocked until the target chain has the required Zama FHEVM infrastructure and the production/legal posture is ready.

## Naira and Cross-Border Payments

VEIL itself does not hold naira and does not magically create fiat settlement.

VEIL controls whether an on-chain confidential transfer cleared. The off-ramp listener can then call a payout provider. The current adapter targets Flutterwave transfers for Nigeria / NGN.

There are two different modes:

| Mode       | What happens                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sandbox    | Uses Flutterwave test credentials and simulated test-bank flows. No real naira reaches a real recipient.                                                                                  |
| Production | Requires live Flutterwave approval, live keys, funded balances, compliant recipient details, and operational controls. This can move real NGN if the provider account is live and funded. |

So the answer is: sandbox is not real naira; production can be real naira, but only through a live payout provider account and compliance-approved operations.

## Repository Layout

```text
packages/foundry/
  src/
    Veil.sol
    orders/Corridor.sol
    orders/Leash.sol
    orders/SealedSettlement.sol
    orders/ConfidentialFeed.sol
    mocks/DemoConfidentialToken.sol
  script/
    DeployVeil.s.sol
  test/
    Veil.t.sol
    Corridor.t.sol
    SealedSettlement.t.sol
    CrossContractProbe.t.sol

packages/nextjs/
  app/
    operator/
    sender/
    officer/
  components/veil/
  hooks/veil/
  contracts/veil/

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

Run the mandatory gate:

```bash
pnpm veil:gate
```

Run the frontend:

```bash
pnpm start
```

Start a local FHEVM/anvil stack:

```bash
pnpm chain
```

Deploy to Sepolia:

```bash
cp .env.example .env.local
# set SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
# set ETHERSCAN_API_KEY if source verification is required
pnpm deploy:sepolia
```

## Frontend Views

The app has three operational views:

- `/operator`: set sealed policy, fund custody, screen recipients
- `/sender`: submit encrypted transfers
- `/officer`: decrypt selected policy handles and outcomes for audit

The UI also includes a scout's-eye mode, which shows what an outside observer can infer: addresses, ordering, and ciphertext handles, but not limits, amounts, screening decisions, or pass/fail reasons.

## Security Notes

- This code is unaudited.
- Local tests use Zama's cleartext FHEVM harness for development speed.
- Real FHE execution and user-decryption require supported live FHEVM infrastructure.
- Private keys and provider secrets must stay out of the frontend.
- The off-ramp must run server-side.
- A zero settlement must be treated as final: the provider must not pay fiat unless `moved > 0` is decrypted by the authorized officer path.

## License

BSD-3-Clause-Clear. See [LICENSE](LICENSE).
