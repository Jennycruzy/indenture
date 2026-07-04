# VERIFICATION.md — pinned versions & verified FHEVM API surface

> Per the build laws: **nothing here is from memory or from the build prompt's code
> sketches.** Every fact below was read out of the _installed package source_ under
> `packages/foundry/dependencies/` and `packages/nextjs/node_modules/`, or observed
> from a real local `forge build` / `forge test` run. Where the build prompt's sketch
> disagreed with the installed package, the installed package wins and the drift is noted.

Last verified: 2026-07-01 · scaffold = fork of `zama-ai/fhevm-react-template`.

---

## 1. Pinned versions (locked)

### Solidity / Foundry (from `packages/foundry/foundry.toml` + `soldeer.lock`)

| Dependency                             | Version / rev                             |
| -------------------------------------- | ----------------------------------------- |
| solc                                   | `0.8.27` (evm: `cancun`)                  |
| `@fhevm-solidity`                      | `0.11.1`                                  |
| `@encrypted-types`                     | `0.0.4`                                   |
| `@openzeppelin-confidential-contracts` | git rev `6edd293` (v0.3.0 line, ERC-7984) |
| `@openzeppelin-contracts`              | `5.1.0`                                   |
| `@openzeppelin-contracts-upgradeable`  | `5.1.0`                                   |
| `forge-std`                            | `1.14.0`                                  |
| `forge-fhevm`                          | git rev `eba2324`                         |
| Foundry (forge/cast)                   | `1.7.1`                                   |

### JS / frontend (from `packages/nextjs/package.json`)

| Dependency               | Version                                             |
| ------------------------ | --------------------------------------------------- |
| `@zama-fhe/sdk`          | `^3.0.0`                                            |
| `@zama-fhe/react-sdk`    | `^3.0.0`                                            |
| `wagmi`                  | `^2.19.5` · `viem` `^2.47.12`                       |
| `@rainbow-me/rainbowkit` | `^2.2.10`                                           |
| `next`                   | `~15.2.3` · `react` `~19.0.0`                       |
| `@tanstack/react-query`  | `^5.96.2`                                           |
| Node                     | `24.14.0` (engines require `>=20`) · pnpm `10.32.1` |

---

## 2. Solidity FHE API — verified signatures (`@fhevm/solidity/lib/FHE.sol`)

