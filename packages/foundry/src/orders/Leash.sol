// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Cloistra} from "../Cloistra.sol";

/// @title Leash — Order I: the blind single-agent composability proof.
/// @notice A fund/treasury delegates execution to an autonomous agent that is *physically
///         incapable* of exceeding its sealed per-trade cap, total-exposure cap, or drawdown
///         floor, or of paying a non-allowlisted counterparty — and the mandate is invisible,
///         so competitors and front-runners cannot read or game it, **and the agent itself
///         cannot see the leash it runs on.**
/// @dev    Leash is the agent's on-chain identity and the encrypted-input boundary. The engine
///         registers *this contract* as the mandate's authorized settler; Leash in turn gates
///         the real agent EOA. The agent encrypts its proposed amount bound to (this Leash,
///         agent) and calls `execute` directly, so `FHE.fromExternal` verifies against the true
///         caller — a forged/proofless ciphertext reverts here, on-chain, at input verification.
contract Leash is ZamaEthereumConfig {
    Cloistra public immutable engine;
    bytes32 public immutable mandateId;
    /// @notice The blind executor. It authorizes moves but holds NO ACL decrypt rights over the
    ///         sealed mandate — it cannot read the very limits it is bound by.
    address public immutable agent;

    error NotAgent();

    constructor(Cloistra _engine, bytes32 _mandateId, address _agent) {
        engine = _engine;
        mandateId = _mandateId;
        agent = _agent;
    }

    /// @notice The agent proposes a move. The engine silently nullifies it to zero if it breaches
    ///         any sealed limit; nothing about the mandate or the pass/fail outcome leaks.
    /// @param clientNonce must equal the current mandate nonce; a replayed/stale move reverts.
    /// @param payee       the (public) counterparty; whether it is allowed stays sealed.
    /// @param amountExt   the agent's proposed amount, encrypted bound to (this contract, agent).
    function execute(uint256 clientNonce, address payee, externalEuint64 amountExt, bytes calldata inputProof)
        external
        returns (bytes32 receipt)
    {
        if (msg.sender != agent) revert NotAgent();

        // Input boundary: a hand-crafted ciphertext without a valid proof reverts HERE.
        euint64 amount = FHE.fromExternal(amountExt, inputProof);
        // Hand the engine transient access to the internalized handle for this tx only.
        FHE.allowTransient(amount, address(engine));

        return engine.settle(mandateId, clientNonce, payee, amount);
    }
}
