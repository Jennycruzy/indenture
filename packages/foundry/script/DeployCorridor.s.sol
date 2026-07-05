// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {Cloistra} from "../src/Cloistra.sol";
import {Corridor} from "../src/orders/Corridor.sol";

/// @title DeployCorridor — deploys a CLOISTRA Corridor consumer for the Sepolia backbone.
/// @notice This deploys the consumer contract only. The operator still has to commit the sealed
///         mandate, fund custody, screen recipients, and set the sealed velocity ceiling with real
///         encrypted inputs after deployment.
contract DeployCorridor is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        Cloistra engine = Cloistra(vm.envAddress("ENGINE_ADDRESS"));
        bytes32 mandateId = vm.envOr("MANDATE_ID", keccak256("cloistra-sepolia-corridor-v1"));
        address operator = vm.envOr("OPERATOR_ADDRESS", deployer);
        address officer = vm.envAddress("COMPLIANCE_OFFICER_ADDRESS");
        uint256 window = vm.envOr("WINDOW_SECONDS", uint256(30 days));

        vm.startBroadcast(pk);
        Corridor corridor = new Corridor(engine, mandateId, operator, officer, window);
        vm.stopBroadcast();

        console.log("== CLOISTRA Corridor deployed ==");
        console.log("Corridor:             %s", address(corridor));
        console.log("Cloistra engine:          %s", address(engine));
        console.log("Mandate id:");
        console.logBytes32(mandateId);
        console.log("Operator:             %s", operator);
        console.log("Compliance officer:   %s", officer);
        console.log("Window seconds:       %s", window);
    }
}
