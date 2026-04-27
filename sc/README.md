# Lument Smart Contracts

[![CI](https://github.com/AncungAulia/lument-blitz/actions/workflows/test.yml/badge.svg)](https://github.com/AncungAulia/lument-blitz/actions/workflows/test.yml)

> **"Trust your eyes, outplay the odds."**

Smart contracts untuk **Lument** — game Web3 skill-based color matching wagering di **Base Sepolia**. Pemain bertaruh MockUSDC untuk mencocokkan warna secara visual dengan akurasi setinggi mungkin.

Network default untuk deployment adalah Base Sepolia:

| Field | Value |
|---|---|
| Chain ID | `84532` |
| RPC URL | `https://sepolia.base.org` |
| Explorer | `https://sepolia-explorer.base.org` |

---

## Architecture

```
                      ┌──────────────────────────┐
                      │      LumentGame.sol      │
                      │                          │
 ┌──────────────┐     │  • depositStake()        │
 │  MockUSDC    │────▶│  • resolveRound()  ◄──── ECDSA Sig
 │  (ERC-20)    │     │  • withdraw()            │
 │              │     │  • refundStake()         │
 │  • Faucet    │     │  • seedSoloReserve()     │
 │  • 6 decimal │     │  • emergencyDrain()      │
 │  • 24h CD    │     │                          │
 └──────────────┘     │  Guards:                 │
                      │  ├ ReentrancyGuard       │
                      │  ├ Ownable               │
                      │  ├ Pausable (custom)     │
                      │  └ SafeERC20             │
                      └──────────────────────────┘
```

### Contracts

| Contract | Description |
|---|---|
| **`LumentGame.sol`** | Core game contract — stake locking, ECDSA-verified round resolution, pull-pattern withdrawals, solo reserve pool, dan emergency pause. |
| **`MockUSDC.sol`** | Custom ERC-20 test token dengan faucet (100 mUSDC per 24 jam). 6 decimals. |

---

## Game Modes & Stakes

| Mode | Default Stake | Max Players | Payout Split |
|---|---|---|---|
| **Solo** | 5 mUSDC | 1 | From Solo Reserve Pool (tier-based) |
| **Duel** (1v1) | 10 mUSDC | 2 | 80% winner · 10% dev · 10% reserve |
| **Battle Royale** | 10 mUSDC | 5 | 80% winner · 10% dev · 10% reserve |

### Solo Mode Tiers

| Tier | Description |
|---|---|
| `LOSE` | No payout — stake goes to reserve |
| `BEP` | Break even |
| `GOOD` | Moderate payout from reserve |
| `GREAT` | High payout from reserve |
| `JACKPOT` | Maximum payout (2x) from reserve |

---

## Project Structure

```
sc/
├── src/
│   ├── LumentGame.sol       # Core game contract
│   └── MockUSDC.sol          # Test ERC-20 token
├── test/
│   ├── LumentGame.t.sol     # 31 comprehensive tests
│   └── MockUSDC.t.sol        # Token-specific tests
├── script/
│   └── Deploy.s.sol          # Deployment script
├── abi/
│   ├── LumentGame.json      # ABI for frontend integration
│   └── MockUSDC.json         # ABI for frontend integration
├── foundry.toml              # Foundry config (Solidity 0.8.24, optimizer)
└── .github/workflows/
    └── test.yml              # CI pipeline
```

---

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Git

### Install

```bash
git clone https://github.com/AncungAulia/lument-blitz.git
cd lument-blitz/sc
forge install
```

### Build

```bash
forge build
```

### Test

```bash
forge test -vvv
```

### Format Check

```bash
forge fmt --check
```

### Deploy

```bash
cp .env.example .env
# Edit .env with your values
source .env
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
```

The deploy script will:
1. Deploy `MockUSDC`
2. Deploy `LumentGame` with configured signer, treasury, and backend
3. Optionally seed the Solo Reserve Pool (if `INITIAL_RESERVE` is set)

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PRIVATE_KEY` | Deployer wallet private key | ✅ |
| `SIGNER_ADDRESS` | ECDSA signer address for score verification | ✅ |
| `DEV_TREASURY` | Address to receive dev rake (10%) | ✅ |
| `BACKEND_SIGNER` | Backend EOA for `resolveRound()` and `refundStake()` | ✅ |
| `RPC_URL` | Base Sepolia RPC URL | ✅ |
| `INITIAL_RESERVE` | Initial Solo Reserve Pool seed amount (in token units) | ❌ |

---

## Security Features

| Feature | Description |
|---|---|
| **ECDSA Signature Verification** | All round results are signed off-chain and verified on-chain |
| **Deadline Expiry** | Signatures expire to prevent stale replays |
| **Payout Validation** | On-chain check: total payout ≤ total staked per round |
| **Backend-Only Access** | `resolveRound()` and `refundStake()` restricted to backend signer |
| **ReentrancyGuard** | All state-changing functions protected against reentrancy |
| **Pull Pattern Withdrawals** | Anti-DoS; players claim via `withdraw()` |
| **Emergency Pause** | Owner can pause deposits/resolves; `withdraw()` always available |
| **Max Players Cap** | 5 players per round to prevent DoS via unbounded loops |
| **Zero-Address Guards** | All setters and constructor validate non-zero addresses |
| **SafeERC20** | Safe token transfer wrappers for ERC-20 interactions |
| **Fee-on-Transfer Protection** | Rejects tokens with transfer fees to prevent accounting drift |
| **Winner Validation** | Winners must be unique, non-zero, actual round participants |

---

## Test Coverage

**34 tests** — all passing ✅

| Suite | Tests | Description |
|---|---|---|
| `LumentGameTest` | 31 | Full game lifecycle, security, edge cases, admin |
| `MockUSDCTest` | 3 | Faucet, cooldown, owner mint |

### Test Categories

- **Full Lifecycle** — Duel flow, Solo Jackpot/Lose, Battle Royale (5 players)
- **Security Guards** — Invalid signature, deadline expiry, access control, payout limits, pause
- **Edge Cases** — Double resolve, deposit to resolved/refunded round, round full, no winners, fee-on-transfer rejection
- **Winner Validation** — Non-player winner, zero-address winner, duplicate winners
- **Admin Functions** — Treasury migration, reserve seed/drain, zero-address guards, incorrect stake amount

```bash
# Run with verbose output
forge test -vvv

# Run specific test
forge test --mt testDuelFlow -vvv

# Run with gas report
forge test --gas-report
```

---

## Toolchain

| Tool | Version |
|---|---|
| Solidity | `0.8.24` |
| Foundry | Latest |
| OpenZeppelin | `v5.x` (via git submodule) |
| Optimizer | Enabled (200 runs, via IR) |

---

## License

MIT