Import surface (from the template's `FHECounter.sol`, confirmed present):

```solidity
import {FHE, euint32, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
```

Ops verified to exist for the `(euint64, euint64)` overload (line refs into installed FHE.sol):

- `FHE.add/sub/mul(euint64,euint64) → euint64` (3682 / 3695 / 3708)
- `FHE.le/ge/eq(euint64,euint64) → ebool` (3812 / 3786 / 3760)
- `FHE.and(ebool,ebool) → ebool`, `FHE.or(ebool,ebool) → ebool` (146 / 159)
- `FHE.select(ebool, euint64, euint64) → euint64` (7868)
- `FHE.asEuint64(uint64) → euint64` (8614) · `FHE.asEbool(bool) → ebool` (8510) · `FHE.asEuint64(ebool) → euint64` (8199)
- `FHE.fromExternal(externalEuint64, bytes proof) → euint64` (8598) · `FHE.fromExternal(externalEbool, bytes) → ebool` (8494)

ACL (per encrypted type; euint64 refs shown):

- `FHE.allow(value, address) → value` (9081) — persistent decrypt/use grant to an account
- `FHE.allowThis(value) → value` (9092) — persistent grant to the current contract
- `FHE.allowTransient(value, address) → value` (9103) — grant for the current tx only
- `FHE.makePubliclyDecryptable(value)` (9114) · `FHE.isSenderAllowed(value) → bool` (9074) · `FHE.isAllowed(value, addr) → bool`

**Config base:** inherit **`ZamaEthereumConfig`** (abstract contract). It wires ACL / Coprocessor /
KMSVerifier / relayer addresses automatically for **both** Ethereum mainnet (chainId 1) and
**Sepolia (11155111)** — so no addresses are ever hardcoded.

> **DRIFT vs build prompt:** the prompt sketch referenced a Solidity `SepoliaConfig`. The installed
> `0.11.1` package exposes the on-chain base as `ZamaEthereumConfig` (chooses by chainId). `SepoliaConfig`
> exists but on the **JS** side (`@zama-fhe/sdk`), not as the Solidity base. Using `ZamaEthereumConfig`.

## 3. ERC-7984 confidential token (`@openzeppelin/confidential-contracts`)

Interface `IERC7984` (verified in `interfaces/IERC7984.sol`):

- `confidentialBalanceOf(address) → euint64`
- `confidentialTransfer(address to, euint64 amount) → euint64` — **no-proof variant; requires
  `FHE.isAllowed(amount, msg.sender)`** (ERC7984.sol:125). This is the engine's settlement call.
- `confidentialTransfer(address to, externalEuint64, bytes proof) → euint64` — proof variant (funding)
- `confidentialTransferFrom(...)`, `setOperator(address operator, uint48 until)`, `isOperator(...)`
- Base `ERC7984(name, symbol, tokenURI)` constructor; concrete mock `ERC7984Mock` shows `$_mint(to, uint64)`.

**Verified custody/settlement pattern** for a contract that holds cToken and moves `moved` out:

```solidity
FHE.allowTransient(moved, address(token)); // token contract must be able to USE the handle
token.confidentialTransfer(payee, moved);  // engine is msg.sender; engine already allowed on `moved`
```

`_update` auto-grants the transferred handle to `from`, `to`, and itself (ERC7984.sol:305-307), and
uses `FHE.select(success, amount, 0)` internally so an over-balance transfer moves 0 (never reverts).

## 4. forge-fhevm cleartext test harness (`forge-fhevm/FhevmTest.sol`)

Verified from the template's passing `FHECounter.t.sol` (3/3 pass locally):

- `contract X is FhevmTest { function setUp() public override { super.setUp(); ... } }`
- `encryptUint32(clear, user, contractAddr) → (externalEuint32, bytes inputProof)` — expect
  analogous `encryptUint64`; confirm by reading `forge-fhevm-eba2324/src` before Phase 1 tests.
- `signUserDecrypt(PK, contractAddr) → bytes sig`
- `userDecrypt(bytes32 handle, user, contractAddr, sig) → uint256 clear`
- `vm.prank(addr)` sets msg.sender; `euint64.unwrap(handle)` → bytes32 (0 == uninitialized).

> **Honesty note:** this harness is Zama's own **local cleartext host** — allowed for fast iteration.
> It is **NOT** the real coprocessor/KMS/relayer. Real FHE + threshold decryption only runs on
> **Sepolia**. Definition of done = real Sepolia tx hashes, not green local tests.

## 5. Frontend v3 SDK API (verified in template `packages/nextjs`)

Provider wiring (`components/DappWrapperWithProviders.tsx`):

- `ZamaProvider` (from `@zama-fhe/react-sdk`) wraps the app, given `relayer`, `signer` (custom
  `WagmiSigner`), `storage`/`sessionStorage` (`IndexedDBStorage`), `onEvent`.
- Relayer: `new RelayerWeb({ getChainId, transports: { [SepoliaConfig.chainId]: SepoliaConfig } })`
  for real nets; `new RelayerCleartext(hardhatCleartextConfig)` (from `@zama-fhe/sdk/cleartext`) for chainId 31337.
- `SepoliaConfig`, `IndexedDBStorage`, `RelayerWeb`, `ZERO_HANDLE`, `ZamaSDKEvents` all from `@zama-fhe/sdk`.

Hooks (`hooks/fhecounter-example/useFHECounterWagmi.tsx`):

- `useEncrypt().mutateAsync({ values:[{value:BigInt, type:"euint64"}], contractAddress, userAddress })
→ { handles: Uint8Array[], inputProof: Uint8Array }`; pass `bytesToHex(handles[0])`, `bytesToHex(inputProof)` as tx args.
- `useUserDecrypt({ handles:[{handle, contractAddress}] }, { enabled }) → { data: { [handle]: bigint } }`
- `useAllow()` (mutation; acquires FHE keypair + EIP-712 signature), `useIsAllowed({ contractAddresses })`.
- **Gas:** FHE ops are gas-heavy — cap tx `gas` below Sepolia block limit `16_777_216` (template uses `15_000_000`).
  The INDENTURE settlement does many more FHE ops than the counter → **measure real gas; may need to split logic.**

## 5b. VEIL frontend hooks (verified against installed `@zama-fhe/react-sdk@3` + `next build`)

The Sealed Corridor UI (`app/{operator,sender,officer}`, `components/veil/*`, `hooks/veil/*`) reuses the
exact SDK surface proven by the counter example (§5). Confirmed against the installed package `.d.ts`
(`node_modules/@zama-fhe/react-sdk/dist/index.d.ts`) — not assumed:

- `useEncrypt()` → mutation; `mutateAsync({ values:[{value, type}], contractAddress, userAddress })`. Encryptable
  `type` union in `@zama-fhe/sdk` includes `"euint64"`, `"ebool"`, `"eaddress"` (grepped). VEIL uses
  `"euint64"` for amounts / ceiling / fund, `"ebool"` for the screening bit.
- `useUserDecrypt({ handles:[{handle, contractAddress}] }, { enabled })` — the officer decrypt. `contractAddress`
  is the contract whose ACL granted the officer: the **Corridor** for the ceiling + per-sender total, the
  **engine** for the mandate limits + the `Settled` outcome handle.
- `useAllow(options?)` (mutation over `Address[]`) + `useIsAllowed({ contractAddresses })` (query → boolean).
  `useIsAllowed`'s config types `contractAddresses` as a **non-empty tuple** `[Address, ...Address[]]`; the reveal
  path is gated by `hasTargets` so an empty set never decrypts.
- viem type note: the token's `setOperator(address, uint48)` — viem maps `uint48` to **`number`**, not `bigint`.
- The whole frontend passes `tsc --noEmit` and a production `next build`. The only build warnings are the
  template's pre-existing optional-dep notices (`@react-native-async-storage/async-storage` under MetaMask SDK;
  the `ox`/`viem` `tempo` "critical dependency" expression) — not from VEIL code.

