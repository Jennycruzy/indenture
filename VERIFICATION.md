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

## 7. OPEN ITEMS to confirm just-in-time

- [x] `encryptUint64` / `encryptBool` — confirmed present in `FhevmTest.sol`.
- [ ] Cross-contract ACL grant pattern for Order II (Phase 3) — reproduce a minimal 2-contract test
      on Sepolia before wiring `SealedSettlement`. **Do not improvise (build-prompt §3 / Phase 3 warning).**
- [ ] Real per-settlement gas on Sepolia vs the 16.7M block limit (Phase 6 performance honesty).
- [ ] **Sepolia deploy of a trivial contract + browser user-decryption screenshot = the other half of
      Evidence Gate 0. BLOCKED on user-provided funded key + RPC.** Local pipeline is proven (3/3 harness tests).
