# Resurgence Legacy Asset Claim Engine — Technical Specification

**Version:** v0.1  
**Status:** Design spec / append-ready  
**Primary Project:** Resurgence Protocol  
**Supporting Projects:** ChronoNode, BaaLS, CanvasContracts  
**Feature Family:** Proof-of-Dormancy, Legacy Asset Claims, Non-Token Dormant Value Rewards  
**Intended Stage:** Testnet-first, audit before mainnet value  

---

## 1. Executive Summary

The Legacy Asset Claim Engine expands Resurgence Protocol beyond normal ERC-20 dead-token staking.

Current Resurgence model:

```text
Stake abandoned ERC-20 token -> earn RESURGE
```

Expanded model:

```text
Stake, deposit, burn, lock, or prove dormant legacy value -> earn RESURGE
```

This creates a unified system for:

1. ERC-20 dead-token staking.
2. Native legacy coin claims.
3. Transfer-backed claims.
4. Burn-backed claims.
5. Lock/vault-backed claims.
6. Signature-only dormant wallet claims.
7. RPC/explorer/light-node evidence claims.
8. zkVM-verified dormancy proofs through ChronoNode SP1 proof mode.

The goal is to make Resurgence a **dormant-value revival protocol**, not merely a dead-token staking app.

---

## 2. Core Principle

Not every abandoned project has a working token contract, active chain, healthy RPC, or live node network.

Therefore the system must support multiple evidence paths:

```text
If the old asset can still move:
    user sends / burns / locks funds for stronger rewards.

If the old chain cannot move funds:
    user proves wallet ownership and dormancy for a lower-tier reward.

If the proof can be generated in zkVM:
    ChronoNode produces a cryptographic proof and Resurgence can verify it trustlessly.

If only explorer/RPC evidence exists:
    reward is allowed only at lower confidence tiers with stricter caps.
```

---

## 3. Ecosystem Roles

### 3.1 Resurgence Protocol

Resurgence is the EVM rewards, staking, governance, and minting layer.

Responsibilities:

```text
- Define claim types.
- Store consumed claim/proof hashes.
- Enforce replay protection.
- Enforce reward caps.
- Mint RESURGE for approved claims.
- Track claim status.
- Expose protocol explorer data.
- Govern supported chains, reward policies, caps, and emergency pauses.
```

### 3.2 ChronoNode

ChronoNode is the evidence, archival, and proof layer.

Responsibilities:

```text
- Scan supported chains.
- Track watched addresses.
- Detect dormancy.
- Validate ownership signatures.
- Validate transfer/burn/lock transactions.
- Produce compact evidence records.
- Generate Merkle proofs and checkpoints.
- Generate SP1 Groth16 zkVM dormancy proofs where supported.
- Anchor checkpoints to durable storage such as Arweave.
- Submit attestations to BaaLS.
```

### 3.3 BaaLS

BaaLS is the local-first attestation registry and EVM relay layer.

Responsibilities:

```text
- Accept ChronoNode attestations.
- Store attestation records.
- Associate source chain, source address hash, EVM wallet, proof hash, and status.
- Relay valid claims to Resurgence through EVMSubmitter.
- Provide explorer visibility for the attestation lifecycle.
```

### 3.4 CanvasContracts

CanvasContracts is not required for v1, but becomes the visual policy builder later.

Future responsibilities:

```text
- Visual design of reward policy graphs.
- Compile claim scoring policies into BaaLS WASM contracts.
- Generate validation reports and manifests.
- Archive policy artifacts through ChronoNode.
```

---

## 4. Claim Modes

### 4.1 Mode 1 — ERC-20 Dead Token Staking

This is the current Resurgence model.

```text
User stakes ERC-20 dead token
-> DeadCoinStakingPool tracks deposit
-> RewardDistributor mints RESURGE over time
```

Best for:

```text
- EVM dead tokens
- Abandoned ERC-20 contracts
- Tokens that can still transfer
- Projects on supported EVM chains
```

Evidence strength: **High**, because the token deposit is on-chain.

---

### 4.2 Mode 2 — Transfer-to-Vault Legacy Claim

For non-token/native legacy chains that still process transactions.

```text
User sends legacy coin to configured vault address
-> ChronoNode detects the deposit transaction
-> BaaLS records attestation
-> Resurgence rewards the claim
```

Best for:

```text
- Small PoW chains still producing blocks
- Abandoned but functional native chains
- Chains with working RPC/explorer
```

Advantages:

```text
- Strong ownership proof.
- User proves control by moving funds.
- Easier to verify than signature-only evidence.
```

