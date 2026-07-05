// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {Vm} from "forge-std/Vm.sol";
import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {Cloistra} from "../src/Cloistra.sol";
import {Corridor} from "../src/orders/Corridor.sol";
import {DemoConfidentialToken} from "../src/mocks/DemoConfidentialToken.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title CLOISTRA Corridor test suite — the sealed compliance rulebook, incl. the net-new encrypted
///        velocity accumulator (Rule 3) and the compliance-officer disclosure model.
/// @dev Covers Evidence Gate B: compliant transfer clears; cap breach / screened-out recipient /
///      velocity breach all nullify to zero; window rollover resets the encrypted running total and a
///      post-reset transfer succeeds; the accumulator advances only by the ACTUALLY-MOVED amount;
///      per-sender accumulators are independent; ONLY the compliance officer can decrypt the sealed
///      policy (cap, ceiling, screening flag, per-sender total) — sender AND operator cannot; and no
///      event leaks any sealed value or the pass/fail bit. Runs on Zama's cleartext harness (fast
///      iteration); the definition of done is real Sepolia tx hashes (see DEPLOYMENTS.md / README).
contract CorridorTest is FhevmTest {
    Cloistra internal engine;
    DemoConfidentialToken internal token;

    uint256 internal constant OPERATOR_PK = 0xC0FFEE; // the corridor operator (== mandate principal)
    uint256 internal constant OFFICER_PK = 0x0ff1ce; // the compliance officer (audit role) — DISTINCT
    uint256 internal constant SENDER_PK = 0x5e9de5; // a sender
    uint256 internal constant SENDER2_PK = 0x5e9de6; // a second sender (per-sender independence)
    address internal operator;
    address internal officer;
    address internal sender;
    address internal sender2;
    address internal constant RECIPIENT = address(0xBEEF); // screened-in beneficiary
    address internal constant MALLORY = address(0xBAD); // never screened in

    uint256 internal constant WINDOW = 30 days;

    function setUp() public override {
        super.setUp();
        disableHCUDepthLimit(); // the sealed predicate is a deep homomorphic circuit
        operator = vm.addr(OPERATOR_PK);
        officer = vm.addr(OFFICER_PK);
        sender = vm.addr(SENDER_PK);
        sender2 = vm.addr(SENDER2_PK);
        engine = new Cloistra();
        token = new DemoConfidentialToken("CLOISTRA USD", "clUSD", "");
    }

    // ── helpers ────────────────────────────────────────────────────────────────
    /// @notice Deploy + fully provision a corridor: commit the sealed mandate with a DISTINCT compliance
    ///         officer, fund custody, screen RECIPIENT in, and set the sealed velocity ceiling.
    function _corridor(bytes32 id, uint64 perTrade, uint64 total, uint64 drawdownPct, uint64 fundAmount, uint64 ceiling)
        internal
        returns (Corridor c)
    {
        c = new Corridor(engine, id, operator, officer, WINDOW);

        (externalEuint64 pt, bytes memory ptP) = encryptUint64(perTrade, operator, address(engine));
        (externalEuint64 tot, bytes memory totP) = encryptUint64(total, operator, address(engine));
        (externalEuint64 dd, bytes memory ddP) = encryptUint64(drawdownPct, operator, address(engine));
        vm.prank(operator);
        engine.commitMandateFor(id, address(c), IERC7984(address(token)), officer, pt, ptP, tot, totP, dd, ddP);

        if (fundAmount > 0) {
            token.mint(operator, fundAmount);
            vm.prank(operator);
            token.setOperator(address(engine), uint48(block.timestamp + 3650 days));
            (externalEuint64 a, bytes memory p) = encryptUint64(fundAmount, operator, address(engine));
            vm.prank(operator);
            engine.fund(id, a, p);
        }

        (externalEbool f, bytes memory fp) = encryptBool(true, operator, address(engine));
        vm.prank(operator);
        engine.setPayeeAllowed(id, RECIPIENT, f, fp);

        (externalEuint64 ce, bytes memory ceP) = encryptUint64(ceiling, operator, address(c));
        vm.prank(operator);
        c.setCeiling(ce, ceP);
    }

    function _transfer(Corridor c, uint256 nonce, address who, address recipient, uint64 amount) internal {
        (externalEuint64 a, bytes memory p) = encryptUint64(amount, who, address(c));
        vm.prank(who);
        c.transfer(nonce, recipient, a, p);
    }

    function _engineSpent(bytes32 id) internal returns (uint64) {
        (euint64 s,,) = engine.sealedState(id);
        return decrypt(s);
    }

    function _bal(address a) internal returns (uint64) {
        return decrypt(token.confidentialBalanceOf(a));
    }

    // ── happy path: a compliant transfer clears ──────────────────────────────────
    function test_compliantTransfer_clears() public {
        bytes32 id = keccak256("cloistra-ok");
        Corridor c = _corridor(id, 100, 100000, 0, 1000, 500); // ceiling 500
        _transfer(c, 0, sender, RECIPIENT, 80);

        assertEq(_bal(RECIPIENT), 80, "recipient received the transfer");
        assertEq(_engineSpent(id), 80, "engine spent advanced");
        assertEq(decrypt(c.sealedSpent(sender)), 80, "sealed velocity total advanced by the moved amount");
        assertEq(engine.mandateNonce(id), 1, "nonce advanced");
        assertEq(c.windowStart(sender), block.timestamp, "window anchor set on the sender's first transfer");
    }

    // ── Rule 1: sealed per-transfer cap breach → nullified ───────────────────────
    function test_capBreach_nullified() public {
        bytes32 id = keccak256("cloistra-cap");
        Corridor c = _corridor(id, 50, 100000, 0, 1000, 100000); // cap 50, ceiling effectively infinite
        _transfer(c, 0, sender, RECIPIENT, 80); // 80 > cap 50

        assertEq(_bal(RECIPIENT), 0, "over-cap transfer moved nothing");
        assertEq(_engineSpent(id), 0, "engine spent unchanged");
        // The accumulator advances by MOVED, not the proposed amount: a cap-blocked transfer must NOT
        // consume window budget.
        assertEq(decrypt(c.sealedSpent(sender)), 0, "blocked transfer consumed no velocity budget");
        assertEq(engine.mandateNonce(id), 1, "nonce still advances (transfer happened, just nullified)");
    }

    // ── Rule 2: screened-out recipient → nullified ───────────────────────────────
    function test_screenedOutRecipient_nullified() public {
        bytes32 id = keccak256("cloistra-screen");
        Corridor c = _corridor(id, 1000, 100000, 0, 1000, 100000);
        _transfer(c, 0, sender, MALLORY, 50); // MALLORY was never screened in → default DENY

        assertEq(_bal(MALLORY), 0, "unscreened recipient received nothing");
        assertEq(_engineSpent(id), 0, "engine spent unchanged");
        assertEq(decrypt(c.sealedSpent(sender)), 0, "blocked transfer consumed no velocity budget");
    }

    // ── Rule 3: sealed velocity breach ACROSS transfers → nullified ──────────────
    function test_velocityBreach_acrossTransfers_nullified() public {
        bytes32 id = keccak256("cloistra-velocity");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100); // ceiling 100; cap/total generous
        _transfer(c, 0, sender, RECIPIENT, 60); // 0+60 <= 100 → clears
        assertEq(decrypt(c.sealedSpent(sender)), 60, "first transfer within ceiling");
        assertEq(_bal(RECIPIENT), 60, "first transfer paid out");

        _transfer(c, 1, sender, RECIPIENT, 50); // 60+50=110 > ceiling 100 → velocity breach → nullified

        assertEq(decrypt(c.sealedSpent(sender)), 60, "velocity-breaching transfer left the total unchanged");
        assertEq(_bal(RECIPIENT), 60, "only the first, within-ceiling transfer paid out");
        assertEq(_engineSpent(id), 60, "engine spent reflects only the cleared transfer");
    }

    // ── Rule 3: at-the-ceiling boundary clears (<=) ──────────────────────────────
    function test_velocityAtCeiling_boundaryClears() public {
        bytes32 id = keccak256("cloistra-boundary");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100);
        _transfer(c, 0, sender, RECIPIENT, 100); // 0+100 <= 100 → clears exactly at the ceiling
        assertEq(_bal(RECIPIENT), 100, "exactly-at-ceiling transfer clears");
        _transfer(c, 1, sender, RECIPIENT, 1); // 100+1 > 100 → nullified
        assertEq(_bal(RECIPIENT), 100, "one over the ceiling is nullified");
    }

    // ── Rule 3: PUBLIC window rollover resets the ENCRYPTED total; post-reset transfer succeeds ──
    function test_windowRollover_resetsEncryptedTotal() public {
        bytes32 id = keccak256("cloistra-rollover");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100); // ceiling 100
        _transfer(c, 0, sender, RECIPIENT, 60); // fill 60 of the window
        assertEq(decrypt(c.sealedSpent(sender)), 60, "pre-rollover total");
        uint256 firstAnchor = c.windowStart(sender);

        // Without a rollover, a second 60 would break the ceiling (60+60=120 > 100). Advance the PUBLIC
        // clock past the window so the encrypted total resets to zero.
        vm.warp(block.timestamp + WINDOW + 1);
        _transfer(c, 1, sender, RECIPIENT, 60); // rolled → carried 0 → 0+60 <= 100 → clears

        assertEq(_bal(RECIPIENT), 120, "post-rollover transfer cleared on top of the first");
        assertEq(decrypt(c.sealedSpent(sender)), 60, "encrypted total reset to just the post-rollover amount");
        assertGt(c.windowStart(sender), firstAnchor, "public window anchor advanced on rollover");
        assertEq(_engineSpent(id), 120, "engine cumulative spent is 120 across both windows");
    }

    // ── combined: within velocity but over the sealed cap → STILL nullified ──────
    // Proves Rule 3 is ANDed with Rules 1+2, not swapped for them.
    function test_withinVelocity_butOverCap_nullified() public {
        bytes32 id = keccak256("cloistra-combined");
        Corridor c = _corridor(id, 50, 100000, 0, 1000, 100000); // cap 50, ceiling huge
        _transfer(c, 0, sender, RECIPIENT, 80); // within velocity (80 <= huge) but 80 > cap 50

        assertEq(_bal(RECIPIENT), 0, "cap still binds even when within the velocity ceiling");
        assertEq(decrypt(c.sealedSpent(sender)), 0, "nullified transfer consumed no velocity budget");
    }

    // ── per-sender independence: one sender's exhausted window does not touch another's ──
    function test_perSenderAccumulators_areIndependent() public {
        bytes32 id = keccak256("cloistra-multi");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100); // ceiling 100 per sender
        _transfer(c, 0, sender, RECIPIENT, 100); // sender fills its window
        _transfer(c, 1, sender, RECIPIENT, 1); // sender over ceiling → nullified
        assertEq(decrypt(c.sealedSpent(sender)), 100, "sender's window is full");

        _transfer(c, 2, sender2, RECIPIENT, 100); // sender2 has its OWN full budget
        assertEq(decrypt(c.sealedSpent(sender2)), 100, "sender2 accumulator is independent");
        assertEq(_bal(RECIPIENT), 200, "sender(100) + sender2(100) both cleared; sender's overage did not");
    }

    // ── replay: a stale nonce reverts on-chain (not a frontend guard) ────────────
    function test_replay_revertsOnStaleNonce() public {
        bytes32 id = keccak256("cloistra-replay");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100000);
        _transfer(c, 0, sender, RECIPIENT, 40); // nonce → 1

        (externalEuint64 a, bytes memory p) = encryptUint64(40, sender, address(c));
        vm.prank(sender);
        vm.expectRevert(Cloistra.StaleNonce.selector);
        c.transfer(0, RECIPIENT, a, p); // stale nonce 0 reverts on-chain
    }

    // ── forgery: a hand-crafted ciphertext without a valid proof dies at the boundary ──
    function test_forgedInput_revertsAtInputBoundary() public {
        bytes32 id = keccak256("cloistra-forge");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100000);

        externalEuint64 forged = externalEuint64.wrap(bytes32(uint256(0xF0F0)));
        vm.prank(sender);
        vm.expectRevert(); // reverts inside FHE.fromExternal — a real on-chain rejection
        c.transfer(0, RECIPIENT, forged, "");
    }

    // ── access control: only the operator may set the sealed ceiling ─────────────
    function test_onlyOperatorCanSetCeiling() public {
        bytes32 id = keccak256("cloistra-auth");
        Corridor c = _corridor(id, 1000, 100000, 0, 10000, 100000);
        (externalEuint64 ce, bytes memory ceP) = encryptUint64(5, MALLORY, address(c));
        vm.prank(MALLORY);
        vm.expectRevert(Corridor.NotOperator.selector);
        c.setCeiling(ce, ceP);
    }

    // ── DISCLOSURE: only the compliance officer can decrypt the sealed policy ─────
    // The sender AND the operator are blind to every sealed policy value — this is what makes the
    // compliance line unscoutable and unleakable.
    function test_onlyOfficer_canDecryptSealedPolicy() public {
        bytes32 id = keccak256("cloistra-disclose");
        Corridor c = _corridor(id, 100, 250, 50, 1000, 500);
        _transfer(c, 0, sender, RECIPIENT, 80); // create a per-sender running total to audit

        bytes32 ceiling = euint64.unwrap(c.sealedCeiling());
        bytes32 spent = euint64.unwrap(c.sealedSpent(sender));
        (euint64 perTradeCap,,) = engine.sealedLimits(id);
        bytes32 cap = euint64.unwrap(perTradeCap);
        bytes32 screenFlag = ebool.unwrap(engine.sealedPayeeFlag(id, RECIPIENT));

        bytes32[4] memory policy = [ceiling, cap, screenFlag, spent];
        for (uint256 i = 0; i < policy.length; i++) {
            // ONLY the compliance officer may decrypt each sealed policy value...
            assertTrue(_acl.persistAllowed(policy[i], officer), "compliance officer must be able to audit");
            // ...NOT the operator that set it (unscoutable/unleakable at runtime)...
            assertFalse(_acl.persistAllowed(policy[i], operator), "operator must NOT decrypt the sealed policy");
            // ...and NOT the sender it governs.
            assertFalse(_acl.persistAllowed(policy[i], sender), "sender must NOT decrypt the sealed policy");
        }
    }

    // ── blind agent: the Corridor (the settler) cannot decrypt the engine's sealed mandate ──
    function test_blindCorridor_cannotDecryptMandate() public {
        bytes32 id = keccak256("cloistra-blind");
        Corridor c = _corridor(id, 100, 250, 50, 1000, 500);

        (euint64 perTradeCap, euint64 totalCap, euint64 drawdownPct) = engine.sealedLimits(id);
        ebool screenFlag = engine.sealedPayeeFlag(id, RECIPIENT);
        bytes32[4] memory handles = [
            euint64.unwrap(perTradeCap), euint64.unwrap(totalCap), euint64.unwrap(drawdownPct), ebool.unwrap(screenFlag)
        ];
        for (uint256 i = 0; i < handles.length; i++) {
            assertTrue(_acl.persistAllowed(handles[i], officer), "officer audits the engine mandate");
            assertFalse(_acl.persistAllowed(handles[i], address(c)), "the corridor is blind to the mandate it enforces");
            assertFalse(_acl.persistAllowed(handles[i], sender), "the sender is blind to the mandate");
        }
    }

    // ── LEAK-AUDIT: no event exposes any sealed value or the pass/fail bit ────────
    function test_leakAudit_noCleartextInEvents() public {
        bytes32 id = keccak256("cloistra-leak");
        // Secrets avoid the trivial constants {0,1,100} the circuit encrypts, so this tests real leakage.
        Corridor c = _corridor(id, 137, 9110, 0, 6130, 777); // cap, total, fund, ceiling=777
        uint64 amount = 88;
        uint64 spentAfter = 88; // sealed running total after this transfer

        vm.recordLogs();
        _transfer(c, 0, sender, RECIPIENT, amount);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint64[4] memory secrets = [amount, uint64(137), uint64(777), spentAfter];
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
}
