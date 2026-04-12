// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SwarmitRegistryV3} from "../src/SwarmitRegistryV3.sol";

contract DeployV3Script is Script {
    function run() public {
        vm.startBroadcast();
        SwarmitRegistryV3 registry = new SwarmitRegistryV3();
        vm.stopBroadcast();

        console.log("SwarmitRegistryV3 deployed at:", address(registry));
    }
}
