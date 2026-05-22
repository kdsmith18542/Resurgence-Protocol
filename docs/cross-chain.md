# Resurgence Protocol — Cross-Chain Strategy

## Overview

This document outlines the cross-chain expansion strategy for Resurgence Protocol, enabling Proof-of-Dormancy staking across multiple EVM chains with unified governance.

## Bridge Protocol Evaluation

### LayerZero (Recommended Primary)

**Strengths:**
- Omnichain messaging protocol with ultra-light nodes
- Largest ecosystem (50+ chains supported)
- Configurable decentralized verifier networks (DVNs)
- OApp (Omnichain Application) pattern maps well to our architecture
- Strong security track record, multiple audits
- Native OFT (Omnichain Fungible Token) for RESURGE bridging

**Integration approach:**
- Deploy ResurgeToken as OFT on each chain
- Use LayerZero messaging for cross-chain governance vote aggregation
- Cross-chain reward distribution via OFT burn/mint pattern
- Unified StakingPoolManager state synced via LayerZero messages

**Fees:** ~$0.01-0.10 per message on L2s

### Axelar (Secondary Option)

**Strengths:**
- General Message Passing (GMP) with proof-of-stake security
- Interchain Token Service (ITS) for native cross-chain tokens
- Strong enterprise partnerships
- Gas-efficient on L2s

**Considerations:**
- Smaller validator set than some alternatives
- Less mature ecosystem than LayerZero

### Wormhole (Tertiary Option)

**Strengths:**
- Guardian network with 19 validators
- Native Token Bridge (NTB)
- Strong Solana support for future non-EVM expansion

**Considerations:**
- Higher gas costs per message
- Guardian set requires high trust assumptions
- Slower message delivery (30-60s vs 5-15s for LayerZero)

## Architecture Design

### Phase 1: Multi-Chain Independent Deployment

Deploy full protocol stack on each chain independently:
- Polygon (primary/mainnet)
- Arbitrum
- Optimism

Each chain operates independently with its own:
- RESURGE token (separate supply per chain)
- Staking pools
- Governance (chain-specific proposals)

### Phase 2: Unified Governance (via LayerZero)

```
┌─────────────────┐     LayerZero      ┌─────────────────┐
│  Polygon Gov     │◄──────────────────►│  Arbitrum Gov    │
│  (Hub Chain)     │   Cross-chain msgs │  (Spoke Chain)   │
└────────┬─────────┘                    └────────┬─────────┘
         │                                       │
    Polygon Pools                          Arbitrum Pools
```

- Polygon serves as governance hub
- Cross-chain proposals broadcast to all chains
- Vote aggregation across chains
- Unified execution with chain-specific delays

### Phase 3: Cross-Chain RESURGE (OFT)

- RESURGE becomes omnichain via LayerZero OFT
- Users can bridge RESURGE between chains
- Unified token supply across all chains
- Cross-chain staking: stake on one chain, earn on another

## Implementation Plan

### Step 1: Testnet Deployment (Week 1-2)
- Deploy full protocol on Arbitrum Sepolia
- Deploy full protocol on Optimism Sepolia
- Verify all contracts
- Deploy subgraph for each chain

### Step 2: LayerZero Integration (Week 3-4)
- Create `contracts/crosschain/CrossChainGovernor.sol`
- Implement OApp for governance messaging
- Create `contracts/crosschain/ResurgeOFT.sol` (OFT wrapper for RESURGE)
- Test cross-chain proposal creation and execution

### Step 3: Unified Frontend (Week 5-6)
- Multi-chain wallet support
- Chain selector in dApp
- Aggregated dashboard showing positions across chains
- Cross-chain bridging UI

### Step 4: Mainnet Expansion (Week 7-8)
- Deploy to Arbitrum One mainnet
- Deploy to Optimism mainnet
- Enable cross-chain governance
- Launch RESURGE bridge

## Security Considerations

1. **Message verification**: All cross-chain messages verified by LayerZero DVNs
2. **Rate limiting**: Maximum value per cross-chain transaction enforced
3. **Timelock integration**: Cross-chain proposals subject to Timelock delays on each chain
4. **Emergency pause**: Cross-chain pauser role for emergency shutdown
5. **Replay protection**: LayerZero nonce-based replay protection built in

## Gas Cost Estimates

| Operation | Polygon | Arbitrum | Optimism |
|-----------|---------|----------|----------|
| Deploy stack | ~$5 | ~$15 | ~$10 |
| Cross-chain proposal | ~$0.50 | ~$2.00 | ~$1.50 |
| Bridge RESURGE (OFT) | ~$0.30 | ~$1.50 | ~$1.00 |
| Stake/Unstake | ~$0.05 | ~$0.30 | ~$0.20 |

## References

- [LayerZero Docs](https://docs.layerzero.network)
- [Axelar Docs](https://docs.axelar.dev)
- [Wormhole Docs](https://docs.wormhole.com)
- [OpenZeppelin Cross-Chain Governance](https://docs.openzeppelin.com/contracts/5.x/crosschain)
