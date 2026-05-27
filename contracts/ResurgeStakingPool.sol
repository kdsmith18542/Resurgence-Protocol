// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import "./ResurgeToken.sol";
import "./RewardDistributor.sol";

error ResurgeStaking_InvalidAmount();
error ResurgeStaking_InsufficientBalance();
error ResurgeStaking_TransferFailed();
error ResurgeStaking_RewardMintingFailed();
error ResurgeStaking_LockPeriodActive();
error ResurgeStaking_NotAuthorized();
error ResurgeStaking_CheckpointWriteFailed();

interface IVotes {
    function delegate(address delegatee) external;
    function getVotes(address account) external view returns (uint256);
}

/// @title ResurgeStakingPool - Native RESURGE token staking with boosted rewards and voting power
/// @notice Allows RESURGE holders to stake tokens for boosted yield. Staked votes tracked via
///         per-delegatee checkpoints so governors can aggregate liquid + staked vote weight.
/// @dev UUPS Upgradeable. New state variables must consume __gap slots to preserve proxy layout.
contract ResurgeStakingPool is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using Checkpoints for Checkpoints.Trace208;

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

    // Boost multiplier (basis points, 10000 = 1x). Boosts affect rewards only, never vote weight.
    uint256 public baseBoostBps;
    mapping(address => uint256) public userBoostBps;

    // Staked vote checkpoints — keyed by delegatee address, value = delegated stake weight.
    // Consumes 3 slots from __gap (was 44, now 41).
    mapping(address => Checkpoints.Trace208) private _stakedVoteCheckpoints;
    Checkpoints.Trace208 private _totalStakedCheckpoints;
    uint256 public maxBoostBps;

    event Staked(address indexed user, uint256 amount, address delegation);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRatePerSecond);
    event BoostUpdated(address indexed user, uint256 newBoostBps);
    event MaxBoostUpdated(uint256 newMaxBoostBps);
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
        resurgeToken = ResurgeToken(_resurgeToken);
        rewardDistributor = _rewardDistributor;
        rewardRatePerSecond = _initialRewardRate;
        emit RewardRateUpdated(_initialRewardRate);
        lastUpdateTime = block.timestamp;
        minStakeDuration = 7 days;
        earlyUnstakePenaltyBps = 500; // 5%
        baseBoostBps = 10000; // 1x
        maxBoostBps = 30000;  // 3x hard cap

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
            // Store raw (unboosted) rewards — boost is applied at claim time only.
            // Storing boosted values here would cause exponential re-boosting on each interaction.
            userRewards[_account] = _earnedRaw(_account);
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

    /// @dev Raw accrued rewards with no boost applied. Used internally to checkpoint state.
    function _earnedRaw(address _account) internal view returns (uint256) {
        return userRewards[_account] +
            (userStakedAmount[_account] * (_rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18;
    }

    /// @notice Boosted rewards for a user — for display purposes.
    function earned(address _account) public view returns (uint256) {
        uint256 boost = userBoostBps[_account] > 0 ? userBoostBps[_account] : baseBoostBps;
        return (_earnedRaw(_account) * boost) / 10000;
    }

    /// @notice Stakes RESURGE tokens into the pool
    /// @param _amount Amount of RESURGE to stake
    /// @param _delegatee Voting power delegate (address(0) = self-delegate or keep existing)
    function stake(uint256 _amount, address _delegatee) external whenNotPaused updateReward(msg.sender) nonReentrant {
        _stakeInternal(msg.sender, _amount, _delegatee);
    }

    /// @notice Stakes on behalf of another user (for compounding from other pools)
    function stakeFor(address _user, uint256 _amount) external whenNotPaused updateReward(_user) nonReentrant {
        if (!RewardDistributor(rewardDistributor).authorizedStakingPools(msg.sender)) revert ResurgeStaking_NotAuthorized();
        _stakeInternal(_user, _amount, address(0));
    }

    function _stakeInternal(address _user, uint256 _amount, address _delegatee) internal {
        if (_amount == 0) revert ResurgeStaking_InvalidAmount();

        bool isFresh = userStakedAmount[_user] == 0;
        userStakedAmount[_user] += _amount;
        totalStakedSupply += _amount;

        // Only set the lock start for a fresh position — top-ups keep the original lock timestamp.
        if (isFresh) userStakedAt[_user] = block.timestamp;

        // Resolve the final delegatee: explicit arg > existing > self.
        address finalDelegatee = _delegatee != address(0)
            ? _delegatee
            : (userDelegation[_user] != address(0) ? userDelegation[_user] : _user);

        address prevDelegatee = userDelegation[_user] != address(0) ? userDelegation[_user] : _user;

        if (prevDelegatee != finalDelegatee) {
            // Changing delegation: move existing vote weight to the new delegatee first.
                uint208 existingWeight = uint208(userStakedAmount[_user] - _amount);
                if (existingWeight > 0) {
                    _pushTraceCheckpoint(
                        _stakedVoteCheckpoints[prevDelegatee],
                        _stakedVoteCheckpoints[prevDelegatee].latest() - existingWeight
                    );
                    _pushTraceCheckpoint(
                        _stakedVoteCheckpoints[finalDelegatee],
                        _stakedVoteCheckpoints[finalDelegatee].latest() + existingWeight
                    );
                }
            userDelegation[_user] = finalDelegatee;
            emit DelegationUpdated(_user, finalDelegatee);
        } else if (userDelegation[_user] == address(0)) {
            // First stake with no explicit delegatee: initialize default self-delegation.
            userDelegation[_user] = _user;
        }

        // Add new votes to the final delegatee (same-block push replaces prior push correctly).
        _pushTraceCheckpoint(
            _stakedVoteCheckpoints[finalDelegatee],
            _stakedVoteCheckpoints[finalDelegatee].latest() + uint208(_amount)
        );
        _pushTotalStakedCheckpoint(uint208(totalStakedSupply));

        if (!resurgeToken.transferFrom(msg.sender, address(this), _amount))
            revert ResurgeStaking_TransferFailed();

        emit Staked(_user, _amount, _delegatee);
    }

    /// @notice Withdraws staked RESURGE. Subject to early-unstake penalty before minStakeDuration.
    function unstake(uint256 _amount) external whenNotPaused updateReward(msg.sender) nonReentrant {
        if (_amount == 0) revert ResurgeStaking_InvalidAmount();
        if (userStakedAmount[msg.sender] < _amount) revert ResurgeStaking_InsufficientBalance();

        uint256 penalty = 0;
        if (block.timestamp < userStakedAt[msg.sender] + minStakeDuration) {
            penalty = (_amount * earlyUnstakePenaltyBps) / 10000;
        }

        userStakedAmount[msg.sender] -= _amount;
        totalStakedSupply -= _amount;

        // Remove vote weight from current delegatee.
        address delegatee = userDelegation[msg.sender];
        if (delegatee == address(0)) delegatee = msg.sender;
        _pushTraceCheckpoint(
            _stakedVoteCheckpoints[delegatee],
            _stakedVoteCheckpoints[delegatee].latest() - uint208(_amount)
        );
        _pushTotalStakedCheckpoint(uint208(totalStakedSupply));

        uint256 returnAmount = _amount - penalty;
        if (!resurgeToken.transfer(msg.sender, returnAmount))
            revert ResurgeStaking_TransferFailed();

        if (penalty > 0) {
            resurgeToken.burn(penalty);
        }

        emit Unstaked(msg.sender, _amount, penalty);
    }

    function claimRewards() public whenNotPaused updateReward(msg.sender) nonReentrant {
        uint256 boost = userBoostBps[msg.sender] > 0 ? userBoostBps[msg.sender] : baseBoostBps;
        uint256 rewards = (userRewards[msg.sender] * boost) / 10000;
        if (rewards > 0) {
            userRewards[msg.sender] = 0;
            bool success = RewardDistributor(rewardDistributor).mintAndDistribute(msg.sender, rewards);
            if (!success) revert ResurgeStaking_RewardMintingFailed();
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    function claimAndRestake() external whenNotPaused updateReward(msg.sender) nonReentrant {
        uint256 boost = userBoostBps[msg.sender] > 0 ? userBoostBps[msg.sender] : baseBoostBps;
        uint256 rewards = (userRewards[msg.sender] * boost) / 10000;
        if (rewards > 0) {
            userRewards[msg.sender] = 0;
            userStakedAmount[msg.sender] += rewards;
            totalStakedSupply += rewards;
            // Reset lock timer: compounded tokens must serve the full lock period.
            userStakedAt[msg.sender] = block.timestamp;

            address delegatee = userDelegation[msg.sender];
            if (delegatee == address(0)) delegatee = msg.sender;
            _pushTraceCheckpoint(
                _stakedVoteCheckpoints[delegatee],
                _stakedVoteCheckpoints[delegatee].latest() + uint208(rewards)
            );
            _pushTotalStakedCheckpoint(uint208(totalStakedSupply));

            bool success = RewardDistributor(rewardDistributor).mintAndDistribute(address(this), rewards);
            if (!success) revert ResurgeStaking_RewardMintingFailed();

            emit RewardsClaimed(msg.sender, rewards);
            emit Staked(msg.sender, rewards, address(0));
        }
    }

    /// @notice Changes the staked-vote delegation target for the caller.
    /// @param delegatee Address to delegate to. address(0) reverts to self-delegation.
    function delegateStakedVotes(address delegatee) external {
        _delegateStaked(msg.sender, delegatee == address(0) ? msg.sender : delegatee);
    }

    function setDelegate(address _delegatee) external {
        _delegateStaked(msg.sender, _delegatee == address(0) ? msg.sender : _delegatee);
    }

    function _delegateStaked(address account, address delegatee) internal {
        address from = userDelegation[account] != address(0) ? userDelegation[account] : account;
        if (from == delegatee) return;

        userDelegation[account] = delegatee;
        uint208 weight = uint208(userStakedAmount[account]);
        if (weight > 0) {
            _pushTraceCheckpoint(
                _stakedVoteCheckpoints[from],
                _stakedVoteCheckpoints[from].latest() - weight
            );
            _pushTraceCheckpoint(
                _stakedVoteCheckpoints[delegatee],
                _stakedVoteCheckpoints[delegatee].latest() + weight
            );
        }
        emit DelegationUpdated(account, delegatee);
    }

    function _pushTraceCheckpoint(Checkpoints.Trace208 storage trace, uint208 value) internal {
        (uint208 previousValue, uint208 checkpointValue) = trace.push(uint48(block.number), value);
        if (checkpointValue != value) {
            revert ResurgeStaking_CheckpointWriteFailed();
        }
        if (previousValue > checkpointValue || previousValue < checkpointValue) return;
    }

    function _pushTotalStakedCheckpoint(uint208 value) internal {
        (uint208 previousValue, uint208 checkpointValue) = _totalStakedCheckpoints.push(uint48(block.number), value);
        if (checkpointValue != value) {
            revert ResurgeStaking_CheckpointWriteFailed();
        }
        if (previousValue > checkpointValue || previousValue < checkpointValue) return;
    }

    /// @notice Current staked voting power held by an account (as delegatee).
    function getStakedVotes(address account) public view returns (uint256) {
        return _stakedVoteCheckpoints[account].latest();
    }

    /// @notice Historical staked voting power of an account at a past block number.
    function getPastStakedVotes(address account, uint256 blockNumber) public view returns (uint256) {
        return _stakedVoteCheckpoints[account].upperLookupRecent(uint48(blockNumber));
    }

    /// @notice Total staked supply at a past block number (for quorum calculations).
    function getPastTotalStakedSupply(uint256 blockNumber) public view returns (uint256) {
        return _totalStakedCheckpoints.upperLookupRecent(uint48(blockNumber));
    }

    function setRewardRate(uint256 _newRatePerSecond) external onlyRole(RATE_SETTER_ROLE) whenNotPaused updateReward(address(0)) {
        rewardRatePerSecond = _newRatePerSecond;
        emit RewardRateUpdated(_newRatePerSecond);
    }

    function setUserBoost(address _user, uint256 _boostBps) external onlyRole(TIMELOCK_ROLE) {
        require(_boostBps >= 10000, "Boost must be >= 1x");
        require(_boostBps <= maxBoostBps, "Boost exceeds maximum");
        userBoostBps[_user] = _boostBps;
        emit BoostUpdated(_user, _boostBps);
    }

    function setMaxBoost(uint256 _maxBoostBps) external onlyRole(TIMELOCK_ROLE) {
        require(_maxBoostBps >= 10000, "Max boost must be >= 1x");
        maxBoostBps = _maxBoostBps;
        emit MaxBoostUpdated(_maxBoostBps);
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

    function pause() external onlyRole(EMERGENCY_PAUSER) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function getVotingPower(address _account) public view returns (uint256) {
        return userStakedAmount[_account];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(TIMELOCK_ROLE) {}

    uint256[41] private __gap;
}
