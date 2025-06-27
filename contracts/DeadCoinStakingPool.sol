// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

interface IRewardDistributor {
    function mintAndDistribute(address _to, uint256 _amount) external returns (bool);
}

contract DeadCoinStakingPool is AccessControl, Pausable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    
    IERC20 public immutable deadCoin;
    IERC20 public immutable resurgenceToken;
    address public immutable rewardDistributor;
    address public immutable stakingPoolManager;

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

    constructor(
        address _deadCoinAddress,
        address _resurgenceTokenAddress,
        address _rewardDistributorAddress,
        address _stakingPoolManagerAddress,
        address _timelock
    ) {
        deadCoin = IERC20(_deadCoinAddress);
        resurgenceToken = IERC20(_resurgenceTokenAddress);
        rewardDistributor = _rewardDistributorAddress;
        stakingPoolManager = _stakingPoolManagerAddress;
        
        // Grant roles to the timelock
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);
        
        // Also grant TIMELOCK_ROLE to the StakingPoolManager
        _grantRole(TIMELOCK_ROLE, _stakingPoolManagerAddress);
    }

    modifier updateReward() {
        rewardPerTokenStored = _updateReward(totalStakedSupply);
        lastUpdateTime = block.timestamp;
        _;
    }

    function _updateReward(uint256 _totalStakedSupply) internal view returns (uint256) {
        if (_totalStakedSupply == 0 || rewardRatePerSecond == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + 
            ((block.timestamp - lastUpdateTime) * rewardRatePerSecond * 1e18) / _totalStakedSupply;
    }

    function earned(address _account) public view returns (uint256) {
        uint256 _rewardPerTokenStored = rewardPerTokenStored;
        if (block.timestamp > lastUpdateTime) {
            _rewardPerTokenStored = _updateReward(totalStakedSupply);
        }
        
        return userRewards[_account] + (userStakedAmount[_account] * (_rewardPerTokenStored - userRewardPerTokenPaid[_account])) / 1e18;
    }

    function stake(uint256 _amount) external whenNotPaused updateReward {
        require(_amount > 0, "Cannot stake 0");
        
        // Update rewards before staking
        userRewards[msg.sender] = earned(msg.sender);
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;
        
        // Transfer tokens from user
        require(deadCoin.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        // Update balances
        userStakedAmount[msg.sender] += _amount;
        totalStakedSupply += _amount;
        
        emit Staked(msg.sender, _amount);
    }
    
    function unstake(uint256 _amount) external whenNotPaused updateReward {
        require(_amount > 0, "Cannot unstake 0");
        require(userStakedAmount[msg.sender] >= _amount, "Insufficient balance");
        
        // Update rewards before unstaking
        userRewards[msg.sender] = earned(msg.sender);
        userRewardPerTokenPaid[msg.sender] = rewardPerTokenStored;
        
        // Update balances
        userStakedAmount[msg.sender] -= _amount;
        totalStakedSupply -= _amount;
        
        // Transfer tokens back to user
        require(deadCoin.transfer(msg.sender, _amount), "Transfer failed");
        
        emit Unstaked(msg.sender, _amount);
    }
    
    function claimRewards() public whenNotPaused updateReward {
        // Get the total rewards for the user (stored + newly earned)
        uint256 rewards = userRewards[msg.sender];
        
        if (rewards > 0) {
            // Reset the rewards for the user before external call to prevent reentrancy
            userRewards[msg.sender] = 0;
            
            // Mint and distribute the rewards
            bool success = IRewardDistributor(rewardDistributor).mintAndDistribute(msg.sender, rewards);
            require(success, "Failed to mint and distribute rewards");
            
            emit RewardsClaimed(msg.sender, rewards);
        }
    }

    function setRewardRate(uint256 _newRatePerSecond) external onlyRole(TIMELOCK_ROLE) whenNotPaused {
        rewardRatePerSecond = _newRatePerSecond;
        lastUpdateTime = block.timestamp;
        emit RewardRateUpdated(_newRatePerSecond);
    }

    function pause() external onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}