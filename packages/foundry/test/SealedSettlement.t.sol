// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {Cloistra} from "../src/Cloistra.sol";
import {SealedSettlement} from "../src/orders/SealedSettlement.sol";
import {ConfidentialFeed} from "../src/orders/ConfidentialFeed.sol";
import {DemoConfidentialToken} from "../src/mocks/DemoConfidentialToken.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title Phase 3 / Order II test suite — the cross-contract composability proof.
/// @dev Covers Evidence Gate 3: the feed posts a sealed value; settlement pays out when
///      in-the-money and pays zero when out-of-the-money; the extra sealed predicate is ANDed
///      into (not swapped for) the mandate; the strike is never granted decrypt rights to the
///      buyer or the public; and the consumer-as-agent stays blind to the mandate. Runs on Zama's
///      cleartext harness (fast iteration); definition of done is real Sepolia tx hashes.
contract SealedSettlementTest is FhevmTest {
    Cloistra internal engine;
    DemoConfidentialToken internal token;
    ConfidentialFeed internal feed;

    uint256 internal constant PRINCIPAL_PK = 0xA11CE; // the option writer
    uint256 internal constant BUYER_PK = 0xB1DDE7; // the option holder / payee
    uint256 internal constant PUBLISHER_PK = 0xFEED; // the feed publisher
    address internal principal;
    address internal buyer;
    address internal publisher;
    address internal constant OUTSIDER = address(0x0757); // never granted anything

    function setUp() public override {
        super.setUp();
        disableHCUDepthLimit(); // the sealed predicate is a deep homomorphic circuit
        principal = vm.addr(PRINCIPAL_PK);
        buyer = vm.addr(BUYER_PK);
        publisher = vm.addr(PUBLISHER_PK);
        engine = new Cloistra();
        token = new DemoConfidentialToken("Cloistra USD", "clUSD", "");
        feed = new ConfidentialFeed(publisher);
    }

    // ── helpers ────────────────────────────────────────────────────────────────
    /// @notice Deploy + fully provision an Order II option: commit the mandate (agent = the
    ///         settlement), fund custody, allowlist the buyer, arm strike + notional, wire the feed.
    function _option(
        bytes32 id,
        uint64 perTrade,
        uint64 total,
        uint64 drawdownPct,
        uint64 fundAmount,
        uint64 strike,
        uint64 notional
    ) internal returns (SealedSettlement settlement) {
        settlement = new SealedSettlement(engine, id, feed, buyer);
        _commit(id, address(settlement), perTrade, total, drawdownPct);
        _fund(id, fundAmount);
        _allowBuyer(id);
        _arm(settlement, strike, notional);
        vm.prank(publisher); // wire the feed to this settlement
        feed.authorizeConsumer(address(settlement));
    }

    function _commit(bytes32 id, address agent, uint64 perTrade, uint64 total, uint64 drawdownPct) internal {
        (externalEuint64 pt, bytes memory ptP) = encryptUint64(perTrade, principal, address(engine));
        (externalEuint64 tot, bytes memory totP) = encryptUint64(total, principal, address(engine));
        (externalEuint64 dd, bytes memory ddP) = encryptUint64(drawdownPct, principal, address(engine));
        vm.prank(principal);
        engine.commitMandate(id, agent, IERC7984(address(token)), pt, ptP, tot, totP, dd, ddP);
    }

    function _fund(bytes32 id, uint64 fundAmount) internal {
        token.mint(principal, fundAmount);
        vm.prank(principal);
        token.setOperator(address(engine), uint48(block.timestamp + 3650 days));
        (externalEuint64 a, bytes memory ap) = encryptUint64(fundAmount, principal, address(engine));
        vm.prank(principal);
        engine.fund(id, a, ap);
    }

    function _allowBuyer(bytes32 id) internal {
        (externalEbool f, bytes memory fp) = encryptBool(true, principal, address(engine));
        vm.prank(principal);
        engine.setPayeeAllowed(id, buyer, f, fp);
    }

    function _arm(SealedSettlement settlement, uint64 strike, uint64 notional) internal {
        (externalEuint64 st, bytes memory stP) = encryptUint64(strike, principal, address(settlement));
        (externalEuint64 no, bytes memory noP) = encryptUint64(notional, principal, address(settlement));
        vm.prank(principal);
        settlement.arm(st, stP, no, noP);
    }

    function _postFeed(uint64 value) internal {
        (externalEuint64 v, bytes memory vp) = encryptUint64(value, publisher, address(feed));
        vm.prank(publisher);
        feed.postValue(v, vp);
    }

    function _exercise(SealedSettlement settlement, uint256 nonce) internal {
        vm.prank(buyer);
        settlement.exercise(nonce);
    }

    function _custody(bytes32 id) internal returns (uint64) {
        (, euint64 c,) = engine.sealedState(id);
        return decrypt(c);
    }

    function _spent(bytes32 id) internal returns (uint64) {
        (euint64 s,,) = engine.sealedState(id);
        return decrypt(s);
    }

    // ── in-the-money: the cross-contract predicate + mandate both pass → payout ────
    function test_inTheMoney_paysOut() public {
        bytes32 id = keccak256("itm");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80); // strike 1000, notional 80
        _postFeed(1500); // 1500 >= 1000 → in the money
        _exercise(s, 0);

        assertEq(decrypt(token.confidentialBalanceOf(buyer)), 80, "buyer received the sealed notional");
        assertEq(_spent(id), 80, "spent advanced by the notional");
        assertEq(_custody(id), 120, "custody decreased by the notional");
        assertEq(engine.mandateNonce(id), 1, "nonce advanced");
    }

    // ── out-of-the-money: feed < strike → engine nullifies to zero, nothing leaks ──
    function test_outOfTheMoney_paysZero() public {
        bytes32 id = keccak256("otm");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(500); // 500 < 1000 → out of the money
        _exercise(s, 0);

        assertEq(decrypt(token.confidentialBalanceOf(buyer)), 0, "no payout when out of the money");
        assertEq(_spent(id), 0, "nothing spent");
        assertEq(_custody(id), 200, "custody untouched");
        assertEq(engine.mandateNonce(id), 1, "nonce still advances (exercise happened, just nullified)");
    }

    // ── boundary: feed == strike is in the money (>=) ─────────────────────────────
    function test_atTheMoney_boundaryPaysOut() public {
        bytes32 id = keccak256("atm");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(1000); // 1000 >= 1000 → in the money at the boundary
        _exercise(s, 0);
        assertEq(decrypt(token.confidentialBalanceOf(buyer)), 80, "at-the-money exercises");
    }

    // ── composition: in-the-money but over the mandate cap → STILL nullified ───────
    // Proves the extra predicate is ANDed into the sealed mandate, not swapped for it.
    function test_inTheMoney_butOverMandateCap_nullified() public {
        bytes32 id = keccak256("compose");
        SealedSettlement s = _option(id, 50, 250, 0, 200, 1000, 80); // perTradeCap 50 < notional 80
        _postFeed(1500); // in the money...
        _exercise(s, 0);

        // ...but the notional breaches the sealed per-trade cap, so the engine nullifies it.
        assertEq(decrypt(token.confidentialBalanceOf(buyer)), 0, "mandate still binds even when in the money");
        assertEq(_spent(id), 0, "over-cap notional nullified despite ITM");
    }

    // ── the strike stays sealed even after settlement (Evidence Gate 3) ───────────
    function test_strikeNeverDecryptableByBuyerOrPublic() public {
        bytes32 id = keccak256("sealedStrike");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(1500);
        _exercise(s, 0); // settle first — the strike must remain sealed AFTER settlement

        bytes32 strikeHandle = euint64.unwrap(s.sealedStrike());
        bytes32 notionalHandle = euint64.unwrap(s.sealedNotional());

        // Only the writer's EOA (the mandate principal) is granted decrypt rights on strike +
        // notional. user-decryption (EIP-712) requires BOTH a granted EOA and a granted contract
        // (see FhevmTest.userDecrypt), so no adversary EOA can decrypt these even though the
        // settlement contract holds compute (`allowThis`) rights to evaluate the predicate.
        assertTrue(_acl.persistAllowed(strikeHandle, principal), "writer can audit the strike");
        assertTrue(_acl.persistAllowed(notionalHandle, principal), "writer can audit the notional");
        // No adversary EOA — buyer, publisher, or public — is ever granted; the strike stays sealed.
        assertFalse(_acl.persistAllowed(strikeHandle, buyer), "buyer must NOT decrypt the strike");
        assertFalse(_acl.persistAllowed(strikeHandle, publisher), "publisher must NOT decrypt the strike");
        assertFalse(_acl.persistAllowed(strikeHandle, OUTSIDER), "public must NOT decrypt the strike");
        assertFalse(_acl.persistAllowed(notionalHandle, buyer), "buyer must NOT decrypt the notional");
        // The contract holds compute rights (necessary to evaluate the predicate) but that alone
        // decrypts nothing — decryption needs a granted EOA too, and only the writer's is granted.
        assertTrue(_acl.persistAllowed(strikeHandle, address(s)), "contract computes on the strike (compute-only)");
    }

    // ── the cross-contract grant exists (composability hinge), and only for the consumer ──
    function test_feedValue_computeGrantedOnlyToConsumer() public {
        bytes32 id = keccak256("feedGrant");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(1500);

        bytes32 feedHandle = euint64.unwrap(feed.value());
        assertTrue(_acl.persistAllowed(feedHandle, address(s)), "consumer may compute on the feed value");
        assertTrue(_acl.persistAllowed(feedHandle, publisher), "publisher may audit its own feed");
        assertFalse(_acl.persistAllowed(feedHandle, buyer), "buyer may NOT read the feed value");
        assertFalse(_acl.persistAllowed(feedHandle, OUTSIDER), "public may NOT read the feed value");
    }

    // ── blind agent (Order II): the settlement contract cannot read the mandate it enforces ──
    function test_blindAgent_settlementCannotReadMandate() public {
        bytes32 id = keccak256("blindII");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);

        (euint64 perTradeCap, euint64 totalCap, euint64 drawdownPct) = engine.sealedLimits(id);
        ebool payeeFlag = engine.sealedPayeeFlag(id, buyer);
        bytes32[4] memory handles = [
            euint64.unwrap(perTradeCap), euint64.unwrap(totalCap), euint64.unwrap(drawdownPct), ebool.unwrap(payeeFlag)
        ];

        for (uint256 i = 0; i < handles.length; i++) {
            assertTrue(_acl.persistAllowed(handles[i], principal), "principal audits the mandate");
            assertFalse(_acl.persistAllowed(handles[i], address(s)), "the settlement agent is blind to the mandate");
            assertFalse(_acl.persistAllowed(handles[i], buyer), "the buyer is blind to the mandate");
        }
    }

    // ── replay: a stale exercise reverts on the nonce, on-chain ───────────────────
    function test_replay_revertsOnStaleNonce() public {
        bytes32 id = keccak256("replayII");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(1500);
        _exercise(s, 0); // nonce -> 1

        vm.prank(buyer);
        vm.expectRevert(Cloistra.StaleNonce.selector);
        s.exercise(0); // stale nonce 0 reverts
    }

    // ── access control: only the buyer exercises; only the writer arms ────────────
    function test_onlyBuyerCanExercise() public {
        bytes32 id = keccak256("authEx");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        _postFeed(1500);
        vm.prank(OUTSIDER);
        vm.expectRevert(SealedSettlement.NotBuyer.selector);
        s.exercise(0);
    }

    function test_onlyWriterCanArm() public {
        bytes32 id = keccak256("authArm");
        SealedSettlement s = _option(id, 100, 250, 50, 200, 1000, 80);
        (externalEuint64 st, bytes memory stP) = encryptUint64(2000, OUTSIDER, address(s));
        (externalEuint64 no, bytes memory noP) = encryptUint64(10, OUTSIDER, address(s));
        vm.prank(OUTSIDER);
        vm.expectRevert(SealedSettlement.NotWriter.selector);
        s.arm(st, stP, no, noP);
    }
}
