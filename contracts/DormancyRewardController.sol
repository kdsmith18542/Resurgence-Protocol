// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./LegacyClaimRegistry.sol";

interface IRewardDistributor {
    function mintAndDistribute(address _to, uint256 _amount) external returns (bool);
    function sp1DormancyVerifier() external view returns (address);
}

interface ISP1DormancyVerifier {
    function verifyDormancyProof(
        bytes calldata proof,
        bytes calldata publicInputs,
        bytes32 chainId,
        string calldata walletAddress,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks
    ) external returns (bytes32);
}

/// @title DormancyRewardController
/// @notice Implements reward validation, epoch cap management, and zkVM verification logic.
contract DormancyRewardController is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    // State Variables
    address public registry;
    IRewardDistributor public distributor;

    uint256 public epochStart;
    uint256 public epochDuration;
    uint256 public currentEpochIndex;

    uint256 public maxRewardPerWalletPerEpoch;
    uint256 public maxRewardPerChainPerEpoch;

    // Epoch index => Wallet => Amount
    mapping(uint256 => mapping(address => uint256)) public walletEpochMinted;
    // Epoch index => ChainId => Amount
    mapping(uint256 => mapping(bytes32 => uint256)) public chainEpochMinted;

    // Custom Errors
    error DormancyRewardController_OnlyRegistry();
    error DormancyRewardController_UserCapExceeded();
    error DormancyRewardController_ChainCapExceeded();
    error DormancyRewardController_InvalidAddress();
    error DormancyRewardController_AddressMismatch();
    error DormancyRewardController_ProofHashMismatch();
    error DormancyRewardController_VerifierNotSet();

    // Events
    event EpochReset(uint256 indexed newEpochIndex, uint256 newEpochStart);
    event LimitsUpdated(uint256 maxPerWallet, uint256 maxPerChain);
    event RegistryUpdated(address indexed newRegistry);
    event DistributorUpdated(address indexed newDistributor);

    modifier onlyRegistry() {
        if (msg.sender != registry) revert DormancyRewardController_OnlyRegistry();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _registry,
        address _distributor,
        address _timelock
    ) public initializer {
        if (_registry == address(0) || _distributor == address(0) || _timelock == address(0)) {
            revert DormancyRewardController_InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        registry = _registry;
        distributor = IRewardDistributor(_distributor);
        emit RegistryUpdated(_registry);
        emit DistributorUpdated(_distributor);

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);

        // Grant temporary roles to deployer for setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);

        epochStart = block.timestamp;
        epochDuration = 7 days;
        maxRewardPerWalletPerEpoch = 100000 * 10**18; // 100k RESURGE
        maxRewardPerChainPerEpoch = 1000000 * 10**18; // 1M RESURGE
    }

    /// @notice Resets epoch if duration has passed
    function _checkAndResetEpoch() internal {
        if (block.timestamp >= epochStart + epochDuration) {
            epochStart = block.timestamp;
            currentEpochIndex++;
            emit EpochReset(currentEpochIndex, epochStart);
        }
    }

    /// @notice Validates reward amount with confidence multiplier applied
    function calculateAndVerifyReward(
        LegacyClaimRegistry.LegacyClaim calldata claim
    ) external view returns (uint256) {
        uint256 multiplier = getConfidenceMultiplier(claim.claimType);
        return (claim.rewardAmount * multiplier) / 100;
    }

    /// @notice Returns the confidence multiplier for a given claim type (basis points, 10000 = 1.00x)
    function getConfidenceMultiplier(
        LegacyClaimRegistry.LegacyClaimType claimType
    ) public pure returns (uint256) {
        if (claimType == LegacyClaimRegistry.LegacyClaimType.TransferToVault) {
            return 100;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.BurnProof) {
            return 110;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.LockProof) {
            return 90;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.ZkDormancyProof) {
            return 100;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.SignatureDormancyProof) {
            return 80;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.PublicRpcEvidenceProof) {
            return 60;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.ExplorerEvidenceProof) {
            return 40;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.MultiSourceEvidenceProof) {
            return 70;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.ManualReview) {
            return 0;
        }
        if (claimType == LegacyClaimRegistry.LegacyClaimType.ERC20Stake) {
            return 100;
        }
        return 50;
    }

    /// @notice Verifies SP1 Groth16 proof using the system verifier
    function verifyZkProof(
        bytes calldata proof,
        bytes calldata publicInputs,
        string calldata walletAddress,
        uint64 dormantSinceBlock,
        uint64 currentBlock,
        uint64 thresholdBlocks,
        LegacyClaimRegistry.LegacyClaim calldata claim
    ) external onlyRegistry {
        if (keccak256(abi.encodePacked(walletAddress)) != claim.sourceAddressHash) {
            revert DormancyRewardController_AddressMismatch();
        }

        bytes32 calculatedProofHash = keccak256(
            abi.encodePacked(
                claim.sourceChainId,
                walletAddress,
                dormantSinceBlock,
                currentBlock,
                thresholdBlocks
            )
        );

        if (calculatedProofHash != claim.proofHash) {
            revert DormancyRewardController_ProofHashMismatch();
        }

        address verifierAddress = distributor.sp1DormancyVerifier();
        if (verifierAddress == address(0)) revert DormancyRewardController_VerifierNotSet();

        bytes32 returnedProofHash = ISP1DormancyVerifier(verifierAddress).verifyDormancyProof(
            proof,
            publicInputs,
            claim.sourceChainId,
            walletAddress,
            dormantSinceBlock,
            currentBlock,
            thresholdBlocks
        );

        if (returnedProofHash != claim.proofHash) {
            revert DormancyRewardController_ProofHashMismatch();
        }
    }

    /// @notice Mints reward while enforcing epoch caps
    function mintReward(
        address user,
        uint256 amount,
        bytes32 sourceChainId
    ) external onlyRegistry whenNotPaused {
        _checkAndResetEpoch();

        uint256 newWalletMinted = walletEpochMinted[currentEpochIndex][user] + amount;
        if (newWalletMinted > maxRewardPerWalletPerEpoch) revert DormancyRewardController_UserCapExceeded();

        uint256 newChainMinted = chainEpochMinted[currentEpochIndex][sourceChainId] + amount;
        if (newChainMinted > maxRewardPerChainPerEpoch) revert DormancyRewardController_ChainCapExceeded();

        walletEpochMinted[currentEpochIndex][user] = newWalletMinted;
        chainEpochMinted[currentEpochIndex][sourceChainId] = newChainMinted;

        bool success = distributor.mintAndDistribute(user, amount);
        require(success, "Mint failed");
    }

    // Governance functions
    function setEpochDuration(uint256 duration) external onlyRole(TIMELOCK_ROLE) {
        epochDuration = duration;
    }

    function setMaxRewardPerWalletPerEpoch(uint256 limit) external onlyRole(TIMELOCK_ROLE) {
        maxRewardPerWalletPerEpoch = limit;
        emit LimitsUpdated(maxRewardPerWalletPerEpoch, maxRewardPerChainPerEpoch);
    }

    function setMaxRewardPerChainPerEpoch(uint256 limit) external onlyRole(TIMELOCK_ROLE) {
        maxRewardPerChainPerEpoch = limit;
        emit LimitsUpdated(maxRewardPerWalletPerEpoch, maxRewardPerChainPerEpoch);
    }

    function setRegistry(address _registry) external onlyRole(TIMELOCK_ROLE) {
        if (_registry == address(0)) revert DormancyRewardController_InvalidAddress();
        registry = _registry;
        emit RegistryUpdated(_registry);
    }

    function setDistributor(address _distributor) external onlyRole(TIMELOCK_ROLE) {
        if (_distributor == address(0)) revert DormancyRewardController_InvalidAddress();
        distributor = IRewardDistributor(_distributor);
        emit DistributorUpdated(_distributor);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}
}
