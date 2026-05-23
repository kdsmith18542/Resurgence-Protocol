# Resurgence Protocol — Audit Scope & Submission Package

> For professional security auditors. This document defines the scope, architecture, known issues, and testing status for the Resurgence Protocol pre-launch audit.

## 1. Protocol Summary

**Resurgence Protocol** is a Proof-of-Dormancy staking system that allows holders of abandoned ("dead") ERC-20 tokens to stake them and earn RESURGE, a governance and rewards token. A treasury fee (default 10%, max 30%) is applied at claim time for all rewards earned on dead coin staking pools and distributed to a DAO-controlled treasury.

- **Primary chain**: Arbitrum One (chain ID 42161) — hub chain
- **Spoke chains**: Polygon, BSC, Base, Ethereum, Optimism, Avalanche (Phase 10)
- **Solidity version**: `^0.8.20`
- **OpenZeppelin version**: `5.x` (contracts-upgradeable 5.6.x)
- **Proxy pattern**: UUPS (ERC-1967)

## 2. In-Scope Contracts

| Contract | File | Lines | Proxy? | Priority |
|---|---|---|---|---|
| `ResurgeToken` | `contracts/ResurgeToken.sol` | ~150 | UUPS | High |
| `DeadCoinStakingPool` | `contracts/DeadCoinStakingPool.sol` | ~300 | UUPS | **Critical** |
| `ResurgeStakingPool` | `contracts/ResurgeStakingPool.sol` | ~350 | UUPS | **Critical** |
| `StakingPoolManager` | `contracts/StakingPoolManager.sol` | ~350 | UUPS | High |
| `RewardDistributor` | `contracts/RewardDistributor.sol` | ~250 | UUPS | **Critical** |
| `ResurgenceGovernance` | `contracts/ResurgenceGovernance.sol` | ~200 | None | High |
| `ResurgenceTimelockController` | `contracts/ResurgenceTimelockController.sol` | ~80 | None | High |
| `MockOracle` | `contracts/MockOracle.sol` | ~50 | None | Low (testnet only) |
| `ReentrancyGuardUpgradeable` (local shim) | `contracts/utils/ReentrancyGuardUpgradeable.sol` | ~50 | — | High |

### Out of Scope
- Frontend (`frontend/`)
- Subgraph (`subgraph/`)
- Deployment/migration scripts (`scripts/`)
- Test files (`test/`)

## 3. Architecture Overview

```
User Wallet
  ├── stake/unstake/claim → DeadCoinStakingPool (one per dead coin)
  ├── stake/unstake       → ResurgeStakingPool (RESURGE native staking)
  └── propose/vote        → ResurgenceGovernance
                                  │
                          ResurgenceTimelockController (1hr min delay)
                                  │
                    ┌─────────────┴────────────┐
                    │                          │
             StakingPoolManager          RewardDistributor
             (deploys pools,            (mints RESURGE to pools
              sets rates)                on claim, enforces cap)
                    │
           DeadCoinStakingPool (via ERC1967Proxy)
```

**Trust hierarchy** (post-deployment):
- `TimelockController.DEFAULT_ADMIN_ROLE` → self
- `StakingPoolManager.TIMELOCK_ROLE` → TimelockController
- `RewardDistributor.TIMELOCK_ROLE` → TimelockController
- `ResurgeToken.MINTER_ROLE` → RewardDistributor
- `ResurgeToken.PAUSER_ROLE` → TimelockController
- No EOA holds any privileged role post-deployment

## 4. Key Invariants (Critical to Verify)

1. `totalStakedSupply == Σ userStakedAmount[i]` for all active stakers in each pool
2. `totalResurgeMinted <= maxMintSupply` at all times
3. `RewardDistributor.mintAndDistribute()` only callable by authorized pools
4. `rewardPerToken` is monotonically non-decreasing
5. `earned(user)` always returns ≤ actual accumulated rewards (no over-minting)
6. UUPS `_authorizeUpgrade()` only callable by `TIMELOCK_ROLE`
7. `ResurgeStakingPool` early-unstake penalty (5%) goes to burn address, not treasury
8. Oracle price from Chainlink is validated for staleness (max age: 1 hour)
9. `userReceived + treasuryReceived == totalRewardsEarned` for all reward claims (no rounding leakage)
10. `protocolFeeBps` is capped at 30% (3000 bps) maximum

## 5. Known Issues / Acknowledged Risks

| # | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| 1 | OZ v5 `ReentrancyGuardUpgradeable` removed | N/A | Resolved | Local shim created at `contracts/utils/ReentrancyGuardUpgradeable.sol` using ERC-7201 slot `0x9b779b17...`. Initializer sets slot to `NOT_ENTERED (1)`. |
| 2 | Dead coin tokens may have fee-on-transfer behavior | Medium | Acknowledged | Staking pools use `amount` parameter, not balance diff. Fee-on-transfer tokens may cause accounting drift. Recommend listing only standard ERC-20s as dead coins. |
| 3 | `claimAndRestakeTo` in `DeadCoinStakingPool` not extensively tested | Low | Resolved | Full test suite added: fee split on restake, treasury receipt, staked amount matches post-fee remainder. |
| 4 | Chainlink oracle on Polygon: single feed dependency | Medium | Acknowledged | No fallback oracle. Oracle failure causes `distributeWithMultiplier` to revert. Non-blocking for base `mintAndDistribute`. |
| 5 | `ResurgeStakingPool` voting power retained while staked | Low | By design | Users can vote while RESURGE is staked. Staked tokens remain in pool contract which delegates to the staker. |
| 6 | Governance `proposalThreshold` (100k RESURGE) is static | Low | Acknowledged | Cannot be changed without a contract upgrade. Acceptable for v1. |

## 6. Test Coverage

```
Total tests: 230 passing
Framework: Hardhat + Mocha + Chai
Coverage areas:
  - Unit tests: ResurgeToken, DeadCoinStakingPool, ResurgeStakingPool,
                StakingPoolManager, RewardDistributor, ResurgenceGovernance
  - Protocol treasury fee: fee split on claim/claimAndRestakeTo/batchClaim,
                           zero-fee path, 30% cap enforcement, access control
  - Integration: Full stake/claim/governance lifecycle
  - Security: Reentrancy, access control, pause/unpause
  - Fuzz: StakingRandomized.test.js — 100+ random operations
  - Upgrade: State preservation across UUPS upgrades
```

Run tests: `npx hardhat test`

## 7. Deployment Sequence (for auditor reference)

1. Deploy `ResurgeToken` (UUPS proxy)
2. Deploy `ResurgenceTimelockController`
3. Deploy `RewardDistributor` (UUPS proxy)
4. Grant `MINTER_ROLE` on ResurgeToken → RewardDistributor
5. Deploy `DeadCoinStakingPool` implementation (logic only, no proxy)
6. Deploy `StakingPoolManager` (UUPS proxy)
7. Deploy `ResurgeStakingPool` (UUPS proxy)
8. Transfer `DEFAULT_ADMIN_ROLE` on all contracts → TimelockController
9. Transfer deployer EOA role revocations

## 8. Build & Verify

```bash
npm install
npx hardhat compile
npx hardhat test
# Check upgrade compatibility
npx hardhat run scripts/checkUpgrades.js --network localhost
```

## 9. Contact

- GitHub: https://github.com/kdsmith18542/Resurgence-Protocol
- Email: grywrm1337@gmail.com
- Security disclosures: See SECURITY.md (to be created post-audit)