Risks:

```text
- Protocol custody risk if vault is controlled by Resurgence.
- If the dead chain revives, vault holdings may become valuable.
- Requires secure vault key management or DAO-controlled burn/vault addresses.
```

Recommendation:

```text
Prefer burn or provably unspendable vaults where possible.
Use custody only if the legal/security implications are acceptable.
```

---

### 4.3 Mode 3 — Burn Proof Claim

User sends legacy coin to a known burn address.

```text
User burns legacy asset
-> ChronoNode verifies burn tx
-> claim becomes eligible
-> Resurgence mints reward
```

Best for:

```text
- Chains where burning is possible
- Assets where custody should be avoided
- Claims where irreversible sacrifice should receive highest confidence
```

Advantages:

```text
- No custody.
- Strong anti-replay.
- Strong proof of control.
```

Risks:

```text
- User permanently gives up old asset.
- Some old chains may not have standard burn addresses.
- Need careful burn-address policy per chain.
```

---

### 4.4 Mode 4 — Lock Proof Claim

User locks funds in a script, timelock, multisig, or non-spendable contract where supported.

```text
User locks legacy coin
-> ChronoNode verifies lock condition
-> Resurgence rewards claim
```

Best for:

```text
- Chains with robust script/multisig support
- Assets where burning is undesirable
- Chains with verifiable lock scripts
```

Risks:

```text
- Complex chain-specific validation.
- Not all chains support this.
- Lock semantics can be subtle and audit-heavy.
```

---

### 4.5 Mode 5 — Signature-Only Dormancy Claim

Fallback mode for chains where assets cannot move.

```text
User signs challenge message with legacy wallet
-> ChronoNode verifies signature
-> ChronoNode scans historical activity
-> BaaLS attests dormancy
-> Resurgence rewards lower-tier claim
```

Best for:

```text
- Chains with broken nodes
- Frozen networks
- Archived explorer-only projects
- Wallets that can sign but cannot broadcast
```

This is a fallback and should have lower reward weight than transfer-backed claims.

---

### 4.6 Mode 6 — RPC / Explorer Evidence Claim

For chains where a full node is impractical but evidence can be retrieved from public infrastructure.

```text
ChronoNode queries public RPC or official explorer
-> extracts last activity / balance / tx history
-> hashes raw response
-> stores compact evidence
-> assigns confidence tier
```

Best for:

```text
- Obscure chains with public explorers
- Large chains where full archive nodes are too expensive
- Legacy assets where public APIs are the only remaining evidence source
```

This should be medium/low confidence unless cross-checked with multiple sources.

---

### 4.7 Mode 7 — zkVM Dormancy Proof Claim

For chains/evidence sets that can be converted into a deterministic proof input.

```text
ChronoNode builds dormancy input
-> SP1 guest program verifies no outbound activity in dormancy window
-> SP1 Groth16 proof generated
-> SP1DormancyVerifier validates proof on-chain
-> RewardDistributor mints RESURGE
```

This is the strongest long-term path because it reduces trusted-oracle dependency.

---

## 5. Claim Type Enum

Recommended EVM enum:

```solidity
enum LegacyClaimType {
    ERC20Stake,
    TransferToVault,
    BurnProof,
    LockProof,
    SignatureDormancyProof,
    PublicRpcEvidenceProof,
    ExplorerEvidenceProof,
    MultiSourceEvidenceProof,
    ZkDormancyProof,
    ManualReview
}
```

---

## 6. Evidence Source Types

Recommended ChronoNode evidence source enum:

```rust
pub enum EvidenceSourceType {
    FullNode,
    PrunedNode,
    LightClient,
    PublicRpc,
    OfficialExplorerApi,
    ThirdPartyExplorerApi,
    MultiSource,
    ZkVmProof,
    ManualReview,
}
```

> [!NOTE]
> This enum is a net-new addition to the ChronoNode codebase.

---

## 7. Confidence Tiers

Reward and UI must distinguish proof quality.

```text
Tier A — Transfer/Burn/Lock Backed
- User moved funds.
- Strongest ownership proof.
- Highest reward multiplier.

Tier B — zkVM Cryptographic Dormancy Proof
- Dormancy computation is proven.
- Very strong trust model.
- High reward multiplier.

Tier C — Signature + Full/Light Node Evidence
- Strong ownership and chain evidence.
- Medium/high reward multiplier.

Tier D — Signature + Public RPC Evidence
- Medium trust.
- Medium reward multiplier.

Tier E — Signature + Official Explorer Evidence
- Lower trust.
- Low reward multiplier.

Tier F — Historical/Manual Evidence
- No automatic mint.
- Manual review only.
```

