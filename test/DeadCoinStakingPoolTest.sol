// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/DeadCoinStakingPool.sol";
import "../contracts/ResurgeToken.sol";
import "../contracts/RewardDistributor.sol";

contract DeadCoinStakingPoolTest is Test {
    DeadCoinStakingPool pool;
    ResurgeToken token;
    RewardDistributor distributor;
    
    address admin = address(0x1);
    address timelock = address(0x2);
    address user = address(0x3);
    address deadCoin = address(0x4);
    
    function setUp() public {
        token = new ResurgeToken("Resurgence Token", "RESURGE", 1_000_000_000 * 10**18, address(0), admin);
        distributor = new RewardDistributor(address(token), 500_000_000 * 10**18, timelock);
        pool = new DeadCoinStakingPool(
            deadCoin,
            address(token),
            address(distributor),
            address(this),
            timelock
        );
        
        // Setup roles
        pool.grantRole(pool.TIMELOCK_ROLE(), timelock);
        
        // Set reward rate
        vm.startPrank(timelock);
        pool.setRewardRate(100); // 100 tokens per second
    }
    
    function testStaking() public {
        // Mock deadCoin transfer
        vm.prank(deadCoin);
        IERC20(deadCoin).transfer(user, 1000);
        
        vm.startPrank(user);
        IERC20(deadCoin).approve(address(pool), 1000);
        pool.stake(1000);
        
        assertEq(pool.userStakedAmount(user), 1000);
        assertEq(pool.totalStakedSupply(), 1000);
    }
    
    function testUnstaking() public {
        testStaking(); // Setup stake first
        
        vm.startPrank(user);
        pool.unstake(500);
        
        assertEq(pool.userStakedAmount(user), 500);
        assertEq(pool.totalStakedSupply(), 500);
    }
    
    function testRewardCalculation() public {
        testStaking(); // Setup stake first
        
        // Advance time by 10 seconds
        vm.warp(block.timestamp + 10);
        
        assertEq(pool.earned(user), 1000); // 100 tokens/sec * 10 sec
    }
}
