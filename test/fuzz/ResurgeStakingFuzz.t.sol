// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/ResurgeToken.sol";
import "../../contracts/ResurgeStakingPool.sol";
import "../../contracts/RewardDistributor.sol";
import "../../contracts/ResurgenceTimelockController.sol";
import "../../contracts/MockOracle.sol";

contract ResurgeStakingFuzzTest is Test {
    ResurgeToken public token;
    RewardDistributor public distributor;
    ResurgenceTimelockController public timelock;
    ResurgeStakingPool public staking;
    MockOracle public oracle;

    address public admin = address(0x1000);
    address public user1 = address(0x2000);
    address public user2 = address(0x3000);

    uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant INITIAL_REWARD_RATE = 1 ether;

    function setUp() public {
        vm.startPrank(admin);

        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = admin;
        executors[0] = admin;

        timelock = new ResurgenceTimelockController(3600, proposers, executors, admin);
        token = new ResurgeToken();
        token.initialize(admin, INITIAL_SUPPLY);

        distributor = new RewardDistributor();
        distributor.initialize(address(token), INITIAL_SUPPLY / 2, address(timelock));

        oracle = new MockOracle();
        oracle.setPrice(5000000, 8); // $0.05
        
        // RewardDistributor initialization needs TIMELOCK_ROLE for some things, but initialize grants to timelock param
        // We granted it to timelock, let's also grant to admin for setup
        distributor.grantRole(distributor.TIMELOCK_ROLE(), admin);

        staking = new ResurgeStakingPool();
        staking.initialize(address(token), address(distributor), address(timelock), INITIAL_REWARD_RATE);
        
        // Setup roles
        token.grantRole(token.MINTER_ROLE(), address(distributor));
        distributor.authorizeStakingPool(address(staking));
        
        vm.stopPrank();

        // Fund users
        vm.startPrank(admin);
        token.mint(user1, 100_000 ether);
        token.mint(user2, 100_000 ether);
        vm.stopPrank();
    }

    function testFuzz_ResurgeStake(uint256 amount) public {
        amount = bound(amount, 1 ether, 10_000 ether);
        
        vm.startPrank(user1);
        token.approve(address(staking), amount);
        staking.stake(amount, address(0));
        vm.stopPrank();

        assertEq(staking.userStakedAmount(user1), amount);
        assertEq(staking.totalStakedSupply(), amount);
    }

    function testFuzz_ResurgeUnstakeEarlyPenalty(uint256 amount, uint256 timeWarp) public {
        amount = bound(amount, 1 ether, 10_000 ether);
        timeWarp = bound(timeWarp, 1, 7 days - 1); // Less than minStakeDuration
        
        vm.startPrank(user1);
        token.approve(address(staking), amount);
        staking.stake(amount, address(0));
        
        vm.warp(block.timestamp + timeWarp);
        
        uint256 balanceBefore = token.balanceOf(user1);
        staking.unstake(amount);
        uint256 balanceAfter = token.balanceOf(user1);
        vm.stopPrank();

        uint256 expectedPenalty = (amount * 500) / 10000; // 5%
        assertEq(balanceAfter - balanceBefore, amount - expectedPenalty);
    }

    function testFuzz_ResurgeUnstakeNoPenalty(uint256 amount, uint256 timeWarp) public {
        amount = bound(amount, 1 ether, 10_000 ether);
        timeWarp = bound(timeWarp, 7 days, 30 days);
        
        vm.startPrank(user1);
        token.approve(address(staking), amount);
        staking.stake(amount, address(0));
        
        vm.warp(block.timestamp + timeWarp);
        
        uint256 balanceBefore = token.balanceOf(user1);
        staking.unstake(amount);
        uint256 balanceAfter = token.balanceOf(user1);
        vm.stopPrank();

        assertEq(balanceAfter - balanceBefore, amount);
    }

    function testFuzz_ResurgeBoostedRewards(uint256 amount, uint256 boostBps, uint256 timeWarp) public {
        amount = bound(amount, 10 ether, 1000 ether);
        boostBps = bound(boostBps, 10000, 20000); // 1x to 2x
        timeWarp = bound(timeWarp, 1 hours, 24 hours);

        vm.prank(admin);
        staking.setUserBoost(user1, boostBps);

        vm.startPrank(user1);
        token.approve(address(staking), amount);
        staking.stake(amount, address(0));
        vm.stopPrank();

        vm.warp(block.timestamp + timeWarp);

        uint256 earned = staking.earned(user1);
        uint256 baseExpected = (timeWarp * INITIAL_REWARD_RATE);
        uint256 boostedExpected = (baseExpected * boostBps) / 10000;

        // Tolerance for block timestamp and precision
        assertApproxEqAbs(earned, boostedExpected, 1 ether);
    }

    function testFuzz_ResurgeClaimAndRestake(uint256 amount, uint256 timeWarp) public {
        amount = bound(amount, 1 ether, 1000 ether);
        timeWarp = bound(timeWarp, 1 days, 7 days);

        vm.startPrank(user1);
        token.approve(address(staking), amount);
        staking.stake(amount, address(0));
        vm.stopPrank();

        vm.warp(block.timestamp + timeWarp);

        uint256 earnedBefore = staking.earned(user1);
        
        vm.prank(user1);
        staking.claimAndRestake();

        assertEq(staking.userStakedAmount(user1), amount + earnedBefore);
        assertEq(staking.userRewards(user1), 0);
    }
}
