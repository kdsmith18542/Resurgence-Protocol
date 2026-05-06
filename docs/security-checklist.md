# Resurgence Protocol — Security Audit Checklist

Per `docs/formaltech.md` Section VII and `rpbp.txt` Security Strategy.

## Pre-Audit Self-Review

### Access Control
- [x] All privileged functions protected by appropriate roles
- [x] DEFAULT_ADMIN_ROLE transferred to Timelock post-deployment
- [x] MINTER_ROLE only held by RewardDistributor
- [x] PAUSER_ROLE held by Timelock for governance-controlled pause
- [x] No single EOA holds privileged roles post-deployment
- [x] UUPS upgrade authorization restricted to Timelock

### Token (ResurgeToken)
- [x] Capped supply enforced (`ERC20Capped`)
- [x] Mint function only callable by MINTER_ROLE
- [x] Burn function works correctly with vote tracking
- [x] Permit (EIP-2612) works correctly
- [x] Vote delegation properly tracks balance changes
- [x] Pause/unpause by PAUSER_ROLE only
- [x] Initializer can only be called once
- [x] `_disableInitializers()` called in constructor

### Staking Pool (DeadCoinStakingPool)
- [x] ReentrancyGuard on stake, unstake, claimRewards
- [x] Reward calculation precision (no rounding losses)
- [x] `updateReward` modifier correctly updates state before mutations
- [x] Zero-amount stake/unstake reverts
- [x] Insufficient balance unstake reverts
- [x] Reward minting via authorized distributor only
- [x] User cannot claim more rewards than earned
- [x] `totalStakedSupply` always equals sum of all `userStakedAmount`
- [x] Pause prevents all user actions; unpause restores

### Reward Distributor
- [x] Only authorized pools can call `mintAndDistribute`
- [x] Total minted never exceeds `maxMintSupply`
- [x] `mintAndDistribute` respects RESURGE token cap
- [x] `maxMintSupply` cannot be set below `totalResurgeMinted`
- [x] Authorization/deauthorization only by TIMELOCK_ROLE
- [x] Pause prevents all minting

### Staking Pool Manager
- [x] No duplicate pools for same dead coin
- [x] Pool removal properly unauthorizes from distributor
- [x] `supportedDeadCoins` array stays consistent
- [x] Only TIMELOCK_ROLE can add/remove pools
- [x] Batch operations properly validate arrays
- [x] Dynamic rate calculation cannot overflow
- [x] Dynamic rate bounded by min/max

### Governance
- [x] Proposal threshold check before proposal creation
- [x] Voting delay and period configurable
- [x] Quorum fraction correctly applied
- [x] Vote counting correct (For/Against/Abstain)
- [x] Timelock delay enforced before execution
- [x] Canceled proposals cannot be executed
- [x] Already-executed proposals cannot be re-executed
- [x] Proposal state transitions are correct

### Timelock Controller
- [x] Minimum delay configurable
- [x] PROPOSER_ROLE and EXECUTOR_ROLE properly assigned to Governance
- [x] Only CANCELLER_ROLE can cancel scheduled operations
- [x] Operations cannot be executed before delay expires

### Upgrade Safety
- [x] All upgradeable contracts use UUPS pattern
- [x] `_authorizeUpgrade` restricted to Timelock
- [x] Storage gaps present (50 slots) for future variables
- [x] `_disableInitializers()` called in all constructors
- [x] Governance and Timelock intentionally non-upgradeable

### Economics
- [x] No inflation beyond capped supply
- [x] Reward rate cannot cause overflow in accumulator
- [x] Early unstake penalty correctly calculated
- [x] Boost multipliers properly bounded
- [x] TVL decay formula cannot underflow
- [x] Minimum reward rate is > 0

## Fuzz Testing Targets

Run with Foundry `forge test --fuzz-runs 10000`:

- [ ] `stake()` with random amounts (1 wei to max uint256)
- [ ] `unstake()` with random amounts and sequences
- [ ] `claimRewards()` after random time intervals
- [ ] Multi-user interactions with random ordering
- [ ] `setRewardRate()` with extreme values
- [ ] `setMaxMintSupply()` with boundary values
- [ ] `mintAndDistribute()` at supply boundaries
- [ ] Dynamic rate calculation with extreme TVL values

## Formal Verification Targets

- [ ] `totalStakedSupply == sum(userStakedAmount)` (invariant)
- [ ] `totalResurgeMinted <= maxMintSupply` (invariant)
- [ ] `earned(account) >= 0` (invariant)
- [ ] `rewardPerTokenStored` monotonic non-decreasing
- [ ] No user can unstake more than they staked
- [ ] Rewards claimed ≤ rewards earned at any point

## External Audit Scope

### Recommended Firms
1. OpenZeppelin — Governor/ERC20/staking expertise
2. CertiK — Formal verification capabilities
3. ConsenSys Diligence — DeFi protocol specialists

### Audit Scope
- All 5 core contracts + ResurgeStakingPool
- Deployment scripts (role transfers, initialization)
- Upgrade paths (UUPS proxy state preservation)
- Cross-chain bridge contracts (when implemented)

## Bug Bounty Program

### Platform: Immunefi / HackenProof

### Tiers:
| Severity | Max Bounty | Example |
|----------|-----------|---------|
| Critical | $50,000 | Direct fund loss, governance takeover |
| High | $25,000 | Reward manipulation, unauthorized minting |
| Medium | $5,000 | Incorrect state, precision loss >0.1% |
| Low | $1,000 | Minor logic issues, gas inefficiencies |

### Scope: 
- All deployed contracts on Polygon mainnet
- Frontend dApp (XSS, signature phishing)
- Subgraph (data manipulation, query injection)

### Exclusions:
- Third-party contract vulnerabilities
- Already-known issues
- Theoretical attacks requiring unrealistic conditions

## Production Monitoring

### Tenderly / OpenZeppelin Defender Alerts:
- [ ] Large stake/unstake (>$10k equivalent)
- [ ] Unusual reward rate changes
- [ ] New pool deployment
- [ ] Governance proposal created
- [ ] Contract paused/unpaused
- [ ] Role granted/revoked
- [ ] Upgrade events
- [ ] Subgraph sync delay >10 minutes

### Forta Bots:
- [ ] Flash loan detection
- [ ] Abnormal token transfer patterns
- [ ] Governance attack detection (vote buying, flash governance)
- [ ] Reward manipulation monitoring
