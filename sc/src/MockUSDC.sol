// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 1e6;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaim;

    event FaucetClaimed(address indexed user, uint256 amount, uint256 timestamp);

    error FaucetCooldownActive(uint256 nextClaimAt);

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mintFaucet() external {
        uint256 next = lastClaim[msg.sender] + FAUCET_COOLDOWN;
        if (lastClaim[msg.sender] != 0 && block.timestamp < next) {
            revert FaucetCooldownActive(next);
        }
        lastClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    function nextClaimAt(address user) external view returns (uint256) {
        if (lastClaim[user] == 0) return 0;
        return lastClaim[user] + FAUCET_COOLDOWN;
    }

    function ownerMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