Recommended reward confidence multipliers:

```text
TransferToVault:             1.00x
BurnProof:                   1.10x
LockProof:                   0.90x
ZkDormancyProof:             1.00x
FullNodeSignatureProof:      0.80x
PublicRpcEvidenceProof:      0.60x
ExplorerEvidenceProof:       0.40x
ManualReview:                0.00x automatic
```

---

## 8. Reward Formula

Base reward:

```text
reward =
    base_reward
    × dormancy_multiplier
    × confidence_multiplier
    × asset_weight
```

Dormancy multiplier:

```text
1+ year dormant:      1.0x
3+ years dormant:     1.5x
5+ years dormant:     2.0x
10+ years dormant:    3.0x
```

Asset weight may account for:

```text
- source chain reputation
- historical balance
- transaction history depth
- minimum balance threshold
- activity age
- community-approved campaign weighting
```

Hard caps:

```text
max_reward_per_claim
max_reward_per_source_address
max_reward_per_evm_wallet_per_epoch
max_reward_per_chain_per_epoch
max_total_legacy_claim_emission
max_emission_per_confidence_tier
```

Never allow uncapped proof-only rewards.

> [!NOTE]
> **Computation Location & Trust Model**:
> The reward formula is calculated off-chain by ChronoNode/BaaLS and verified off-chain. The resulting `rewardAmount` is included in the signed/attested `LegacyClaim` struct.
> The EVM contracts (`LegacyClaimRegistry` and `DormancyRewardController`) enforce the reward policy limits (e.g., `maxRewardPerClaim`) and epoch/per-wallet caps on-chain, protecting the protocol from oracle misbehavior or compromise.

---

## 9. Claim Identity and Replay Protection

Canonical claim id:

```text
claim_id = keccak256(
    source_chain_id,
    source_address_hash,
    evm_wallet,
    claim_type,
    source_tx_hash_or_proof_hash,
    campaign_id
)
```

Replay protection:

```solidity
mapping(bytes32 => bool) public consumedClaims;
mapping(bytes32 => bool) public consumedProofs;
mapping(bytes32 => ClaimStatus) public claimStatus;
```

One source address should not be able to farm multiple campaigns unless governance explicitly allows a new campaign id.

> [!NOTE]
> **Campaign Lifecycle & Governance**:
> Campaigns are created and managed by Resurgence Governance. A Campaign defines the parameters (duration, supported assets, rewards allocation).
> - **Lifecycle**: Created (Draft) → Active (claims allowed) → Closed (no new claims, rewards paused/ended).
> - **Governance Interaction**: Resurgence Governance registers campaigns in the `LegacyClaimRegistry` via a `setCampaign` governance proposal.
> - **Campaign Struct**:
> ```solidity
> struct Campaign {
>     uint256 id;
>     bool active;
>     uint256 startTime;
>     uint256 endTime;
>     uint256 maxTotalRewards;
>     uint256 rewardsMinted;
> }
> ```

---

## 10. EVM Contract Architecture

### 10.1 New or Expanded Contracts

Recommended contracts:

```text
LegacyClaimRegistry
DormancyRewardController
ProofConsumer
SP1DormancyVerifier
RewardDistributor integration
NonEvmStakingPool integration
```

> [!NOTE]
> **Upgradeability**:
> Both `LegacyClaimRegistry` and `DormancyRewardController` will be deployed as UUPS upgradeable proxies. The `TIMELOCK_ROLE` (controlled by Resurgence Governance) will be the sole upgrade authority.

### 10.2 LegacyClaim Struct

```solidity
struct LegacyClaim {
    bytes32 sourceChainId;
    bytes32 sourceAddressHash;
    address evmWallet;
    bytes32 proofHash;
    bytes32 sourceTxHash;
    LegacyClaimType claimType;
    uint8 confidenceTier;
    uint256 lastSeenTimestamp;
    uint256 dormancySeconds;
    uint256 rewardAmount;
    uint256 campaignId;
}
```

### 10.3 Claim Status

```solidity
enum ClaimStatus {
    None,
    Pending,
    Verified,
    Minted,
    Rejected,
    Quarantined,
    Expired
}
```

### 10.4 Core Methods

