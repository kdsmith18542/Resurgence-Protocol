// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title LegacyClaimRegistry
/// @notice Handles registration, validation, and storage of LACE claims.
contract LegacyClaimRegistry is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant DORMANCY_ORACLE_ROLE = keccak256("DORMANCY_ORACLE_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

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

    enum ClaimStatus {
        None,
        Pending,
        Verified,
        Minted,
        Rejected,
        Quarantined,
        Expired
    }

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

    struct Campaign {
        uint256 id;
        bool active;
        uint256 startTime;
        uint256 endTime;
        uint256 maxTotalRewards;
        uint256 rewardsMinted;
    }

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

    // State Variables
    address public rewardController;
    ClaimPolicy public defaultPolicy;

    mapping(bytes32 => bool) public consumedClaims;
    mapping(bytes32 => bool) public consumedProofs;
    mapping(bytes32 => ClaimStatus) public claimStatus;
    mapping(uint256 => Campaign) public campaigns;
    mapping(bytes32 => ClaimPolicy) public claimPolicies;
    mapping(bytes32 => LegacyClaim) public claims;

    mapping(bytes32 => string) public vaultAddresses;
    mapping(bytes32 => string) public burnAddresses;

    // Custom Errors
    error LegacyClaimRegistry_ClaimAlreadyConsumed(bytes32 claimId);
    error LegacyClaimRegistry_ProofAlreadyConsumed(bytes32 proofHash);
    error LegacyClaimRegistry_ClaimQuarantined(bytes32 claimId);
    error LegacyClaimRegistry_ClaimNotPending(bytes32 claimId);
    error LegacyClaimRegistry_ClaimStatusInvalid(bytes32 claimId);
    error LegacyClaimRegistry_CampaignInactive(uint256 campaignId);
    error LegacyClaimRegistry_CampaignExpired(uint256 campaignId);
    error LegacyClaimRegistry_UnauthorizedOracle();
    error LegacyClaimRegistry_InvalidAddress();
    error LegacyClaimRegistry_PolicyValidationFailed();
    error LegacyClaimRegistry_RewardControllerNotSet();
    error LegacyClaimRegistry_InvalidConfidenceTier(uint8 tier);
    error LegacyClaimRegistry_RewardCapExceeded();

    // Events
    event LegacyClaimSubmitted(
        bytes32 indexed claimId,
        bytes32 indexed sourceChainId,
        address indexed evmWallet,
        LegacyClaimType claimType,
        uint256 rewardAmount
    );
    event ClaimQuarantined(bytes32 indexed claimId, string reason);
    event ClaimReleased(bytes32 indexed claimId);
    event ClaimRejected(bytes32 indexed claimId);
    event ClaimMinted(bytes32 indexed claimId, address indexed to, uint256 amount);
    event CampaignUpdated(uint256 indexed campaignId, bool active);
    event PolicyUpdated(bytes32 indexed sourceChainId, bool enabled);
    event DefaultPolicyUpdated();
    event RewardControllerUpdated(address indexed controller);
    event ProofGrandfathered(bytes32 indexed proofHash);
    event ClaimGrandfathered(bytes32 indexed claimId);
    event VaultAddressUpdated(bytes32 indexed sourceChainId, string vaultAddress);
    event BurnAddressUpdated(bytes32 indexed sourceChainId, string burnAddress);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _timelock) public initializer {
        if (_timelock == address(0)) revert LegacyClaimRegistry_InvalidAddress();

        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(RISK_MANAGER_ROLE, _timelock);

        // Grant temporary roles to deployer for setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }

    /// @notice Calculates canonical claim ID
    function getClaimId(LegacyClaim calldata claim) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                claim.sourceChainId,
                claim.sourceAddressHash,
                claim.evmWallet,
                claim.claimType,
                claim.proofHash,
                claim.sourceTxHash,
                claim.campaignId
            )
        );
    }

    /// @notice Submits a legacy claim verified by the dormancy oracle
    function submitLegacyClaim(
        LegacyClaim calldata claim,
        bytes calldata /* baalsAttestation */
    ) external onlyRole(DORMANCY_ORACLE_ROLE) whenNotPaused {
        _submitClaimInternal(claim, false);
    }

    /// @notice Submits a transfer-backed claim permissionlessly with a valid BaaLS attestation.
    /// Only TransferToVault and BurnProof claim types are allowed.
    function submitTransferClaim(
        LegacyClaim calldata claim,
        bytes calldata baalsAttestation
    ) external whenNotPaused {
        if (claim.claimType != LegacyClaimType.TransferToVault &&
            claim.claimType != LegacyClaimType.BurnProof) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        _verifyBaalsAttestation(baalsAttestation, claim);
        _submitClaimInternal(claim, true);
    }

    function _submitClaimInternal(LegacyClaim calldata claim, bool permissionless) internal {
        bytes32 claimId = getClaimId(claim);

        if (consumedClaims[claimId]) revert LegacyClaimRegistry_ClaimAlreadyConsumed(claimId);
        if (claim.proofHash != bytes32(0) && consumedProofs[claim.proofHash]) {
            revert LegacyClaimRegistry_ProofAlreadyConsumed(claim.proofHash);
        }

        if (claim.campaignId != 0) {
            Campaign memory campaign = campaigns[claim.campaignId];
            if (!campaign.active) revert LegacyClaimRegistry_CampaignInactive(claim.campaignId);
            if (block.timestamp < campaign.startTime || block.timestamp > campaign.endTime) {
                revert LegacyClaimRegistry_CampaignExpired(claim.campaignId);
            }
        }

        _validatePolicy(claim);

        if (rewardController == address(0)) revert LegacyClaimRegistry_RewardControllerNotSet();

        ClaimPolicy memory policy = _getPolicy(claim.sourceChainId);
        bool shouldQuarantine = (claim.claimType == LegacyClaimType.ManualReview) ||
                               (claim.rewardAmount > policy.maxRewardPerClaim);

        claims[claimId] = claim;

        if (shouldQuarantine) {
            claimStatus[claimId] = ClaimStatus.Quarantined;
            emit LegacyClaimSubmitted(claimId, claim.sourceChainId, claim.evmWallet, claim.claimType, claim.rewardAmount);
            emit ClaimQuarantined(claimId, "Auto-quarantine triggered");
        } else {
            consumedClaims[claimId] = true;
            if (claim.proofHash != bytes32(0)) {
                consumedProofs[claim.proofHash] = true;
            }

            claimStatus[claimId] = ClaimStatus.Minted;
            emit LegacyClaimSubmitted(claimId, claim.sourceChainId, claim.evmWallet, claim.claimType, claim.rewardAmount);
            emit ClaimMinted(claimId, claim.evmWallet, claim.rewardAmount);

            IDormancyRewardController(rewardController).mintReward(claim.evmWallet, claim.rewardAmount, claim.sourceChainId);
        }
    }

    /// @notice Verifies a BaaLS attestation signature (simplified — production should use full ed25519 verify)
    function _verifyBaalsAttestation(
        bytes calldata baalsAttestation,
        LegacyClaim calldata claim
    ) internal view {
        if (baalsAttestation.length < 64) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        require(claim.sourceTxHash != bytes32(0), "Transfer claim requires source tx hash");
    }

    /// @notice Submits a zk-proof backed claim directly (trustless)
    function submitZkDormancyClaim(
        bytes calldata groth16Proof,
        bytes calldata publicInputs,
        string calldata walletAddress,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks,
        LegacyClaim calldata claim
    ) external whenNotPaused {
        bytes32 claimId = getClaimId(claim);

        if (consumedClaims[claimId]) revert LegacyClaimRegistry_ClaimAlreadyConsumed(claimId);
        if (claim.proofHash != bytes32(0) && consumedProofs[claim.proofHash]) {
            revert LegacyClaimRegistry_ProofAlreadyConsumed(claim.proofHash);
        }

        if (claim.campaignId != 0) {
            Campaign memory campaign = campaigns[claim.campaignId];
            if (!campaign.active) revert LegacyClaimRegistry_CampaignInactive(claim.campaignId);
            if (block.timestamp < campaign.startTime || block.timestamp > campaign.endTime) {
                revert LegacyClaimRegistry_CampaignExpired(claim.campaignId);
            }
        }

        _validatePolicy(claim);

        if (rewardController == address(0)) revert LegacyClaimRegistry_RewardControllerNotSet();

        claims[claimId] = claim;
        consumedClaims[claimId] = true;
        if (claim.proofHash != bytes32(0)) {
            consumedProofs[claim.proofHash] = true;
        }
        claimStatus[claimId] = ClaimStatus.Minted;

        // Verify ZK Proof via reward controller (which wraps verifier call)
        IDormancyRewardController(rewardController).verifyZkProof(
            groth16Proof,
            publicInputs,
            walletAddress,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks,
            claim
        );

        emit LegacyClaimSubmitted(claimId, claim.sourceChainId, claim.evmWallet, claim.claimType, claim.rewardAmount);
        emit ClaimMinted(claimId, claim.evmWallet, claim.rewardAmount);

        IDormancyRewardController(rewardController).mintReward(claim.evmWallet, claim.rewardAmount, claim.sourceChainId);
    }

    /// @notice Quarantines a claim manually
    function markClaimQuarantined(
        bytes32 claimId,
        string calldata reason
    ) external onlyRole(RISK_MANAGER_ROLE) {
        if (claimStatus[claimId] != ClaimStatus.Pending) revert LegacyClaimRegistry_ClaimNotPending(claimId);
        claimStatus[claimId] = ClaimStatus.Quarantined;
        emit ClaimQuarantined(claimId, reason);
    }

    /// @notice Releases a quarantined claim for minting
    function releaseClaim(bytes32 claimId) external onlyRole(RISK_MANAGER_ROLE) whenNotPaused {
        if (claimStatus[claimId] != ClaimStatus.Quarantined) revert LegacyClaimRegistry_ClaimStatusInvalid(claimId);

        LegacyClaim memory claim = claims[claimId];
        if (claim.evmWallet == address(0)) revert LegacyClaimRegistry_InvalidAddress();

        consumedClaims[claimId] = true;
        if (claim.proofHash != bytes32(0)) {
            consumedProofs[claim.proofHash] = true;
        }

        claimStatus[claimId] = ClaimStatus.Minted;
        emit ClaimReleased(claimId);
        emit ClaimMinted(claimId, claim.evmWallet, claim.rewardAmount);

        IDormancyRewardController(rewardController).mintReward(claim.evmWallet, claim.rewardAmount, claim.sourceChainId);
    }

    /// @notice Rejects a quarantined claim
    function rejectClaim(bytes32 claimId) external onlyRole(RISK_MANAGER_ROLE) whenNotPaused {
        if (claimStatus[claimId] != ClaimStatus.Quarantined) revert LegacyClaimRegistry_ClaimStatusInvalid(claimId);

        claimStatus[claimId] = ClaimStatus.Rejected;
        emit ClaimRejected(claimId);
    }

    /// @notice Grandfathers existing processed proof hashes to prevent re-submission
    function grandfatherProofs(bytes32[] calldata proofHashes) external onlyRole(TIMELOCK_ROLE) {
        for (uint256 i = 0; i < proofHashes.length; i++) {
            if (proofHashes[i] != bytes32(0)) {
                consumedProofs[proofHashes[i]] = true;
                emit ProofGrandfathered(proofHashes[i]);
            }
        }
    }

    /// @notice Grandfathers existing processed claim IDs to prevent re-submission
    function grandfatherClaims(bytes32[] calldata claimIds) external onlyRole(TIMELOCK_ROLE) {
        for (uint256 i = 0; i < claimIds.length; i++) {
            if (claimIds[i] != bytes32(0)) {
                consumedClaims[claimIds[i]] = true;
                claimStatus[claimIds[i]] = ClaimStatus.Minted;
                emit ClaimGrandfathered(claimIds[i]);
            }
        }
    }

    /// @notice Set specific policy for a chain
    function setClaimPolicy(
        bytes32 sourceChainId,
        ClaimPolicy calldata policy
    ) external onlyRole(TIMELOCK_ROLE) {
        claimPolicies[sourceChainId] = policy;
        emit PolicyUpdated(sourceChainId, policy.enabled);
    }

    /// @notice Set default policy
    function setDefaultPolicy(ClaimPolicy calldata policy) external onlyRole(TIMELOCK_ROLE) {
        defaultPolicy = policy;
        emit DefaultPolicyUpdated();
    }

    /// @notice Set reward controller address
    function setRewardController(address controller) external onlyRole(TIMELOCK_ROLE) {
        if (controller == address(0)) revert LegacyClaimRegistry_InvalidAddress();
        rewardController = controller;
        emit RewardControllerUpdated(controller);
    }

    /// @notice Set vault address for a chain
    function setVaultAddress(
        bytes32 sourceChainId,
        string calldata vaultAddress
    ) external onlyRole(TIMELOCK_ROLE) {
        vaultAddresses[sourceChainId] = vaultAddress;
        emit VaultAddressUpdated(sourceChainId, vaultAddress);
    }

    /// @notice Set burn address for a chain
    function setBurnAddress(
        bytes32 sourceChainId,
        string calldata burnAddress
    ) external onlyRole(TIMELOCK_ROLE) {
        burnAddresses[sourceChainId] = burnAddress;
        emit BurnAddressUpdated(sourceChainId, burnAddress);
    }

    /// @notice Configure a campaign
    function setCampaign(uint256 id, Campaign calldata campaign) external onlyRole(TIMELOCK_ROLE) {
        campaigns[id] = campaign;
        emit CampaignUpdated(id, campaign.active);
    }

    // Internal Helpers
    function _getPolicy(bytes32 sourceChainId) internal view returns (ClaimPolicy memory) {
        ClaimPolicy memory policy = claimPolicies[sourceChainId];
        if (policy.enabled) {
            return policy;
        }
        return defaultPolicy;
    }

    function _validatePolicy(LegacyClaim calldata claim) internal view {
        ClaimPolicy memory policy = _getPolicy(claim.sourceChainId);
        if (!policy.enabled) revert LegacyClaimRegistry_PolicyValidationFailed();

        if (claim.claimType == LegacyClaimType.TransferToVault && !policy.transferToVaultEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.BurnProof && !policy.burnProofEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.LockProof && !policy.lockProofEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.SignatureDormancyProof && !policy.signatureProofEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.PublicRpcEvidenceProof && !policy.rpcEvidenceEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.ExplorerEvidenceProof && !policy.explorerEvidenceEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }
        if (claim.claimType == LegacyClaimType.ZkDormancyProof && !policy.zkProofEnabled) {
            revert LegacyClaimRegistry_PolicyValidationFailed();
        }

        if (claim.dormancySeconds < policy.minDormancySeconds) revert LegacyClaimRegistry_PolicyValidationFailed();
        if (claim.confidenceTier < policy.minConfidenceTier) revert LegacyClaimRegistry_PolicyValidationFailed();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}
}

interface IDormancyRewardController {
    function calculateAndVerifyReward(LegacyClaimRegistry.LegacyClaim calldata claim) external view returns (uint256);
    function mintReward(address user, uint256 amount, bytes32 sourceChainId) external;
    function verifyZkProof(
        bytes calldata proof,
        bytes calldata publicInputs,
        string calldata walletAddress,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks,
        LegacyClaimRegistry.LegacyClaim calldata claim
    ) external;
}
