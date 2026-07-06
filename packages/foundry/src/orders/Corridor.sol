// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {Cloistra} from "../Cloistra.sol";

/// @title Corridor — CLOISTRA: a confidential cross-border payment corridor whose COMPLIANCE RULEBOOK is
///        sealed (product name CLOISTRA; engine name `Cloistra`).
///
/// @notice Everyone else encrypts the payment and publishes the rules. CLOISTRA seals the rules. This
///         consumer adds the one net-new primitive on top of the sealed-mandate engine: a SEALED,
///         PER-SENDER ROLLING VELOCITY CEILING enforced by an ENCRYPTED running accumulator that
///         resets on a public time-window boundary — no decryption, no encrypted division.
///
///         The three sealed rules checked on every transfer:
///           1. sealed per-transfer cap        — reused from the engine (`perTradeCap`)
///           2. sealed recipient screening     — reused from the engine (`_payeeAllowed`, default-deny)
///           3. sealed rolling velocity ceiling — NET-NEW, held here
///         All three are ciphertext. A breach nullifies the transfer to zero via the engine's single
///         `FHE.select` and reveals WHICH rule failed to no one — the anti-scouting property.
///
/// @dev    Registered as the mandate's `agent`, so — like `Leash`/`SealedSettlement` — this contract is
///         BLIND to the engine's sealed limits (it holds no decrypt rights over caps/drawdown/screening).
///         It multiplexes many senders onto one mandate: a sender encrypts its amount bound to
///         (sender, this Corridor) and calls `transfer` directly, so `FHE.fromExternal` verifies against
///         the true caller — a forged/proofless ciphertext reverts here, on-chain, at input verification.
///         The mandate nonce is per-mandate (shared across senders); the frontend reads the current
///         nonce before each transfer. Real FHE + threshold decryption run only on Sepolia; local tests
///         use Zama's cleartext harness.
contract Corridor is ZamaEthereumConfig {
    Cloistra public immutable engine;
    bytes32 public immutable mandateId;
    /// @notice The corridor operator (== the mandate principal on the engine). Commits/funds/screens and
    ///         sets the sealed ceiling — but holds NO decrypt rights over any sealed policy value.
    address public immutable operator;
    /// @notice The compliance officer (== the mandate compliance officer on the engine). The ONLY address
    ///         granted decrypt rights over the sealed policy and the flagged-transfer outcomes.
    address public immutable complianceOfficer;
    /// @notice The rolling window length (PUBLIC — block time is not secret; only amounts are).
    uint256 public immutable window;

    euint64 private _ceiling; // the SEALED per-sender velocity ceiling (operator-set ciphertext)
    bool public ceilingSet;

    // Per-sender encrypted running total spent in the current window. The address is public; how much
    // they have moved is sealed — decrypt-granted to the compliance officer ONLY.
    mapping(address => euint64) private _sealedSpent;
    // Per-sender PUBLIC window anchor. Advances (in the clear) only when the window rolls over.
    mapping(address => uint256) public windowStart;

    event CeilingSet(); // the ceiling is sealed and never emitted
    // Public ordering + routing only — NO amount, NO ceiling, NO running total, NO pass/fail bit.
    event CorridorTransfer(address indexed sender, address indexed recipient, uint256 indexed nonce);

    error NotOperator();
    error CeilingUnset();

    constructor(Cloistra _engine, bytes32 _mandateId, address _operator, address _complianceOfficer, uint256 _window) {
        engine = _engine;
        mandateId = _mandateId;
        operator = _operator;
        complianceOfficer = _complianceOfficer;
        window = _window;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    /// @notice The operator commits the SEALED velocity ceiling (Rule 3). Encrypted bound to
    ///         (operator, this Corridor); the operator calls directly so `FHE.fromExternal` verifies
    ///         against the true caller. The ceiling is decrypt-granted to the compliance officer ONLY —
    ///         the operator that set it gets NO on-chain decrypt grant (unscoutable, unleakable).
    /// @dev May be re-called to rotate the ceiling in ciphertext (no plaintext ever leaves the client).
    function setCeiling(externalEuint64 ceilingExt, bytes calldata inputProof) external onlyOperator {
        euint64 c = FHE.fromExternal(ceilingExt, inputProof);
        FHE.allowThis(c); // the Corridor computes on the ceiling on every transfer
        FHE.allow(c, complianceOfficer); // officer-only audit; operator/sender granted NOTHING
        _ceiling = c;
        ceilingSet = true;
        emit CeilingSet();
    }

    /// @notice A sender submits a cross-border transfer. It clears iff it passes ALL three sealed rules
    ///         (cap, recipient screening, velocity ceiling) AND the engine's custody/drawdown checks;
    ///         otherwise the engine silently nullifies it to zero, leaking nothing — not the amount, not
    ///         any threshold, not even which rule caught it.
    /// @param clientNonce must equal the current mandate nonce; a replayed/stale transfer reverts on-chain.
    /// @param recipient   the (public) beneficiary; whether they pass screening stays sealed.
    /// @param amountExt   the sender's amount, encrypted bound to (this Corridor, sender).
    function transfer(uint256 clientNonce, address recipient, externalEuint64 amountExt, bytes calldata inputProof)
        external
        returns (bytes32 receipt)
    {
        if (!ceilingSet) revert CeilingUnset();

        // Input boundary: a hand-crafted ciphertext without a valid proof reverts HERE, on-chain.
        euint64 amount = FHE.fromExternal(amountExt, inputProof);

        // ── Rule 3: sealed rolling velocity, decided against the PUBLIC window clock ──
        // block.timestamp is public — only the spent AMOUNTS are secret — so the rollover is a plaintext
        // branch on a public bool; no encrypted branching, no decryption. `windowStart == 0` is the
        // "never-seen sender" sentinel (a real chain's block.timestamp is always > 0, so a set anchor is
        // never 0): it forces `rolled == true` so the uninitialized `_sealedSpent` handle is NEVER read
        // (carried is a fresh sealed zero). Whenever `rolled == false`, `_sealedSpent[sender]` was set by
        // a prior transfer — the invariant that keeps the accumulator sound.
        uint256 anchor = windowStart[msg.sender];
        bool rolled = anchor == 0 || block.timestamp >= anchor + window;
        euint64 carried = rolled ? FHE.asEuint64(0) : _sealedSpent[msg.sender];
        // "would this transfer put the sender over their sealed ceiling?" — an absolute sealed amount,
        // so a plain `FHE.le`; never an encrypted division.
        ebool withinVelocity = FHE.le(FHE.add(carried, amount), _ceiling);

        // Hand the engine tx-scoped access to the sealed amount and the sealed velocity predicate.
        FHE.allowTransient(amount, address(engine));
        FHE.allowTransient(withinVelocity, address(engine));

        // The engine ANDs Rule 3 into Rules 1+2 (+ its own custody/drawdown) and settles via the single
        // `FHE.select`. It returns the sealed `moved` amount (0 if nullified for ANY reason) and grants
        // THIS contract transient COMPUTE rights on it, so we can advance the accumulator without ever
        // decrypting it (a contract compute-grant decrypts nothing — see CLOISTRA_DESIGN.md §4).
        euint64 moved;
        (receipt, moved) = engine.settleCorridor(mandateId, clientNonce, recipient, amount, withinVelocity);

        // Advance the encrypted running total by the ACTUALLY-MOVED amount. A transfer blocked by ANY
        // rule contributes 0, so window budget is consumed only by money that truly moved. moved ∈
        // {0, amount}, so no underflow, no division.
        euint64 newSpent = FHE.add(carried, moved);
        _sealedSpent[msg.sender] = newSpent;
        if (rolled) windowStart[msg.sender] = block.timestamp; // reset the public anchor on rollover

        FHE.allowThis(newSpent); // the Corridor reuses the running total next transfer
        FHE.allow(newSpent, complianceOfficer); // officer-only audit; sender/operator granted NOTHING

        emit CorridorTransfer(msg.sender, recipient, clientNonce);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Sealed audit handles. On-chain and public, but meaningful only to whoever holds ACL decrypt
    // rights — i.e. the compliance officer. Exposing a handle is not a leak.
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice The sealed velocity ceiling handle. Decryptable only by the compliance officer.
    function sealedCeiling() external view returns (euint64) {
        return _ceiling;
    }

    /// @notice A sender's sealed in-window running total. Decryptable only by the compliance officer;
    ///         opaque to the sender themselves (they know a ceiling exists, never where it sits).
    function sealedSpent(address sender) external view returns (euint64) {
        return _sealedSpent[sender];
    }
}
