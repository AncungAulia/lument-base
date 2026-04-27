// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {LumentGame} from "../src/LumentGame.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract FeeOnTransferUSDC is MockUSDC {
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 1) {
            super._update(from, address(0), 1);
            super._update(from, to, value - 1);
        } else {
            super._update(from, to, value);
        }
    }
}

contract LumentGameTest is Test {
    using MessageHashUtils for bytes32;

    MockUSDC usdc;
    LumentGame game;

    uint256 signerPk = 0xA11CE;
    address signerAddr;
    address devTreasury = address(0xD5E);
    address backend = address(0xB4CE);
    address alice = address(0xA1);
    address bob = address(0xB0);

    function setUp() public {
        signerAddr = vm.addr(signerPk);
        usdc = new MockUSDC();
        game = new LumentGame(address(usdc), signerAddr, devTreasury, backend);

        usdc.ownerMint(alice, 1_000 * 1e6);
        usdc.ownerMint(bob, 1_000 * 1e6);

        vm.prank(alice);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(game), type(uint256).max);
    }

    function _sign(
        bytes32 roundId,
        address[] memory winners,
        uint256[] memory rewards,
        LumentGame.Tier[] memory tiers,
        uint256[] memory scores,
        uint256 devRake,
        uint256 soloRake,
        bool drain,
        uint256 deadline
    ) internal view returns (bytes memory) {
        bytes32 hash = keccak256(
            abi.encode(
                roundId,
                winners,
                rewards,
                tiers,
                scores,
                devRake,
                soloRake,
                drain,
                deadline,
                address(game),
                block.chainid
            )
        );
        bytes32 ethHash = hash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function testDuelFlow() public {
        bytes32 roundId = keccak256("duel-1");

        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
        vm.prank(bob);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 16 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.JACKPOT;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9800;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline);

        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline, sig);

        assertEq(game.balances(alice), 16 * 1e6);
        assertEq(game.soloReserveBalance(), 2 * 1e6);
        assertEq(game.balances(devTreasury), 2 * 1e6);

        vm.prank(alice);
        game.withdraw();
        assertEq(usdc.balanceOf(alice), 1_000 * 1e6 - 10 * 1e6 + 16 * 1e6);
    }

    function testInvalidSignatureReverts() public {
        bytes32 roundId = keccak256("duel-2");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 10 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.BEP;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 8500;

        uint256 deadline = block.timestamp + 1 hours;
        bytes32 hash = keccak256(
            abi.encode(
                roundId,
                winners,
                rewards,
                tiers,
                scores,
                uint256(0),
                uint256(0),
                false,
                deadline,
                address(game),
                block.chainid
            )
        );
        bytes32 ethHash = hash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(backend);
        vm.expectRevert(LumentGame.InvalidSignature.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 0, 0, false, deadline, badSig);
    }

    function testRefund() public {
        bytes32 roundId = keccak256("royale-1");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.ROYALE, 10 * 1e6);
        vm.prank(bob);
        game.depositStake(roundId, LumentGame.Mode.ROYALE, 10 * 1e6);

        vm.prank(backend);
        game.refundStake(roundId);

        assertEq(game.balances(alice), 10 * 1e6);
        assertEq(game.balances(bob), 10 * 1e6);
    }

    function testPauseBlocksDeposit() public {
        game.setPaused(true);
        bytes32 roundId = keccak256("paused");
        vm.prank(alice);
        vm.expectRevert(LumentGame.GamePaused.selector);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
    }

    function testWithdrawWorksWhenPaused() public {
        bytes32 roundId = keccak256("r1");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
        vm.prank(backend);
        game.refundStake(roundId);

        game.setPaused(true);
        vm.prank(alice);
        game.withdraw();
        assertEq(usdc.balanceOf(alice), 1_000 * 1e6);
    }

    function testDoubleResolveReverts() public {
        bytes32 roundId = keccak256("dup");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);
        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);

        vm.prank(backend);
        vm.expectRevert(LumentGame.RoundAlreadyResolved.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);
    }

    function testRoundFullReverts() public {
        bytes32 roundId = keccak256("full-round");

        // Fill up to MAX_PLAYERS_PER_ROUND (5)
        for (uint256 i = 1; i <= 5; i++) {
            address player = address(uint160(0xF000 + i));
            usdc.ownerMint(player, 100 * 1e6);
            vm.prank(player);
            usdc.approve(address(game), type(uint256).max);
            vm.prank(player);
            game.depositStake(roundId, LumentGame.Mode.ROYALE, 10 * 1e6);
        }

        // 6th player should revert
        address extraPlayer = address(uint160(0xF0FF));
        usdc.ownerMint(extraPlayer, 100 * 1e6);
        vm.prank(extraPlayer);
        usdc.approve(address(game), type(uint256).max);
        vm.prank(extraPlayer);
        vm.expectRevert(LumentGame.RoundFull.selector);
        game.depositStake(roundId, LumentGame.Mode.ROYALE, 10 * 1e6);
    }

    function testPayoutExceedsStakesReverts() public {
        bytes32 roundId = keccak256("overplay");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
        vm.prank(bob);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        // Total staked = 20 mUSDC, try to pay out 25 (exceeds)
        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 20 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.JACKPOT;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9900;

        uint256 deadline = block.timestamp + 1 hours;
        // devRake + soloRake = 5, total payout = 25 > 20 staked
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 3 * 1e6, 2 * 1e6, false, deadline);
        vm.prank(backend);
        vm.expectRevert(LumentGame.PayoutExceedsStakes.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 3 * 1e6, 2 * 1e6, false, deadline, sig);
    }

    function testSetSignerZeroAddressReverts() public {
        vm.expectRevert(LumentGame.ZeroAddress.selector);
        game.setSigner(address(0));
    }

    function testSetBackendSignerZeroAddressReverts() public {
        vm.expectRevert(LumentGame.ZeroAddress.selector);
        game.setBackendSigner(address(0));
    }

    function testSetDevTreasuryZeroAddressReverts() public {
        vm.expectRevert(LumentGame.ZeroAddress.selector);
        game.setDevTreasury(address(0));
    }

    function testDevTreasuryMigratesBalance() public {
        // First, accumulate some balance in devTreasury via a duel resolve
        bytes32 roundId = keccak256("migrate-test");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
        vm.prank(bob);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 16 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.JACKPOT;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9800;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline);
        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline, sig);

        // devTreasury should have 2 mUSDC balance
        assertEq(game.balances(devTreasury), 2 * 1e6);

        // Migrate to new treasury
        address newTreasury = address(0xABCD);
        game.setDevTreasury(newTreasury);

        // Old treasury balance should be 0, new treasury should have 2 mUSDC
        assertEq(game.balances(devTreasury), 0);
        assertEq(game.balances(newTreasury), 2 * 1e6);
        assertEq(game.devTreasury(), newTreasury);
    }

    function testSeedSoloReserveOnlyOwner() public {
        usdc.ownerMint(alice, 100 * 1e6);
        vm.prank(alice);
        usdc.approve(address(game), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert();
        game.seedSoloReserve(50 * 1e6);
    }

    function testEmergencyDrainReserve() public {
        // Seed reserve first
        usdc.ownerMint(address(this), 50 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(50 * 1e6);
        assertEq(game.soloReserveBalance(), 50 * 1e6);

        // Drain to owner
        address recipient = address(0xCAFE);
        game.emergencyDrainReserve(recipient);
        assertEq(game.soloReserveBalance(), 0);
        assertEq(usdc.balanceOf(recipient), 50 * 1e6);
    }

    function testEmergencyDrainReserveZeroAddressReverts() public {
        usdc.ownerMint(address(this), 50 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(50 * 1e6);

        vm.expectRevert(LumentGame.ZeroAddress.selector);
        game.emergencyDrainReserve(address(0));
    }

    function testEmergencyDrainEmptyReserveReverts() public {
        vm.expectRevert(LumentGame.ZeroAmount.selector);
        game.emergencyDrainReserve(address(0xCAFE));
    }

    // ==========================================
    // Solo Mode Tests
    // ==========================================

    function testSoloModeJackpotWin() public {
        // Seed the reserve pool first
        usdc.ownerMint(address(this), 100 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(100 * 1e6);

        bytes32 roundId = keccak256("solo-1");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.SOLO, 5 * 1e6);

        // Alice scores Jackpot — gets 10 mUSDC from reserve
        // Her 5 mUSDC stake goes to reserve via soloRake
        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 10 * 1e6; // Jackpot = 2x
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.JACKPOT;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9900;

        uint256 deadline = block.timestamp + 1 hours;
        // drainSoloReserve = true, soloRake = 5 (player stake recycled to reserve)
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline);

        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline, sig);

        // Reserve: 100 - 10 (payout) + 5 (player stake) = 95
        assertEq(game.soloReserveBalance(), 95 * 1e6);
        assertEq(game.balances(alice), 10 * 1e6);

        // Alice withdraws
        vm.prank(alice);
        game.withdraw();
        assertEq(usdc.balanceOf(alice), 1_000 * 1e6 - 5 * 1e6 + 10 * 1e6);
    }

    function testSoloModeLose() public {
        // Seed reserve
        usdc.ownerMint(address(this), 50 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(50 * 1e6);

        bytes32 roundId = keccak256("solo-lose");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.SOLO, 5 * 1e6);

        // Alice loses — 0 reward, her 5 stake goes to reserve
        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 0;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.LOSE;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 5000;

        uint256 deadline = block.timestamp + 1 hours;
        // drain = true but totalRewards = 0, soloRake = 5 (lost stake into reserve)
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline);

        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline, sig);

        // Reserve: 50 - 0 (no payout) + 5 (lost stake) = 55
        assertEq(game.soloReserveBalance(), 55 * 1e6);
        assertEq(game.balances(alice), 0);
    }

    function testSoloModeRejectsRakeExceedingStake() public {
        usdc.ownerMint(address(this), 100 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(100 * 1e6);

        bytes32 roundId = keccak256("solo-over-rake");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.SOLO, 5 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 1 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9000;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 0, 10 * 1e6, true, deadline);

        vm.prank(backend);
        vm.expectRevert(LumentGame.PayoutExceedsStakes.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 0, 10 * 1e6, true, deadline, sig);
    }

    // ==========================================
    // Battle Royale Test (5 players)
    // ==========================================

    function testBattleRoyaleFlow() public {
        bytes32 roundId = keccak256("royale-full");

        // Create 5 players
        address[5] memory players;
        for (uint256 i = 0; i < 5; i++) {
            players[i] = address(uint160(0xBB00 + i));
            usdc.ownerMint(players[i], 100 * 1e6);
            vm.prank(players[i]);
            usdc.approve(address(game), type(uint256).max);
            vm.prank(players[i]);
            game.depositStake(roundId, LumentGame.Mode.ROYALE, 10 * 1e6);
        }

        // Total pool = 5 * 10 = 50 mUSDC
        // Winner gets 80% = 40, dev = 10% = 5, reserve = 10% = 5
        address[] memory winners = new address[](1);
        winners[0] = players[0];
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 40 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.JACKPOT;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9950;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 5 * 1e6, 5 * 1e6, false, deadline);

        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 5 * 1e6, 5 * 1e6, false, deadline, sig);

        assertEq(game.balances(players[0]), 40 * 1e6);
        assertEq(game.balances(devTreasury), 5 * 1e6);
        assertEq(game.soloReserveBalance(), 5 * 1e6);

        // Winner withdraws
        vm.prank(players[0]);
        game.withdraw();
        assertEq(usdc.balanceOf(players[0]), 100 * 1e6 - 10 * 1e6 + 40 * 1e6);
    }

    // ==========================================
    // Deposit Guard Tests
    // ==========================================

    function testDepositToResolvedRoundReverts() public {
        bytes32 roundId = keccak256("resolved-deposit");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        // Resolve the round
        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);
        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);

        // Bob tries to deposit to the already resolved round
        vm.prank(bob);
        vm.expectRevert(LumentGame.RoundAlreadyResolved.selector);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
    }

    function testDepositToRefundedRoundReverts() public {
        bytes32 roundId = keccak256("refunded-deposit");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        // Refund the round
        vm.prank(backend);
        game.refundStake(roundId);

        // Bob tries to deposit to the already refunded round
        vm.prank(bob);
        vm.expectRevert(LumentGame.RoundAlreadyRefunded.selector);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
    }

    // ==========================================
    // Deadline & Access Control Tests
    // ==========================================

    function testDeadlineExpiredReverts() public {
        // Set a known starting timestamp
        vm.warp(1000);

        bytes32 roundId = keccak256("expired");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = 2000; // Deadline at timestamp 2000
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);

        // Warp past deadline
        vm.warp(3000);

        vm.prank(backend);
        vm.expectRevert(LumentGame.DeadlineExpired.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);
    }

    function testNonBackendResolveReverts() public {
        bytes32 roundId = keccak256("no-access");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = alice;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);

        // Alice (non-backend) tries to resolve
        vm.prank(alice);
        vm.expectRevert(LumentGame.OnlyBackend.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);
    }

    function testNonBackendRefundReverts() public {
        bytes32 roundId = keccak256("no-refund-access");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        vm.prank(alice);
        vm.expectRevert(LumentGame.OnlyBackend.selector);
        game.refundStake(roundId);
    }

    // ==========================================
    // Edge Case Tests
    // ==========================================

    function testResolveWithNoWinners() public {
        // Solo mode where everyone loses — empty winners array
        usdc.ownerMint(address(this), 50 * 1e6);
        usdc.approve(address(game), type(uint256).max);
        game.seedSoloReserve(50 * 1e6);

        bytes32 roundId = keccak256("all-lose");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.SOLO, 5 * 1e6);

        // No winners, all stake goes to reserve
        address[] memory winners = new address[](0);
        uint256[] memory rewards = new uint256[](0);
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](0);
        uint256[] memory scores = new uint256[](0);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline);

        vm.prank(backend);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 0, 5 * 1e6, true, deadline, sig);

        // Reserve grows by 5 (player's lost stake)
        assertEq(game.soloReserveBalance(), 55 * 1e6);
        assertEq(game.balances(alice), 0);
        assertTrue(game.roundResolved(roundId));
    }

    function testResolveRejectsNonPlayerWinner() public {
        bytes32 roundId = keccak256("non-player-winner");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = bob;
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);

        vm.prank(backend);
        vm.expectRevert(LumentGame.InvalidWinner.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);
    }

    function testResolveRejectsZeroAddressWinner() public {
        bytes32 roundId = keccak256("zero-winner");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](1);
        winners[0] = address(0);
        uint256[] memory rewards = new uint256[](1);
        rewards[0] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](1);
        tiers[0] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](1);
        scores[0] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline);

        vm.prank(backend);
        vm.expectRevert(LumentGame.InvalidWinner.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 1 * 1e6, 1 * 1e6, false, deadline, sig);
    }

    function testResolveRejectsDuplicateWinners() public {
        bytes32 roundId = keccak256("duplicate-winners");
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);
        vm.prank(bob);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        address[] memory winners = new address[](2);
        winners[0] = alice;
        winners[1] = alice;
        uint256[] memory rewards = new uint256[](2);
        rewards[0] = 8 * 1e6;
        rewards[1] = 8 * 1e6;
        LumentGame.Tier[] memory tiers = new LumentGame.Tier[](2);
        tiers[0] = LumentGame.Tier.GOOD;
        tiers[1] = LumentGame.Tier.GOOD;
        uint256[] memory scores = new uint256[](2);
        scores[0] = 9200;
        scores[1] = 9200;

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline);

        vm.prank(backend);
        vm.expectRevert(LumentGame.InvalidWinner.selector);
        game.resolveRound(roundId, winners, rewards, tiers, scores, 2 * 1e6, 2 * 1e6, false, deadline, sig);
    }

    function testDepositRejectsFeeOnTransferToken() public {
        FeeOnTransferUSDC feeToken = new FeeOnTransferUSDC();
        LumentGame feeGame = new LumentGame(address(feeToken), signerAddr, devTreasury, backend);

        feeToken.ownerMint(alice, 100 * 1e6);
        vm.prank(alice);
        feeToken.approve(address(feeGame), type(uint256).max);

        vm.prank(alice);
        vm.expectRevert(LumentGame.TokenTransferMismatch.selector);
        feeGame.depositStake(keccak256("fee-token"), LumentGame.Mode.DUEL, 10 * 1e6);
    }

    function testIncorrectStakeAmountReverts() public {
        bytes32 roundId = keccak256("test_incorrect_stake");

        // P1 deposits 10 USDC
        vm.prank(alice);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 10 * 1e6);

        // P2 tries to deposit 5 USDC
        vm.prank(bob);
        vm.expectRevert(LumentGame.IncorrectStakeAmount.selector);
        game.depositStake(roundId, LumentGame.Mode.DUEL, 5 * 1e6);
    }
}
