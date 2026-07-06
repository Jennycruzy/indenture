# DEPLOYMENTS.md — CLOISTRA

> Current target order: local gate → Sepolia verification → evidence capture → mainnet decision.

## Sepolia

Status: CLOISTRA backbone and first Sepolia `Corridor` are deployed and verified on Etherscan.

Runtime hosting:

- Frontend: deployable on Vercel from `packages/nextjs` with only `NEXT_PUBLIC_*` configuration.
- Off-ramp: deployed permanently on an always-on VPS as the `cloistra-offramp` systemd service from `/opt/cloistra/app`.
- Runtime coupling: none between Vercel and the VPS. Sepolia events are the integration point; the listener watches the engine/corridor and pays only after officer decryption confirms `moved > 0`.
- Provider posture: Flutterwave sandbox only; the VPS egress IP is whitelisted in Flutterwave for API transfers.

| Contract                | Address                                                                                                                         | Tx                                                                                                                                                                         |      Block |  Gas used |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | --------: |
| `Cloistra` engine       | [`0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee`](https://sepolia.etherscan.io/address/0xF34694B35841ceA17acc9Fb86D2b5bd3Ac276Eee) | [`0x464044567c3620035d9ae942b85ff371d24e58f8d3536e8bbe4a1fab8b322127`](https://sepolia.etherscan.io/tx/0x464044567c3620035d9ae942b85ff371d24e58f8d3536e8bbe4a1fab8b322127) | 11,210,843 |   513,140 |
| `DemoConfidentialToken` | [`0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2`](https://sepolia.etherscan.io/address/0x397ce46754a83f9c903c8e53AE9075Bd6D4d67a2) | [`0xffdbe49a0f12d6de964530a6fd0bc1fdeaff95f0305f67015bd796d0a1b08fe3`](https://sepolia.etherscan.io/tx/0xffdbe49a0f12d6de964530a6fd0bc1fdeaff95f0305f67015bd796d0a1b08fe3) | 11,210,843 | 1,696,240 |
| `ConfidentialFeed`      | [`0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6`](https://sepolia.etherscan.io/address/0xe9f2C4c32D80bc8Bed243Da4D05bE90b478777A6) | [`0xffa8c032ecf4d2b9cd4197144a32b75695af32462955a92ba088acef6c48d3d1`](https://sepolia.etherscan.io/tx/0xffa8c032ecf4d2b9cd4197144a32b75695af32462955a92ba088acef6c48d3d1) | 11,210,843 | 1,644,598 |
| `Corridor`              | [`0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b`](https://sepolia.etherscan.io/address/0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b) | [`0x351b8a0c7721cf462ec9f2d13ef2b2c676113386592fe447e8022532027fe359`](https://sepolia.etherscan.io/tx/0x351b8a0c7721cf462ec9f2d13ef2b2c676113386592fe447e8022532027fe359) | 11,210,851 |   853,737 |

Feed publisher: `0x69eb1bAA26BffCD0fA9089aa2187F6Ca3e2A54f6`

Source pin: the byte-exact source verified on Etherscan for the addresses above is git tag [`sepolia-v1`](https://github.com/Jennycruzy/Cloistra/releases/tag/sepolia-v1). Contracts on `main` after that tag differ only in the SPDX license header (aligned to BSD-3-Clause-Clear) and two doc comments; the next fresh deployment will byte-match `main` again.

Corridor parameters:

- Mandate id: `0x3d22c2c7a148f039136b47757e1eb1f365e6506be096709b10249e9c286967b0`
- Operator: `0x69eb1bAA26BffCD0fA9089aa2187F6Ca3e2A54f6`
- Compliance officer: `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`
- Window: `2,592,000` seconds (`30 days`)
- Provisioning status: encrypted mandate committed, custody funded, recipient screening set, velocity ceiling set.

Provisioning evidence:

| Step                       | Tx                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commit sealed mandate      | [`0xdd90dcb2c32654cfc5c1347a49486a157c8997cab62c90bd949159f40e037818`](https://sepolia.etherscan.io/tx/0xdd90dcb2c32654cfc5c1347a49486a157c8997cab62c90bd949159f40e037818) |
| Mint demo custody token    | [`0x67b10ccd39dd28925a622f3cefc31fb2bbb4d2b7e09230ac39eabc04a2370576`](https://sepolia.etherscan.io/tx/0x67b10ccd39dd28925a622f3cefc31fb2bbb4d2b7e09230ac39eabc04a2370576) |
| Authorize engine custody   | [`0x3088d14515836ebf3dad8415e4011909382ddaa35da33f481ff3cd408d8a4064`](https://sepolia.etherscan.io/tx/0x3088d14515836ebf3dad8415e4011909382ddaa35da33f481ff3cd408d8a4064) |
| Fund sealed custody        | [`0x3033694c84cd95e50a2e1e5cbcd9607dce11a5965cba5fc49ca2b27e2d8e8356`](https://sepolia.etherscan.io/tx/0x3033694c84cd95e50a2e1e5cbcd9607dce11a5965cba5fc49ca2b27e2d8e8356) |
| Allow sandbox recipient    | [`0x37dff09fc920ddfcd56d7859a950737c21c7d1efc3511690533ae789f4191720`](https://sepolia.etherscan.io/tx/0x37dff09fc920ddfcd56d7859a950737c21c7d1efc3511690533ae789f4191720) |
| Set velocity ceiling       | [`0x4b686fc2b4bfd92ed07bb6996fac47e7f2f25b69c09d31ee5f5efac4938aa9c7`](https://sepolia.etherscan.io/tx/0x4b686fc2b4bfd92ed07bb6996fac47e7f2f25b69c09d31ee5f5efac4938aa9c7) |
| Sender transfer, clears    | [`0x65712c3cbc41c167c316fccacb1d22ee5be9d0d6edf08867841b3e357ef57c15`](https://sepolia.etherscan.io/tx/0x65712c3cbc41c167c316fccacb1d22ee5be9d0d6edf08867841b3e357ef57c15) |
| Sender transfer, nullified | [`0x3820954f2f8cd7cd9ddc10ec7ba5554beb6f32c05134930f431e847cbaaf90a4`](https://sepolia.etherscan.io/tx/0x3820954f2f8cd7cd9ddc10ec7ba5554beb6f32c05134930f431e847cbaaf90a4) |
| Sender transfer, clears    | [`0x18f53c52b18db78b5d060606ccf1112413c04b93b08be7beb63b6a35edd63379`](https://sepolia.etherscan.io/tx/0x18f53c52b18db78b5d060606ccf1112413c04b93b08be7beb63b6a35edd63379) |

Off-ramp evidence:

- Officer decrypt processed the nullified transfer in block `11,210,997` and returned `moved = 0`.
- Officer decrypt processed the cleared transfer in block `11,211,032`; the payout adapter reached Flutterwave sandbox.
- Flutterwave initially returned `400 Please enable IP Whitelisting to access this service`; resolved by whitelisting the listener's egress IP and enabling API transfers on the account.

Gate C2 — full off-ramp loop closed with a SUCCESSFUL sandbox disbursement on a genuine on-chain clear:

Funded custody, submitted a transfer at the sealed per-transfer cap (100) that cleared every rule; the officer decrypted `moved = 100` and the Flutterwave v3 sandbox disbursed it. In the v3 sandbox a transfer to a test account stays PENDING unless the reference carries a mock-callback suffix, so the payout reference is suffixed with `_PMCKDU_1` (config `FLW_TEST_REFERENCE_SUFFIX`, empty in production), which resolves to SUCCESSFUL after ~1 min.

| Step                          | Detail                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sender transfer (100), clears | [`0xeeb263f35875c0d1aa599eacce882704eedf79bae8a370654707a433d6881e32`](https://sepolia.etherscan.io/tx/0xeeb263f35875c0d1aa599eacce882704eedf79bae8a370654707a433d6881e32) (block `11,211,728`) |
| Officer decrypt               | sealed `moved` decrypted to `100`                                                                                                                                                               |
| Flutterwave sandbox payout    | `provider=flutterwave-v3` `reference=cloistra-0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b-5_PMCKDU_1` `id=2192755` `amount=100 NGN` `status=SUCCESSFUL`                                          |

Repeat run (2026-07-06) — loop closed again after the licensing/docs refresh, via `demo-run.ts 1 100` and `process-corridor-block.ts 11215099`:

| Step                          | Detail                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sealed ceiling + autoFund     | [`0xcf1a25f8899f4b1dcc56baaf3c57544d5afda213f6977a62e00502d592377bd6`](https://sepolia.etherscan.io/tx/0xcf1a25f8899f4b1dcc56baaf3c57544d5afda213f6977a62e00502d592377bd6), [`0x84df27e893b952b47369f4dbf58686d43ba8c2824a6d362dfa8058489872154f`](https://sepolia.etherscan.io/tx/0x84df27e893b952b47369f4dbf58686d43ba8c2824a6d362dfa8058489872154f) |
| Sender transfer (100), clears | [`0x0a3da67bd1e87d29f151a115a18786c8282f990dbc98318af6042da69decbfb1`](https://sepolia.etherscan.io/tx/0x0a3da67bd1e87d29f151a115a18786c8282f990dbc98318af6042da69decbfb1) (block `11,215,099`, nonce `12`)                                                                                                                                            |
| Officer decrypt               | sealed `moved` decrypted to `100` via relayer + threshold KMS                                                                                                                                                                                                                                                                                          |
| Flutterwave sandbox payout    | `provider=flutterwave-v3` `reference=cloistra-0x4A3c965edb96f74451fe5921686e44CbFF4a8A7b-12_PMCKDU_1` `id=2192950` `amount=100 NGN` `status=SUCCESSFUL`                                                                                                                                                                                                |

Idempotency check: re-processing an already-paid settlement (block `11,211,728`) is rejected by the provider with `Payout with this ref already exists` — one clear can never disburse twice.

Fresh deployment flow:

```bash
pnpm deploy:sepolia
forge script packages/foundry/script/DeployCorridor.s.sol:DeployCorridor --rpc-url "$SEPOLIA_RPC_URL" --broadcast
```

Run before evidence capture:

```bash
pnpm cloistra:gate
```

## Ethereum Mainnet

Status: blocked until Zama FHEVM network support and production/legal readiness are confirmed.

Do not deploy CLOISTRA to Ethereum mainnet just to get an address. The current contract depends on Zama FHEVM network configuration. If the target chain does not have the required FHEVM host, ACL, KMS verifier, input verifier, and relayer support, the deployment is not a functional CLOISTRA deployment.
