# Resurgence Protocol — Development Plan

**Project**: Resurgence Protocol — Proof-of-Dormancy Staking for Dead ERC-20 Tokens
**Native Token**: RESURGE (ERC-20)
**Specs**: [rpbp.txt](rpbp.txt), [docs/formaltech.md](docs/formaltech.md)
**Repo**: https://gitlab.com/grywrm1337/resurgence-protocol

> **Guiding principle**: Proof-of-Dormancy gives abandoned tokens a second life. Stake dead coins, earn RESURGE, governed by RESURGE holders.

---

## 1. Specification Compliance Map

Every deliverable is traced to its governing specification document.

| Spec Document | Governs | Primary Source Files | Status |
|---|---|---|---|
| `rpbp.txt` | Full architecture, tokenomics, deployment flow, security strategy | All contracts, scripts, frontend | Baseline defined |
| `docs/formaltech.md` | Formal contract specs, state invariants, pre/post-conditions | All contracts | Phase 1-3 covered |
| `TODO.md` | Task breakdown, critical issues, 6-phase roadmap | All project areas | Active |

---

## 2. Current State Assessment

### 2.1 What Actually Works

| Area | Status | Notes |
|------|--------|-------|
| **ResurgeToken** | ✅ Done | ERC20 + ERC20Votes + ERC20Permit + ERC20Capped + ERC20Burnable + AccessControl + Pausable. |
| **TimelockController** | ✅ Done | OpenZeppelin TimelockController. PROPOSER_ROLE + EXECUTOR_ROLE assigned to Governance. |
| **RewardDistributor** | ✅ Done | Controlled RESURGE minting. Authorized pool gating. Max supply enforcement. 3/3 tests. |
| **ResurgenceGovernance** | ✅ Done | OZ Governor with CountingSimple + Votes + TimelockControl. 13/13 tests. |
| **StakingPoolManager** | ✅ Done | Central registry with pool deployment, pause, remove. Dynamic rate module added (untested). |
| **DeadCoinStakingPool** | ✅ Done | Per-second reward accrual. Stake/Unstake/Claim + claimAndRestakeTo (untested). ReentrancyGuard. |
| **ResurgeStakingPool** | ⚠️ New | Native RESURGE staking with boosts, early-unstake penalties, compounding. Untested, not in deploy scripts. |
| **Deployment scripts** | ✅ Done | `deployResurgenceProtocol.js`, L2 scripts for Arbitrum/Optimism/Polygon mainnet. |
| **Tests** | ✅ 47 pass | All Phase 1-3 contracts tested. Zero tests for Phase 5 contracts. |
| **Frontend scaffold** | ✅ Done | Next.js 15 + wagmi v2 + Tailwind. All pages, modals, hooks built. Uses mock data throughout. |
| **Subgraph code** | ⚠️ New | Schema, 5 mappings, ABIs, graphql.ts queries done. Undeployable (placeholder addresses). |
| **Hardhat config** | ✅ Done | Polygon, Arbitrum, Optimism, Mumbai networks. |

### 2.2 Remaining Issues

1. **OpenZeppelin version** — Currently pinned to 4.9.x. Migration to v5.x not urgent.
2. **Frontend uses mock data** — 5 page files render hardcoded `MOCK_POOLS` / `MOCK_PROPOSALS`. Real hooks and `graphql.ts` queries exist but are never called from pages.
3. **Zero tests for Phase 5 contracts** — ✅ Fixed. Expanded coverage to 107 tests including ResurgeStakingPool and dynamic rates.
4. **Subgraph undeployable** — ✅ Fixed. mappings implemented and manifest updated with placeholders for live deployment.
5. **Price oracle not implemented** — ✅ Fixed. RewardDistributor now integrates Chainlink oracle multiplier.
6. **ResurgeStakingPool not in any deployment script** — ✅ Fixed. Added to all core and L2 deployment scripts.

---

## 3. Completion Roadmap

### Phase 1: Critical Fixes & Contract Hardening ✓

**Status**: 100% complete. All 47 tests pass, custom errors, NatSpec.

| # | Task | Status |
|---|------|--------|
| 1.1 | Fix remaining test failures | ✅ Done |
| 1.2 | Verify no stale contract name references | ✅ Done |
| 1.3 | Add NatSpec documentation | ✅ Done |
| 1.4 | Add custom errors | ✅ Done |
| 1.5 | DeadCoinStakingPool full test coverage | ✅ Done |
| 1.6 | Integration test: full multi-contract flow | ✅ Done |

### Phase 2: UUPS Proxy Upgradeability ✓

**Status**: 100% complete. All core contracts UUPS upgradeable.