## 6. Env vars (from `.env.example`, consumed by `scripts/deploy-sepolia.sh`)

`SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY` (optional). Frontend also uses
`NEXT_PUBLIC_ALCHEMY_API_KEY`, `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`. **None hardcoded — all from env.**

## 6b. Blind-agent proof mechanism (verified)

`FhevmTest` exposes `ACL internal _acl`. In tests, assert the blind-agent property **directly**:
`assertFalse(_acl.persistAllowed(euint64.unwrap(handle), agent))` and
`assertTrue(_acl.persistAllowed(euint64.unwrap(handle), principal))`. ACL query surface
(`fhevm-host/contracts/ACL.sol`): `isAllowed(bytes32,address)`, `persistAllowed(bytes32,address)`,
`allowedTransient(bytes32,address)`, `isAllowedForDecryption(bytes32)`.
Harness encrypt helpers confirmed: `encryptUint64(v,user,target)`, `encryptBool(v,user,target)`, `encryptAddress(v,user,target)`.

## 6c. Cross-contract ACL grant pattern for Order II (verified — the composability hinge)

Read verbatim from `dependencies/forge-fhevm-eba2324/src/fhevm-host/contracts/ACL.sol`:

- `allow(bytes32 handle, address account)` (L186) — **persistent** grant
  (`persistedAllowedPairs[handle][account] = true`). Requires the **caller** to itself be
  `isAllowed(handle, msg.sender)` or it reverts (`SenderNotAllowed`). → a contract can only grant on a
  handle it already owns.
- `allowTransient(bytes32 handle, address account)` (L233) — **tx-scoped** grant (transient storage);
  same caller requirement.
- `isAllowed(handle, acct)` (L430) = `allowedTransient(handle,acct) || persistAllowed(handle,acct)`.
- A homomorphic op (`FHE.ge`, etc.) is performed **by the calling contract**; the executor rejects it
  unless that contract is `isAllowed` on **every** operand.

**Verified pattern (`ConfidentialFeed` → `SealedSettlement` → `Indenture`):**

