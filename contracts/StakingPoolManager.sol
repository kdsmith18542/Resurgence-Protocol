// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ResurgenceProtocol.sol";
import "./DeadCoinStakingPool.sol";
import "./RewardDistributor.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IDeadCoinStakingPool {
    function setRewardRate(uint256 _newRatePerSecond) external;
    function pause() external;
    function unpause() external;
    function grantRole(bytes32 role, address account) external;
    function TIMELOCK_ROLE() external view returns (bytes32);
}

contract StakingPoolManager is AccessControl, Pausable {
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    bytes32 public constant EMERGENCY_PAUSER = keccak256("EMERGENCY_PAUSER");
    
    mapping(address => address) public deadCoinToPoolAddress;
    address[] public supportedDeadCoins;
    address public resurgenceTokenAddress;
    address public rewardDistributorAddress;

    event StakingPoolAdded(address indexed deadCoinAddress, address indexed poolAddress, uint256 initialRewardRate);
    event RewardRateUpdated(address indexed deadCoinAddress, uint256 newRatePerSecond);
    event StakingPoolPaused(address indexed deadCoinAddress, address indexed poolAddress);
    event StakingPoolUnpaused(address indexed deadCoinAddress, address indexed poolAddress);
    event StakingPoolRemoved(address indexed deadCoinAddress, address indexed poolAddress);
    event RoleGrantRequested(address indexed poolAddress, address indexed account, bytes32 role);

    constructor(
        address _resurgenceTokenAddress, 
        address _rewardDistributorAddress,
        address _timelock
    ) {
        resurgenceTokenAddress = _resurgenceTokenAddress;
        rewardDistributorAddress = _rewardDistributorAddress;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _timelock);
        _grantRole(TIMELOCK_ROLE, _timelock);
        _grantRole(EMERGENCY_PAUSER, _timelock);
    }

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
        require(deadCoinToPoolAddress[_deadCoinAddress] == address(0), "Pool already exists");
        require(_timelock != address(0), "Invalid timelock address");
        
        // Deploy the new pool
        DeadCoinStakingPool newPool = new DeadCoinStakingPool(
            _deadCoinAddress,
            resurgenceTokenAddress,
            rewardDistributorAddress,
            address(this),
            _timelock
        );
        
        // Get the pool address
        address poolAddress = address(newPool);
        
        // The timelock will need to call grantRole on the pool directly
        emit RoleGrantRequested(poolAddress, address(this), newPool.TIMELOCK_ROLE());
        
        // Note: The timelock should call grantRole on the pool to give this contract the TIMELOCK_ROLE
        // This is done separately to follow the principle of least privilege

        // Store the pool address
        deadCoinToPoolAddress[_deadCoinAddress] = poolAddress;
        supportedDeadCoins.push(_deadCoinAddress);

        // Authorize the pool in the reward distributor
        RewardDistributor(rewardDistributorAddress).authorizeStakingPool(poolAddress);
        
        emit StakingPoolAdded(_deadCoinAddress, poolAddress, _initialRewardRatePerSecond);
        return poolAddress;
    }

    function setRewardRate(address _deadCoinAddress, uint256 _newRatePerSecond) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        require(poolAddress != address(0), "Pool does not exist");
        IDeadCoinStakingPool(poolAddress).setRewardRate(_newRatePerSecond);
        emit RewardRateUpdated(_deadCoinAddress, _newRatePerSecond);
    }

    function pauseStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        require(poolAddress != address(0), "Pool does not exist");
        IDeadCoinStakingPool(poolAddress).pause();
        emit StakingPoolPaused(_deadCoinAddress, poolAddress);
    }

    function unpauseStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        require(poolAddress != address(0), "Pool does not exist");
        IDeadCoinStakingPool(poolAddress).unpause();
        emit StakingPoolUnpaused(_deadCoinAddress, poolAddress);
    }

    function removeStakingPool(address _deadCoinAddress) 
        public 
        onlyRole(TIMELOCK_ROLE) 
        whenNotPaused 
    {
        address poolAddress = deadCoinToPoolAddress[_deadCoinAddress];
        require(poolAddress != address(0), "Pool does not exist");

        // TODO: Handle implications for staked funds (e.g., enable unstake only, migrate funds)

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

    function pause() public onlyRole(EMERGENCY_PAUSER) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}