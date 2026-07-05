// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {Cloistra} from "../src/Cloistra.sol";
import {ConfidentialFeed} from "../src/orders/ConfidentialFeed.sol";
import {DemoConfidentialToken} from "../src/mocks/DemoConfidentialToken.sol";

/// @title DeployCloistra — deploys the shared CLOISTRA backbone to Sepolia.
/// @notice Deploys the consumer-agnostic pieces: the sealed-mandate engine, a demo ERC-7984
///         confidential token for custody, and an independent ConfidentialFeed for Order II.
///         The per-mandate consumers (`Leash` for Order I, `SealedSettlement` for Order II) are
///         deployed from the frontend, where the principal generates the client-side encrypted
///         mandate inputs via the SDK — the commit/fund/arm steps require real encrypted inputs
///         and cannot be produced inside a Solidity broadcast script.
/// @dev    Reads `DEPLOYER_PRIVATE_KEY` (self-broadcasts) and optional `FEED_PUBLISHER` (defaults
///         to the deployer). No addresses are hardcoded; `ZamaEthereumConfig` selects FHEVM host
///         addresses by chainId. Run via `scripts/deploy-cloistra-sepolia.sh`.
contract DeployCloistra is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address publisher = vm.envOr("FEED_PUBLISHER", deployer);

        vm.startBroadcast(pk);
        Cloistra engine = new Cloistra();
        DemoConfidentialToken token = new DemoConfidentialToken("Cloistra USD", "clUSD", "");
        ConfidentialFeed feed = new ConfidentialFeed(publisher);
        vm.stopBroadcast();

        console.log("== CLOISTRA backbone deployed ==");
        console.log("Cloistra (engine):    %s", address(engine));
        console.log("DemoConfidentialToken: %s", address(token));
        console.log("ConfidentialFeed:      %s", address(feed));
        console.log("Feed publisher:        %s", publisher);
        console.log("Record these in DEPLOYMENTS.md with their Sepolia tx hashes.");
    }
}