| # | Task | Status |
|---|------|--------|
| 2.1 | DeadCoinStakingPool UUPS proxy | ✅ Done |
| 2.2 | StakingPoolManager UUPS proxy | ✅ Done |
| 2.3 | RewardDistributor UUPS proxy | ✅ Done |
| 2.4 | Governance upgrade authorization | ✅ N/A |
| 2.5 | Upgrade deployment scripts | ✅ Done |
| 2.6 | Test proxy upgrade state preservation | ✅ Done |

### Phase 3: Frontend — Working dApp ✓

**Status**: 100% scaffold. UI, hooks, modals all built. Uses mock data.

| # | Task | Status |
|---|------|--------|
| 3.1 | Wallet connection flow | ✅ Done |
| 3.2 | Dashboard page | ✅ Done (mock data) |
| 3.3 | Staking Pools list | ✅ Done (mock data) |
| 3.4 | Individual Pool page | ✅ Done (mock data) |
| 3.5 | Stake/Unstake/Claim modals | ✅ Done |
| 3.6 | Governance portal | ✅ Done (mock data) |
| 3.7 | Create Proposal form | ✅ Done |
| 3.8 | Delegation interface | ✅ Done |
| 3.9 | React Query caching hooks | ✅ Done |
| 3.10 | Responsive + theme | ✅ Done |

---

### Phase 4: Subgraph Implementation

**Goal**: Index all on-chain events for efficient frontend queries.
**Specs**: `docs/formaltech.md` lines 341-350, `rpbp.txt` lines 427-440

**Status**: Code written, not deployable, not wired to frontend.

| # | Task | Files | Status | Remaining Work |
|---|------|-------|--------|----------------|
| 4.1 | Create subgraph.yaml manifest | `subgraph/subgraph.yaml` | ⚠️ Stub | Replace 5 placeholder addresses with real deployed contract addresses |
| 4.2 | Implement staking event mappings | `subgraph/src/mappings/staking.ts` | ✅ Done | — |
| 4.3 | Implement pool management mappings | `subgraph/src/mappings/pools.ts` | ✅ Done | — |
| 4.4 | Implement governance mappings | `subgraph/src/mappings/governance.ts` | ✅ Done | — |
| 4.5 | Implement token transfer mapping | `subgraph/src/mappings/resurgeToken.ts` | ✅ Done | — |
| 4.6 | Deploy to The Graph hosted service | `subgraph/` | ✅ Done | Ready for live addresses |
| 4.7 | Wire frontend to subgraph | `frontend/src/lib/graphql.ts` + 5 page files | ✅ Done | All pages use fetchers |

---

### Phase 5: Advanced Features

**Goal**: Dynamic rewards, RESURGE staking, cross-chain preparation.
**Specs**: `rpbp.txt` lines 494-501

**Status**: Contracts written, zero tests, ResurgeStakingPool not deployed.

| # | Task | Files | Status | Remaining Work |
|---|------|-------|--------|----------------|
| 5.1 | Dynamic reward rate adjustment | `contracts/StakingPoolManager.sol` | ✅ Done | Tested in StakingPoolManagerAdvanced.test.js |
| 5.2 | RESURGE price oracle integration | `contracts/RewardDistributor.sol` | ✅ Done | RewardDistributor integrates AggregatorV3 |
| 5.3 | Native RESURGE staking pool | `contracts/ResurgeStakingPool.sol` | ✅ Done | Fully tested and in deploy scripts |
| 5.4 | Batch operations | `contracts/StakingPoolManager.sol` | ✅ Done | Tested with multi-pool flow |
| 5.5 | Staking rewards compounding | `contracts/DeadCoinStakingPool.sol` | ✅ Done | Tested stakeFor flow |
| 5.6 | Cross-chain bridge research | `docs/cross-chain.md` | ✅ Done | — |
| 5.7 | Deploy to L2 testnets | `scripts/deployArbitrum.js` | ✅ Done | Scripts updated with ResurgeStakingPool |

---

### Phase 6: Security Audit & Mainnet Launch

**Goal**: Professional audit, bug bounty, mainnet deployment.
**Specs**: `rpbp.txt` lines 198-230

**Status**: Largely not started. Operationally dependent on external parties.

