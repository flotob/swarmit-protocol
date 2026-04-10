// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SwarmitUsernameRegistry} from "../src/SwarmitUsernameRegistry.sol";

contract DeployUsernameRegistryScript is Script {
    // Adjust these before deploying
    uint256 constant BASE_MINT_PRICE = 0.001 ether;
    uint256 constant PRICE_STEP = 0.0001 ether;

    function run() public {
        // Require an explicit OWNER env var. Capturing msg.sender here
        // would silently pick up Foundry's default simulated sender when
        // broadcasting via --account or --ledger rather than --private-key.
        address owner = vm.envAddress("OWNER");

        vm.startBroadcast();
        SwarmitUsernameRegistry registry = new SwarmitUsernameRegistry(
            BASE_MINT_PRICE,
            PRICE_STEP,
            owner
        );
        vm.stopBroadcast();

        console.log("SwarmitUsernameRegistry deployed at:", address(registry));
        console.log("  baseMintPrice:", BASE_MINT_PRICE);
        console.log("  priceStep:    ", PRICE_STEP);
        console.log("  owner:        ", owner);
    }
}
