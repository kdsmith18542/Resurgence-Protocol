// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/StakingPoolManager.sol";
import "../contracts/RewardDistributor.sol";
import "../contracts/ResurgeToken.sol";

contract StakingPoolManagerTest is Test {
    StakingPoolManager manager;
    ResurgeToken token;
    RewardDistributor distributor;
    
    address admin = address(0x1);
    address timelock = address(0x2);
    address emergencyPauser = address(0x3);
    address deadCoin = address(0x4);
    
    function setUp() public {
        token = new ResurgeToken("Resurgence Token", "RESURGE", 1_000_000_000 * 10**18, address(0), admin);
        distributor = new RewardDistributor(address(token), 500_000_000 * 10**18, timelock);
        manager = new StakingPoolManager(address(token), address(distributor), timelock);
        
        // Setup roles
        manager.grantRole(manager.TIMELOCK_ROLE(), timelock);
        manager.grantRole(manager.EMERGENCY_PAUSER(), emergencyPauser);
    }
    
    function testRoleSetup() public {
        assertTrue(manager.hasRole(manager.DEFAULT_ADMIN_ROLE(), timelock));
        assertTrue(manager.hasRole(manager.TIMELOCK_ROLE(), timelock));
        assertTrue(manager.hasRole(manager.EMERGENCY_PAUSER(), emergencyPauser));
    }
    
    function testAddStakingPool() public {
        vm.startPrank(timelock);
        address pool = manager.addStakingPool(deadCoin, 100);
        
        assertEq(manager.deadCoinToPoolAddress(deadCoin), pool);
        assertTrue(distributor.authorizedStakingPools(pool));
    }
    
    function testUnauthorizedAddStakingPool() public {
        vm.startPrank(address(0x999));
        vm.expectRevert();
        manager.addStakingPool(deadCoin, 100);
    }
    
    function testPauseFunctionality() public {
        vm.startPrank(emergencyPauser);
        manager.pause();
        
        vm.startPrank(timelock);
        vm.expectRevert("Pausable: paused");
        manager.addStakingPool(deadCoin, 100);
    }
}