```solidity
function submitLegacyClaim(
    LegacyClaim calldata claim,
    bytes calldata baalsAttestation
) external onlyDormancyOracle;

function submitZkDormancyClaim(
    bytes calldata groth16Proof,
    bytes calldata publicInputs,
    LegacyClaim calldata claim
) external;

function markClaimQuarantined(bytes32 claimId, string calldata reason)
    external onlyRole(RISK_MANAGER_ROLE);

function setClaimPolicy(bytes32 sourceChainId, ClaimPolicy calldata policy)
    external onlyRole(TIMELOCK_ROLE);

function setRewardController(address controller)
    external onlyRole(TIMELOCK_ROLE);
```

> [!IMPORTANT]
> `submitLegacyClaim` coexists alongside the existing `submitDormancyProof` function, which accepts individual parameters. A migration path is provided where existing dormancy proofs will be grandfathered, and new claims will use `submitLegacyClaim` targeting the `LegacyClaimRegistry`.
>
> `submitZkDormancyClaim` is the new endpoint for zkVM claims in the `LegacyClaimRegistry`. It acts as an upgrade path to the existing `verifyAndMint` function in `RewardDistributor`, which verified proof parameters and minted directly. In the new model, verification happens via `SP1DormancyVerifier` and registration happens in the `LegacyClaimRegistry`.

> [!IMPORTANT]
> **Cross-Chain Claim Flow**:
> Legacy claims are hub-only (submitted directly on the Arbitrum Sepolia/Arbitrum Mainnet hub) in Phase 1-3. Users can submit proofs from non-EVM chains directly to the hub. In Phase 4, spoke-chain claim submission can be introduced via CCIP/BaaLS relay if needed, but hub-only processing is preferred for gas efficiency and centralized risk management.

### 10.5 Custom Errors

```solidity
error ClaimAlreadyConsumed(bytes32 claimId);
error ProofAlreadyConsumed(bytes32 proofHash);
error ClaimQuarantinedError(bytes32 claimId);
error InvalidConfidenceTier(uint8 tier);
error RewardCapExceeded();
error CampaignInactive(uint256 campaignId);
error UnauthorizedOracle();
```

### 10.6 Claim Policy

```solidity
struct ClaimPolicy {
    bool enabled;
    bool transferToVaultEnabled;
    bool burnProofEnabled;
    bool lockProofEnabled;
    bool signatureProofEnabled;
    bool rpcEvidenceEnabled;
    bool explorerEvidenceEnabled;
    bool zkProofEnabled;
    uint256 minDormancySeconds;
    uint256 minHistoricalBalance;
    uint256 maxRewardPerClaim;
    uint256 maxRewardPerEpoch;
    uint8 minConfidenceTier;
}
```

> [!TIP]
> To reduce governance overhead, `LegacyClaimRegistry` implements a default `ClaimPolicy` that applies to all chains unless a specific per-chain override policy is explicitly configured by governance.

### 10.7 Contract Interaction Diagram

```text
+-----------------------+              +------------------------------+
|  LegacyClaimRegistry  | -----------> |   DormancyRewardController   |
+-----------------------+              +------------------------------+
            |                                         |
            | (calls verify/mint)                     | (verifies logic / caps)
            v                                         v
+-----------------------+              +------------------------------+
|     ProofConsumer     |              |      RewardDistributor       |
+-----------------------+              +------------------------------+
            | (if zkVM)                               ^
            v                                         | (mints rewards)
+-----------------------+                             |
|  SP1DormancyVerifier  | ----------------------------+
+-----------------------+
```

Role/Permission mapping:
- `MINTER_ROLE`: Held by `DormancyRewardController` to trigger minting in `RewardDistributor`.
- `DORMANCY_ORACLE_ROLE`: Authorized to submit claims via BaaLS.
- `RISK_MANAGER_ROLE`: Authorized to quarantine claims on-chain.

### 10.8 Qualitative Gas Cost Analysis

- **submitLegacyClaim (Struct-heavy, Phase 1+)**: Passes the full `LegacyClaim` struct plus the signature. This incurs higher calldata costs (estimated ~80k-120k gas depending on the number of non-zero fields).
- **submitDormancyProof (Legacy path)**: Passes individual arguments. Incurs lower initial calldata costs (~50k-70k gas) but lacks structured metadata tracking, auditability, and replay-protection flexibility.
- **submitZkDormancyClaim (zkVM path, Phase 4)**: Includes Groth16 verification. Verification costs ~200k-250k gas plus registry state updates.

---

## 11. ChronoNode Architecture

### 11.1 ChainEvidenceAdapter Trait

