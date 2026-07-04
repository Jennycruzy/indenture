# @indenture/offramp — VEIL sandbox off-ramp listener (Phase C2)

Fires a **real sandbox fiat payout** on a **genuine on-chain corridor clear**. Sandbox-only by design — it
does **not** fund a float or complete production KYC (see [`VERIFICATION.md §6e`](../../VERIFICATION.md)).

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

## What you provide

Drop these into `.env.local` (gitignored, server-side only) and the edge is wired:

| Var                                 | What it is                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `FLW_SECRET_KEY`                    | Flutterwave **sandbox** v3 secret key (`FLWSECK_TEST…`) — the only cred needed  |
| `OFFICER_PRIVATE_KEY`               | the compliance-officer signer (holds the decrypt grant) — never operator/sender |
| `CORRIDOR_ADDRESS`                  | the deployed VEIL Corridor (Phase C)                                            |
| `SEPOLIA_RPC_URL`, `ENGINE_ADDRESS` | chain access (engine address defaults to the live backbone)                     |
| `BENEFICIARIES_JSON`                | on-chain recipient → KYC'd fiat destination map                                 |

## Run

```bash
cp packages/offramp/.env.example packages/offramp/.env.local   # fill in the values above
pnpm --filter @indenture/offramp start        # or `dev` for watch mode
```

## Still to wire (Gate C2)

- `ZamaOfficerDecryptor.decryptMoved` isolates the real `@zama-fhe/sdk` v3 user-decryption; confirm the SDK
  signature against the installed package and enable it (the flow is laid out inline).
- Fund the sandbox test balance and run one real transfer (the `POST /v3/transfers` path is verified — the test
  key authenticates, `GET /v3/transfers` → 200), then record the provider reference id in
  [`DEPLOYMENTS.md`](../../DEPLOYMENTS.md) Gate C2.