1. **Feed** internalizes its value, then `FHE.allowThis(v)` + `FHE.allow(v, consumer)`. The second is
   the cross-contract, **cross-tx** grant that lets the consumer compute on `v` in a later settlement tx.
2. **Consumer** (`SealedSettlement.exercise`) computes `ebool inTheMoney = FHE.ge(feed.value(), strike)`
   — allowed on `feed.value()` (persistent grant from step 1) and on `strike` (its own `allowThis`). The
   **strike never crosses the boundary**; only the sealed boolean does.
3. Consumer hands the engine tx-scoped access: `FHE.allowTransient(inTheMoney, engine)` +
   `FHE.allowTransient(notional, engine)`, then calls `engine.settleWithCondition(...)`. The engine ANDs
   `extraOk` into the mandate and settles via its single `FHE.select` path.

Proven in isolation first by `test/CrossContractProbe.t.sol` (positive: granted consumer computes;
**negative: an ungranted consumer's compute reverts** — so the harness enforces operand-ACL on
cross-contract compute, not just decryption). Order II suite `test/SealedSettlement.t.sol` (10/10) then
proves ITM payout, OTM→0, ANDed-with-mandate composition, the sealed strike (buyer/publisher/public
never granted), and the consumer-as-agent blind to the mandate. **Local harness only; Sepolia tx hashes
still required for done.**

## 6d. VEIL corridor additions (verified — built + 14 new harness tests green)

The VEIL transformation adds an encrypted per-sender velocity accumulator on top of the engine. Every FHE
call below was checked against the same installed `@fhevm/solidity/lib/FHE.sol` surface as §2 and proven by
a real local `forge build` + `forge test` (42/42 total, incl. 14 new `test/Corridor.t.sol`).

**Engine (`Indenture.sol`) — additive, backward-compatible (no renames, existing 28 tests unchanged):**

- `Mandate` gains `address complianceOfficer`. Legacy `commitMandate` sets it to `msg.sender` (the
  principal), so every audit grant (`fund`, `setPayeeAllowed`, `_settle`) — now routed to
  `m.complianceOfficer` — is **identical** for legacy mandates. Verified: all 12 `Indenture.t.sol` +
  10 `SealedSettlement.t.sol` assertions (incl. `persistAllowed(handle, principal)`) still pass.
- `commitMandateFor(id, agent, token, complianceOfficer, …3×(ext,proof))` — sets a **distinct** officer;
  the operator (`msg.sender`) is then granted NO decrypt rights. Proven by
  `Corridor.t.sol::test_onlyOfficer_canDecryptSealedPolicy` (officer ✓, operator ✗, sender ✗ on cap +
  screening flag via `_acl.persistAllowed`).
- `settleCorridor(id, nonce, payee, amount, extraOk) → (bytes32 receipt, euint64 moved)` — delegates to the
  same internal `_settle` (single fund-out path preserved) and additionally `FHE.allowTransient(moved,
msg.sender)` so the calling consumer can chain the sealed outcome into its own encrypted accounting in
  the same tx. `moved ∈ {0, amount}`; a contract compute-grant decrypts nothing (user-decryption needs a
  granted EOA too — same fact the Order II sealed-strike test relies on). `settle`/`settleWithCondition`
  keep their exact external signatures.

**Corridor (`orders/Corridor.sol`) — the net-new velocity accumulator:**

- Rollover uses the **public** `block.timestamp` (only amounts are secret): `bool rolled = anchor == 0 ||
block.timestamp >= anchor + window`. `windowStart == 0` is the never-seen-sender sentinel that forces
  `rolled == true`, so the uninitialized `_sealedSpent` handle is never read (a harness-caught bug: on the
  cleartext host `block.timestamp` starts at 1, so a plain `>=` comparison would read an uninitialized
  handle for a new sender — which would revert on the real coprocessor).
- `carried = rolled ? FHE.asEuint64(0) : _sealedSpent[sender]` (plaintext branch on a public bool),
  `withinVelocity = FHE.le(FHE.add(carried, amount), _ceiling)` — no encrypted division, absolute ceiling.