```rust
#[async_trait]
pub trait ChainEvidenceAdapter: Send + Sync {
    fn chain_id(&self) -> &str;
    fn source_type(&self) -> EvidenceSourceType;

    async fn latest_height(&self) -> Result<u64>;

    async fn get_address_activity(
        &self,
        address: &str,
    ) -> Result<AddressActivity>;

    async fn verify_ownership_signature(
        &self,
        address: &str,
        message: &str,
        signature: &str,
    ) -> Result<bool>;

    async fn verify_transfer_claim(
        &self,
        tx_hash: &str,
        expected_from: Option<&str>,
        expected_to: &str,
        min_amount: Option<u128>,
    ) -> Result<TransferEvidence>;

    async fn build_dormancy_evidence(
        &self,
        request: DormancyEvidenceRequest,
    ) -> Result<DormancyEvidence>;

    async fn verify_evidence(
        &self,
        evidence: &DormancyEvidence,
    ) -> Result<bool>;
}
```

> [!NOTE]
> `ChainEvidenceAdapter` does not replace `ChainAdapter`. Rather, `ChainEvidenceAdapter` is a higher-level, address-focused abstraction that layers on top of `ChainAdapter` (block-level) and an indexer, or wraps a Public RPC or Explorer API client directly:
> `ChainAdapter` (block-level) → indexer → `ChainEvidenceAdapter` (address-level)
> `PublicRpcClient` / `ExplorerApiClient` → `ChainEvidenceAdapter`

### 11.2 DormancyEvidence

```rust
pub struct DormancyEvidence {
    pub version: String,
    pub chain_id: String,
    pub source_type: EvidenceSourceType,
    pub source_count: u8,
    pub source_address_hash: String,
    pub evm_wallet: String,
    pub last_seen_tx: Option<String>,
    pub last_seen_block: Option<u64>,
    pub last_seen_timestamp: Option<u64>,
    pub current_height: u64,
    pub checked_at: u64,
    pub dormancy_seconds: u64,
    pub confidence_tier: u8,
    pub confidence_score: u8,
    pub evidence_hash: String,
    pub raw_evidence_pointer: Option<String>,
    pub zk_proof: Option<String>,
    pub public_inputs: Option<String>,
    pub attester_pubkey: String,
    pub attester_signature: String,
}
```

> [!IMPORTANT]
> `DormancyEvidence` is a superset wrapper containing the existing `DormancyProof` plus additional confidence metadata and evidence-source fields. It does not replace or break the existing `DormancyProof` type used throughout ChronoNode, BaaLS, and EVMSubmitter.

### 11.3 Adapter Selection

ChronoNode should select the strongest available adapter per chain:

```text
1. FullNodeAdapter
2. LightClientAdapter
3. PublicRpcAdapter
4. OfficialExplorerAdapter
5. MultiSourceAdapter
6. ManualReviewAdapter
```

For chains under a few GB:

```text
Prefer full node or archival node if software still runs.
Index watched addresses only.
Store compact evidence, not the whole chain.
```

For large chains:

```text
Use light adapter, public RPC, explorer API, or provider-specific historical API.
```

---

## 12. zkVM Integration

### 12.1 Status

ChronoNode Phase 7 introduced SP1 Groth16 zkVM proof mode for trustless dormancy verification.

Completed capabilities include:

```text
- SP1 guest program for DormancyCalculator.
- Rust proof generation in ChronoNode core.
- CLI command: chrononode prove --zkvm sp1 --address <addr>.
- HTTP endpoint for SP1 proof generation.
- DormancyProof extended with proof_type, zk_proof, and public_inputs.
- SP1DormancyVerifier contract for on-chain proof validation.
- RewardDistributor verifyAndMint integration.
- Replay prevention through proof hash tracking.
```

### 12.2 zkVM Dormancy Logic

The SP1 guest should verify:

```text
- block chain contiguity or evidence commitment validity
- no outbound transaction from target address inside dormancy window
- current block/height exceeds dormancy threshold
- public input commitment matches chain_id, address, height range, threshold, and claim target
```

### 12.3 zkVM Claim Flow

```text
User registers legacy address
-> ChronoNode builds proof input
-> SP1 guest verifies dormancy
-> Groth16 proof generated
-> SP1DormancyVerifier validates proof
-> RewardDistributor.verifyAndMint mints RESURGE
-> proof hash marked consumed
```

### 12.4 Mock vs Real Proof Mode

```text
Mock mode:
- used in tests and demos
- fast
- not mainnet acceptable

Real mode:
- uses built SP1 ELF
- generates real Groth16 proof
- slower
- required for trustless production path
```

---

## 13. BaaLS Attestation Registry

### 13.1 Attestation Fields

