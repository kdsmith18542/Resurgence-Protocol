// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IRewardDistributor {
    function mintAndDistribute(address _to, uint256 _amount) external returns (bool);
    function authorizedStakingPools(address pool) external view returns (bool);
}

// Custom errors for gas efficiency
error InvalidAmount();
error InsufficientBalance();
error TransferFailed();
error RewardMintingFailed();

/// @title DeadCoinStakingPool - Proof-of-Dormancy staking pool for individual dead coins
/// @notice Manages staking and reward distribution for a single "dead coin"
/// @dev Implements per-second reward calculation with reentrancy protection. UUPS Upgradeable.
contract DeadCoinStakingPool is 
    Initializable, 
    AccessControlUpgradeable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    
    IERC20 public deadCoin;
    IERC20 public resurgenceToken;
    address public rewardDistributor;
    address public stakingPoolManager;

    uint256 public rewardRatePerSecond;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userStakedAmount;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userRewards;

    uint256 public totalStakedSupply;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRatePerSecond);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the staking pool
    /// @param _deadCoinAddress The address of the dead coin to be staked
    /// @param _resurgenceTokenAddress The protocol's native token
    /// @param _rewardDistributorAddress The central reward distributor
    /// @param _stakingPoolManagerAddress The manager that deployed this pool
    /// @param _timelock The governance timelock
    function initialize(
        address _deadCoinAddress,
        address _resurgenceTokenAddress,
        address _rewardDistributorAddress,
        address _stakingPoolManagerAddress,
        address _timelock
    ) public initializer {
        if (_deadCoinAddress == address(0) || _resurgenceTokenAddress == address(0) || _rewardDistributorAddress == address(0) || _stakingPoolManagerAddress == address(0) || _timelock == address(0)) {
            revert InvalidAmount();
        }

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        deadCoin = IERC20(_deadCoinAddress);
        resurgenceToken = IERC20(_resurgenceTokenAddress);
        rewardDistributor = _rewardDistributorAddress;
        stakingPoolManager = _stakingPoolManagerAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);

        _grantRole(TIMELOCK_ROLE, _stakingPoolManagerAddress);
        _grantRole(EMERGENCY_PAUSER, _stakingPoolManagerAddress);
        
        lastUpdateTime = block.timestamp;
    }

    /// @dev Updates reward variables for the pool and a specific account
    modifier updateReward(address _account) {
        rewardPerTokenStored = _rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (_account != address(0)) {
            userRewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    /// @dev Internal function to calculate current reward per token
    function _rewardPerToken() internal view returns (uint256) {
        if (totalStakedSupply == 0 || rewardRatePerSecond == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + 
            ((block.timestamp - lastUpdateTime) * rewardRatePerSecond * 1e18) / totalStakedSupply;
    }

    /// @notice Returns the total rewards earned by an account
    /// @param _account The user address
    /// @return The amount of RESURGE rewards earned
    function earned(address _account) public view returns (uint256) {
        return userRewards[_account] + 
            (userStakedAmount[_account] * (_rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18;
    }

    /// @notice Stakes dead coins into the pool
    /// @param _amount Amount of dead coins to stake
    function stake(uint256 _amount) external whenNotPaused updateReward(msg.sender) nonReentrant {
        _stakeInternal(msg.sender, _amount);
    }
    
    /// @notice Stakes on behalf of another user (for batch operations via StakingPoolManager)
    /// @param _user The user to credit the stake to
    /// @param _amount Amount of dead coins to stake
    function stakeFor(address _user, uint256 _amount) external whenNotPaused updateReward(_user) nonReentrant {
        if (msg.sender != stakingPoolManager) revert InvalidAmount();
        _stakeInternal(_user, _amount);
    }

    /// @dev Internal stake logic
    function _stakeInternal(address _staker, uint256 _amount) internal {
        if (_amount == 0) revert InvalidAmount();
        
        if (!deadCoin.transferFrom(msg.sender, address(this), _amount)) revert TransferFailed();
        
        userStakedAmount[_staker] += _amount;
        totalStakedSupply += _amount;
        
        emit Staked(_staker, _amount);
    }
    
    /// @notice Unstakes dead coins from the pool
    /// @param _amount Amount of dead coins to unstake
    function unstake(uint256 _amount) external whenNotPaused updateReward(msg.sender) nonReentrant {
        if (_amount == 0) revert InvalidAmount();
        if (userStakedAmount[msg.sender] < _amount) revert InsufficientBalance();
        
        userStakedAmount[msg.sender] -= _amount;
        totalStakedSupply -= _amount;
        
        if (!deadCoin.transfer(msg.sender, _amount)) revert TransferFailed();
        
        emit Unstaked(msg.sender, _amount);
    }
    
    /// @notice Claims all accrued RESURGE rewards
    function claimRewards() public whenNotPaused updateReward(msg.sender) nonReentrant {
        uint256 rewards = userRewards[msg.sender];
        
        if (rewards > 0) {
            userRewards[msg.sender] = 0;
            bool success = IRewardDistributor(rewardDistributor).mintAndDistribute(msg.sender, rewards);
            if (!success) revert RewardMintingFailed();
            
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    /// @notice Claims rewards on behalf of a user (for batch operations via StakingPoolManager)
    /// @param _user The user whose rewards to claim
    function claimRewardsFor(address _user) external whenNotPaused updateReward(_user) nonReentrant {
        if (msg.sender != stakingPoolManager) revert InvalidAmount();
        uint256 rewards = userRewards[_user];
        
        if (rewards > 0) {
            userRewards[_user] = 0;
            // Mint to this pool, then transfer to user
            bool success = IRewardDistributor(rewardDistributor).mintAndDistribute(address(this), rewards);
            if (!success) revert RewardMintingFailed();
            
            if (!resurgenceToken.transfer(_user, rewards)) revert TransferFailed();
            
            emit RewardsClaimed(_user, rewards);
        }
    }

    /// @notice Claims rewards and auto-stakes them into an authorized RESURGE staking pool
    /// @param _resurgeStakingPool Address of the RESURGE staking pool — must be whitelisted in RewardDistributor
    function claimAndRestakeTo(address _resurgeStakingPool) public whenNotPaused updateReward(msg.sender) nonReentrant {
        // Only allow approved pools — prevents approval drain via malicious stakeFor() implementation
        if (!IRewardDistributor(rewardDistributor).authorizedStakingPools(_resurgeStakingPool))
            revert InvalidAmount();

        uint256 rewards = userRewards[msg.sender];
        if (rewards == 0) revert InvalidAmount();

        userRewards[msg.sender] = 0;
        bool success = IRewardDistributor(rewardDistributor).mintAndDistribute(address(this), rewards);
        if (!success) revert RewardMintingFailed();

        emit RewardsClaimed(msg.sender, rewards);

        resurgenceToken.approve(_resurgeStakingPool, rewards);
        (success, ) = _resurgeStakingPool.call(
            abi.encodeWithSignature("stakeFor(address,uint256)", msg.sender, rewards)
        );
        if (!success) revert TransferFailed();
    }

    /// @notice Sets the reward rate per second
    /// @param _newRatePerSecond New reward rate in wei
    function setRewardRate(uint256 _newRatePerSecond) external onlyRole(TIMELOCK_ROLE) whenNotPaused updateReward(address(0)) {
        rewardRatePerSecond = _newRatePerSecond;
        emit RewardRateUpdated(_newRatePerSecond);
    }

    /// @notice Pauses staking and reward accrual
    function pause() external onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    /// @notice Unpauses staking and reward accrual
    function unpause() external onlyRole(TIMELOCK_ROLE) {
        _unpause();
    }

    /// @dev Internal function to authorize an upgrade
    /// @param newImplementation Address of the new implementation
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    /**
     * @dev Gap for future storage variables.
     */
    uint256[50] private __gap;
}