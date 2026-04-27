// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC usdc;
    address alice = address(0xA11CE);

    function setUp() public {
        usdc = new MockUSDC();
    }

    function testFaucetMints100() public {
        vm.prank(alice);
        usdc.mintFaucet();
        assertEq(usdc.balanceOf(alice), 100 * 1e6);
    }

    function testFaucetCooldown() public {
        vm.prank(alice);
        usdc.mintFaucet();

        vm.prank(alice);
        vm.expectRevert();
        usdc.mintFaucet();

        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(alice);
        usdc.mintFaucet();
        assertEq(usdc.balanceOf(alice), 200 * 1e6);
    }

    function testDecimals() public view {
        assertEq(usdc.decimals(), 6);
    }
}