BaaLS should store:

```text
attestation_id
claim_id
source_chain_id
source_address_hash
evm_wallet
claim_type
confidence_tier
proof_hash
source_tx_hash
chrono_signature
baals_tx_hash
evm_tx_hash
status
created_at
submitted_at
error
```

### 13.2 Attestation API

Recommended endpoints:

```text
POST /api/v1/oracle/attest
GET  /api/v1/oracle/attestations/{chain}/{address}
GET  /api/v1/oracle/attestations?status=pending
GET  /api/v1/oracle/claims/{claim_id}
POST /api/v1/oracle/claims/{claim_id}/retry
```

### 13.3 EVMSubmitter

EVMSubmitter should support:

```text
- submit trusted attestation claims
- submit SP1 verifyAndMint transactions
- retry failed submissions
- persist tx status
- expose tx lifecycle to explorer
- avoid duplicate tx submission for same claim id
```

---

## 14. User Flows

### 14.1 ERC-20 Dead Token Staking

```text
1. User connects EVM wallet.
2. User selects supported dead token pool.
3. User approves token.
4. User stakes token.
5. Rewards accrue.
6. User claims or restakes RESURGE.
```

### 14.2 Transfer-to-Vault Claim

```text
1. User connects EVM wallet.
2. User selects legacy chain.
3. UI shows vault/deposit address and instructions.
4. User sends legacy coin.
5. User submits tx hash or ChronoNode auto-detects.
6. ChronoNode verifies deposit.
7. BaaLS records attestation.
8. Resurgence mints reward.
```

### 14.3 Burn Proof Claim

```text
1. User selects legacy chain.
2. UI shows approved burn address.
3. User sends legacy coin to burn address.
4. ChronoNode verifies tx.
5. Claim reward is calculated at high confidence.
6. BaaLS/Resurgence process claim.
```

### 14.4 Signature Dormancy Claim

```text
1. User connects EVM wallet.
2. User enters legacy address.
3. UI generates challenge message.
4. User signs message with legacy wallet.
5. ChronoNode verifies signature.
6. ChronoNode scans last activity.
7. Proof is submitted through BaaLS.
8. Resurgence mints lower-tier reward.
```

### 14.5 zkVM Claim

```text
1. User enters address and target EVM wallet.
2. ChronoNode builds SP1 proof input.
3. ChronoNode generates proof.
4. User or submitter sends proof to SP1 verifier / RewardDistributor.
5. RESURGE mints after on-chain proof validation.
```

---

## 15. Frontend Requirements

### 15.1 New Page

```text
/non-evm-claims
```

### 15.2 Claim Wizard

Steps:

```text
1. Connect EVM wallet.
2. Select claim mode (split into mode-specific flows to simplify UX rather than a single complex wizard):
   - Stake ERC-20 (EVM dead tokens)
   - Send/Burn/Lock legacy coin (native transfer/burn/lock proof flow)
   - Prove dormant wallet (signature-only challenge or zkVM proof flow)
3. Select chain/project.
4. Enter address or tx hash.
5. Complete ownership proof or transfer proof.
6. Scan and verify.
7. Submit claim.
8. Track status.
```

### 15.3 Status Timeline

Display:

```text
Address submitted
Ownership verified
Evidence scanned
Dormancy verified
ChronoNode proof generated
BaaLS attestation stored
EVM submission sent
RESURGE minted
```

### 15.4 Confidence Badge

Display one of:

```text
Strong — transfer/burn/lock backed
Strong — zkVM verified
Medium — signature + full/light node
Medium — signature + public RPC
Low — explorer evidence
Manual — not eligible for automatic mint
```

---

## 16. Explorer Requirements

### 16.1 Resurgence Protocol Explorer

Add/extend:

```text
/resurgence/claims (extend existing)
/resurgence/oracle/proofs (extend existing)
/resurgence/legacy-claims
/resurgence/legacy-claims/:claim_id
/resurgence/non-evm
/resurgence/proofs/:proof_hash
```

> [!NOTE]
> **Route Migration**: The explorer should reuse the existing `/resurgence/claims` and `/resurgence/oracle/proofs` routes where possible, extending them with query parameters or tabs rather than introducing completely new routes that break existing bookmarks.

Show:

```text
claim type
source chain
source address hash
EVM wallet
confidence tier
reward amount
claim status
ChronoNode proof link
BaaLS attestation link
EVM tx link
replay protection status
```

### 16.2 ChronoNode Proof Explorer

Show:

