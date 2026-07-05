// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title Cloistra — the sealed-mandate engine.
/// @author CLOISTRA (clean-room; unaudited demonstration)
/// @notice CLOISTRA encrypts *the rule*, not just the amount — and hides the rule even from
///         the actor it governs. This engine holds ERC-7984 confidential-token custody and
///         enforces a SEALED, encrypted mandate (per-trade cap, total exposure cap, drawdown
///         floor, payee allowlist) homomorphically. The delegated `agent` is BLIND: it holds
///         no ACL decrypt rights over any mandate handle, so it cannot read — let alone game or
///         leak — the limits it runs on. A non-compliant move is silently nullified to zero via
///         a single `FHE.select`; it can't even be expressed. Only the `principal` may decrypt,
///         and only to audit.
///
///         This is NOT "confidential settlement": the adversary here is an *insider* (the
///         delegated agent), and what is hidden is the *policy*, not the transfer amount.
///
/// @dev    Consumer-agnostic primitive. Consumers (Orders I–III) shape only their predicate and
///         feed encrypted inputs in; every fund-out flows through the single internal `_settle`.
///         Real FHE + threshold decryption run only on Sepolia; local tests use Zama's cleartext
///         harness. No addresses are hardcoded — `ZamaEthereumConfig` selects them by chainId.
contract Cloistra is ZamaEthereumConfig {
    struct Mandate {
        // ── sealed mandate (the rule; decrypt-granted to principal ONLY) ──
        euint64 perTradeCap; // max sealed amount movable in a single settlement
        euint64 totalCap; // max sealed cumulative amount movable over the mandate's life
        euint64 drawdownPct; // custody must stay >= drawdownPct% of the high-water mark (e.g. 80)
        // ── sealed running state ──
        euint64 spent; // cumulative amount moved (advances atomically per settlement)
        euint64 custody; // this mandate's sealed confidential-token balance held by the engine
        euint64 highWaterMark; // sealed peak custody, for the drawdown floor
        // ── public bookkeeping ──
        address principal; // commits/rotates/funds the mandate (CLOISTRA: the corridor operator)
        // The ONLY address granted decrypt rights (the audit role). Defaults to `principal` for legacy
        // mandates (`commitMandate`); a CLOISTRA corridor sets a DISTINCT compliance officer via
        // `commitMandateFor`, so the operator commits the policy but can never read it (Phase B step 3).
        address complianceOfficer;
        address agent; // authorized settler (an EOA agent, or a consumer contract); BLIND
        IERC7984 token; // custody token
        uint256 nonce; // public monotonic; a stale/replayed move reverts on it
        bytes32 lastReceipt; // public hash-chained receipt (tamper-evident ordering)
        bool exists;
    }

    mapping(bytes32 => Mandate) private _mandates;
    // Sealed per-payee allow bit. The address is necessarily public (mapping key / calldata);
    // only *whether it is allowed* is encrypted. `_payeeSet` gives explicit default-DENY.
    mapping(bytes32 => mapping(address => ebool)) private _payeeAllowed;
    mapping(bytes32 => mapping(address => bool)) private _payeeSet;

    /// @dev Public receipts carry ordering only — never amounts, limits, or the pass/fail bit.
    event MandateCommitted(bytes32 indexed id, address indexed principal, address indexed agent, address token);
    event Funded(bytes32 indexed id); // amount sealed; not emitted
    event AllowlistRotated(bytes32 indexed id); // which payee changed is not revealed in the event
    // `outcomeHandle` is the opaque ciphertext ref of the moved amount — already publicly
    // observable via coprocessor events, and decryptable ONLY by the principal. It feeds the
    // hash chain and the frontend receipt ribbon; it reveals no cleartext.
    event Settled(bytes32 indexed id, uint256 indexed nonce, bytes32 receipt, bytes32 outcomeHandle);

    error MandateAlreadyExists();
    error UnknownMandate();
    error NotPrincipal();
    error NotAgent();
    error StaleNonce(); // replay / out-of-order move

    modifier onlyPrincipal(bytes32 id) {
        if (!_mandates[id].exists) revert UnknownMandate();
        if (msg.sender != _mandates[id].principal) revert NotPrincipal();
        _;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Principal-direct entrypoints (principal encrypts bound to this engine and calls
    // it directly, so `FHE.fromExternal` verifies against the true caller).
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Commit a sealed mandate whose audit role is the committer itself (legacy behavior).
    ///         Each limit carries its own input-verification proof (one proof per encrypted input —
    ///         identical on the local harness and on real Sepolia; a one-time commit, cheap in context).
    /// @param id        caller-chosen mandate id
    /// @param agent     the blind executor (EOA) or the consumer contract authorized to settle
    /// @param token     ERC-7984 confidential token used for custody
    function commitMandate(
        bytes32 id,
        address agent,
        IERC7984 token,
        externalEuint64 perTradeCapExt,
        bytes calldata perTradeProof,
        externalEuint64 totalCapExt,
        bytes calldata totalProof,
        externalEuint64 drawdownPctExt,
        bytes calldata drawdownProof
    ) external {
        // Legacy: the committer (principal) is its own compliance officer → identical grants to before.
        // Resolve the ciphertexts HERE (msg.sender is the true committer) and pass value-type handles
        // to `_register` — forwarding `bytes calldata` into an internal helper blows the stack.
        _register(
            id,
            agent,
            token,
            msg.sender,
            FHE.fromExternal(perTradeCapExt, perTradeProof),
            FHE.fromExternal(totalCapExt, totalProof),
            FHE.fromExternal(drawdownPctExt, drawdownProof)
        );
    }

    /// @notice CLOISTRA: commit a sealed mandate with a DISTINCT compliance officer as the audit role.
    ///         The operator (msg.sender) commits, funds, and screens, but is granted NO decrypt rights;
    ///         only `complianceOfficer` may decrypt the sealed policy and flagged outcomes (Phase B §3).
    function commitMandateFor(
        bytes32 id,
        address agent,
        IERC7984 token,
        address complianceOfficer,
        externalEuint64 perTradeCapExt,
        bytes calldata perTradeProof,
        externalEuint64 totalCapExt,
        bytes calldata totalProof,
        externalEuint64 drawdownPctExt,
        bytes calldata drawdownProof
    ) external {
        _register(
            id,
            agent,
            token,
            complianceOfficer,
            FHE.fromExternal(perTradeCapExt, perTradeProof),
            FHE.fromExternal(totalCapExt, totalProof),
            FHE.fromExternal(drawdownPctExt, drawdownProof)
        );
    }

    /// @dev The single mandate-registration path. `officer` receives every audit (decrypt) grant; the
    ///      agent receives NOTHING (the blind-agent guarantee). Sealed inputs are already internalized by
    ///      the caller against the true committer, so only value-type handles cross into this helper.
    function _register(
        bytes32 id,
        address agent,
        IERC7984 token,
        address officer,
        euint64 perTradeCap,
        euint64 totalCap,
        euint64 drawdownPct
    ) internal {
        Mandate storage m = _mandates[id];
        if (m.exists) revert MandateAlreadyExists();

        m.principal = msg.sender;
        m.complianceOfficer = officer;
        m.agent = agent;
        m.token = token;
        m.perTradeCap = perTradeCap;
        m.totalCap = totalCap;
        m.drawdownPct = drawdownPct;
        m.spent = FHE.asEuint64(0);
        m.custody = FHE.asEuint64(0);
        m.highWaterMark = FHE.asEuint64(0);
        m.exists = true;

        // The engine must reuse every sealed handle across future txs.
        FHE.allowThis(m.perTradeCap);
        FHE.allowThis(m.totalCap);
        FHE.allowThis(m.drawdownPct);
        FHE.allowThis(m.spent);
        FHE.allowThis(m.custody);
        FHE.allowThis(m.highWaterMark);
        // The compliance officer — and ONLY the officer — may decrypt the sealed mandate to audit.
        // (Legacy mandates set officer = principal, so this is the pre-existing behavior unchanged.)
        // The agent is deliberately granted NOTHING here: this is the blind-agent guarantee.
        FHE.allow(m.perTradeCap, officer);
        FHE.allow(m.totalCap, officer);
        FHE.allow(m.drawdownPct, officer);
        FHE.allow(m.spent, officer);
        FHE.allow(m.custody, officer);
        FHE.allow(m.highWaterMark, officer);

        emit MandateCommitted(id, msg.sender, agent, address(token));
    }

    /// @notice Fund a mandate's sealed custody. Principal must `setOperator(engine, until)` on the
    ///         token first; the engine pulls via confidentialTransferFrom and advances the sealed
    ///         high-water mark used by the drawdown floor.
    function fund(bytes32 id, externalEuint64 amountExt, bytes calldata inputProof) external onlyPrincipal(id) {
        Mandate storage m = _mandates[id];
        // Internalize the amount bound to (principal, engine) — principal calls the engine
        // directly, so this verifies cleanly — then let the token USE the handle and pull via
        // the no-proof transferFrom variant (principal must have setOperator(engine, until)).
        euint64 amt = FHE.fromExternal(amountExt, inputProof);
        FHE.allowTransient(amt, address(m.token));
        euint64 transferred = m.token.confidentialTransferFrom(msg.sender, address(this), amt);

        m.custody = FHE.add(m.custody, transferred);
        // high-water mark = max custody ever held (peak holdings), for the drawdown floor
        ebool higher = FHE.gt(m.custody, m.highWaterMark);
        m.highWaterMark = FHE.select(higher, m.custody, m.highWaterMark);

        FHE.allowThis(m.custody);
        FHE.allowThis(m.highWaterMark);
        FHE.allow(m.custody, m.complianceOfficer); // audit role only (== principal for legacy mandates)
        FHE.allow(m.highWaterMark, m.complianceOfficer);

        emit Funded(id);
    }

    /// @notice Rotate a payee's sealed allow bit in ciphertext. The event does not reveal which
    ///         payee changed (though calldata necessarily carries the address — see contract docs).
    function setPayeeAllowed(bytes32 id, address payee, externalEbool allowedExt, bytes calldata inputProof)
        external
        onlyPrincipal(id)
    {
        ebool flag = FHE.fromExternal(allowedExt, inputProof);
        FHE.allowThis(flag);
        // The compliance officer may audit the screening bit; the operator and agent may not
        // (== principal for legacy mandates, so pre-existing behavior is unchanged).
        FHE.allow(flag, _mandates[id].complianceOfficer);
        _payeeAllowed[id][payee] = flag;
        _payeeSet[id][payee] = true;
        emit AllowlistRotated(id);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Settlement — the SINGLE fund-out path. Consumers (Orders) call these after
    // internalizing the agent's encrypted amount via their own `FHE.fromExternal`
    // and granting this engine transient access to the handle(s).
    // ─────────────────────────────────────────────────────────────────────────────

    /// @notice Order I settlement: enforce the sealed mandate with no extra predicate.
    /// @dev Caller MUST be the mandate's `agent` and MUST have `allowTransient(amount, engine)`.
    function settle(bytes32 id, uint256 clientNonce, address payee, euint64 amount) external returns (bytes32 receipt) {
        (receipt,) = _settle(id, clientNonce, payee, amount, FHE.asEbool(true), false);
    }

    /// @notice Order II/III settlement: AND an additional sealed predicate (e.g. feed >= strike,
    ///         or quorum reached) computed by an independent consumer contract into the mandate.
    /// @dev Caller MUST be the mandate's `agent`; both `amount` and `extraOk` MUST be granted
    ///      transient access to this engine by the caller (the cross-contract ACL grant).
    function settleWithCondition(bytes32 id, uint256 clientNonce, address payee, euint64 amount, ebool extraOk)
        external
        returns (bytes32 receipt)
    {
        (receipt,) = _settle(id, clientNonce, payee, amount, extraOk, false);
    }

    /// @notice CLOISTRA corridor settlement: like `settleWithCondition`, but returns the sealed `moved`
    ///         handle and grants the calling consumer (the agent) transient COMPUTE rights on it, so it
    ///         can chain the actually-moved amount into its own encrypted accounting (the per-sender
    ///         velocity accumulator) IN THIS TX WITHOUT DECRYPTING IT. `moved ∈ {0, amount}`; a compute
    ///         grant to a contract decrypts nothing (user-decryption needs a granted EOA too), so the
    ///         blind-agent-over-policy and leak guarantees are untouched (see CLOISTRA_DESIGN.md §4).
    /// @dev Caller MUST be the mandate's `agent`; `amount` and `extraOk` MUST be `allowTransient`'d to
    ///      this engine by the caller.
    function settleCorridor(bytes32 id, uint256 clientNonce, address payee, euint64 amount, ebool extraOk)
        external
        returns (bytes32 receipt, euint64 moved)
    {
        return _settle(id, clientNonce, payee, amount, extraOk, true);
    }

    function _settle(
        bytes32 id,
        uint256 clientNonce,
        address payee,
        euint64 amount,
        ebool extraOk,
        bool grantAgentMoved
    ) internal returns (bytes32, euint64) {
        Mandate storage m = _mandates[id];
        if (!m.exists) revert UnknownMandate();
        if (msg.sender != m.agent) revert NotAgent();
        if (clientNonce != m.nonce) revert StaleNonce(); // replay / stale move dies here, on-chain

        // ── the sealed predicate (all comparisons on ciphertext; no branch on the outcome) ──
        // Built progressively into `ok` to keep the encrypted-handle stack shallow.
        ebool withinCustody = FHE.le(amount, m.custody); // can't move more than this mandate holds
        ebool ok = FHE.and(FHE.le(amount, m.perTradeCap), FHE.le(FHE.add(m.spent, amount), m.totalCap));
        ok = FHE.and(ok, withinCustody);
        // equity after this move (guarded so an over-custody amount can't underflow the u64);
        // "custody must stay >= drawdownPct% of peak" — cross-multiplied, NEVER divide ciphertext.
        ok = FHE.and(
            ok,
            FHE.ge(
                FHE.mul(FHE.select(withinCustody, FHE.sub(m.custody, amount), FHE.asEuint64(0)), FHE.asEuint64(100)),
                FHE.mul(m.highWaterMark, m.drawdownPct)
            )
        );
        ok = FHE.and(ok, _isPayeeAllowed(id, payee)); // ebool; explicit default-DENY
        ok = FHE.and(ok, extraOk);

        // Single settlement expression: violation => 0. Leaks nothing — not even pass/fail.
        euint64 moved = FHE.select(ok, amount, FHE.asEuint64(0));

        // advance sealed running state atomically; `ok => withinCustody => amount <= custody`,
        // and moved ∈ {0, amount}, so the custody subtraction can never underflow.
        m.spent = FHE.add(m.spent, moved);
        m.custody = FHE.sub(m.custody, moved);

        FHE.allowThis(m.spent);
        FHE.allowThis(m.custody);
        FHE.allowThis(moved);
        // Officer-only selective disclosure: the compliance officer may later decrypt the running
        // state and this settlement's sealed outcome to audit. The agent and operator are granted
        // nothing (== principal for legacy mandates, so pre-existing behavior is unchanged).
        FHE.allow(m.spent, m.complianceOfficer);
        FHE.allow(m.custody, m.complianceOfficer);
        FHE.allow(moved, m.complianceOfficer);
        // CLOISTRA: optionally let the consumer (the agent) COMPUTE on the sealed outcome this tx so it can
        // advance its own encrypted accounting (velocity accumulator). Compute-only — decrypts nothing.
        if (grantAgentMoved) FHE.allowTransient(moved, msg.sender);

        // Move `moved` out of custody. The token must be able to USE the handle (transient),
        // and requires this engine (msg.sender) to be allowed on it — it is, having computed it.
        FHE.allowTransient(moved, address(m.token));
        m.token.confidentialTransfer(payee, moved);

        // public, tamper-evident ordering: proves settlements happened & their sequence,
        // while amounts/limits/outcome stay sealed. outcomeCommitment is an opaque handle ref.
        m.nonce = clientNonce + 1;
        // outcomeCommitment = keccak of the opaque handle ref (reveals nothing); folded into the chain.
        bytes32 outcomeHandle = euint64.unwrap(moved);
        m.lastReceipt = keccak256(abi.encode(m.lastReceipt, m.nonce, payee, keccak256(abi.encode(outcomeHandle))));

        emit Settled(id, m.nonce, m.lastReceipt, outcomeHandle);
        return (m.lastReceipt, moved);
    }

    function _isPayeeAllowed(bytes32 id, address payee) internal returns (ebool) {
        if (!_payeeSet[id][payee]) return FHE.asEbool(false); // default-DENY
        return _payeeAllowed[id][payee];
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Public views. Handles are on-chain (public) but only carry meaning to whoever
    // holds ACL decrypt rights — i.e. the principal. Exposing a handle is not a leak.
    // ─────────────────────────────────────────────────────────────────────────────

    function mandateAgent(bytes32 id) external view returns (address) {
        return _mandates[id].agent;
    }

    function mandatePrincipal(bytes32 id) external view returns (address) {
        return _mandates[id].principal;
    }

    /// @notice The mandate's audit role — the ONLY address granted decrypt rights over the sealed
    ///         policy and flagged outcomes. Equals the principal for legacy mandates; a distinct
    ///         compliance officer for a CLOISTRA corridor (committed via `commitMandateFor`).
    function mandateComplianceOfficer(bytes32 id) external view returns (address) {
        return _mandates[id].complianceOfficer;
    }

    function mandateToken(bytes32 id) external view returns (IERC7984) {
        return _mandates[id].token;
    }

    function mandateNonce(bytes32 id) external view returns (uint256) {
        return _mandates[id].nonce;
    }

    function lastReceipt(bytes32 id) external view returns (bytes32) {
        return _mandates[id].lastReceipt;
    }

    function mandateExists(bytes32 id) external view returns (bool) {
        return _mandates[id].exists;
    }

    /// @notice Sealed running state handles (spent, custody, high-water mark). Decryptable only
    ///         by the principal via user-decryption; opaque to everyone else, incl. the agent.
    function sealedState(bytes32 id) external view returns (euint64 spent, euint64 custody, euint64 highWaterMark) {
        Mandate storage m = _mandates[id];
        return (m.spent, m.custody, m.highWaterMark);
    }

    /// @notice Sealed mandate-limit handles. Same access story: principal-only meaning.
    function sealedLimits(bytes32 id)
        external
        view
        returns (euint64 perTradeCap, euint64 totalCap, euint64 drawdownPct)
    {
        Mandate storage m = _mandates[id];
        return (m.perTradeCap, m.totalCap, m.drawdownPct);
    }

    /// @notice The sealed allow bit for a payee (uninitialized handle if never set → default-deny).
    function sealedPayeeFlag(bytes32 id, address payee) external view returns (ebool) {
        return _payeeAllowed[id][payee];
    }
}
