# VERIFICATION.md — CLOISTRA Gate

CLOISTRA evidence must start with this gate:

```bash
pnpm cloistra:gate
```

The gate enforces:

- no tracked source references to the previous project name
- `forge build --sizes`
- exactly 39 passing Foundry tests
- frontend typecheck
- off-ramp typecheck
- Prettier check

## Network Position

CLOISTRA uses `ZamaEthereumConfig`, so deployment is only meaningful on networks with the required Zama FHEVM infrastructure. Sepolia is the first live target. Ethereum mainnet deployment is not approved until FHEVM mainnet support, contract verification, operational custody, and compliance posture are confirmed.

## Fiat Off-Ramp

The off-ramp package is a server-side listener. It officer-decrypts the sealed `moved` amount and calls the configured payout provider only when `moved > 0`.

The current provider adapter is Flutterwave v3 Transfers for Nigeria / NGN. In sandbox mode it simulates payout flow using test credentials and test bank details. That is not production naira movement. Production naira requires a live Flutterwave account, live funding balance, production keys, supported recipient bank details, and the relevant compliance approvals.
