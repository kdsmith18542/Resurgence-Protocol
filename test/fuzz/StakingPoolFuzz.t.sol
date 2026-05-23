// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../contracts/ResurgeToken.sol";
import "../../contracts/DeadCoinStakingPool.sol";
import "../../contracts/StakingPoolManager.sol";
import "../../contracts/RewardDistributor.sol";
import "../../contracts/ResurgenceTimelockController.sol";
import "../../contracts/ResurgenceGovernance.sol";
import "../../contracts/ERC20Mock.sol";

/// @title StakingPoolFuzzTest - Fuzz testing for staking pool operations
/// @notice Tests staking/unstaking/claiming with random inputs to find edge cases
contract StakingPoolFuzzTest is Test {
    ResurgeToken public resurgeToken;
    ResurgenceTimelockController public timelock;
    RewardDistributor public distributor;
    DeadCoinStakingPool public poolImpl;
    StakingPoolManager public manager;
    ERC20Mock public deadCoin;

    address public admin = address(0x1000);
    address public user1 = address(0x2000);
    address public user2 = address(0x3000);
    address public deadCoinPool;

    uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant MAX_MINT = 500_000_000 ether;
    uint256 constant INITIAL_REWARD_RATE = 1 ether; // 1 RESURGE per second

    function setUp() public {
        vm.startPrank(admin);

        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = admin;
        executors[0] = admin;

        timelock = new ResurgenceTimelockController(3600, proposers, executors, admin);

        resurgeToken = ResurgeToken(address(new ERC1967Proxy(
            address(new ResurgeToken()),
            abi.encodeWithSelector(ResurgeToken.initialize.selector, admin, INITIAL_SUPPLY)
        )));

        distributor = RewardDistributor(address(new ERC1967Proxy(
            address(new RewardDistributor()),
            abi.encodeWithSelector(RewardDistributor.initialize.selector, address(resurgeToken), MAX_MINT, address(timelock))
        )));

        poolImpl = new DeadCoinStakingPool();

        manager = StakingPoolManager(address(new ERC1967Proxy(
            address(new StakingPoolManager()),
            abi.encodeWithSelector(StakingPoolManager.initialize.selector,
                address(resurgeToken),
                address(distributor),
                address(poolImpl),
                address(timelock)
            )
        )));

        deadCoin = new ERC20Mock("DeadCoin", "DEAD", 1_000_000_000 ether);

        // Grant roles
        resurgeToken.grantRole(resurgeToken.MINTER_ROLE(), address(distributor));
        resurgeToken.grantRole(resurgeToken.DEFAULT_ADMIN_ROLE(), address(timelock));
        distributor.grantRole(distributor.TIMELOCK_ROLE(), address(timelock));
        distributor.grantRole(distributor.TIMELOCK_ROLE(), address(manager));
        manager.grantRole(manager.TIMELOCK_ROLE(), address(timelock));

        vm.stopPrank();

        // Deploy a staking pool via manager
        vm.prank(address(timelock));
        deadCoinPool = manager.addStakingPool(address(deadCoin), INITIAL_REWARD_RATE, address(timelock), address(timelock));

        // Fund users
        deadCoin.mint(user1, 100_000_000 ether);
        deadCoin.mint(user2, 100_000_000 ether);
    }

    /// @dev Fuzz test: stake random amounts and verify totalStakedSupply
    function testFuzz_Stake(uint256 amount) public {
        amount = bound(amount, 1, 1_000_000 ether);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, amount);
        DeadCoinStakingPool(deadCoinPool).stake(amount);
        vm.stopPrank();

        assertEq(DeadCoinStakingPool(deadCoinPool).totalStakedSupply(), amount);
        assertEq(DeadCoinStakingPool(deadCoinPool).userStakedAmount(user1), amount);
    }

    /// @dev Fuzz test: stake then unstake partial amounts
    function testFuzz_StakeAndPartialUnstake(uint256 stakeAmount, uint256 unstakeAmount) public {
        stakeAmount = bound(stakeAmount, 100, 1_000_000 ether);
        unstakeAmount = bound(unstakeAmount, 1, stakeAmount);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, stakeAmount);
        DeadCoinStakingPool(deadCoinPool).stake(stakeAmount);

        uint256 balanceBefore = deadCoin.balanceOf(user1);
        DeadCoinStakingPool(deadCoinPool).unstake(unstakeAmount);
        uint256 balanceAfter = deadCoin.balanceOf(user1);
        vm.stopPrank();

        assertEq(balanceAfter - balanceBefore, unstakeAmount);
        assertEq(
            DeadCoinStakingPool(deadCoinPool).userStakedAmount(user1),
            stakeAmount - unstakeAmount
        );
        assertEq(
            DeadCoinStakingPool(deadCoinPool).totalStakedSupply(),
            stakeAmount - unstakeAmount
        );
    }

    /// @dev Fuzz test: rewards accrue correctly over random time periods
    function testFuzz_RewardAccrual(uint256 stakeAmount, uint256 timeWarp) public {
        stakeAmount = bound(stakeAmount, 1 ether, 1_000_000 ether);
        timeWarp = bound(timeWarp, 1, 365 days);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, stakeAmount);
        DeadCoinStakingPool(deadCoinPool).stake(stakeAmount);
        vm.stopPrank();

        vm.warp(block.timestamp + timeWarp);

        uint256 earned = DeadCoinStakingPool(deadCoinPool).earned(user1);
        uint256 expected = (timeWarp * INITIAL_REWARD_RATE * 1e18) / 1e18;

        // Allow 1% tolerance for precision
        uint256 tolerance = expected / 100;
        assertApproxEqAbs(earned, expected, tolerance);
    }

    /// @dev Fuzz test: multiple users staking with varying amounts
    function testFuzz_MultiUserStaking(
        uint256 amount1,
        uint256 amount2,
        uint256 timeWarp
    ) public {
        amount1 = bound(amount1, 1 ether, 1_000_000 ether);
        amount2 = bound(amount2, 1 ether, 1_000_000 ether);
        timeWarp = bound(timeWarp, 10, 30 days);

        // User 1 stakes
        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, amount1);
        DeadCoinStakingPool(deadCoinPool).stake(amount1);
        vm.stopPrank();

        // User 2 stakes after some time
        vm.warp(block.timestamp + 100);
        vm.startPrank(user2);
        deadCoin.approve(deadCoinPool, amount2);
        DeadCoinStakingPool(deadCoinPool).stake(amount2);
        vm.stopPrank();

        // Warp forward
        vm.warp(block.timestamp + timeWarp);

        uint256 earned1 = DeadCoinStakingPool(deadCoinPool).earned(user1);
        uint256 earned2 = DeadCoinStakingPool(deadCoinPool).earned(user2);

        assertGt(earned1, 0, "User 1 should have earned rewards");
        assertGt(earned2, 0, "User 2 should have earned rewards");

        uint256 total = DeadCoinStakingPool(deadCoinPool).totalStakedSupply();
        assertEq(total, amount1 + amount2);
    }

    /// @dev Fuzz test: stake 0 should revert
    function testFuzz_StakeZero() public {
        vm.startPrank(user1);
        vm.expectRevert(InvalidAmount.selector);
        DeadCoinStakingPool(deadCoinPool).stake(0);
        vm.stopPrank();
    }

    /// @dev Fuzz test: unstake more than staked should revert
    function testFuzz_UnstakeExcess(uint256 stakeAmount, uint256 excessAmount) public {
        stakeAmount = bound(stakeAmount, 1, 1_000_000 ether);
        excessAmount = bound(excessAmount, stakeAmount + 1, type(uint256).max);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, stakeAmount);
        DeadCoinStakingPool(deadCoinPool).stake(stakeAmount);

        vm.expectRevert(InsufficientBalance.selector);
        DeadCoinStakingPool(deadCoinPool).unstake(excessAmount);
        vm.stopPrank();
    }

    /// @dev Fuzz test: claim rewards after random time
    function testFuzz_ClaimRewards(uint256 stakeAmount, uint256 timeWarp) public {
        stakeAmount = bound(stakeAmount, 1 ether, 100_000 ether);
        timeWarp = bound(timeWarp, 1, 30 days);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, stakeAmount);
        DeadCoinStakingPool(deadCoinPool).stake(stakeAmount);
        vm.stopPrank();

        vm.warp(block.timestamp + timeWarp);

        uint256 earned = DeadCoinStakingPool(deadCoinPool).earned(user1);
        uint256 balanceBefore = resurgeToken.balanceOf(user1);

        vm.prank(user1);
        DeadCoinStakingPool(deadCoinPool).claimRewards();

        uint256 balanceAfter = resurgeToken.balanceOf(user1);

        assertEq(balanceAfter - balanceBefore, earned, "Claimed amount should match earned");
        assertEq(DeadCoinStakingPool(deadCoinPool).userRewards(user1), 0, "Pending rewards should be 0");
    }

    /// @dev Fuzz test: claim with no rewards should succeed (no-op)
    function testFuzz_ClaimNoRewards() public {
        vm.prank(user1);
        DeadCoinStakingPool(deadCoinPool).claimRewards();
    }

    /// @dev Fuzz test: reward rate update affects future accrual
    function testFuzz_RewardRateUpdate(uint256 initialStake, uint256 newRate, uint256 timeWarp) public {
        initialStake = bound(initialStake, 1 ether, 100_000 ether);
        newRate = bound(newRate, 0.1 ether, 10 ether);
        timeWarp = bound(timeWarp, 100, 7 days);

        vm.startPrank(user1);
        deadCoin.approve(deadCoinPool, initialStake);
        DeadCoinStakingPool(deadCoinPool).stake(initialStake);
        vm.stopPrank();

        // Update reward rate
        vm.prank(address(timelock));
        DeadCoinStakingPool(deadCoinPool).setRewardRate(newRate);

        vm.warp(block.timestamp + timeWarp);

        uint256 earned = DeadCoinStakingPool(deadCoinPool).earned(user1);
        assertGt(earned, 0, "Should earn rewards at new rate");
    }
}
