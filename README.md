# Resurgence Protocol

<p align="center">
  <img src="resurgencelogo.png" alt="Resurgence Protocol Logo" width="360" />
</p>

**Proof-of-Dormancy staking for abandoned ERC-20 tokens.**

Stake "dead coins" — tokens from failed or abandoned projects — and earn **RESURGE**, the protocol's native governance and rewards token. The protocol is fully on-chain, upgradeable via UUPS proxies, and governed by RESURGE holders through a time-locked DAO.

> **Status:** Pre-audit. 223 tests passing. Arbitrum mainnet is the target hub chain. Do not deposit significant value until a professional audit is complete.

---

## Table of Contents

- [Architecture](#architecture)
- [Contracts](#contracts)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [Deployment](#deployment)
- [Frontend](#frontend)
- [Subgraph](#subgraph)
- [Monitoring](#monitoring)
- [Governance Scripts](#governance-scripts)
- [Security](#security)
- [Docs](#docs)

---

## Architecture

```
User Wallet
  ├── stake / unstake / claim  →  DeadCoinStakingPool  (one per dead coin)
  ├── stake / unstake          →  ResurgeStakingPool   (RESURGE native staking)
  └── propose / vote           →  ResurgenceGovernance
                                        │
                               ResurgenceTimelockController  (≥1hr delay)
                                        │
                         ┌──────────────┴──────────────┐
                         │                             │
                  StakingPoolManager             RewardDistributor
                  (deploys & configures         (mints RESURGE on claim,
                   pools via governance)         enforces 1B cap)
```

**Trust model (post-deployment):**
- All privileged roles held by `TimelockController` — no EOA retains admin access
- Upgrades require a governance vote + timelock delay
- `MINTER_ROLE` on RESURGE token held exclusively by `RewardDistributor`

---

## Contracts

| Contract | Description | Proxy |
|---|---|---|
| `ResurgeToken` | ERC-20 + ERC20Votes + ERC20Permit + ERC20Capped. 1B hard cap. | UUPS |
| `DeadCoinStakingPool` | Per-second reward accrual for a single dead coin. One instance per coin. | UUPS |
| `ResurgeStakingPool` | Native RESURGE staking with boost multipliers and early-unstake penalty (5% burned). | UUPS |
| `StakingPoolManager` | Registry that deploys and configures `DeadCoinStakingPool` instances. | UUPS |
| `RewardDistributor` | Mints RESURGE to stakers on claim. Chainlink oracle multiplier (1×–2×). | UUPS |
| `ResurgenceGovernance` | OZ Governor with 7-day voting, 4% quorum, 100k RESURGE threshold. | — |
| `ResurgenceTimelockController` | 1-hour minimum delay on all governance actions. | — |

**OpenZeppelin version:** `contracts-upgradeable` 5.x  
**Solidity:** `^0.8.20`  
**Reentrancy guard:** local shim at `contracts/utils/ReentrancyGuardUpgradeable.sol` (ERC-7201 storage slot)

---

## Getting Started

**Prerequisites:** Node.js 18+, npm

```bash
git clone https://github.com/kdsmith18542/Resurgence-Protocol.git
cd Resurgence-Protocol
npm install
cp .env.example .env   # fill in RPC URLs and private keys
```

**Compile contracts:**
```bash
npx hardhat compile
```

**Local dev node:**
```bash
npx hardhat node
# in a second terminal:
npx hardhat run scripts/deployResurgenceProtocol.js --network localhost
```

---

## Testing

```bash
# Run full suite (223 tests, ~11s)
npx hardhat test

# Run with gas report
REPORT_GAS=true npx hardhat test

# Run a specific file
npx hardhat test test/ResurgeToken.test.js
```

**Test coverage by contract:**

| Contract | Test File(s) |
|---|---|
| ResurgeToken | `test/ResurgeToken.test.js` — ERC20Votes, ERC20Permit, burn, pausable, UUPS |
| DeadCoinStakingPool | `test/DeadCoinStakingPool.test.js` — stake/unstake/claim, rewards, access control, upgrade |
| ResurgeStakingPool | `test/ResurgeStakingPool.test.js` — boost, penalty, compound, pause, upgrade |
| RewardDistributor | `test/RewardDistributor.test.js` — minting, oracle multiplier, pause, upgrade |
| StakingPoolManager | `test/StakingPoolManager.test.js`, `test/StakingPoolManagerAdvanced.test.js` |
| ResurgenceGovernance | `test/ResurgenceGovernance.test.js` — propose, vote, queue, execute, defeat, quorum |
| Security | `test/SecurityIntegration.test.js` — reentrancy, access control, supply invariants |
| Cross-chain | `test/crosschain/CrossChain.test.js` |
| Integration | `test/integration/fullLifecycle.test.js` |
| Randomized | `test/randomized/StakingRandomized.test.js` — 100 random operations, invariant checks |

> `test/fuzz/*.t.sol` are Foundry test stubs. No `foundry.toml` is configured; they do not run under Hardhat.

---

## Deployment

### Local / Hardhat network
```bash
npx hardhat run scripts/deployResurgenceProtocol.js --network localhost
```

### Arbitrum Sepolia (testnet — do this first)
```bash
npx hardhat run scripts/deployResurgenceProtocol.js --network arbitrumSepolia
```

### Arbitrum Mainnet (hub chain)
```bash
npx hardhat run scripts/deployResurgenceProtocol.js --network arbitrum
```

### Spoke chains (after hub is deployed)
```bash
npx hardhat run scripts/deploySpoke.js --network polygon
npx hardhat run scripts/deploySpoke.js --network bsc
npx hardhat run scripts/deploySpoke.js --network base
```

### Post-deployment steps
1. **Seed DEX liquidity** — `scripts/addLiquidity.js` (Uniswap v3 or Camelot RESURGE/ETH on Arbitrum)
2. **Deploy initial dead coin pools** — `scripts/proposeInitialPools.js`
3. **Vote → Queue → Execute** — `scripts/voteProposal.js`, `scripts/queueAndExecuteProposal.js`

### Contract upgrades
```bash
PROXY_ADDRESS=0x... npx hardhat run scripts/upgradePool.js --network arbitrum
PROXY_ADDRESS=0x... npx hardhat run scripts/upgradeManager.js --network arbitrum
PROXY_ADDRESS=0x... npx hardhat run scripts/upgradeDistributor.js --network arbitrum
```

---

## Frontend

Next.js 15 + wagmi v2 + Tailwind CSS static dApp.

```bash
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_* contract addresses and subgraph URL
npm run dev                  # dev server at http://localhost:3000
npm run build                # static export to frontend/out/
```

**Pages:**

| Route | Description |
|---|---|
| `/` | Landing page |
| `/dashboard` | User portfolio, positions, recent activity, Claim All |
| `/pools` | All dead coin staking pools with APR |
| `/pools/[address]` | Individual pool — stake / unstake / claim |
| `/governance` | Proposal list |
| `/governance/[id]` | Proposal detail — vote for / against / abstain |
| `/analytics` | TVL breakdown by pool, emission schedule, token supply |
| `/docs` | Protocol documentation |

**Environment variables required:**
```
NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS=
NEXT_PUBLIC_STAKING_MANAGER_ADDRESS=
NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=
NEXT_PUBLIC_GOVERNANCE_ADDRESS=
NEXT_PUBLIC_TIMELOCK_ADDRESS=
NEXT_PUBLIC_RESURGE_STAKING_POOL_ADDRESS=
NEXT_PUBLIC_SUBGRAPH_URL=          # leave blank to use built-in dev simulator
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

**IPFS deployment:**
```bash
cd frontend && npm run build
# deploy frontend/out/ to Fleek or Pinata
```

---

## Subgraph

```bash
cd subgraph
npm install
graph codegen && graph build

# Before deploying: replace placeholder addresses in subgraph.yaml
graph deploy --product hosted-service <your-org>/resurgence-protocol
```

**Entities:** `ResurgeToken`, `StakingPool`, `StakingPosition`, `StakingEvent`, `User`, `GovernanceProposal`, `VoteReceipt`, `RewardClaimEvent`.

---

## Monitoring

Pre-configured templates in `monitoring/`:

| File | Tool | How to use |
|---|---|---|
| `tenderly-alerts.json` | Tenderly | Import via Tenderly dashboard → Alerts |
| `defender-sentinel.json` | OpenZeppelin Defender | Import via Defender API (fill `${ADDRESS}` vars first) |
| `forta-bot/` | Forta | `cd monitoring/forta-bot && npm install && forta publish` |

**Forta bot detects:** reentrancy attempts, unauthorized upgrades, unexpected role grants, large reward claims (>100k RESURGE).

---

## Governance Scripts

```bash
# 1. Submit proposal to add initial dead coin pools
GOVERNANCE_ADDRESS=0x... STAKING_MANAGER_ADDRESS=0x... TIMELOCK_ADDRESS=0x... \
DEAD_COIN_1=0x... REWARD_RATE_1=1000000000000000 \
npx hardhat run scripts/proposeInitialPools.js --network polygon

# 2. Vote on the proposal (VOTE_SUPPORT: 0=Against, 1=For, 2=Abstain)
GOVERNANCE_ADDRESS=0x... PROPOSAL_ID=123 VOTE_SUPPORT=1 \
npx hardhat run scripts/voteProposal.js --network polygon

# 3. Queue and execute after voting period ends
GOVERNANCE_ADDRESS=0x... PROPOSAL_ID=123 \
PROPOSAL_TARGETS='["0x..."]' PROPOSAL_VALUES='[0]' \
PROPOSAL_CALLDATAS='["0x..."]' PROPOSAL_DESCRIPTION="..." \
npx hardhat run scripts/queueAndExecuteProposal.js --network polygon
```

---

## Security

- `ReentrancyGuard` on all `stake` / `unstake` / `claimRewards` functions
- UUPS upgrades authorized only by `TIMELOCK_ROLE` (requires passing a governance vote)
- `TimelockController` enforces ≥1 hour delay on all privileged actions
- Chainlink oracle staleness validated (max age: 1 hour) before applying emission multiplier
- No pre-mine, no team allocation — 100% of RESURGE supply enters via staking rewards

**Audit status:** Pre-audit. See [`docs/audit-scope.md`](docs/audit-scope.md) for the full submission package including in-scope contracts, critical invariants, and known issues.

**Bug bounty:** Immunefi program to be launched after audit completes.

---

## Docs

| File | Contents |
|---|---|
| [`docs/audit-scope.md`](docs/audit-scope.md) | Audit submission: scope, architecture, invariants, known issues |
| [`docs/security-checklist.md`](docs/security-checklist.md) | Pre-audit self-review checklist |
| [`docs/formaltech.md`](docs/formaltech.md) | Formal technical specification |
| [`docs/cross-chain.md`](docs/cross-chain.md) | Cross-chain architecture research |
| [`plan.md`](plan.md) | Development roadmap and phase status |

---

## License

[MIT](LICENSE)