```text
adapter type
source evidence
last seen tx
last seen timestamp
dormancy window
proof type
SP1 proof status
checkpoint anchor
raw evidence pointer
```

### 16.3 BaaLS Explorer

Show:

```text
oracle attestation
EVMSubmitter status
linked Resurgence claim
proof hash
submitter tx
```

---

## 17. Security and Anti-Fraud

### 17.1 Non-Negotiable Rules

```text
Never ask for seed phrases.
Never ask for private keys.
Never ask for wallet.dat uploads in automatic flow.
Only request signed messages, public addresses, or transaction hashes.
```

### 17.2 Fraud Controls

```text
- one claim per source address per campaign
- one proof hash consumed once
- one source tx hash consumed once
- per-chain reward caps
- per-user reward caps
- confidence-tier caps
- minimum balance/activity thresholds
- source blacklist
- exchange/hot-wallet detection (handled off-chain via BaaLS-side/ChronoNode-side blocklist)
- dust-farming detection
- manual quarantine
- emergency pause
- per-claim-type submission frequency caps and per-epoch rate limits on-chain
```

### 17.3 Risk Flags

Quarantine when:

```text
- source is explorer-only and large reward requested
- address belongs to known exchange/hot wallet (checked off-chain)
- many claims map to same EVM wallet
- recent funding looks like claim farming
- source API returns inconsistent results
- multiple evidence sources disagree
```

---

## 18. Privacy

For public display, prefer:

```text
source_address_hash
partial address display
proof hash
claim id
chain id
status
```

Only show full source address if the user opts in or the chain data is already unavoidably public in the claim process.

---

## 19. Storage Strategy

### 19.1 Store Compact Evidence

Store:

```text
address hash
last seen tx
block height
timestamp
evidence source
proof hash
confidence tier
raw evidence pointer
status
```

Avoid storing:

```text
full chain data for large networks
entire transaction history unless needed
private metadata
API keys
raw proof blobs in EVM contracts
```

### 19.2 Archive Pointers

Raw evidence should be optionally stored in:

```text
local_fs
IPFS
Pinata
Arweave/Irys
S3-compatible object storage
```

ChronoNode should keep compact database rows and content-addressed pointers.

---

## 20. Data Model Sketch

### 20.1 claims

```sql
CREATE TABLE legacy_claims (
    claim_id TEXT PRIMARY KEY,
    source_chain_id TEXT NOT NULL,
    source_address_hash TEXT NOT NULL,
    evm_wallet TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    confidence_tier INTEGER NOT NULL,
    proof_hash TEXT NOT NULL,
    source_tx_hash TEXT,
    reward_amount TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX idx_legacy_claims_lookup ON legacy_claims (source_chain_id, source_address_hash);
CREATE INDEX idx_legacy_claims_wallet ON legacy_claims (evm_wallet);
CREATE INDEX idx_legacy_claims_status ON legacy_claims (status);
```

### 20.2 evidence_records

```sql
CREATE TABLE evidence_records (
    evidence_hash TEXT PRIMARY KEY,
    claim_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    last_seen_tx TEXT,
    last_seen_block INTEGER,
    last_seen_timestamp INTEGER,
    current_height INTEGER,
    raw_evidence_pointer TEXT,
    zk_proof_pointer TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_evidence_records_claim ON evidence_records (claim_id);
```

### 20.3 claim_events

```sql
CREATE TABLE claim_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    tx_hash TEXT,
    message TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_claim_events_claim ON claim_events (claim_id);
```

---

## 21. Operations and Logging

Emit ecosystem events for:

```text
legacy_claim_created
ownership_signature_verified
transfer_claim_detected
burn_claim_detected
dormancy_evidence_created
sp1_proof_generated
baals_attestation_submitted
evm_submitter_tx_sent
evm_submitter_tx_confirmed
resurge_reward_minted
claim_quarantined
claim_rejected
```

Every event should include:

```text
correlation_id
claim_id
proof_hash
source_chain_id
evm_wallet
status
```

---

## 22. Testing Matrix

### 22.1 Unit Tests

```text
claim_id deterministic hash
reward formula caps
confidence multiplier
dormancy multiplier
claim policy validation
source address hashing
signature challenge generation
```

### 22.2 ChronoNode Tests

```text
full node evidence adapter
public RPC adapter
explorer adapter
multi-source conflict handling
dormancy detection
SP1 mock proof generation
SP1 real proof generation
checkpoint anchor lookup
attestation submission
```

### 22.3 BaaLS Tests

```text
oracle attestation POST
duplicate claim rejection
EVMSubmitter retry
EVMSubmitter duplicate prevention
attestation status query
failure status persistence
```

