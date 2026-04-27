// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LumentGame
/// @notice Core game contract for Lument — a skill-based color matching wagering game on Base Sepolia.
/// @dev Manages stake locking, ECDSA-verified round resolution, pull-pattern withdrawals,
///      solo reserve pool, and emergency controls. All scoring is done off-chain;
///      this contract only handles financial integrity.
contract LumentGame is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MessageHashUtils for bytes32;

    enum Mode {
        SOLO,
        DUEL,
        ROYALE
    }
    enum Tier {
        LOSE,
        BEP,
        GOOD,
        GREAT,
        JACKPOT
    }

    /// @notice The ERC-20 token used for staking (MockUSDC)
    IERC20 public immutable token;

    /// @notice ECDSA signer address — used to verify round result signatures
    address public signer;

    /// @notice Address that receives dev rake (10% of Duel/Royale pools)
    address public devTreasury;

    /// @notice Backend EOA authorized to call resolveRound() and refundStake()
    address public backendSigner;

    /// @notice When true, depositStake and resolveRound are blocked. withdraw() remains available.
    bool public paused;

    /// @notice Current balance of the Solo Reserve Pool (funds Solo mode payouts)
    uint256 public soloReserveBalance;

    /// @notice Cumulative total of dev rake ever allocated (only increases, not withdrawable balance)
    /// @dev Actual withdrawable dev balance is in balances[devTreasury]
    uint256 public totalDevRakeAccumulated;

    uint256 public constant MAX_PLAYERS_PER_ROUND = 5;

    /// @notice Minimum allowed stake (1 mUSDC)
    uint256 public constant MIN_STAKE = 1 * 1e6;

    /// @notice Claimable balances per address (pull-pattern). Use withdraw() to claim.
    mapping(address => uint256) public balances;

    /// @notice Stakes locked per round per player
    mapping(bytes32 => mapping(address => uint256)) public stakes;

    /// @notice Stake requested per round (set by the first depositor)
    mapping(bytes32 => uint256) public roundStakes;

    /// @notice List of players who deposited into each round
    mapping(bytes32 => address[]) public roundPlayers;

    /// @notice Whether a round has been resolved
    mapping(bytes32 => bool) public roundResolved;

    /// @notice Whether a round has been refunded
    mapping(bytes32 => bool) public roundRefunded;

    event StakeDeposited(bytes32 indexed roundId, address indexed player, uint256 amount, Mode mode);
    event RoundResolved(bytes32 indexed roundId, address indexed winner, uint256 score, Tier tier, uint256 reward);
    event Withdrawn(address indexed user, uint256 amount);
    event Refunded(bytes32 indexed roundId, address indexed player, uint256 amount);
    event SignerUpdated(address indexed newSigner);
    event BackendSignerUpdated(address indexed newBackendSigner);
    event DevTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury, uint256 migratedBalance);
    event PauseToggled(bool paused);
    event SoloReserveFunded(uint256 amount);
    event SoloReserveDrained(address indexed to, uint256 amount);
    event DevTreasuryFunded(uint256 amount);

    error GamePaused();
    error InvalidSignature();
    error RoundAlreadyResolved();
    error RoundAlreadyRefunded();
    error ArrayLengthMismatch();
    error AlreadyStaked();
    error ZeroAmount();
    error OnlyBackend();
    error InsufficientReserve();
    error NothingToWithdraw();
    error DeadlineExpired();
    error PayoutExceedsStakes();
    error RoundFull();
    error ZeroAddress();
    error StakeTooLow();
    error IncorrectStakeAmount();
    error InvalidWinner();
    error TokenTransferMismatch();

    modifier notPaused() {
        if (paused) revert GamePaused();
        _;
    }

    modifier onlyBackend() {
        if (msg.sender != backendSigner) revert OnlyBackend();
        _;
    }

    /// @notice Deploy the LumentGame contract
    /// @param _token Address of the ERC-20 token (MockUSDC)
    /// @param _signer ECDSA signer address for score verification
    /// @param _devTreasury Address to receive dev rake
    /// @param _backendSigner Backend EOA for resolveRound/refundStake calls
    constructor(address _token, address _signer, address _devTreasury, address _backendSigner) Ownable(msg.sender) {
        if (_token == address(0) || _signer == address(0) || _devTreasury == address(0) || _backendSigner == address(0))
        {
            revert ZeroAddress();
        }
        token = IERC20(_token);
        signer = _signer;
        devTreasury = _devTreasury;
        backendSigner = _backendSigner;
    }

    /// @notice Lock a stake for a game round. Amount can be dynamic.
    /// @dev Reverts if round is already resolved/refunded, player already staked, or round is full.
    ///      Player must have approved this contract for the stake amount beforehand.
    /// @param roundId Unique identifier for the game round (generated by backend)
    /// @param mode Game mode: SOLO, DUEL, or ROYALE
    /// @param amount Amount of tokens to stake for this round
    function depositStake(bytes32 roundId, Mode mode, uint256 amount) external notPaused nonReentrant {
        if (roundResolved[roundId]) revert RoundAlreadyResolved();
        if (roundRefunded[roundId]) revert RoundAlreadyRefunded();
        if (stakes[roundId][msg.sender] != 0) revert AlreadyStaked();
        if (roundPlayers[roundId].length >= MAX_PLAYERS_PER_ROUND) revert RoundFull();
        if (amount < MIN_STAKE) revert StakeTooLow();

        uint256 expectedStake = roundStakes[roundId];
        if (expectedStake == 0) {
            // First player sets the stake amount for this round
            roundStakes[roundId] = amount;
        } else if (expectedStake != amount) {
            // Ensure subsequent players match the exact stake required
            revert IncorrectStakeAmount();
        }

        stakes[roundId][msg.sender] = amount;
        roundPlayers[roundId].push(msg.sender);

        _pullExactTokens(msg.sender, amount);
        emit StakeDeposited(roundId, msg.sender, amount, mode);
    }

    /// @notice Resolve a round with deadline, payout validation, and backend-only access.
    /// @dev Signature covers keccak256(abi.encode(roundId, winners, rewards, tiers, scores,
    ///      devRake, soloRake, drainSoloReserve, deadline, address(this), block.chainid)).
    ///      For Solo mode (drainSoloReserve=true): rewards are paid from soloReserveBalance.
    ///      The player's original stake should be recycled via soloRake parameter.
    ///      For Duel/Royale (drainSoloReserve=false): total payout validated against total staked.
    /// @param roundId Unique round identifier
    /// @param winners Array of winner addresses
    /// @param rewards Array of reward amounts (parallel to winners)
    /// @param tiers Array of performance tiers (parallel to winners)
    /// @param scores Array of accuracy scores (parallel to winners)
    /// @param devRake Amount allocated to dev treasury
    /// @param soloRake Amount added to solo reserve pool (e.g., losing player's stake in Solo mode)
    /// @param drainSoloReserve If true, rewards are drawn from the solo reserve (Solo mode)
    /// @param deadline Timestamp after which this signature is invalid
    /// @param sig ECDSA signature from the authorized signer
    function resolveRound(
        bytes32 roundId,
        address[] calldata winners,
        uint256[] calldata rewards,
        Tier[] calldata tiers,
        uint256[] calldata scores,
        uint256 devRake,
        uint256 soloRake,
        bool drainSoloReserve,
        uint256 deadline,
        bytes calldata sig
    ) external notPaused nonReentrant onlyBackend {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (roundResolved[roundId]) revert RoundAlreadyResolved();
        if (roundRefunded[roundId]) revert RoundAlreadyRefunded();
        if (winners.length != rewards.length || winners.length != tiers.length || winners.length != scores.length) {
            revert ArrayLengthMismatch();
        }

        bytes32 hash = keccak256(
            abi.encode(
                roundId,
                winners,
                rewards,
                tiers,
                scores,
                devRake,
                soloRake,
                drainSoloReserve,
                deadline,
                address(this),
                block.chainid
            )
        );
        _verify(hash, sig);

        roundResolved[roundId] = true;

        // --- Payout validation ---
        uint256 totalRewards;
        for (uint256 i = 0; i < rewards.length;) {
            totalRewards += rewards[i];
            unchecked {
                ++i;
            }
        }

        uint256 totalStaked;
        address[] memory players = roundPlayers[roundId];
        for (uint256 i = 0; i < players.length;) {
            totalStaked += stakes[roundId][players[i]];
            unchecked {
                ++i;
            }
        }
        _validateWinners(winners, players);

        if (drainSoloReserve) {
            // Solo mode: rewards come from the solo reserve pool
            if (totalRewards > soloReserveBalance) revert InsufficientReserve();
            if (devRake + soloRake > totalStaked) revert PayoutExceedsStakes();
            soloReserveBalance -= totalRewards;
        } else {
            // Duel/Royale: total payout must not exceed total staked in this round
            if (totalRewards + devRake + soloRake > totalStaked) revert PayoutExceedsStakes();
        }

        for (uint256 i = 0; i < winners.length;) {
            if (rewards[i] > 0) {
                balances[winners[i]] += rewards[i];
            }
            emit RoundResolved(roundId, winners[i], scores[i], tiers[i], rewards[i]);
            unchecked {
                ++i;
            }
        }

        if (devRake > 0) {
            totalDevRakeAccumulated += devRake;
            balances[devTreasury] += devRake;
            emit DevTreasuryFunded(devRake);
        }
        if (soloRake > 0) {
            soloReserveBalance += soloRake;
            emit SoloReserveFunded(soloRake);
        }
    }

    /// @notice Withdraw all claimable balance to msg.sender. Pull-pattern for anti-DoS safety.
    /// @dev Available even when contract is paused (emergency withdrawal).
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        balances[msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Refund all stakes in a round (e.g., lobby timeout). Backend-only.
    /// @dev Refunded amounts go to balances[] (pull-pattern), not direct transfer.
    ///      Players must call withdraw() separately to claim.
    /// @param roundId The round to refund
    function refundStake(bytes32 roundId) external onlyBackend nonReentrant {
        if (roundResolved[roundId]) revert RoundAlreadyResolved();
        if (roundRefunded[roundId]) revert RoundAlreadyRefunded();
        roundRefunded[roundId] = true;

        address[] memory players = roundPlayers[roundId];
        for (uint256 i = 0; i < players.length;) {
            address p = players[i];
            uint256 amount = stakes[roundId][p];
            if (amount > 0) {
                stakes[roundId][p] = 0;
                balances[p] += amount;
                emit Refunded(roundId, p, amount);
            }
            unchecked {
                ++i;
            }
        }
    }

    /// @dev Verify an ECDSA signature against the authorized signer
    function _verify(bytes32 hash, bytes calldata sig) internal view {
        bytes32 ethHash = hash.toEthSignedMessageHash();
        address recovered = ECDSA.recover(ethHash, sig);
        if (recovered != signer) revert InvalidSignature();
    }

    /// @dev Only accept exact inbound transfers so accounting cannot drift for fee-on-transfer tokens.
    function _pullExactTokens(address from, uint256 amount) internal {
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) != balanceBefore + amount) revert TokenTransferMismatch();
    }

    /// @dev Winners must be unique round participants and never the zero address.
    function _validateWinners(address[] calldata winners, address[] memory players) internal pure {
        if (winners.length > players.length) revert InvalidWinner();

        for (uint256 i = 0; i < winners.length;) {
            address winner = winners[i];
            if (winner == address(0)) revert InvalidWinner();

            bool isPlayer;
            for (uint256 j = 0; j < players.length;) {
                if (winner == players[j]) {
                    isPlayer = true;
                    break;
                }
                unchecked {
                    ++j;
                }
            }
            if (!isPlayer) revert InvalidWinner();

            for (uint256 j = 0; j < i;) {
                if (winner == winners[j]) revert InvalidWinner();
                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    // ==========================================
    // Admin Functions
    // ==========================================

    /// @notice Update the ECDSA signer address used for score verification
    /// @param _signer New signer address (must not be zero)
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    /// @notice Update the backend signer EOA for resolveRound/refundStake
    /// @param _backendSigner New backend signer address (must not be zero)
    function setBackendSigner(address _backendSigner) external onlyOwner {
        if (_backendSigner == address(0)) revert ZeroAddress();
        backendSigner = _backendSigner;
        emit BackendSignerUpdated(_backendSigner);
    }

    /// @notice Update the dev treasury address. Migrates any accumulated balance to the new address.
    /// @param _newTreasury New treasury address (must not be zero)
    function setDevTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        uint256 oldBal = balances[devTreasury];
        if (oldBal > 0) {
            balances[devTreasury] = 0;
            balances[_newTreasury] += oldBal;
        }
        emit DevTreasuryUpdated(devTreasury, _newTreasury, oldBal);
        devTreasury = _newTreasury;
    }

    /// @notice Toggle the emergency pause state
    /// @param _paused True to pause, false to unpause
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseToggled(_paused);
    }

    /// @notice Seed the Solo Reserve Pool with tokens. Owner must have approved this contract.
    /// @dev Required before Solo mode can pay out winners. Call after initial deployment.
    /// @param amount Amount of tokens to seed into the reserve
    function seedSoloReserve(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        soloReserveBalance += amount;
        _pullExactTokens(msg.sender, amount);
        emit SoloReserveFunded(amount);
    }

    /// @notice Emergency drain of solo reserve for contract migration. Only callable by owner.
    /// @param to Recipient address for the drained funds (must not be zero)
    function emergencyDrainReserve(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 amount = soloReserveBalance;
        if (amount == 0) revert ZeroAmount();
        soloReserveBalance = 0;
        token.safeTransfer(to, amount);
        emit SoloReserveDrained(to, amount);
    }

    // ==========================================
    // View Functions
    // ==========================================

    /// @notice Get the list of players who deposited into a round
    /// @param roundId The round to query
    /// @return Array of player addresses
    function getRoundPlayers(bytes32 roundId) external view returns (address[] memory) {
        return roundPlayers[roundId];
    }
}