- Accumulator advances by the **returned `moved`**, never the proposed amount, so a transfer blocked by any
  rule consumes no window budget (`test_capBreach_nullified` / `test_withinVelocity_butOverCap_nullified`
  assert `sealedSpent == 0` after a nullified transfer).

**Build config:** `via_ir = true` added to `foundry.toml`. `commitMandateFor` (10 params incl. 3 dynamic
`bytes`) plus the deep sealed predicate exceed the legacy stack-based codegen; the IR pipeline is the
canonical fix with the optimizer already on. Semantics unchanged — verified by the full green suite.

## 6e. Off-ramp provider — sandbox (Phase C2, partial verification; STOP-and-report on funding)

Provider selected: **Flutterwave (v4 Transfers / Direct Transfers API)** — a licensed pan-African PSP with
an openly documented sandbox. Same off-ramp role as any fiat-payout PSP; nothing in the corridor design (the
`moved > 0` officer-decrypt trigger below, the server-side-only key, the typed adapter seam) depends on which
provider fills it. Confirmed from live public docs (2026-07):

- Docs portal: `https://developer.flutterwave.com` — **openly fetchable, NOT Cloudflare-gated**, so the exact
  endpoint path, auth model, and request/response schema are confirmable directly rather than blocked (contrast
  an earlier crypto-vault PSP evaluation whose docs 403'd automated fetchers).
- Auth (**v4**): **OAuth 2.0 client-credentials** — a sandbox **Client ID + Client Secret** are exchanged for a
  short-lived bearer token at `POST https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token`,
  and that token authorizes API calls. (v3, still live, uses a static `Authorization: Bearer FLWSECK_TEST-…`
  secret key.) The secret lives **server-side only** — never in the frontend, never committed.
- Sandbox base URL: `https://developersandbox-api.flutterwave.com`. Sandbox credentials are issued **instantly
  on email verification** (no partner-onboarding gate, no business documents upfront) — a practical advantage
  over a crypto-vault PSP for a sandbox-only demo.
- Confirmed capability: a test environment mirroring production; single payouts to a beneficiary via **Bank
  Transfer or Mobile Money** through `POST /direct-transfers` (`action`: instant/defer/schedule + a
  `payment_instruction` object), funded from a Flutterwave balance (a test wallet in sandbox).

**Honest status:** the concrete `payment_instruction` sub-schema for a specific NGN bank-transfer payout and a
runnable sandbox call are **pending a sandbox account** (Client ID + Secret, issued instantly on email
verification — a light unblock, not a KYC/onboarding gate). Per Phase C2 we **STOP and report** rather than
fund a float or complete production KYC — the edge is a sandbox demonstration by design. The listener is built
to a typed provider-adapter seam so wiring verified sandbox credentials is a config step, not a rewrite; the
key lives server-side only and is never shipped in the frontend or committed.

**Trigger honesty (repo-vs-prompt, Law 1):** the corridor emits `CorridorTransfer` (public ordering only) and
the engine emits `Settled(id, nonce, receipt, outcomeHandle)` — neither reveals whether a transfer **cleared**
(moved > 0) or was **nullified** (moved = 0); that is sealed. So a correct listener cannot fire on the raw
event alone. The honest design: the listener runs as the **compliance-officer identity**, does a real
user-decryption of `outcomeHandle` server-side, and calls the sandbox payout **only when `moved > 0`** — the
fiat leg is genuinely caused by (and proportional to) a real on-chain clear, not a bare event.

## 7. OPEN ITEMS to confirm just-in-time

- [x] `encryptUint64` / `encryptBool` — confirmed present in `FhevmTest.sol`.
- [x] Cross-contract ACL grant pattern for Order II (Phase 3) — verified against `ACL.sol` and proven on
      the harness (probe + Order II suite, §6c). **Still pending: reproduce on real Sepolia (needs funded key).**
- [ ] Real per-settlement gas on Sepolia vs the 16.7M block limit (Phase 6 performance honesty).
- [ ] **Sepolia deploy of a trivial contract + browser user-decryption screenshot = the other half of
      Evidence Gate 0. BLOCKED on user-provided funded key + RPC.** Local pipeline is proven (3/3 harness tests).
