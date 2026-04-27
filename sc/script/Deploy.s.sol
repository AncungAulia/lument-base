// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {LumentGame} from "../src/LumentGame.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address signerAddr = vm.envAddress("SIGNER_ADDRESS");
        address devTreasury = vm.envAddress("DEV_TREASURY");
        address backendSigner = vm.envAddress("BACKEND_SIGNER");

        // Optional: initial reserve seed amount (default 0 if not set)
        uint256 initialReserve = vm.envOr("INITIAL_RESERVE", uint256(0));

        address deployer = vm.addr(pk);

        console2.log("=== Lument Deployment ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Signer:", signerAddr);
        console2.log("DevTreasury:", devTreasury);
        console2.log("BackendSigner:", backendSigner);

        vm.startBroadcast(pk);

        MockUSDC usdc = new MockUSDC();
        LumentGame game = new LumentGame(address(usdc), signerAddr, devTreasury, backendSigner);

        // Seed solo reserve if INITIAL_RESERVE is set
        if (initialReserve > 0) {
            usdc.ownerMint(deployer, initialReserve);
            usdc.approve(address(game), initialReserve);
            game.seedSoloReserve(initialReserve);
            console2.log("Solo Reserve seeded:", initialReserve);
        }

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployed Contracts ===");
        console2.log("MockUSDC:", address(usdc));
        console2.log("LumentGame:", address(game));
        console2.log("");
        console2.log("=== Post-Deploy Checklist ===");
        console2.log("1. Verify contracts on explorer");
        console2.log("2. Set INITIAL_RESERVE env var and re-run if Solo Reserve not seeded");
        console2.log("3. Update frontend .env with contract addresses");
    }
}
