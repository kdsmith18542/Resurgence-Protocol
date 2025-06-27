// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/ResurgeToken.sol";

contract ResurgeTokenTest is Test {
    ResurgeToken token;
    address admin = address(0x1);
    address rewardDistributor = address(0x2);
    address user = address(0x3);
    
    function setUp() public {
        token = new ResurgeToken(
            "Resurgence Token",
            "RESURGE",
            1_000_000_000 * 10**18,
            rewardDistributor,
            admin
        );
    }
    
    function testInitialRoles() public {
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.MINTER_ROLE(), rewardDistributor));
        assertTrue(token.hasRole(token.PAUSER_ROLE(), admin));
    }
    
    function testMinting() public {
        vm.startPrank(rewardDistributor);
        token.mint(user, 1000 * 10**18);
        assertEq(token.balanceOf(user), 1000 * 10**18);
    }
    
    function testPauseFunctionality() public {
        vm.startPrank(admin);
        token.pause();
        
        vm.startPrank(rewardDistributor);
        vm.expectRevert("Pausable: paused");
        token.mint(user, 1000 * 10**18);
    }
}
