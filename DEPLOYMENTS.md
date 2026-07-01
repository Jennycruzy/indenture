# DEPLOYMENTS.md — INDENTURE on Sepolia

> **Status: PENDING real Sepolia deploy.** Every contract below currently passes on Zama's local
> cleartext harness (28/28 forge-fhevm tests). The **definition of done is real Sepolia tx hashes**
> — the real coprocessor, threshold-KMS decryption, and relayer only run on Sepolia. This file is
> the template that the deploy fills in; do not claim a local run as a Sepolia run.
>
> **Blocked on:** a funded Sepolia deployer key + RPC URL (`DEPLOYER_PRIVATE_KEY`, `SEPOLIA_RPC_URL`).
> Once provided, run `scripts/deploy-indenture-sepolia.sh` for the backbone, then wire per-mandate
> consumers from the frontend.

Network: **Sepolia** (chainId `11155111`). FHEVM host addresses are selected by `ZamaEthereumConfig`
— none are hardcoded (see `VERIFICATION.md §2`).

## Backbone (deployed by `DeployIndenture.s.sol`)

| Contract                       | Address | Deploy tx |
| ------------------------------ | ------- | --------- |
| `Indenture` (sealed engine)    | `TBD`   | `TBD`     |
| `DemoConfidentialToken` (iUSD) | `TBD`   | `TBD`     |
| `ConfidentialFeed`             | `TBD`   | `TBD`     |

## Per-mandate consumers (deployed from the frontend)

| Contract           | Order | Address | Deploy tx |
| ------------------ | ----- | ------- | --------- |
| `Leash`            | I     | `TBD`   | `TBD`     |
| `SealedSettlement` | II    | `TBD`   | `TBD`     |

## Evidence — live tx hashes (Evidence Gates 0/2/3)

Fill each row with a real Sepolia tx hash. Rejection paths must be real on-chain outcomes, not
frontend guards.

### Evidence Gate 0 — pipeline proof (trivial FHECounter)

- Encrypted write: `TBD`
- Browser user-decryption (EIP-712 prompt visible): `TBD` (screenshot)

### Order I — Leash (Evidence Gate 2)

- Commit mandate: `TBD`
- Fund custody: `TBD`
- Compliant settlement (seal-fuse): `TBD`
- Oversize move → nullified to 0: `TBD`
- Off-allowlist payee → nullified: `TBD`
- Replay → reverts on nonce: `TBD`
- Forged ciphertext → reverts at input verification: `TBD`
- Principal decrypt (audit): `TBD`

### Order II — SealedSettlement (Evidence Gate 3)

- Feed posts sealed value: `TBD`
- Exercise in-the-money → payout: `TBD`
- Exercise out-of-the-money → 0: `TBD`
- (Strike remains sealed after settlement — proven by test; asserted on-chain via ACL.)

## Performance honesty (Phase 6)

Record real per-settlement latency + homomorphic-compute cost on Sepolia for each Order once
deployed; note any predicate near the per-tx block-gas limit (`16_777_216`).

| Order | Path                        | Gas (Sepolia) | Latency |
| ----- | --------------------------- | ------------- | ------- |
| I     | `Leash.execute`             | `TBD`         | `TBD`   |
| II    | `SealedSettlement.exercise` | `TBD`         | `TBD`   |
