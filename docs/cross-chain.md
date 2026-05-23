# Resurgence Protocol — Cross-Chain Strategy

**Decision locked**: Chainlink CCIP — hub on Arbitrum, spokes on Polygon/BSC/Base/Ethereum/Optimism/Avalanche.

> The earlier LayerZero evaluation is superseded by this document. `contracts/crosschain/LayerZeroBridge.sol` and related files are retained as reference but are not part of the production architecture.

---

## Why CCIP Over LayerZero

We already use Chainlink for the price oracle in `RewardDistributor`. CCIP extends that to cross-chain messaging under the same trust model — one vendor, one security assumption, one audit scope. LayerZero DVN trust assumptions require a separate evaluation; CCIP's Risk Management Network is an established, audited layer with battle-tested deployments.

---

## Architecture

```
HUB (Arbitrum One — chain ID 42161)
├── ResurgeToken          ERC-20, ERC20Votes, UUPS — sole minting authority
├── RewardDistributor     mintAndDistribute() + mintForBridge() for cross-chain claims
├── CrossChainReceiver    CCIPReceiver — validates spoke messages, triggers mint
├── ResurgenceGovernance  OZ Governor — governs all chains via Timelock
├── TimelockController    ≥1hr delay on all privileged ops
└── ResurgeStakingPool    RESURGE native staking (hub only)

SPOKE (each additional chain)
├── StakingPoolManager    deploys and manages DeadCoinStakingPool instances
├── DeadCoinStakingPool   per-second accrual; bridgeClaim() zeroes debt and sends CCIP msg
└── CrossChainSender      CCIPSender — batches reward claims, sends to hub; pays LINK fees
```

### Reward Flow

```
User stakes dead tokens on BSC
    → accrues reward debt in DeadCoinStakingPool (local, no minting)
    → calls bridgeClaim()
    → CrossChainSender sends CCIP message: {user, amount} to Arbitrum hub
    → CrossChainReceiver validates source chain + sender
    → calls RewardDistributor.mintForBridge(user, amount)
    → RESURGE minted on Arbitrum to user's address
    → user bridges RESURGE back via CCIP token pool if desired
```

### Token Model

RESURGE is minted **exclusively on Arbitrum**. Spokes accumulate reward debt locally — no RESURGE exists on spoke chains until a user bridges it back. This keeps total supply control fully on the hub.

---

## Target Networks

| Tier | Chain | Chain ID | Role | Rationale |
|------|-------|----------|------|-----------|
| Hub | Arbitrum | 42161 | Hub | ETH rollup security, deepest L2 DeFi TVL |
| 1 | Polygon | 137 | Spoke | Largest dead ICO token graveyard (2020-2022) |
| 1 | BSC | 56 | Spoke | Highest retail dead token count |
| 1 | Base | 8453 | Spoke | Coinbase distribution, growing ecosystem |
| 2 | Ethereum | 1 | Spoke | Original 2017-2019 ICO graveyard, highest-value dead tokens |
| 2 | Optimism | 10 | Spoke | Blue-chip dead tokens, OP Stack ecosystem |
| 2 | Avalanche | 43114 | Spoke | Dead AVAX ecosystem tokens |
| 3 | Fantom, Cronos, Moonbeam | — | Future | Dead DeFi / ecosystem tokens |

---

## New Contracts (Phase 10)

### `CrossChainReceiver.sol` (hub — Arbitrum)

```solidity
// Inherits Chainlink CCIPReceiver
// - Stores authorizedSpokes mapping (chainSelector => senderAddress)
// - _ccipReceive() validates source, decodes (address user, uint256 amount)
// - Calls RewardDistributor.mintForBridge(user, amount)
// - Emits RewardBridged(sourceChain, user, amount)
```

### `CrossChainSender.sol` (each spoke)

```solidity
// Inherits Chainlink CCIPSender
// - Called by DeadCoinStakingPool.bridgeClaim()
// - Encodes (user, amount) and sends to hub CrossChainReceiver
// - Pays LINK fee from contract balance (governance tops up LINK)
// - configurable: destinationChainSelector, receiverAddress
```

### `RewardDistributor.sol` changes

```solidity
// Add:
mapping(address => bool) public authorizedBridges;
function mintForBridge(address user, uint256 amount) external onlyAuthorizedBridge { ... }
function setAuthorizedBridge(address bridge, bool authorized) external onlyRole(TIMELOCK_ROLE) { ... }
```

### `DeadCoinStakingPool.sol` changes

```solidity
// Add alongside existing claimRewards():
function bridgeClaim() external whenNotPaused updateReward(msg.sender) nonReentrant {
    uint256 rewards = userRewards[msg.sender];
    if (rewards == 0) revert InvalidAmount();
    userRewards[msg.sender] = 0;
    emit RewardsClaimed(msg.sender, rewards);
    ICrossChainSender(crossChainSender).sendRewardClaim(msg.sender, rewards);
}
// Hub chain pools: claimRewards() path unchanged (no bridging needed)
```

---

## Security Considerations

1. **Source validation**: CrossChainReceiver checks both `sourceChainSelector` and `sender` address — not just one
2. **Message deduplication**: CCIP message IDs are unique; store processed IDs to prevent replay
3. **LINK funding**: CrossChainSender holds LINK for fees; governance controls top-up; emit alert when balance < threshold
4. **Rate limiting**: Max claim per tx to limit damage from a compromised spoke
5. **Timelock on bridge registration**: Adding/removing authorized spokes requires TIMELOCK_ROLE → governance vote
6. **Emergency pause**: Hub CrossChainReceiver can be paused independently of staking contracts

---

## Gas Cost Estimates

| Operation | Cost |
|-----------|------|
| CCIP message (spoke → hub) | ~0.1–0.5 LINK (~$1–5 at current prices) |
| Stake/Unstake (spoke) | ~$0.05–0.30 depending on chain |
| Stake/Unstake (Arbitrum hub) | ~$0.10–0.50 |
| LINK top-up frequency | Estimate 1 LINK per ~100 bridge claims |

---

## CCIP References

- Router addresses and chain selectors: see `plan.md` CCIP section
- Token admin registry (for RESURGE cross-chain token): docs.chain.link/ccip/concepts/cross-chain-tokens
- CCIP explorer (monitor messages): ccip.chain.link
