# @cloistra/offramp — CLOISTRA off-ramp listener

Fires a **sandbox fiat payout** on a **genuine on-chain corridor clear**. Sandbox-only by design — it does
**not** fund a float or complete production KYC (see [`VERIFICATION.md`](../../VERIFICATION.md)).

## What it does

1. Watches the engine's `Settled(id, nonce, receipt, outcomeHandle)` and the corridor's
   `CorridorTransfer(sender, recipient, nonce)` on Sepolia.
2. **Officer-decrypts** `outcomeHandle` (`moved`) — the listener runs as the compliance officer, the only
   identity with the ACL grant. Neither event reveals cleared-vs-nullified; that is sealed.
3. **The gate:** pays out **only when `moved > 0`** — a nullified transfer (any rule failed) disburses nothing.
   The fiat leg is genuinely caused by, and proportional to, a real clear.
4. Disburses via the **Flutterwave v3 Transfers** adapter (Nigeria / NGN bank transfer), keyed idempotently to
   `(corridorId, nonce)`.

The PSP sits behind a typed `PayoutProvider` seam (`src/providers/types.ts`) — swapping providers is one file.

The full loop has been closed end-to-end on Sepolia: a transfer that cleared every sealed rule was
officer-decrypted to `moved = 100` and disbursed as a SUCCESSFUL sandbox payout. The evidence (tx hashes,
provider reference, payout id) is recorded in [`DEPLOYMENTS.md`](../../DEPLOYMENTS.md).

## What you provide

Drop these into `.env.local` (gitignored, server-side only) and the edge is wired:

| Var                                 | What it is                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `FLW_SECRET_KEY`                    | Flutterwave **sandbox** v3 secret key (`FLWSECK_TEST…`) — the only cred needed  |
| `OFFICER_PRIVATE_KEY`               | the compliance-officer signer (holds the decrypt grant) — never operator/sender |
| `CORRIDOR_ADDRESS`                  | the deployed CLOISTRA Corridor                                                  |
| `SEPOLIA_RPC_URL`, `ENGINE_ADDRESS` | chain access for the deployed CLOISTRA engine                                   |
| `BENEFICIARIES_JSON`                | on-chain recipient → KYC'd fiat destination map                                 |
| `FLW_TEST_REFERENCE_SUFFIX`         | sandbox-only mock-callback suffix (e.g. `_PMCKDU_1`); keep empty in production  |

## Run

```bash
cp packages/offramp/.env.example packages/offramp/.env.local   # fill in the values above
pnpm --filter @cloistra/offramp start        # or `dev` for watch mode
```

## Officer decryption

`ZamaOfficerDecryptor` (`src/officer.ts`) performs a real FHEVM user-decryption via `@zama-fhe/sdk` v3: a
`RelayerNode` (Node worker-thread relayer) + a `ViemSigner` backed by the officer key drive
`ZamaSDK.allow([engine])` (one-time EIP-712, signed non-interactively) then
`ZamaSDK.userDecrypt([{ handle, contractAddress }])` through the relayer and threshold KMS. The contract
ACL-grants `moved` to the officer only, so any other identity is rejected — it is never a plaintext lookup.
