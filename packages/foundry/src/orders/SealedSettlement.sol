// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Cloistra} from "../Cloistra.sol";
import {ConfidentialFeed} from "./ConfidentialFeed.sol";

/// @title SealedSettlement — Order II: the cross-contract composability proof.
/// @author CLOISTRA (clean-room; unaudited demonstration)
/// @notice A parametric option/OTC hedge over the SAME sealed-mandate engine, adding ONE new
///         sealed predicate: payout releases iff an independent feed's sealed value ≥ the writer's
///         sealed strike. This proves the engine is a composable primitive, not a single app:
///         an independent contract's ciphertext (`ConfidentialFeed`) enters the mandate predicate
///         across a contract boundary, and **the strike stays sealed even after settlement** —
///         it never leaves this contract; only a sealed boolean crosses to the engine.
///
/// @dev    This contract is registered as the mandate's `agent`, so — like the Leash — it is BLIND
///         to the engine's sealed limits (caps, drawdown, allowlist). The strike and notional are
///         THIS consumer's own predicate parameters, not the engine's mandate; they are granted to
///         the writer (the mandate principal) for audit and to NO ONE else. Real FHE runs only on
///         Sepolia; local tests use Zama's cleartext harness.
contract SealedSettlement is ZamaEthereumConfig {
    Cloistra public immutable engine;
    bytes32 public immutable mandateId;
    ConfidentialFeed public immutable feed;
    /// @notice The option holder; the payout payee. Must be allowlisted on the mandate by the writer.
    address public immutable buyer;

    euint64 private _strike; // the writer's SEALED threshold — never revealed, even post-settlement
    euint64 private _notional; // the SEALED payout amount released on a valid exercise
    bool public armed;

    event Armed();
    event Exercised(uint256 indexed nonce, bytes32 receipt);

    error NotWriter();
    error NotBuyer();
    error NotArmed();
    error FeedUnset();

    constructor(Cloistra _engine, bytes32 _mandateId, ConfidentialFeed _feed, address _buyer) {
        engine = _engine;
        mandateId = _mandateId;
        feed = _feed;
        buyer = _buyer;
    }

    /// @dev The writer is the mandate's principal on the engine — the single source of truth.
    function writer() public view returns (address) {
        return engine.mandatePrincipal(mandateId);
    }

    /// @notice The writer (= mandate principal) commits the SEALED strike and notional.
    /// @dev Each sealed input is encrypted bound to (writer, this contract) and the writer calls
    ///      directly, so `FHE.fromExternal` verifies against the true caller.
    function arm(
        externalEuint64 strikeExt,
        bytes calldata strikeProof,
        externalEuint64 notionalExt,
        bytes calldata notionalProof
    ) external {
        if (msg.sender != writer()) revert NotWriter();
        euint64 strike = FHE.fromExternal(strikeExt, strikeProof);
        euint64 notional = FHE.fromExternal(notionalExt, notionalProof);
        FHE.allowThis(strike); // this contract computes on the strike each exercise
        FHE.allowThis(notional); // and passes the notional to the engine
        // Writer-only audit rights. The buyer and public are granted NOTHING: the strike is sealed
        // even after settlement, and the buyer cannot learn the notional.
        FHE.allow(strike, msg.sender);
        FHE.allow(notional, msg.sender);
        _strike = strike;
        _notional = notional;
        armed = true;
        emit Armed();
    }

    /// @notice The buyer exercises the option. Payout releases iff the feed is at/above the sealed
    ///         strike AND the sealed mandate holds; otherwise the engine nullifies the move to zero,
    ///         leaking nothing — not the strike, not the feed, not even whether it was in the money.
    /// @param clientNonce must equal the current mandate nonce; a replayed exercise reverts.
    function exercise(uint256 clientNonce) external returns (bytes32 receipt) {
        if (msg.sender != buyer) revert NotBuyer();
        if (!armed) revert NotArmed();
        if (!feed.hasValue()) revert FeedUnset();

        // Cross-contract compute: read the feed's SEALED value and compare it to the SEALED strike.
        // Only this contract can: the feed granted it persistent rights on the value handle, and the
        // strike is its own. The strike never crosses the boundary — only the sealed boolean does.
        ebool inTheMoney = FHE.ge(feed.value(), _strike);

        // Hand the engine tx-scoped access to the sealed boolean and the sealed notional it will move.
        FHE.allowTransient(inTheMoney, address(engine));
        FHE.allowTransient(_notional, address(engine));

        // The engine ANDs this extra sealed predicate into the sealed mandate; a violation on either
        // side => 0 via the engine's single FHE.select settlement path.
        receipt = engine.settleWithCondition(mandateId, clientNonce, buyer, _notional, inTheMoney);
        emit Exercised(clientNonce + 1, receipt);
    }

    /// @notice Sealed predicate-parameter handles. Decryptable only by the writer; opaque to the
    ///         buyer, the public, and this contract's own agent role.
    function sealedStrike() external view returns (euint64) {
        return _strike;
    }

    function sealedNotional() external view returns (euint64) {
        return _notional;
    }
}
