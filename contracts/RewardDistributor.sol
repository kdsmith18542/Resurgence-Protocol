// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ResurgeToken.sol";

interface IPriceOracle {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/// @title RewardDistributor - Manages the minting and distribution of RESURGE rewards
/// @notice This contract is authorized to mint RESURGE tokens and is called by staking pools
/// @dev Implements AccessControl for management and Pausable for emergencies. UUPS Upgradeable.
contract RewardDistributor is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant DORMANCY_ORACLE_ROLE = keccak256("DORMANCY_ORACLE_ROLE");
    
    /// @notice Custom errors for gas efficiency
    error RewardDistributor_UnauthorizedPool();
    error RewardDistributor_UnauthorizedBridge();
    error RewardDistributor_ExceedsMaxSupply();
    error RewardDistributor_InvalidAddress();
    error RewardDistributor_SupplyTooLow();
    error RewardDistributor_OracleStale();
    error RewardDistributor_OracleNotSet();
    error RewardDistributor_ProofAlreadyProcessed();
    error RewardDistributor_InvalidProofData();

    ResurgeToken public resurgenceToken;
    uint256 public totalResurgeMinted;
    uint256 public maxMintSupply;
    mapping(address => bool) public authorizedStakingPools;
    mapping(address => bool) public authorizedBridges;

    // Oracle configuration
    IPriceOracle public priceOracle;
    uint256 public oracleStaleThreshold;
    uint256 public oracleLastUpdate;
    uint256 public oracleLastPrice;
    bool public oracleEnabled;
    address public fallbackPriceAddress;

    // Non-EVM dormancy oracle (Phase 11)
    mapping(bytes32 => bool) public processedProofs;
    uint256 public nonEvmRewardAmount;

    event TokensMintedAndDistributed(address indexed to, uint256 amount);
    event TokensMintedForBridge(address indexed user, uint256 amount, address indexed bridge);
    event MaxMintSupplyUpdated(uint256 newMaxSupply);
    event StakingPoolAuthorized(address indexed stakingPool);
    event StakingPoolDeauthorized(address indexed stakingPool);
    event BridgeAuthorized(address indexed bridge);
    event BridgeDeauthorized(address indexed bridge);
    event PriceOracleSet(address indexed oracle, uint8 decimals);
    event OracleEnabled(bool enabled);
    event OraclePriceUpdated(uint256 price, uint256 timestamp);
    event NonEvmRewardAmountUpdated(uint256 newAmount);
    event DormancyProofProcessed(
        bytes32 indexed proofHash,
        bytes32 indexed chainId,
        address indexed dormantWallet,
        uint256 dormantSinceBlock,
        uint256 currentBlock,
        uint256 amount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the RewardDistributor with the token and initial supply cap
    /// @param _resurgenceTokenAddress Address of the RESURGE token
    /// @param _initialMaxMintSupply Initial maximum tokens that can be minted via rewards
    /// @param _timelock Address of the Timelock controller
    function initialize(
        address _resurgenceTokenAddress, 
        uint256 _initialMaxMintSupply,
        address _timelock
    ) public initializer {
        if (_resurgenceTokenAddress == address(0) || _timelock == address(0)) revert RewardDistributor_InvalidAddress();
        
        __AccessControl_init();
        __Pausable_init();

        resurgenceToken = ResurgeToken(_resurgenceTokenAddress);
        maxMintSupply = _initialMaxMintSupply;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);

        // Grant temporary roles to deployer for setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    /// @notice Authorizes a staking pool to call mintAndDistribute
    /// @param _stakingPool Address of the pool to authorize
    function authorizeStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) {
        if (_stakingPool == address(0)) revert RewardDistributor_InvalidAddress();
        authorizedStakingPools[_stakingPool] = true;
        emit StakingPoolAuthorized(_stakingPool);
    }

