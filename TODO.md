# Resurgence Protocol — TODO

## Status: Phase 6 (75% complete). Awaiting external audit engagement.

---

## ✅ COMPLETED

### Contracts
- [x] Contract standardization (ResurgeToken, consistent naming)
- [x] OpenZeppelin migration: v4 → v5 (contracts-upgradeable 5.x)
- [x] Local `ReentrancyGuardUpgradeable` shim (ERC-7201 slot, initializer-safe)
- [x] ReentrancyGuard on stake / unstake / claimRewards
- [x] Custom errors throughout (gas-efficient, OZ v5 compatible)
- [x] NatSpec documentation on all contracts
- [x] UUPS proxy pattern: ResurgeToken, DeadCoinStakingPool, ResurgeStakingPool, StakingPoolManager, RewardDistributor
- [x] Emergency pause / unpause on all core contracts
- [x] AccessControl roles: TIMELOCK_ROLE, EMERGENCY_PAUSER, MINTER_ROLE, PAUSER_ROLE, RATE_SETTER
- [x] Fix: DeadCoinStakingPool.initialize() grant EMERGENCY_PAUSER to manager (was missing, caused pauseStakingPool to always revert)
- [x] Fix: DeadCoinStakingPool.unpause() role changed DEFAULT_ADMIN_ROLE → TIMELOCK_ROLE
- [x] StakingPoolManager.getAllSupportedDeadCoins() view function
- [x] ResurgeStakingPool: boost mechanism, early-unstake penalty (5% burned), compounding
- [x] RewardDistributor: Chainlink oracle integration (1×–2× emission multiplier, staleness check)
- [x] Dynamic reward rate adjustment based on TVL in StakingPoolManager
- [x] ResurgenceGovernance: OZ Governor + TimelockControl, 7-day voting, 4% quorum, 100k threshold
- [x] Cross-chain contracts: LayerZeroBridge, ResurgeBridgeToken, GovernanceHub, GovernanceSpokeChain

### Tests (223 passing)
- [x] ResurgeToken.test.js: ERC20Votes, ERC20Permit, ERC20Capped, burn, pausable, UUPS
- [x] DeadCoinStakingPool.test.js: stake/unstake/claim, rewards, access control, pause, upgrade
- [x] ResurgeStakingPool.test.js: boost, penalty, compound, delegation, access control, upgrade
- [x] RewardDistributor.test.js: minting, oracle multiplier, pause, upgrade
- [x] StakingPoolManager.test.js: addStakingPool, removeStakingPool, pause/unpause pool, getAllSupportedDeadCoins
- [x] StakingPoolManagerAdvanced.test.js: dynamic rates, batch operations, oracle integration
- [x] ResurgenceGovernance.test.js: propose, vote, queue, execute, defeat, quorum failure, threshold, double-vote guard
- [x] SecurityIntegration.test.js: reentrancy, access control, supply invariants, pause mechanisms
- [x] CrossChain.test.js: bridge, message relay, governance hub/spoke
- [x] integration/fullLifecycle.test.js: full multi-contract lifecycle
- [x] randomized/StakingRandomized.test.js: 100 random operations, invariant checks
- [x] Fix OZ v5 test assertions: EnforcedPause custom error, upgradeToAndCall

### Deployment Scripts
- [x] deployResurgenceProtocol.js (local / testnet)
- [x] deployPolygonMainnet.js (Polygon mainnet, includes ResurgeStakingPool)
- [x] deployArbitrum.js, deployOptimism.js (L2)
- [x] upgradePool.js, upgradeManager.js, upgradeDistributor.js
- [x] addLiquidity.js (Quickswap V3 RESURGE/WMATIC seeding)
- [x] proposeInitialPools.js (governance proposal for initial dead coin pools)
- [x] voteProposal.js, queueAndExecuteProposal.js

### Frontend
- [x] Next.js 15 + wagmi v2 + Tailwind CSS scaffold
- [x] Wallet connection (WalletConnect, MetaMask, Coinbase)
- [x] Network switcher dropdown (Polygon, Mumbai, Arbitrum, Optimism)
- [x] Dashboard: portfolio, positions, recent activity, Claim All button, RESURGE price
- [x] Staking Pools page: APR, TVL, user stake
- [x] Individual Pool page: stake / unstake / claim modals
- [x] Governance portal: proposal list, voting interface, create proposal form, delegation
- [x] Analytics page: TVL breakdown, emission schedule, token supply bar
- [x] Docs page: comprehensive protocol documentation
- [x] Gas estimation in StakeModal, UnstakeModal, ClaimModal
- [x] RESURGE price hook via CoinGecko API
- [x] All pages wired to subgraph via graphql.ts (no mock data in pages)
- [x] /api/subgraph dev simulator for local development without a deployed subgraph
- [x] Fix: generateStaticParams returning 'placeholder' → returns []
- [x] Fix: ProposalDetailClient state derivation covers all 6 proposal states
- [x] IPFS static export configured (output: 'export' in next.config.mjs)
- [x] fleek.config.json for Fleek IPFS deployment
- [x] EmergencyControls component in header

### Subgraph
- [x] schema.graphql with all entities
- [x] Mappings: staking, pools, governance, resurgeToken, rewardDistributor, resurgeStaking, timelock
- [x] subgraph.yaml manifest (placeholder addresses — replace after mainnet deployment)
- [x] graphql.ts query functions wired to all pages

### Tooling & Infrastructure
- [x] .github/workflows/ci.yml: contracts compile+test, frontend typecheck+build, subgraph build
- [x] monitoring/tenderly-alerts.json (9 alert rules)
- [x] monitoring/defender-sentinel.json (4 OZ Defender Sentinels)
- [x] monitoring/forta-bot/ (reentrancy, upgrade, role, large-claim detection)
- [x] docs/audit-scope.md (audit submission package)
- [x] docs/security-checklist.md
- [x] README.md (comprehensive)
- [x] Hardhat config: Polygon, Mumbai, Arbitrum, Optimism networks

---

## 🔲 REMAINING

### External gates (require action outside the repo)
- [ ] **Engage professional audit firm** — CertiK, ConsenSys Diligence, OpenZeppelin, or Halborn. Budget $15k–$80k. Submit `docs/audit-scope.md`.
- [ ] **Mumbai testnet rehearsal** — full dry run of `deployPolygonMainnet.js` on Mumbai before mainnet
- [ ] **Launch Immunefi bug bounty** — after audit completes. Tiers defined in `docs/security-checklist.md`.
- [ ] **Mainnet deployment** — deploy to Polygon after audit passes
- [ ] **Set up initial dead coin pools** — run `scripts/proposeInitialPools.js` post-mainnet
- [ ] **Seed DEX liquidity** — run `scripts/addLiquidity.js` with MATIC + RESURGE treasury allocation
- [ ] **Wire monitoring** — import `monitoring/tenderly-alerts.json`, `monitoring/defender-sentinel.json`, deploy Forta bot
- [ ] **Deploy frontend to IPFS** — run `npm run build` in `frontend/`, deploy `out/` to Fleek

### Optional improvements
- [ ] Foundry setup (`foundry.toml`) to run `test/fuzz/*.t.sol` fuzz tests
- [ ] Mainnet fork tests against live Polygon state
- [ ] Formal verification (Certora) for reward accumulator math
- [ ] Subgraph deployment and address population in `subgraph.yaml`
- [ ] Community channels (Discord, Telegram, Twitter/X)
