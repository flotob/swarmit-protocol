// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SwarmitUsernameRegistry} from "../src/SwarmitUsernameRegistry.sol";

contract DeployUsernameRegistryScript is Script {
    // Adjust these before deploying
    uint256 constant BASE_MINT_PRICE = 0.001 ether;
    uint256 constant PRICE_STEP = 0.0001 ether;

    function run() public {
        address deployer = msg.sender;

        vm.startBroadcast();
        SwarmitUsernameRegistry registry = new SwarmitUsernameRegistry(
            BASE_MINT_PRICE,
            PRICE_STEP,
            deployer
        );
        vm.stopBroadcast();

        console.log("SwarmitUsernameRegistry deployed at:", address(registry));
        console.log("  baseMintPrice:", BASE_MINT_PRICE);
        console.log("  priceStep:    ", PRICE_STEP);
        console.log("  owner:        ", deployer);
    }
}