    /// @notice Deauthorizes a staking pool
    /// @param _stakingPool Address of the pool to deauthorize
    function unauthorizeStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) {
        if (_stakingPool == address(0)) revert RewardDistributor_InvalidAddress();
        authorizedStakingPools[_stakingPool] = false;
        emit StakingPoolDeauthorized(_stakingPool);
    }

    /// @notice Mints and distributes rewards to a user
    /// @dev Only callable by authorized staking pools
    /// @param _to User address to receive rewards
    /// @param _amount Amount of RESURGE to mint
    /// @return Success boolean
    function mintAndDistribute(address _to, uint256 _amount) public whenNotPaused returns (bool) {
        if (!authorizedStakingPools[msg.sender]) revert RewardDistributor_UnauthorizedPool();
        
        uint256 newTotalMinted = totalResurgeMinted + _amount;
        if (newTotalMinted > maxMintSupply) revert RewardDistributor_ExceedsMaxSupply();
        
        totalResurgeMinted = newTotalMinted;
        resurgenceToken.mint(_to, _amount);
        emit TokensMintedAndDistributed(_to, _amount);
        return true;
    }

    /// @notice Authorize a CrossChainReceiver to call mintForBridge
    /// @param _bridge Address of the CrossChainReceiver on the hub
    function authorizeBridge(address _bridge) public onlyRole(TIMELOCK_ROLE) {
        if (_bridge == address(0)) revert RewardDistributor_InvalidAddress();
        authorizedBridges[_bridge] = true;
        emit BridgeAuthorized(_bridge);
    }

    /// @notice Deauthorize a bridge receiver
    function unauthorizeBridge(address _bridge) public onlyRole(TIMELOCK_ROLE) {
        if (_bridge == address(0)) revert RewardDistributor_InvalidAddress();
        authorizedBridges[_bridge] = false;
        emit BridgeDeauthorized(_bridge);
    }

    /// @notice Mints RESURGE for a user whose reward was bridged from a spoke chain
    /// @dev Only callable by an authorized CrossChainReceiver on the hub
    /// @param user The recipient address (user on the hub chain)
    /// @param amount RESURGE amount to mint
    function mintForBridge(address user, uint256 amount) external whenNotPaused {
        if (!authorizedBridges[msg.sender]) revert RewardDistributor_UnauthorizedBridge();
        uint256 newTotalMinted = totalResurgeMinted + amount;
        if (newTotalMinted > maxMintSupply) revert RewardDistributor_ExceedsMaxSupply();
        totalResurgeMinted = newTotalMinted;
        resurgenceToken.mint(user, amount);
        emit TokensMintedForBridge(user, amount, msg.sender);
    }

    /// @notice Backwards compatibility function for adding authorized pools
    /// @param _stakingPool Address to authorize
    function addAuthorizedStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) {
        authorizeStakingPool(_stakingPool);
    }

    /// @notice Backwards compatibility function for removing authorized pools
    /// @param _stakingPool Address to deauthorize
    function removeAuthorizedStakingPool(address _stakingPool) public onlyRole(TIMELOCK_ROLE) {
        unauthorizeStakingPool(_stakingPool);
    }

    /// @notice Updates the maximum supply that can be minted via rewards
    /// @param _newMaxSupply New supply cap
    function setMaxMintSupply(uint256 _newMaxSupply) public onlyRole(TIMELOCK_ROLE) whenNotPaused {
        if (_newMaxSupply < totalResurgeMinted) revert RewardDistributor_SupplyTooLow();
        maxMintSupply = _newMaxSupply;
        emit MaxMintSupplyUpdated(_newMaxSupply);
    }

    /// @notice Sets the Chainlink price oracle for RESURGE
    /// @param _oracle Address of the Chainlink aggregator
    /// @param _staleThreshold Maximum seconds before oracle data is considered stale
    function setPriceOracle(address _oracle, uint256 _staleThreshold) public onlyRole(TIMELOCK_ROLE) {
        if (_oracle == address(0)) revert RewardDistributor_InvalidAddress();
        priceOracle = IPriceOracle(_oracle);
        oracleStaleThreshold = _staleThreshold > 0 ? _staleThreshold : 3600;
        oracleEnabled = true;
        emit PriceOracleSet(_oracle, priceOracle.decimals());
    }

    /// @notice Enables or disables the oracle-based emission adjustment
    function setOracleEnabled(bool _enabled) public onlyRole(TIMELOCK_ROLE) {
        oracleEnabled = _enabled;
        emit OracleEnabled(_enabled);
    }

    /// @notice Manually sets the price when oracle is unavailable (fallback)
    /// @param _price The RESURGE price in oracle decimals (e.g. 8)
    function setFallbackPrice(uint256 _price) public onlyRole(ORACLE_MANAGER_ROLE) {
        oracleLastPrice = _price;
        oracleLastUpdate = block.timestamp;
        emit OraclePriceUpdated(_price, block.timestamp);
    }

    /// @notice Returns the current RESURGE price from the oracle
    /// @return price The current price in oracle decimals (8 for Chainlink USD feeds)
    /// @return valid Whether the oracle data is fresh
    function getResurgePrice() public view returns (uint256 price, bool valid) {
        if (!oracleEnabled || address(priceOracle) == address(0)) {
            // Check fallback
            if (oracleLastPrice > 0 && block.timestamp < oracleLastUpdate + oracleStaleThreshold) {
                return (oracleLastPrice, true);
            }
            return (0, false);
        }
        
        try priceOracle.latestRoundData() returns (
            uint80 roundId,
            int256 answer,
            uint256,
            uint256 updatedAt,
            uint80 answeredInRound
        ) {
            if (answer <= 0) return (0, false);
            if (answeredInRound < roundId) return (0, false);
            if (updatedAt == 0 || block.timestamp > updatedAt + oracleStaleThreshold) {
                // Stale data, try fallback
                if (oracleLastPrice > 0 && block.timestamp < oracleLastUpdate + oracleStaleThreshold) {
                    return (oracleLastPrice, true);
                }
                return (0, false);
            }
            
            price = uint256(answer);
            valid = true;
        } catch {
            if (oracleLastPrice > 0 && block.timestamp < oracleLastUpdate + oracleStaleThreshold) {
                return (oracleLastPrice, true);
            }
            return (0, false);
        }
    }

    /// @notice Calculates an emission multiplier based on RESURGE price
    /// @dev Higher price → higher emission rate (more reward value)
    /// @return multiplier Basis points multiplier (10000 = 1x)
    function getEmissionMultiplier() public view returns (uint256) {
        (uint256 price, bool valid) = getResurgePrice();
        if (!valid || price == 0) return 10000;

        // Base price at $0.05 with 8 decimals = 5000000
        uint256 basePrice = 5000000;

        if (price <= basePrice) return 10000;

        // 10% increase per $0.01 above base (capped at 2x at $0.15)
        uint256 excess = price - basePrice;
        uint256 multiplier = 10000 + (excess * 1000) / 1000000;
        if (multiplier > 20000) multiplier = 20000;

        return multiplier;
    }

    /// @notice Sets the base RESURGE reward amount for non-EVM dormancy attestations
    /// @param _amount RESURGE amount (in wei) minted per valid dormancy proof
    function setNonEvmRewardAmount(uint256 _amount) public onlyRole(TIMELOCK_ROLE) {
        nonEvmRewardAmount = _amount;
        emit NonEvmRewardAmountUpdated(_amount);
    }

    /// @notice Submits a dormancy proof for a non-EVM wallet, attested by ChronoNode + BaaLS
    /// @dev Only callable by authorized dormancy oracles (DORMANCY_ORACLE_ROLE).
    ///      The ChronoNode ed25519 signature fields (signerPubkey, signature) are stored
    ///      on-chain for audit but access control is via msg.sender role.
    /// @param chainId Identifier of the source chain (e.g. "bitcoin" as bytes32)
    /// @param dormantWallet The wallet address that has been dormant
    /// @param dormantSinceBlock Block height when dormancy began
    /// @param currentBlock Current block height at proof generation
    /// @param thresholdBlocks Dormancy threshold applied
    /// @param signerPubkey ChronoNode operator ed25519 public key (hex, 64 chars → 32 bytes)
    /// @param signature ChronoNode operator ed25519 signature (hex, 128 chars → 64 bytes)
    /// @return proofHash Unique identifier for this proof (used for replay protection)
    function submitDormancyProof(
        bytes32 chainId,
        address dormantWallet,
        uint256 dormantSinceBlock,
        uint256 currentBlock,
        uint256 thresholdBlocks,
        bytes32 signerPubkey,
        bytes calldata signature
    ) public onlyRole(DORMANCY_ORACLE_ROLE) whenNotPaused returns (bytes32 proofHash) {
        if (dormantWallet == address(0)) revert RewardDistributor_InvalidAddress();
        if (nonEvmRewardAmount == 0) revert RewardDistributor_InvalidProofData();

        proofHash = keccak256(
            abi.encodePacked(
                chainId,
                dormantWallet,
                dormantSinceBlock,
                currentBlock,
                thresholdBlocks
            )
        );

        if (processedProofs[proofHash]) revert RewardDistributor_ProofAlreadyProcessed();
        processedProofs[proofHash] = true;

        uint256 newTotalMinted = totalResurgeMinted + nonEvmRewardAmount;
        if (newTotalMinted > maxMintSupply) revert RewardDistributor_ExceedsMaxSupply();
        totalResurgeMinted = newTotalMinted;

        resurgenceToken.mint(dormantWallet, nonEvmRewardAmount);

        emit DormancyProofProcessed(
            proofHash,
            chainId,
            dormantWallet,
            dormantSinceBlock,
            currentBlock,
            nonEvmRewardAmount
        );

        emit TokensMintedAndDistributed(dormantWallet, nonEvmRewardAmount);
    }

    /// @notice Pauses the distributor in case of emergency
    function pause() public onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    /// @notice Unpauses the distributor
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @dev Internal function to authorize an upgrade
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    /**
     * @dev Gap for future storage variables.
     */
    uint256[41] private __gap;
}