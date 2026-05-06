// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ResurgeToken.sol";
import "./RewardDistributor.sol";

error ResurgeStaking_InvalidAmount();
error ResurgeStaking_InsufficientBalance();
error ResurgeStaking_TransferFailed();
error ResurgeStaking_RewardMintingFailed();
error ResurgeStaking_LockPeriodActive();
error ResurgeStaking_NotAuthorized();

interface IVotes {
    function delegate(address delegatee) external;
    function getVotes(address account) external view returns (uint256);
}

/// @title ResurgeStakingPool - Native RESURGE token staking with boosted rewards and voting power
/// @notice Allows RESURGE holders to stake tokens for boosted yield while retaining voting power
/// @dev UUPS Upgradeable. Staked RESURGE is locked; voting power delegated back to stakers.
contract ResurgeStakingPool is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    bytes32 public constant RATE_SETTER_ROLE = keccak256("RATE_SETTER_ROLE");

    ResurgeToken public resurgeToken;
    address public rewardDistributor;

    uint256 public rewardRatePerSecond;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userStakedAmount;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userRewards;
    mapping(address => uint256) public userStakedAt;
    mapping(address => address) public userDelegation;

    uint256 public totalStakedSupply;
    uint256 public minStakeDuration;
    uint256 public earlyUnstakePenaltyBps;

    // Boost multiplier (basis points, 10000 = 1x)
    uint256 public baseBoostBps;
    mapping(address => uint256) public userBoostBps;

    event Staked(address indexed user, uint256 amount, address delegation);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRatePerSecond);
    event BoostUpdated(address indexed user, uint256 newBoostBps);
    event DelegationUpdated(address indexed user, address indexed delegatee);
    event MinStakeDurationUpdated(uint256 newDuration);
    event EarlyUnstakePenaltyUpdated(uint256 newPenaltyBps);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _resurgeToken,
        address _rewardDistributor,
        address _timelock,
        uint256 _initialRewardRate
    ) public initializer {
        require(_resurgeToken != address(0), "Invalid token");
        require(_rewardDistributor != address(0), "Invalid distributor");
        require(_timelock != address(0), "Invalid timelock");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        resurgeToken = ResurgeToken(_resurgeToken);
        rewardDistributor = _rewardDistributor;
        rewardRatePerSecond = _initialRewardRate;
        lastUpdateTime = block.timestamp;
        minStakeDuration = 7 days;
        earlyUnstakePenaltyBps = 500; // 5%
        baseBoostBps = 10000; // 1x

        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);
        _grantRole(RATE_SETTER_ROLE, _timelock);

        // Grant temporary roles to deployer for setup
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TIMELOCK_ROLE, msg.sender);
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = _rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (_account != address(0)) {
            userRewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }
        _;
    }

    function _rewardPerToken() internal view returns (uint256) {
        if (totalStakedSupply == 0 || rewardRatePerSecond == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored +
            ((block.timestamp - lastUpdateTime) * rewardRatePerSecond * 1e18) / totalStakedSupply;
    }

    /// @notice Calculates the total earned rewards for a user, including boost multipliers
    /// @param _account The user address to calculate rewards for
    /// @return The amount of RESURGE tokens earned
    function earned(address _account) public view returns (uint256) {
        uint256 boost = userBoostBps[_account] > 0 ? userBoostBps[_account] : baseBoostBps;
        uint256 base = userRewards[_account] +
            (userStakedAmount[_account] * (_rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18;
        return (base * boost) / 10000;
    }

    /// @notice Stakes RESURGE tokens into the pool
    /// @param _amount Amount of RESURGE to stake
    /// @param _delegatee Optional address to delegate voting power to (can be address(0))
    function stake(uint256 _amount, address _delegatee) external whenNotPaused updateReward(msg.sender) nonReentrant {
        _stakeInternal(msg.sender, _amount, _delegatee);
    }

    /// @notice Stakes on behalf of another user (for compounding from other pools)
    /// @param _user The user to credit the stake to
    /// @param _amount Amount of RESURGE to stake
    function stakeFor(address _user, uint256 _amount) external whenNotPaused updateReward(_user) nonReentrant {
        // Only authorized staking pools can call this
        if (!RewardDistributor(rewardDistributor).authorizedStakingPools(msg.sender)) revert ResurgeStaking_NotAuthorized();
        _stakeInternal(_user, _amount, address(0));
    }

    function _stakeInternal(address _user, uint256 _amount, address _delegatee) internal {
        if (_amount == 0) revert ResurgeStaking_InvalidAmount();

        if (!resurgeToken.transferFrom(msg.sender, address(this), _amount))
            revert ResurgeStaking_TransferFailed();

        userStakedAmount[_user] += _amount;
        totalStakedSupply += _amount;
        userStakedAt[_user] = block.timestamp;

        if (_delegatee != address(0)) {
            userDelegation[_user] = _delegatee;
            emit DelegationUpdated(_user, _delegatee);
        }

        emit Staked(_user, _amount, _delegatee);
    }

    /// @notice Withdraws staked RESURGE tokens. Subject to early unstake penalty if before minStakeDuration.
    /// @param _amount Amount of RESURGE to withdraw
    function unstake(uint256 _amount) external whenNotPaused updateReward(msg.sender) nonReentrant {
        if (_amount == 0) revert ResurgeStaking_InvalidAmount();
        if (userStakedAmount[msg.sender] < _amount) revert ResurgeStaking_InsufficientBalance();

        uint256 penalty = 0;
        if (block.timestamp < userStakedAt[msg.sender] + minStakeDuration) {
            penalty = (_amount * earlyUnstakePenaltyBps) / 10000;
        }

        userStakedAmount[msg.sender] -= _amount;
        totalStakedSupply -= _amount;

        uint256 returnAmount = _amount - penalty;
        if (!resurgeToken.transfer(msg.sender, returnAmount))
            revert ResurgeStaking_TransferFailed();

        if (penalty > 0) {
            // Penalty goes to protocol treasury (burn or redistribute)
            resurgeToken.burn(penalty);
        }

        emit Unstaked(msg.sender, _amount, penalty);
    }

    function claimRewards() public whenNotPaused updateReward(msg.sender) nonReentrant {
        uint256 rewards = userRewards[msg.sender];
        if (rewards > 0) {
            userRewards[msg.sender] = 0;
            bool success = RewardDistributor(rewardDistributor).mintAndDistribute(msg.sender, rewards);
            if (!success) revert ResurgeStaking_RewardMintingFailed();
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    function claimAndRestake() external whenNotPaused updateReward(msg.sender) nonReentrant {
        uint256 rewards = userRewards[msg.sender];
        if (rewards > 0) {
            userRewards[msg.sender] = 0;
            bool success = RewardDistributor(rewardDistributor).mintAndDistribute(address(this), rewards);
            if (!success) revert ResurgeStaking_RewardMintingFailed();

            userStakedAmount[msg.sender] += rewards;
            totalStakedSupply += rewards;

            emit RewardsClaimed(msg.sender, rewards);
            emit Staked(msg.sender, rewards, address(0));
        }
    }

    function setDelegate(address _delegatee) external {
        userDelegation[msg.sender] = _delegatee;
        emit DelegationUpdated(msg.sender, _delegatee);
    }

    function setRewardRate(uint256 _newRatePerSecond) external onlyRole(RATE_SETTER_ROLE) whenNotPaused updateReward(address(0)) {
        rewardRatePerSecond = _newRatePerSecond;
        emit RewardRateUpdated(_newRatePerSecond);
    }

    function setUserBoost(address _user, uint256 _boostBps) external onlyRole(TIMELOCK_ROLE) {
        require(_boostBps >= 10000, "Boost must be >= 1x");
        userBoostBps[_user] = _boostBps;
        emit BoostUpdated(_user, _boostBps);
    }

    function setMinStakeDuration(uint256 _duration) external onlyRole(TIMELOCK_ROLE) {
        minStakeDuration = _duration;
        emit MinStakeDurationUpdated(_duration);
    }

    function setEarlyUnstakePenalty(uint256 _penaltyBps) external onlyRole(TIMELOCK_ROLE) {
        require(_penaltyBps <= 2500, "Max 25% penalty");
        earlyUnstakePenaltyBps = _penaltyBps;
        emit EarlyUnstakePenaltyUpdated(_penaltyBps);
    }

    function pause() external onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getVotingPower(address _account) public view returns (uint256) {
        return userStakedAmount[_account];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    uint256[44] private __gap;
}
