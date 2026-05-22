// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./ResurgeToken.sol";
import "./DeadCoinStakingPool.sol";
import "./RewardDistributor.sol";

/// @dev Interface for interacting with DeadCoinStakingPool instances
interface IDeadCoinStakingPool {
    function initialize(
        address _deadCoinAddress,
        address _resurgenceTokenAddress,
        address _rewardDistributorAddress,
        address _stakingPoolManagerAddress,
        address _timelock
    ) external;
    function setRewardRate(uint256 _newRatePerSecond) external;
    function pause() external;
    function unpause() external;
    function grantRole(bytes32 role, address account) external;
    function TIMELOCK_ROLE() external view returns (bytes32);
    function rewardRatePerSecond() external view returns (uint256);
    function totalStakedSupply() external view returns (uint256);
}

/// @title StakingPoolManager - Registry and factory for DeadCoinStakingPools
/// @notice Manages the deployment and administration of individual dead coin staking pools
/// @dev Governed by a Timelock controller for all critical actions. UUPS Upgradeable.
contract StakingPoolManager is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    
    error StakingPoolManager_PoolExists();
    error StakingPoolManager_InvalidAddress();
    error StakingPoolManager_PoolNotFound();

    // Dynamic reward rate parameters
    bool public dynamicRateEnabled;
    uint256 public baseRewardRatePerSecond;
    uint256 public tvlDecayFactor;       // Basis points of rate reduction per 1M TVL (e.g. 100 = 1%)
    uint256 public minRewardRatePerSecond;
    uint256 public maxRewardRatePerSecond;

    mapping(address => address) public deadCoinToPoolAddress;
    address[] public supportedDeadCoins;
    address public resurgenceTokenAddress;
    address public rewardDistributorAddress;
    address public stakingPoolImplementation;

    event StakingPoolAdded(address indexed deadCoinAddress, address indexed poolAddress, uint256 initialRewardRate);
    event RewardRateUpdated(address indexed deadCoinAddress, uint256 newRatePerSecond);
    event StakingPoolPaused(address indexed deadCoinAddress, address indexed poolAddress);
    event StakingPoolUnpaused(address indexed deadCoinAddress, address indexed poolAddress);
    event StakingPoolRemoved(address indexed deadCoinAddress, address indexed poolAddress);
    event RoleGrantRequested(address indexed poolAddress, address indexed account, bytes32 role);
    event ImplementationUpdated(address indexed newImplementation);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the manager with core protocol addresses
    /// @param _resurgenceTokenAddress The native RESURGE token address
    /// @param _rewardDistributorAddress The central reward distributor
    /// @param _stakingPoolImplementation The logic contract for staking pools
    /// @param _timelock The timelock address for governance
    function initialize(
        address _resurgenceTokenAddress, 
        address _rewardDistributorAddress,
        address _stakingPoolImplementation,
        address _timelock
    ) public initializer {
        if (_resurgenceTokenAddress == address(0) || _rewardDistributorAddress == address(0) || _stakingPoolImplementation == address(0) || _timelock == address(0)) {
            revert StakingPoolManager_InvalidAddress();
        }

        __AccessControl_init();
        __Pausable_init();

        resurgenceTokenAddress = _resurgenceTokenAddress;
        rewardDistributorAddress = _rewardDistributorAddress;
        stakingPoolImplementation = _stakingPoolImplementation;
        
        dynamicRateEnabled = false;
        baseRewardRatePerSecond = 1e18;
        tvlDecayFactor = 100;
        minRewardRatePerSecond = 1e17;
        maxRewardRatePerSecond = 10e18;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);

        // Grant temporary roles to deployer for setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    /// @notice Sets a new implementation for future staking pools
    /// @param _newImplementation The address of the new DeadCoinStakingPool logic contract
    function setStakingPoolImplementation(address _newImplementation) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newImplementation == address(0)) revert StakingPoolManager_InvalidAddress();
        stakingPoolImplementation = _newImplementation;
        emit ImplementationUpdated(_newImplementation);
    }

    /// @notice Deploys a new staking pool proxy for a specific dead coin
    /// @param _deadCoinAddress The address of the abandoned/dead ERC20 token
    /// @param _initialRewardRatePerSecond RESURGE tokens to distribute per second
    /// @param _timelock The timelock address that will govern the new pool
    /// @return newPoolAddress The address of the newly deployed pool proxy
    function addStakingPool(
        address _deadCoinAddress, 
        uint256 _initialRewardRatePerSecond,
        address _timelock
    ) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
        returns (address newPoolAddress) 
    {
        if (deadCoinToPoolAddress[_deadCoinAddress] != address(0)) revert StakingPoolManager_PoolExists();
        if (_timelock == address(0) || _deadCoinAddress == address(0)) revert StakingPoolManager_InvalidAddress();
        
        // Deploy the new pool proxy using ERC1967
        bytes memory initData = abi.encodeWithSelector(
            IDeadCoinStakingPool.initialize.selector,
            _deadCoinAddress,
            resurgenceTokenAddress,
            rewardDistributorAddress,
            address(this),
            _timelock
        );

        ERC1967Proxy proxy = new ERC1967Proxy(stakingPoolImplementation, initData);
        address poolAddress = address(proxy);
        
        // The timelock will need to call grantRole on the pool directly
        emit RoleGrantRequested(poolAddress, address(this), IDeadCoinStakingPool(poolAddress).TIMELOCK_ROLE());
        
        deadCoinToPoolAddress[_deadCoinAddress] = poolAddress;
        supportedDeadCoins.push(_deadCoinAddress);

        // Authorize the pool in the reward distributor
        RewardDistributor(rewardDistributorAddress).authorizeStakingPool(poolAddress);
        
        // Set the initial reward rate on the pool
        if (_initialRewardRatePerSecond > 0) {
            IDeadCoinStakingPool(poolAddress).setRewardRate(_initialRewardRatePerSecond);
        }
        
        emit StakingPoolAdded(_deadCoinAddress, poolAddress, _initialRewardRatePerSecond);
        return poolAddress;
    }

    /// @notice Updates the reward rate for an existing pool
    /// @param _deadCoinAddress The dead coin address associated with the pool
    /// @param _newRatePerSecond New reward rate in wei
    function setRewardRate(address _deadCoinAddress, uint256 _newRatePerSecond) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        if (poolAddress == address(0)) revert StakingPoolManager_PoolNotFound();
        IDeadCoinStakingPool(poolAddress).setRewardRate(_newRatePerSecond);
        emit RewardRateUpdated(_deadCoinAddress, _newRatePerSecond);
    }

    /// @notice Pauses staking and reward accrual for a specific pool
    /// @param _deadCoinAddress The dead coin address associated with the pool
    function pauseStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        if (poolAddress == address(0)) revert StakingPoolManager_PoolNotFound();
        IDeadCoinStakingPool(poolAddress).pause();
        emit StakingPoolPaused(_deadCoinAddress, poolAddress);
    }

    /// @notice Unpauses a specific staking pool
    /// @param _deadCoinAddress The dead coin address associated with the pool
    function unpauseStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        if (poolAddress == address(0)) revert StakingPoolManager_PoolNotFound();
        IDeadCoinStakingPool(poolAddress).unpause();
        emit StakingPoolUnpaused(_deadCoinAddress, poolAddress);
    }

    /// @notice Removes a staking pool from the registry
    /// @dev Does not delete the pool contract, but unauthorizes it from reward distribution
    /// @param _deadCoinAddress The dead coin address associated with the pool
    function removeStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        if (poolAddress == address(0)) revert StakingPoolManager_PoolNotFound();

        // Before removing, unauthorize the staking pool from the RewardDistributor
        RewardDistributor(rewardDistributorAddress).unauthorizeStakingPool(poolAddress);

        delete deadCoinToPoolAddress[_deadCoinAddress];

        // Remove from supportedDeadCoins array
        for (uint i = 0; i < supportedDeadCoins.length; i++) {
            if (supportedDeadCoins[i] == _deadCoinAddress) {
                supportedDeadCoins[i] = supportedDeadCoins[supportedDeadCoins.length - 1];
                supportedDeadCoins.pop();
                break;
            }
        }
        emit StakingPoolRemoved(_deadCoinAddress, poolAddress);
    }

    /// @notice Batch-stakes dead coins across multiple pools in a single transaction
    /// @dev User must approve StakingPoolManager for each dead coin before calling. Limited to 50 pools per tx.
    /// @param _deadCoinAddresses Array of dead coin addresses to stake to
    /// @param _amounts Array of amounts to stake in each pool
    function batchStake(address[] calldata _deadCoinAddresses, uint256[] calldata _amounts) external whenNotPaused {
        require(_deadCoinAddresses.length == _amounts.length, "Array length mismatch");
        require(_deadCoinAddresses.length <= 50, "Batch size too large");
        for (uint i = 0; i < _deadCoinAddresses.length; i++) {
            if (_amounts[i] > 0) {
                address poolAddress = deadCoinToPoolAddress[_deadCoinAddresses[i]];
                require(poolAddress != address(0), "Pool not found");
                // Pull tokens from user to this manager, approve pool, then call stakeFor
                IDeadCoinStakingPool(poolAddress);
                IERC20 deadCoin = IERC20(_deadCoinAddresses[i]);
                deadCoin.transferFrom(msg.sender, address(this), _amounts[i]);
                deadCoin.approve(poolAddress, _amounts[i]);
                (bool success, ) = poolAddress.call(
                    abi.encodeWithSignature("stakeFor(address,uint256)", msg.sender, _amounts[i])
                );
                require(success, "Stake failed");
            }
        }
    }

    /// @notice Batch-claims rewards from multiple pools for the caller
    /// @param _deadCoinAddresses Array of dead coin addresses to claim rewards from
    function batchClaimRewards(address[] calldata _deadCoinAddresses) external whenNotPaused {
        require(_deadCoinAddresses.length <= 50, "Batch size too large");
        for (uint i = 0; i < _deadCoinAddresses.length; i++) {
            address poolAddress = deadCoinToPoolAddress[_deadCoinAddresses[i]];
            if (poolAddress != address(0)) {
                (bool success, ) = poolAddress.call(
                    abi.encodeWithSignature("claimRewardsFor(address)", msg.sender)
                );
                require(success, "Claim failed");
            }
        }
    }

    /// @notice Enables or disables dynamic reward rate calculation
    /// @param _enabled Whether dynamic rates should be active
    function setDynamicRateEnabled(bool _enabled) public onlyRole(TIMELOCK_ROLE) {
        dynamicRateEnabled = _enabled;
    }

    /// @notice Configures the dynamic reward rate parameters
    /// @param _baseRate Base reward rate per second (wei)
    /// @param _tvlDecayFactor Basis points of rate reduction per 1M TVL
    /// @param _minRate Minimum allowed reward rate
    /// @param _maxRate Maximum allowed reward rate
    function setDynamicRateParams(
        uint256 _baseRate,
        uint256 _tvlDecayFactor,
        uint256 _minRate,
        uint256 _maxRate
    ) public onlyRole(TIMELOCK_ROLE) {
        baseRewardRatePerSecond = _baseRate;
        tvlDecayFactor = _tvlDecayFactor;
        minRewardRatePerSecond = _minRate;
        maxRewardRatePerSecond = _maxRate;
    }

    /// @notice Calculates a dynamic reward rate for a pool based on its TVL
    /// @param _poolAddress The address of the staking pool
    /// @return The dynamically calculated reward rate
    function calculateDynamicRate(address _poolAddress) public view returns (uint256) {
        if (!dynamicRateEnabled) {
            return DeadCoinStakingPool(_poolAddress).rewardRatePerSecond();
        }

        uint256 tvl = DeadCoinStakingPool(_poolAddress).totalStakedSupply();
        // Reduction = baseRate * tvlMillions * decayFactor / 10000
        uint256 tvlMillions = tvl / 1e24; // Divide by 1M * 1e18 = 1e24
        uint256 reduction = 0;
        if (tvlMillions > 0) {
            reduction = (baseRewardRatePerSecond * tvlMillions * tvlDecayFactor) / 10000;
        }
        
        uint256 dynamicRate = baseRewardRatePerSecond;
        if (reduction < dynamicRate) {
            dynamicRate = dynamicRate - reduction;
        } else {
            dynamicRate = minRewardRatePerSecond;
        }

        if (dynamicRate > maxRewardRatePerSecond) {
            dynamicRate = maxRewardRatePerSecond;
        }
        if (dynamicRate < minRewardRatePerSecond) {
            dynamicRate = minRewardRatePerSecond;
        }

        // Apply oracle-based emission multiplier from RewardDistributor
        uint256 multiplier = RewardDistributor(rewardDistributorAddress).getEmissionMultiplier();
        dynamicRate = (dynamicRate * multiplier) / 10000;

        return dynamicRate;
    }

    /// @notice Applies dynamic rate recalculation to a pool
    /// @param _deadCoinAddress The dead coin address of the pool
    function applyDynamicRate(address _deadCoinAddress) public whenNotPaused {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        if (poolAddress == address(0)) revert StakingPoolManager_PoolNotFound();
        
        uint256 dynamicRate = calculateDynamicRate(poolAddress);
        IDeadCoinStakingPool(poolAddress).setRewardRate(dynamicRate);
        emit RewardRateUpdated(_deadCoinAddress, dynamicRate);
    }

    /// @notice Batch applies dynamic rates to all pools
    function applyDynamicRateAll() public whenNotPaused {
        uint256 limit = supportedDeadCoins.length > 50 ? 50 : supportedDeadCoins.length;
        for (uint i = 0; i < limit; i++) {
            address poolAddress = deadCoinToPoolAddress[supportedDeadCoins[i]];
            if (poolAddress != address(0)) {
                uint256 dynamicRate = calculateDynamicRate(poolAddress);
                IDeadCoinStakingPool(poolAddress).setRewardRate(dynamicRate);
                emit RewardRateUpdated(supportedDeadCoins[i], dynamicRate);
            }
        }
    }

    /// @notice Returns all supported dead coin addresses as an array
    /// @return Array of all registered dead coin addresses
    function getAllSupportedDeadCoins() public view returns (address[] memory) {
        return supportedDeadCoins;
    }

    /// @notice Pauses the entire manager
    function pause() public onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    /// @notice Unpauses the manager
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @dev Internal function to authorize an upgrade
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /**
     * @dev Gap for future storage variables.
     */
    uint256[50] private __gap;
}