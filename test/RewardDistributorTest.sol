// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/RewardDistributor.sol";
import "../contracts/ResurgeToken.sol";

contract RewardDistributorTest is Test {
    RewardDistributor distributor;
    ResurgeToken token;
    
    address admin = address(0x1);
    address stakingPool = address(0x2);
    address emergencyPauser = address(0x3);
    address user = address(0x4);
    
    function setUp() public {
        token = new ResurgeToken("Resurgence Token", "RESURGE", 1_000_000_000 * 10**18, address(0), admin);
        distributor = new RewardDistributor(address(token), 500_000_000 * 10**18, admin);
        
        // Setup roles
        distributor.grantRole(distributor.TIMELOCK_ROLE(), admin);
        distributor.grantRole(distributor.EMERGENCY_PAUSER(), emergencyPauser);
        
        // Authorize test staking pool
        vm.startPrank(admin);
        distributor.authorizeStakingPool(stakingPool);
    }
    
    function testRoleSetup() public {
        assertTrue(distributor.hasRole(distributor.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(distributor.hasRole(distributor.TIMELOCK_ROLE(), admin));
        assertTrue(distributor.hasRole(distributor.EMERGENCY_PAUSER(), emergencyPauser));
    }
    
    function testAuthorizedMinting() public {
        vm.startPrank(stakingPool);
        distributor.mintAndDistribute(user, 1000 * 10**18);
        assertEq(token.balanceOf(user), 1000 * 10**18);
    }
    
    function testUnauthorizedMinting() public {
        vm.startPrank(user);
        vm.expectRevert("Caller is not an authorized staking pool");
        distributor.mintAndDistribute(user, 1000 * 10**18);
    }
    
    function testPauseFunctionality() public {
        vm.startPrank(emergencyPauser);
        distributor.pause();
        
        vm.startPrank(stakingPool);
        vm.expectRevert("Pausable: paused");
        distributor.mintAndDistribute(user, 1000 * 10**18);
    }
}
