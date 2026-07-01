// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title ConfidentialFeed — an independent sealed-value oracle (Order II).
/// @author INDENTURE (clean-room; unaudited demonstration)
/// @notice A standalone contract that publishes a SEALED value (e.g. a settlement price or an
///         index level). It is deliberately SEPARATE from the sealed-mandate engine: its encrypted
///         value flows into the mandate predicate across a contract boundary, read by an authorized
///         consumer through the ACL. That cross-contract flow — an independent contract's ciphertext
///         entering the mandate predicate *without being decrypted* — is the composability proof.
///
/// @dev    ACL discipline (verified against fhevm-host/contracts/ACL.sol):
///         `FHE.allow(handle, consumer)` is a PERSISTENT grant, and the caller (this feed) must
///         itself be allowed on the handle for the grant to succeed — it is, having just
///         internalized the value. That lets the consumer compute on this handle in a *later* tx.
///         Real FHE runs only on Sepolia; local tests use Zama's cleartext harness.
contract ConfidentialFeed is ZamaEthereumConfig {
    /// @notice The only address that may post values.
    address public immutable publisher;
    /// @notice The contract authorized to compute on the sealed value (e.g. a SealedSettlement).
    address public consumer;

    euint64 private _value; // the sealed feed value
    bool public hasValue;

    event ConsumerAuthorized(address indexed consumer);
    event ValuePosted(); // the value is sealed and never emitted

    error NotPublisher();
    error ConsumerUnset();

    constructor(address _publisher) {
        publisher = _publisher;
    }

    modifier onlyPublisher() {
        if (msg.sender != publisher) revert NotPublisher();
        _;
    }

    /// @notice Authorize the consumer contract that may compute on posted values. Set once wiring
    ///         is deployed (avoids a circular constructor dependency with the consumer).
    function authorizeConsumer(address _consumer) external onlyPublisher {
        consumer = _consumer;
        emit ConsumerAuthorized(_consumer);
    }

    /// @notice Post a sealed value and grant the authorized consumer PERSISTENT rights to compute
    ///         on this handle in a later settlement tx. The publisher may decrypt its own feed to
    ///         audit; the consumer may only *compute* on it, and the buyer/public get nothing.
    function postValue(externalEuint64 valueExt, bytes calldata inputProof) external onlyPublisher {
        if (consumer == address(0)) revert ConsumerUnset();
        euint64 v = FHE.fromExternal(valueExt, inputProof);
        FHE.allowThis(v); // the feed reuses the handle across reads
        FHE.allow(v, consumer); // cross-contract, cross-tx compute grant — the composability hinge
        FHE.allow(v, publisher); // publisher-only audit; buyer/public are granted NOTHING
        _value = v;
        hasValue = true;
        emit ValuePosted();
    }

    /// @notice The sealed value handle. On-chain and public, but meaningful only to whoever holds
    ///         ACL rights: the consumer may compute on it; only the publisher may decrypt it.
    function value() external view returns (euint64) {
        return _value;
    }
}
