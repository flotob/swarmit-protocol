// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SwarmitRegistryV2} from "../src/SwarmitRegistryV2.sol";

contract DeployV2Script is Script {
    function run() public {
        vm.startBroadcast();
        SwarmitRegistryV2 registry = new SwarmitRegistryV2();
        vm.stopBroadcast();

        console.log("SwarmitRegistryV2 deployed at:", address(registry));
    }
}
