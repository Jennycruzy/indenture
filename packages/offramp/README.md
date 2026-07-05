# @cloistra/offramp — CLOISTRA sandbox off-ramp listener (Phase C2)

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
| `CORRIDOR_ADDRESS`                  | the deployed CLOISTRA Corridor (Phase C)                                        |
| `SEPOLIA_RPC_URL`, `ENGINE_ADDRESS` | chain access for the freshly deployed CLOISTRA engine                           |
| `BENEFICIARIES_JSON`                | on-chain recipient → KYC'd fiat destination map                                 |

## Run

```bash
cp packages/offramp/.env.example packages/offramp/.env.local   # fill in the values above
pnpm --filter @cloistra/offramp start        # or `dev` for watch mode
```

## Officer decryption

`ZamaOfficerDecryptor` (`src/officer.ts`) is wired to the real `@zama-fhe/sdk` v3 API: a `RelayerNode`
(Node worker-thread relayer) + a `ViemSigner` backed by the officer key drive `ZamaSDK.allow([engine])`
(one-time EIP-712, signed non-interactively) then `ZamaSDK.userDecrypt([{ handle, contractAddress }])`.
Verified: `tsc` clean and the SDK constructs in Node (imports resolve, workers/WASM deferred). A **live
decrypt** returning cleartext needs a deployed Corridor emitting a sealed `moved` ACL-granted to the officer.

## Still to run (Gate C2)

- Deploy a Corridor (Phase C) so a genuine clear emits a `moved` handle the officer can decrypt.
- Fund the sandbox test balance and run one real transfer (the `POST /v3/transfers` path is verified — the test
  key authenticates, `GET /v3/transfers` → 200), then record the provider reference id in
  [`DEPLOYMENTS.md`](../../DEPLOYMENTS.md) Gate C2.