### 22.4 Resurgence Tests

```text
submitLegacyClaim authorization
claim replay rejection
proof replay rejection
per-chain caps
per-wallet caps
reward cap enforcement
pause behavior
quarantine behavior
SP1 verifyAndMint success
SP1 replay rejection
```

### 22.5 End-to-End Tests

```text
BTC/DOGE signature dormancy claim
transfer-backed legacy claim
burn proof claim
explorer-only low-confidence claim
SP1 zkVM proof claim
failed/replayed claim
quarantined suspicious claim
```

---

## 23. Deployment Phases

### Phase 1 — Current Pipeline Hardening

```text
- BTC/DOGE dormant wallet claims.
- ChronoNode evidence generation.
- BaaLS attestation.
- EVMSubmitter to Resurgence.
- Protocol explorer timeline.
- Deploy LegacyClaimRegistry (empty, upgradeable, with ClaimStatus tracking).
- Add LegacyClaimType enum to contracts.
- Migrate existing submitDormancyProof() claims to new registry.
- Add EvidenceSourceType enum to ChronoNode.
- Add confidence_tier field to DormancyProof (backward-compatible).
- Define campaign_id = 0 as "genesis campaign".
- Add LegacyClaimRegistry event tracking to subgraph (LegacyClaimSubmitted, ClaimQuarantined, ClaimMinted).
```

### Phase 2 — Transfer/Burn Claims

```text
- Add chain-level vault/burn address registry.
- Add ChronoNode transfer verification.
- Add reward boost for transfer/burn evidence.
- Add UI claim wizard mode.
- Deprecate and deactivate legacy submitDormancyProof() path.
- Add transfer/burn event tracking to subgraph.
```

### Phase 3 — Multi-Source Evidence Adapters

```text
- PublicRpcAdapter.
- OfficialExplorerAdapter.
- MultiSourceAdapter.
- Confidence score engine.
```

### Phase 4 — SP1 zkVM Production Path

```text
- Use real SP1 proofs for eligible chains.
- Deploy SP1DormancyVerifier.
- Add verifyAndMint path.
- Gradually reduce reliance on trusted DORMANCY_ORACLE_ROLE.
```

### Phase 5 — CanvasContracts Policy Builder

```text
- Define visual reward policy nodes.
- Compile policy graph to BaaLS WASM.
- Archive policy manifests with ChronoNode.
- Govern policy updates through Resurgence DAO.
```

---

## 24. Mainnet Readiness Checklist

Before mainnet value:

```text
- external audit of Resurgence contracts
- external audit of SP1 guest program
- audit SP1DormancyVerifier
- audit RewardDistributor verifyAndMint
- audit BaaLS EVMSubmitter path
- proof replay tests
- reward cap tests
- source adapter trust docs
- emergency pause runbook
- key rotation runbook
- public proof explorer
- bug bounty
```

---

## 25. Recommended Initial Supported Modes

For the first public testnet version:

```text
1. ERC-20 dead token staking.
2. BTC dormant wallet proof.
3. DOGE dormant wallet proof.
4. SP1 mock-mode proof demo.
5. One transfer-backed test chain or Dogecoin test claim.
```

Avoid early support for:

```text
- screenshot-only claims
- exchange account claims
- private database imports
- unsupported chains with no reliable evidence
- high-value explorer-only rewards
```

---

## 26. Final Positioning

This feature transforms Resurgence into:

```text
A dormant-value revival protocol.
```

It supports:

```text
- dead ERC-20 staking
- native legacy coin deposit/burn/lock claims
- dormant wallet proof claims
- public RPC / official explorer evidence claims
- SP1 zkVM cryptographic dormancy proofs
```

The combined ecosystem becomes:

```text
ChronoNode proves dormant history.
BaaLS records and relays attestations.
Resurgence mints governed rewards.
CanvasContracts later visualizes and compiles policy logic.
```

That is a stronger and more unique protocol identity than a normal staking app.

---

## 27. Migration Strategy for Existing Claims

To ensure backward compatibility and project continuity, existing claims processed through the legacy `submitDormancyProof()` path will be migrated to the new `LegacyClaimRegistry`.
- **Grandfathering**: Legacy proofs will remain valid. A script will scrape the subgraph / contract state for historical mints and populate the `consumedClaims` and `consumedProofs` mappings in `LegacyClaimRegistry` to prevent double-claiming.
- **Coexistence**: During Phase 1, both paths will be supported on-chain. In Phase 2, the legacy path will be deprecated and deactivated.