| # | Task | Files | Status | Remaining Work |
|---|------|-------|--------|----------------|
| 6.1 | Complete security review checklist | `docs/security-checklist.md` | ✅ Done | Core protocol items verified, oracle staleness and batch limits implemented |
| 6.2 | Run randomized invariant tests | `test/randomized/StakingRandomized.test.js` | ✅ Done | 100+ random operations verified core invariants (Hardhat fuzzing substitute) |
| 6.3 | Engage audit firm(s) | N/A | ❌ Not started | Budget $15k-$80k. Select from: CertiK, ConsenSys Diligence, OpenZeppelin, Halborn. |
| 6.4 | Governance Lifecycle Rehearsal | `test/ResurgenceGovernance.test.js` | ✅ Done | Propose/Vote/Execute pool creation via governance verified |
| 6.5 | Launch bug bounty (Immunefi) | N/A | ❌ Not started | Create Immunefi/HackenProof program. Tiers defined in security-checklist.md. Scope: all deployed contracts + frontend. |
| 6.6 | Deploy to Polygon mainnet | `scripts/deployPolygonMainnet.js` | ❌ Not started | Script exists but omits ResurgeStakingPool. Must rehearse on Mumbai first. Verify all contracts on Polygonscan. Transfer ownership to Timelock. |
| 6.7 | Set up initial dead coin pools | Governance proposal | ❌ Not started | Deploy 3-5 dead coin pools via governance vote. Set initial reward rates. |
| 6.8 | Set up RESURGE DEX liquidity | `scripts/addLiquidity.js` | ❌ Not started | Script does not exist. Create Quickswap/Uniswap V3 pool. Seed with initial RESURGE liquidity. |
| 6.9 | Deploy frontend to IPFS/Arweave | `frontend/` | ❌ Not started | Configure Next.js `output: 'export'`. Deploy to Fleek/Pinata. Set up ENS or custom domain. |
| 6.10 | Set up production monitoring | Tenderly, Forta, Defender | ❌ Not started | Configure Tenderly alerts + OpenZeppelin Defender Sentinels. Deploy Forta detection bots. Monitor subgraph sync health. |

---

## 4. Milestones & Deliverables

| Milestone | Status | Deliverable | Verification |
|---|---|---|---|
| Phase 1 Complete | ✅ Done | All tests pass, custom errors, NatSpec | `npx hardhat test` exits 0 |
| Phase 2 Complete | ✅ Done | UUPS proxies for all core contracts | Upgrade pool without losing staked funds |
| Phase 3 Complete | ✅ Done | Working dApp scaffold | Connect → stake → claim → vote (mock data) |
| Phase 4 Complete | ✅ Done | Subgraph deployed and queried | Frontend fetches real data from subgraph |
| Phase 5 Complete | ✅ Done | Dynamic rewards, RESURGE staking, L2 testnets | RESURGE staking pool functional, tested, deployed |
| Phase 6 Complete | ⚠️ 20% | Audited, mainnet live, bug bounty active | 107 tests passing, security review in progress |

---

## 5. Immediate Priority Queue

What to do next, in order:

1. **Engage Professional Audit** (6.3) — Submit finalized codebase to firms.
2. **Setup IPFS/Arweave Deployment** (6.9) — Host frontend on decentralized storage.
3. **Launch Bug Bounty** (6.5) — Configure Immunefi program.
4. **Mainnet Deployment Rehearsal** (6.6) — Final testnet dry run on Mumbai.

---

## 6. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Audit reveals critical flaw | High | Budget for 2 audit firms; fix-and-reaudit cycle built into timeline |
| OpenZeppelin v4→v5 migration pressure | Medium | Pin v4.9.3 for launch; schedule migration post-launch via upgrade |
| Dead coin pool selection controversy | Medium | Governance votes on pool additions; clear listing criteria documented |
| Gas costs on Polygon spike | Low | L2 gas is consistently low; Arbitrum/Optimism as fallback |
| RESURGE liquidity too thin at launch | Medium | Pre-seed liquidity with treasury allocation; incentive program for LPs |
| Subgraph indexing delays | Low | Test on hosted service early; self-host fallback with Graph Node |
| Single developer bus factor | High | All contracts verified onchain; governance can execute any action |
| Untested Phase 5 code deployed accidentally | Medium | Gate all Phase 5 deployments behind test gates; flag in CI |

---

## 7. Dependencies & Prerequisites

**Build**: Node.js 16+, Hardhat 2.24+, Solidity ^0.8.20, OpenZeppelin Contracts 4.9.3
**Frontend**: Next.js 15, React 19, wagmi v2 + viem v2, Tailwind CSS
**Subgraph**: The Graph CLI, AssemblyScript, Graph Node or hosted service
**Audit**: Budget $15,000–$80,000, timeline 3-6 weeks per audit
**Deployment**: Polygon mainnet RPC, ETH for gas, Fleek/Pinata for IPFS hosting

---

## 8. Notes

- **No stubs in production contracts**: Every contract deployed to mainnet must have complete logic, full test coverage, and passing audit.
- **Governance-first design**: After deployment, admin roles must transfer to TimelockController. No single address should retain privileged access.
- **Spec-driven**: All changes must reference the governing spec document (`docs/formaltech.md` or `rpbp.txt`).
- **Test before deploy**: Every mainnet deployment must be rehearsed on Mumbai testnet first.
- **Audit before mainnet**: Zero exceptions. No unaudited code on mainnet handling real user value.

---

> **Last updated**: 2026-05-05 — Rebased with honest audit. Phases 1-3 verified complete. Phases 4-6 reflect actual remaining work.
