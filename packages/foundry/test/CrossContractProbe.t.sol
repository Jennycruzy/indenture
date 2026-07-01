// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FhevmTest} from "forge-fhevm/FhevmTest.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64, ebool, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

// ─────────────────────────────────────────────────────────────────────────────
// THROWAWAY cross-contract ACL probe (Phase 3 pre-flight, per build prompt).
// Before wiring Order II's SealedSettlement/ConfidentialFeed, prove the exact
// pattern in isolation: contract A (feed) stores an encrypted handle and grants
// contract B (consumer) *persistent* compute rights; B, in a LATER tx, computes
// on A's handle. This mirrors ConfidentialFeed → SealedSettlement.
//
// Verified ACL semantics (dependencies/.../fhevm-host/contracts/ACL.sol):
//   allow(handle, acct)          → persistent grant; caller must itself be allowed on handle
//   allowTransient(handle, acct) → tx-scoped grant; same caller requirement
//   isAllowed = allowedTransient(handle,acct) OR persistAllowed(handle,acct)
// A compute (FHE.ge) is performed *by* the calling contract; it must be isAllowed
// on every operand or the executor rejects it.
// ─────────────────────────────────────────────────────────────────────────────

/// @dev Independent producer of a sealed value (stands in for ConfidentialFeed).
contract ProbeFeed is ZamaEthereumConfig {
    euint64 private _v;

    /// @notice Post a sealed value and grant `consumer` PERSISTENT rights to compute on it later.
    function post(externalEuint64 ext, bytes calldata proof, address consumer) external {
        euint64 v = FHE.fromExternal(ext, proof);
        FHE.allowThis(v); // feed keeps the handle usable for future reads
        FHE.allow(v, consumer); // cross-contract, cross-tx grant → consumer may compute on `v`
        _v = v;
    }

    function value() external view returns (euint64) {
        return _v;
    }
}

/// @dev Consumer that reads the feed's sealed value and compares it to its own sealed threshold.
contract ProbeConsumer is ZamaEthereumConfig {
    ProbeFeed public immutable feed;
    euint64 private _threshold;
    ebool public result;

    constructor(ProbeFeed f) {
        feed = f;
    }

    function setThreshold(externalEuint64 ext, bytes calldata proof) external {
        euint64 t = FHE.fromExternal(ext, proof);
        FHE.allowThis(t);
        _threshold = t;
    }

    /// @notice The cross-contract compute: feed.value() >= threshold, in a tx after post().
    function compute() external returns (ebool) {
        ebool r = FHE.ge(feed.value(), _threshold); // requires isAllowed(feed.value(), address(this))
        FHE.allowThis(r);
        result = r;
        return r;
    }
}

contract CrossContractProbeTest is FhevmTest {
    ProbeFeed internal feed;
    ProbeConsumer internal consumer;

    function setUp() public override {
        super.setUp();
        feed = new ProbeFeed();
        consumer = new ProbeConsumer(feed);
    }

    /// @notice Positive path: granted consumer computes on the feed's sealed handle across a tx boundary.
    function test_grantedConsumer_computesOnFeedHandle() public {
        (externalEuint64 tExt, bytes memory tP) = encryptUint64(80, address(consumer));
        consumer.setThreshold(tExt, tP);

        // Feed posts 100 and grants THIS consumer persistent compute rights.
        (externalEuint64 vExt, bytes memory vP) = encryptUint64(100, address(feed));
        feed.post(vExt, vP, address(consumer));

        // The consumer is now persistently allowed on the feed's handle...
        (euint64 fv) = feed.value();
        assertTrue(_acl.persistAllowed(euint64.unwrap(fv), address(consumer)), "consumer granted on feed handle");

        // ...so in a later tx it can compute feed.value() >= threshold without reverting.
        consumer.compute();
        assertTrue(decrypt(consumer.result()), "100 >= 80 is true");
    }

    /// @notice Re-posting a lower value flips the sealed comparison — the grant persists per handle.
    function test_recompute_reflectsNewFeedValue() public {
        (externalEuint64 tExt, bytes memory tP) = encryptUint64(80, address(consumer));
        consumer.setThreshold(tExt, tP);

        (externalEuint64 vExt, bytes memory vP) = encryptUint64(50, address(feed));
        feed.post(vExt, vP, address(consumer));
        consumer.compute();
        assertFalse(decrypt(consumer.result()), "50 >= 80 is false");
    }

    /// @notice Negative path: a consumer the feed never granted cannot compute on the handle.
    function test_ungrantedConsumer_cannotCompute() public {
        ProbeConsumer other = new ProbeConsumer(feed);
        (externalEuint64 tExt, bytes memory tP) = encryptUint64(80, address(other));
        other.setThreshold(tExt, tP);

        // Feed posts, granting only `consumer` — NOT `other`.
        (externalEuint64 vExt, bytes memory vP) = encryptUint64(100, address(feed));
        feed.post(vExt, vP, address(consumer));

        (euint64 fv) = feed.value();
        assertFalse(_acl.persistAllowed(euint64.unwrap(fv), address(other)), "other NOT granted on feed handle");

        vm.expectRevert(); // executor rejects the compute — `other` is not allowed on the operand
        other.compute();
    }
}
