// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {Vm} from "forge-std/Vm.sol";
import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {Indenture} from "../src/Indenture.sol";
import {Leash} from "../src/orders/Leash.sol";
import {DemoConfidentialToken} from "../src/mocks/DemoConfidentialToken.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title Phase 1 / Order I test suite — the sealed-mandate engine + the blind Leash.
/// @dev Covers Evidence Gate 1: compliant move, each limit breach independently nullified,
///      default-deny payee, nonce increment + replay revert, receipt-chain linkage, the
///      leak-audit, and the blind-agent proof. Runs on Zama's cleartext harness (fast
///      iteration); the definition of done is real Sepolia tx hashes (see README/VERIFICATION).
contract IndentureTest is FhevmTest {
    Indenture internal engine;
    DemoConfidentialToken internal token;

    uint256 internal constant PRINCIPAL_PK = 0xA11CE;
    uint256 internal constant AGENT_PK = 0xB0B;
    address internal principal;
    address internal agent;
    address internal constant BOB = address(0xB0B0); // allowlisted payee
    address internal constant MALLORY = address(0xBAD); // never allowlisted

    function setUp() public override {
        super.setUp();
        disableHCUDepthLimit(); // the sealed predicate is a deep homomorphic circuit
        principal = vm.addr(PRINCIPAL_PK);
        agent = vm.addr(AGENT_PK);
        engine = new Indenture();
        token = new DemoConfidentialToken("Indenture USD", "iUSD", "");
    }

    // ── helpers ────────────────────────────────────────────────────────────────
    /// @notice Deploy + fully provision a mandate: commit sealed limits, fund custody, allow BOB.
    function _mandate(
        bytes32 id,
        uint64 perTrade,
        uint64 total,
        uint64 drawdownPct,
        uint64 fundAmount
    ) internal returns (Leash leash) {
        leash = new Leash(engine, id, agent);

        (externalEuint64 pt, bytes memory ptP) = encryptUint64(perTrade, principal, address(engine));
        (externalEuint64 tot, bytes memory totP) = encryptUint64(total, principal, address(engine));
        (externalEuint64 dd, bytes memory ddP) = encryptUint64(drawdownPct, principal, address(engine));
        vm.prank(principal);
        engine.commitMandate(id, address(leash), IERC7984(address(token)), pt, ptP, tot, totP, dd, ddP);

        if (fundAmount > 0) {
            token.mint(principal, fundAmount);
            vm.prank(principal);
            token.setOperator(address(engine), uint48(block.timestamp + 3650 days));
            (externalEuint64 a, bytes memory p) = encryptUint64(fundAmount, principal, address(engine));
            vm.prank(principal);
            engine.fund(id, a, p);
        }

        (externalEbool f, bytes memory fp) = encryptBool(true, principal, address(engine));
        vm.prank(principal);
        engine.setPayeeAllowed(id, BOB, f, fp);
    }

    function _execute(Leash leash, uint256 nonce, address payee, uint64 amount) internal {
        (externalEuint64 a, bytes memory p) = encryptUint64(amount, agent, address(leash));
        vm.prank(agent);
        leash.execute(nonce, payee, a, p);
    }

    function _spent(bytes32 id) internal returns (uint64) {
        (euint64 s, , ) = engine.sealedState(id);
        return decrypt(s);
    }

    function _custody(bytes32 id) internal returns (uint64) {
        (, euint64 c, ) = engine.sealedState(id);
        return decrypt(c);
    }

    // ── happy path ───────────────────────────────────────────────────────────────
    function test_compliantMove_transfersFullAmount() public {
        bytes32 id = keccak256("ok");
        Leash leash = _mandate(id, 100, 250, 50, 200); // floor = 50% of HWM 200 = 100
        _execute(leash, 0, BOB, 80);

        assertEq(_spent(id), 80, "spent advances by full amount");
        assertEq(_custody(id), 120, "custody decreases by full amount");
        assertEq(decrypt(token.confidentialBalanceOf(BOB)), 80, "payee received full amount");
        assertEq(engine.mandateNonce(id), 1, "nonce incremented");
    }

    // ── each limit breach independently nullifies to ZERO ─────────────────────────
    function test_perTradeCapBreach_nullified() public {
        bytes32 id = keccak256("perTrade");
        Leash leash = _mandate(id, 100, 100000, 0, 1000);
        _execute(leash, 0, BOB, 150); // 150 > perTradeCap 100

        assertEq(_spent(id), 0, "nothing spent");
        assertEq(_custody(id), 1000, "custody untouched");
        assertEq(decrypt(token.confidentialBalanceOf(BOB)), 0, "payee received nothing");
        assertEq(engine.mandateNonce(id), 1, "nonce still advances (move happened, just nullified)");
    }

    function test_totalCapBreach_nullified() public {
        bytes32 id = keccak256("total");
        Leash leash = _mandate(id, 100, 120, 0, 1000); // drawdown 0 => no floor
        _execute(leash, 0, BOB, 100); // spent -> 100 (ok)
        assertEq(_spent(id), 100, "first move ok");
        _execute(leash, 1, BOB, 100); // 100+100=200 > totalCap 120

        assertEq(_spent(id), 100, "second move nullified: spent unchanged");
        assertEq(decrypt(token.confidentialBalanceOf(BOB)), 100, "only the first move paid out");
    }

    function test_drawdownBreach_nullified() public {
        bytes32 id = keccak256("drawdown");
        Leash leash = _mandate(id, 1000, 100000, 80, 100); // HWM=100, floor = 80
        _execute(leash, 0, BOB, 30); // equity after = 70; 7000 >= 8000 is FALSE -> nullified

        assertEq(_spent(id), 0, "drawdown floor blocked the move");
        assertEq(_custody(id), 100, "custody untouched");

        _execute(leash, 1, BOB, 15); // equity after = 85; 8500 >= 8000 TRUE -> ok
        assertEq(_spent(id), 15, "a move that respects the floor goes through");
    }

    // ── allowlist: explicit default-deny ─────────────────────────────────────────
    function test_offAllowlistPayee_nullified() public {
        bytes32 id = keccak256("payee");
        Leash leash = _mandate(id, 100, 250, 0, 200);
        _execute(leash, 0, MALLORY, 50); // MALLORY was never allowlisted -> default DENY

        assertEq(_spent(id), 0, "off-allowlist payee blocked");
        assertEq(decrypt(token.confidentialBalanceOf(MALLORY)), 0, "unlisted payee received nothing");
    }

    function test_rotateAllowlist_thenAllowed() public {
        bytes32 id = keccak256("rotate");
        Leash leash = _mandate(id, 100, 250, 0, 200);
        _execute(leash, 0, MALLORY, 50);
        assertEq(_spent(id), 0, "denied before rotation");

        (externalEbool f, bytes memory fp) = encryptBool(true, principal, address(engine));
        vm.prank(principal);
        engine.setPayeeAllowed(id, MALLORY, f, fp); // principal rotates the sealed bit

        _execute(leash, 1, MALLORY, 50);
        assertEq(_spent(id), 50, "allowed after rotation");
    }

    // ── replay / nonce ───────────────────────────────────────────────────────────
    function test_replay_revertsOnStaleNonce() public {
        bytes32 id = keccak256("replay");
        Leash leash = _mandate(id, 100, 250, 0, 200);
        _execute(leash, 0, BOB, 40); // nonce -> 1

        (externalEuint64 a, bytes memory p) = encryptUint64(40, agent, address(leash));
        vm.prank(agent);
        vm.expectRevert(Indenture.StaleNonce.selector);
        leash.execute(0, BOB, a, p); // stale nonce 0 -> revert (on-chain, not a frontend guard)
    }

    // ── forgery: a hand-crafted ciphertext without a valid proof dies at the boundary ──
    function test_forgedInput_revertsAtInputBoundary() public {
        bytes32 id = keccak256("forge");
        Leash leash = _mandate(id, 100, 250, 0, 200);

        // The agent fabricates an input handle it never legitimately obtained a proof for.
        externalEuint64 forged = externalEuint64.wrap(bytes32(uint256(0xF0F0)));
        vm.prank(agent);
        vm.expectRevert(); // reverts inside FHE.fromExternal — a real on-chain rejection, not a UI guard
        leash.execute(0, BOB, forged, ""); // empty proof => handle must already be allowed; it isn't
    }

    // ── receipt chain (tamper-evident public ordering) ───────────────────────────
    function test_receiptChain_linksCorrectly() public {
        bytes32 id = keccak256("receipt");
        Leash leash = _mandate(id, 100, 250, 0, 200);
        assertEq(engine.lastReceipt(id), bytes32(0), "genesis receipt is zero");

        bytes32 r1 = _executeAndExpectedReceipt(leash, id, 0, BOB, 40, bytes32(0));
        assertEq(engine.lastReceipt(id), r1, "receipt 1 = H(0, 1, payee, outcome)");

        bytes32 r2 = _executeAndExpectedReceipt(leash, id, 1, BOB, 30, r1);
        assertEq(engine.lastReceipt(id), r2, "receipt 2 chains onto receipt 1");
        assertTrue(r1 != r2 && r2 != bytes32(0), "chain advances");
    }

    /// @dev Execute a move, capture the moved ciphertext handle from the engine's Settled event,
    ///      and recompute the expected hash-chained receipt from public data only.
    function _executeAndExpectedReceipt(
        Leash leash,
        bytes32 id,
        uint256 nonce,
        address payee,
        uint64 amount,
        bytes32 prevReceipt
    ) internal returns (bytes32 expected) {
        id; // (silence unused; kept for call-site readability)
        vm.recordLogs();
        _execute(leash, nonce, payee, amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bytes32 settledSig = keccak256("Settled(bytes32,uint256,bytes32,bytes32)");
        bytes32 outcomeHandle;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(engine) && logs[i].topics[0] == settledSig) {
                // non-indexed data = abi.encode(receipt, outcomeHandle); outcomeHandle at offset 32
                bytes memory d = logs[i].data;
                assembly {
                    outcomeHandle := mload(add(add(d, 32), 32))
                }
            }
        }
        bytes32 outcomeCommitment = keccak256(abi.encode(outcomeHandle));
        expected = keccak256(abi.encode(prevReceipt, nonce + 1, payee, outcomeCommitment));
    }

    // ── leak-audit: no cleartext limit/amount/outcome escapes via events ──────────
    function test_leakAudit_noCleartextInEvents() public {
        bytes32 id = keccak256("leak");
        // Secrets deliberately avoid the public constants {0,1,100} the circuit trivially
        // encrypts (cross-multiply 100, select-zero 0), so we test real leakage, not coincidence.
        Leash leash = _mandate(id, 137, 911, 73, 613); // perTrade, total, drawdownPct, fund
        uint64 moveAmt = 88;
        uint64 custodyAfter = 613 - 88; // 525

        vm.recordLogs();
        _execute(leash, 0, BOB, moveAmt);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        // The move amount, every sealed cap, and the resulting custody must never appear as a
        // 32-byte cleartext word in any emitted event's data/topics.
        uint64[5] memory secrets = [moveAmt, 137, 911, 73, custodyAfter];
        for (uint256 i = 0; i < logs.length; i++) {
            for (uint256 s = 0; s < secrets.length; s++) {
                bytes32 needle = bytes32(uint256(secrets[s]));
                for (uint256 t = 0; t < logs[i].topics.length; t++) {
                    assertTrue(logs[i].topics[t] != needle, "cleartext secret leaked in a topic");
                }
                bytes memory d = logs[i].data;
                for (uint256 o = 0; o + 32 <= d.length; o += 32) {
                    bytes32 word;
                    assembly {
                        word := mload(add(add(d, 32), o))
                    }
                    assertTrue(word != needle, "cleartext secret leaked in event data");
                }
            }
        }
    }

    // ── the blind-agent proof (the thesis) ───────────────────────────────────────
    function test_blindAgent_hasNoDecryptRightsOverMandate() public {
        bytes32 id = keccak256("blind");
        Leash leash = _mandate(id, 100, 250, 50, 200);

        (euint64 perTradeCap, euint64 totalCap, euint64 drawdownPct) = engine.sealedLimits(id);
        ebool payeeFlag = engine.sealedPayeeFlag(id, BOB);

        bytes32[4] memory handles = [
            euint64.unwrap(perTradeCap),
            euint64.unwrap(totalCap),
            euint64.unwrap(drawdownPct),
            ebool.unwrap(payeeFlag)
        ];

        for (uint256 i = 0; i < handles.length; i++) {
            // The principal may audit every sealed handle...
            assertTrue(_acl.persistAllowed(handles[i], principal), "principal must be able to decrypt");
            // ...but the agent and its on-chain identity (the Leash) are BLIND: no decrypt rights.
            assertFalse(_acl.persistAllowed(handles[i], agent), "agent must NOT be able to decrypt the mandate");
            assertFalse(_acl.persistAllowed(handles[i], address(leash)), "the leash must be blind too");
        }
    }

    // ── selective disclosure: principal (only) can decrypt the running state ──────
    function test_principalOnly_canDecryptRunningState() public {
        bytes32 id = keccak256("audit");
        Leash leash = _mandate(id, 100, 250, 50, 200);
        _execute(leash, 0, BOB, 80);

        (euint64 spent, euint64 custody, ) = engine.sealedState(id);
        assertTrue(_acl.persistAllowed(euint64.unwrap(spent), principal), "principal can audit spent");
        assertTrue(_acl.persistAllowed(euint64.unwrap(custody), principal), "principal can audit custody");
        assertFalse(_acl.persistAllowed(euint64.unwrap(spent), agent), "agent cannot read spent");
    }
}
