// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SwarmitRegistry} from "../src/SwarmitRegistry.sol";

contract DeployScript is Script {
    function run() public {
        vm.startBroadcast();
        SwarmitRegistry registry = new SwarmitRegistry();
        vm.stopBroadcast();

        console.log("SwarmitRegistry deployed at:", address(registry));
    }
}
