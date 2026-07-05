# CLOISTRA / CLOISTRA Contracts

This package contains the Solidity side of CLOISTRA. `Cloistra.sol` is the sealed-mandate engine; `orders/Corridor.sol`
is the CLOISTRA product contract that turns the engine into a sealed compliance corridor.

## Contract Map

```text
src/
├── Cloistra.sol                     # sealed-mandate engine
├── orders/Corridor.sol               # CLOISTRA corridor + sealed velocity accumulator
├── orders/Leash.sol                  # Order I composability proof
├── orders/SealedSettlement.sol       # Order II cross-contract proof
├── orders/ConfidentialFeed.sol       # independent sealed feed for Order II
└── mocks/DemoConfidentialToken.sol   # ERC-7984 demo token
```

## Verify Locally

```bash
forge build
forge test -vv
```

The local suite runs on `forge-fhevm`'s cleartext harness. Real FHE relayer/KMS behavior is Sepolia-only; record
those transaction hashes in `../../DEPLOYMENTS.md`.

## Deploy Backbone

From the repo root:

```bash
scripts/deploy-cloistra-sepolia.sh
```

That deploys the shared CLOISTRA backbone for CLOISTRA: engine, demo confidential token, and `ConfidentialFeed`.
The CLOISTRA `Corridor` is deployed per mandate after the operator encrypts the policy inputs.
