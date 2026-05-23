const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("DeadCoinStakingPool (Upgradeable)", function () {
  let resurgeToken, rewardDistributor, stakingPoolManager, timelock, deadCoin;
  let owner, user, admin;
  let poolAddress, pool, poolImplementation;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000");
  const REWARD_RATE = ethers.parseEther("1");
  const STAKE_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, timelock, user, admin] = await ethers.getSigners();

    // Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, INITIAL_SUPPLY], { kind: 'uups' });
    await resurgeToken.waitForDeployment();

    // Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_SUPPLY / 2n,
      timelock.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();

    // Deploy DeadCoinStakingPool Implementation
    const DeadCoinStakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
    poolImplementation = await DeadCoinStakingPool.deploy();
    await poolImplementation.waitForDeployment();

    // Deploy StakingPoolManager (Proxy)
    const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
    stakingPoolManager = await upgrades.deployProxy(StakingPoolManager, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      await poolImplementation.getAddress(),
      timelock.address
    ], { kind: 'uups' });
    await stakingPoolManager.waitForDeployment();

    // Deploy Mock Dead Coin
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await MockERC20.deploy("Dead Coin", "DEAD", INITIAL_SUPPLY);
    await deadCoin.waitForDeployment();

    // Setup Roles
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();
    const DEFAULT_ADMIN_ROLE = await resurgeToken.DEFAULT_ADMIN_ROLE();
    
    // Grant roles to owner for easier testing of administrative functions
    await resurgeToken.connect(timelock).grantRole(DEFAULT_ADMIN_ROLE, owner.address);
    await rewardDistributor.connect(timelock).grantRole(DEFAULT_ADMIN_ROLE, owner.address);
    await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);
    await stakingPoolManager.connect(timelock).grantRole(DEFAULT_ADMIN_ROLE, owner.address);
    await stakingPoolManager.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);

    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
    await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, await stakingPoolManager.getAddress());

    // Add Staking Pool (this deploys a proxy)
    await stakingPoolManager.connect(timelock).addStakingPool(
      await deadCoin.getAddress(),
      REWARD_RATE,
      timelock.address,
      timelock.address
    );
    poolAddress = await stakingPoolManager.deadCoinToPoolAddress(await deadCoin.getAddress());
    pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);

    // Authorize pool in distributor
    await rewardDistributor.connect(timelock).authorizeStakingPool(poolAddress);
    
    // Grant TIMELOCK_ROLE to owner on the pool for upgrade test
    await pool.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);
  });

  async function setupStakedUser() {
    await deadCoin.mint(user.address, STAKE_AMOUNT);
    await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
    await pool.connect(user).stake(STAKE_AMOUNT);
  }

  describe("Staking", function () {
    it("Should allow staking tokens", async function () {
      await deadCoin.mint(user.address, STAKE_AMOUNT);
      await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
      
      await expect(pool.connect(user).stake(STAKE_AMOUNT))
        .to.emit(pool, "Staked")
        .withArgs(user.address, STAKE_AMOUNT);

      expect(await pool.userStakedAmount(user.address)).to.equal(STAKE_AMOUNT);
      expect(await pool.totalStakedSupply()).to.equal(STAKE_AMOUNT);
    });

    it("Should revert staking zero amount", async function () {
      await expect(pool.connect(user).stake(0))
        .to.be.revertedWithCustomError(pool, "InvalidAmount");
    });

    it("Should allow multiple users to stake", async function () {
      const user2 = admin;
      await deadCoin.mint(user.address, STAKE_AMOUNT);
      await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
      await deadCoin.mint(user2.address, STAKE_AMOUNT);
      await deadCoin.connect(user2).approve(poolAddress, STAKE_AMOUNT);

      await pool.connect(user).stake(STAKE_AMOUNT);
      await pool.connect(user2).stake(STAKE_AMOUNT);

      expect(await pool.userStakedAmount(user.address)).to.equal(STAKE_AMOUNT);
      expect(await pool.userStakedAmount(user2.address)).to.equal(STAKE_AMOUNT);
      expect(await pool.totalStakedSupply()).to.equal(STAKE_AMOUNT * 2n);
    });
  });

  describe("Unstaking", function () {
    it("Should allow unstaking full amount", async function () {
      await setupStakedUser();

      await expect(pool.connect(user).unstake(STAKE_AMOUNT))
        .to.emit(pool, "Unstaked")
        .withArgs(user.address, STAKE_AMOUNT);

      expect(await pool.userStakedAmount(user.address)).to.equal(0);
      expect(await pool.totalStakedSupply()).to.equal(0);
    });

    it("Should allow partial unstaking", async function () {
      await setupStakedUser();
      const partialAmount = STAKE_AMOUNT / 4n;

      await pool.connect(user).unstake(partialAmount);
      expect(await pool.userStakedAmount(user.address)).to.equal(STAKE_AMOUNT - partialAmount);
      expect(await pool.totalStakedSupply()).to.equal(STAKE_AMOUNT - partialAmount);
    });

    it("Should revert unstaking more than staked balance", async function () {
      await setupStakedUser();
      const excessAmount = STAKE_AMOUNT + 1n;

      await expect(pool.connect(user).unstake(excessAmount))
        .to.be.revertedWithCustomError(pool, "InsufficientBalance");
    });

    it("Should revert unstaking zero amount", async function () {
      await expect(pool.connect(user).unstake(0))
        .to.be.revertedWithCustomError(pool, "InvalidAmount");
    });
  });

  describe("Rewards", function () {
    it("Should calculate rewards correctly over time", async function () {
      await setupStakedUser();
      const startTime = await pool.lastUpdateTime();

      const duration = 10;
      await time.increaseTo(startTime + BigInt(duration));
      await mine();

      const earned = await pool.earned(user.address);
      const expectedRewards = REWARD_RATE * BigInt(duration);
      
      // Allow for small difference due to the block mined by mine()
      expect(earned).to.be.gte(expectedRewards);
      expect(earned).to.be.closeTo(expectedRewards, ethers.parseEther("1.1"));
    });

    it("Should return zero earned rewards when no time has passed", async function () {
      await setupStakedUser();

      const earned = await pool.earned(user.address);
      // May accrue 1 second of rewards due to block timing after stake
      expect(earned).to.be.closeTo(0n, ethers.parseEther("2"));
    });

    it("Should return zero earned rewards for non-staker", async function () {
      const earned = await pool.earned(admin.address);
      expect(earned).to.equal(0);
    });

    it("Should allow claiming rewards", async function () {
      await setupStakedUser();

      await time.increase(10);
      await mine();

      const balanceBefore = await resurgeToken.balanceOf(user.address);
      const tx = await pool.connect(user).claimRewards();
      const receipt = await tx.wait();
      const balanceAfter = await resurgeToken.balanceOf(user.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
      expect(await pool.earned(user.address)).to.equal(0);

      const event = receipt.logs.find(l => l.fragment?.name === "RewardsClaimed");
      expect(event).to.not.be.undefined;
      expect(event.args.user).to.equal(user.address);
      expect(event.args.amount).to.be.gt(0);
    });

    it("Should not revert when claiming zero rewards", async function () {
      await setupStakedUser();

      await expect(pool.connect(user).claimRewards()).to.not.be.reverted;
    });

    it("Should accumulate rewards across multiple claim periods", async function () {
      await setupStakedUser();
      const claimAmounts = [];

      for (let i = 0; i < 3; i++) {
        await time.increase(5);
        await mine();
        const earnedBeforeClaim = await pool.earned(user.address);
        claimAmounts.push(earnedBeforeClaim);
        await pool.connect(user).claimRewards();
      }

      // Each claim should have returned non-zero rewards
      for (const amount of claimAmounts) {
        expect(amount).to.be.gt(0);
      }
    });

    it("Should allow compounding rewards to ResurgeStakingPool", async function () {
      await setupStakedUser();
      
      // Deploy ResurgeStakingPool
      const ResurgeStakingPool = await ethers.getContractFactory("ResurgeStakingPool");
      const resurgePool = await upgrades.deployProxy(ResurgeStakingPool, [
        await resurgeToken.getAddress(),
        await rewardDistributor.getAddress(),
        timelock.address,
        REWARD_RATE
      ], { kind: 'uups' });
      await resurgePool.waitForDeployment();
      const resurgePoolAddress = await resurgePool.getAddress();

      // Authorize the new pool in distributor
      await rewardDistributor.connect(timelock).authorizeStakingPool(resurgePoolAddress);

      await time.increase(100);
      await mine();
      
      const earnedBefore = await pool.earned(user.address);
      expect(earnedBefore).to.be.gt(0);

      await pool.connect(timelock).setProtocolFee(0);

      await pool.connect(user).claimAndRestakeTo(resurgePoolAddress);

      expect(await pool.userRewards(user.address)).to.equal(0);
      expect(await resurgePool.userStakedAmount(user.address)).to.be.closeTo(earnedBefore, ethers.parseEther("2"));
    });
  });

  describe("Access Control", function () {
    it("Should only allow TIMELOCK_ROLE to set reward rate", async function () {
      await expect(pool.connect(user).setRewardRate(100))
        .to.be.reverted;
    });

    it("Should only allow EMERGENCY_PAUSER to pause", async function () {
      await expect(pool.connect(user).pause())
        .to.be.reverted;
    });

    it("Should only allow DEFAULT_ADMIN_ROLE to unpause", async function () {
      await pool.connect(timelock).pause();
      await expect(pool.connect(user).unpause())
        .to.be.reverted;
    });
  });

  describe("Pause Functionality", function () {
    it("Should prevent staking when paused", async function () {
      await pool.connect(timelock).pause();
      await expect(pool.connect(user).stake(STAKE_AMOUNT))
        .to.be.revertedWithCustomError(pool, "EnforcedPause");
    });

    it("Should prevent unstaking when paused", async function () {
      await setupStakedUser();
      await pool.connect(timelock).pause();
      await expect(pool.connect(user).unstake(STAKE_AMOUNT))
        .to.be.revertedWithCustomError(pool, "EnforcedPause");
    });

    it("Should prevent claiming rewards when paused", async function () {
      await setupStakedUser();
      await pool.connect(timelock).pause();
      await expect(pool.connect(user).claimRewards())
        .to.be.revertedWithCustomError(pool, "EnforcedPause");
    });

    it("Should allow operations after unpause", async function () {
      await pool.connect(timelock).pause();
      await pool.connect(timelock).unpause();

      await deadCoin.mint(user.address, STAKE_AMOUNT);
      await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
      await expect(pool.connect(user).stake(STAKE_AMOUNT))
        .to.emit(pool, "Staked");
    });
  });

  describe("Protocol Treasury Fee", function () {
    it("Should apply 10% fee on reward claim", async function () {
      await setupStakedUser();
      await time.increase(10);
      await mine();

      const userBalanceBefore = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceBefore = await resurgeToken.balanceOf(timelock.address);

      const tx = await pool.connect(user).claimRewards();
      const receipt = await tx.wait();

      const claimedEvent = receipt.logs.find(l => l.fragment?.name === "RewardsClaimed");
      expect(claimedEvent).to.not.be.undefined;
      const claimedAmount = claimedEvent.args.amount;

      const userBalanceAfter = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceAfter = await resurgeToken.balanceOf(timelock.address);

      const userReceived = userBalanceAfter - userBalanceBefore;
      const treasuryReceived = treasuryBalanceAfter - treasuryBalanceBefore;

      const expectedFee = (claimedAmount * 1000n) / 10000n;
      const expectedUserAmount = claimedAmount - expectedFee;

      expect(userReceived).to.be.closeTo(expectedUserAmount, ethers.parseEther("0.001"));
      expect(treasuryReceived).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
      expect(userReceived + treasuryReceived).to.be.closeTo(claimedAmount, ethers.parseEther("0.001"));

      // Verify events
      const feePaidEvent = receipt.logs.find(l => l.fragment?.name === "ProtocolFeePaid");
      expect(feePaidEvent).to.not.be.undefined;
      expect(feePaidEvent.args.pool).to.equal(poolAddress);
      expect(feePaidEvent.args.treasury).to.equal(timelock.address);
      expect(feePaidEvent.args.amount).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
    });

    it("Should apply fee on claimRewardsFor (batch)", async function () {
      await setupStakedUser();
      await time.increase(10);
      await mine();

      const userBalanceBefore = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceBefore = await resurgeToken.balanceOf(timelock.address);

      const tx = await stakingPoolManager.connect(user).batchClaimRewards([await deadCoin.getAddress()]);
      const receipt = await tx.wait();

      const claimedEvent = receipt.logs.map(log => {
        try { return pool.interface.parseLog(log); } catch (e) { return null; }
      }).find(l => l && l.name === "RewardsClaimed");
      expect(claimedEvent).to.not.be.undefined;
      const claimedAmount = claimedEvent.args.amount;

      const userBalanceAfter = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceAfter = await resurgeToken.balanceOf(timelock.address);

      const userReceived = userBalanceAfter - userBalanceBefore;
      const treasuryReceived = treasuryBalanceAfter - treasuryBalanceBefore;

      const expectedFee = (claimedAmount * 1000n) / 10000n;
      const expectedUserAmount = claimedAmount - expectedFee;

      expect(userReceived).to.be.closeTo(expectedUserAmount, ethers.parseEther("0.001"));
      expect(treasuryReceived).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
    });

    it("Should apply fee on claimAndRestakeTo", async function () {
      await setupStakedUser();
      
      // Deploy ResurgeStakingPool
      const ResurgeStakingPool = await ethers.getContractFactory("ResurgeStakingPool");
      const resurgePool = await upgrades.deployProxy(ResurgeStakingPool, [
        await resurgeToken.getAddress(),
        await rewardDistributor.getAddress(),
        timelock.address,
        REWARD_RATE
      ], { kind: 'uups' });
      await resurgePool.waitForDeployment();
      const resurgePoolAddress = await resurgePool.getAddress();

      await rewardDistributor.connect(timelock).authorizeStakingPool(resurgePoolAddress);

      await time.increase(10);
      await mine();

      const treasuryBalanceBefore = await resurgeToken.balanceOf(timelock.address);

      const tx = await pool.connect(user).claimAndRestakeTo(resurgePoolAddress);
      const receipt = await tx.wait();

      const claimedEvent = receipt.logs.find(l => l.fragment?.name === "RewardsClaimed");
      expect(claimedEvent).to.not.be.undefined;
      const claimedAmount = claimedEvent.args.amount;

      const treasuryBalanceAfter = await resurgeToken.balanceOf(timelock.address);
      const treasuryReceived = treasuryBalanceAfter - treasuryBalanceBefore;

      const expectedFee = (claimedAmount * 1000n) / 10000n;
      const expectedUserAmount = claimedAmount - expectedFee;

      expect(treasuryReceived).to.be.closeTo(expectedFee, ethers.parseEther("0.001"));
      expect(await resurgePool.userStakedAmount(user.address)).to.be.closeTo(expectedUserAmount, ethers.parseEther("0.001"));
    });

    it("Should support 0 bps fee (no fee taken)", async function () {
      // Set fee to 0
      await pool.connect(timelock).setProtocolFee(0);

      await setupStakedUser();
      await time.increase(10);
      await mine();

      const userBalanceBefore = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceBefore = await resurgeToken.balanceOf(timelock.address);

      const tx = await pool.connect(user).claimRewards();
      const receipt = await tx.wait();

      const claimedEvent = receipt.logs.find(l => l.fragment?.name === "RewardsClaimed");
      expect(claimedEvent).to.not.be.undefined;
      const claimedAmount = claimedEvent.args.amount;

      const userBalanceAfter = await resurgeToken.balanceOf(user.address);
      const treasuryBalanceAfter = await resurgeToken.balanceOf(timelock.address);

      expect(userBalanceAfter - userBalanceBefore).to.be.closeTo(claimedAmount, ethers.parseEther("0.001"));
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(0);
    });

    it("Should allow max 30% fee and reject higher", async function () {
      await expect(pool.connect(timelock).setProtocolFee(3001))
        .to.be.revertedWithCustomError(pool, "InvalidAmount");

      await expect(pool.connect(timelock).setProtocolFee(3000))
        .to.emit(pool, "ProtocolFeeUpdated")
        .withArgs(1000, 3000);

      expect(await pool.protocolFeeBps()).to.equal(3000);
    });

    it("Should only allow TIMELOCK_ROLE to update fee and treasury", async function () {
      await expect(pool.connect(user).setProtocolFee(2000))
        .to.be.reverted;

      await expect(pool.connect(user).setTreasury(user.address))
        .to.be.reverted;

      await expect(pool.connect(timelock).setTreasury(admin.address))
        .to.emit(pool, "TreasuryUpdated")
        .withArgs(admin.address);

      expect(await pool.treasury()).to.equal(admin.address);
    });

    it("Should reject setting treasury to zero address", async function () {
      await expect(pool.connect(timelock).setTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(pool, "InvalidAmount");
    });
  });

  describe("Upgradeability", function () {
    it("Should preserve state after upgrade", async function () {
      await deadCoin.mint(user.address, STAKE_AMOUNT);
      await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
      await pool.connect(user).stake(STAKE_AMOUNT);
      
      const stakedBefore = await pool.userStakedAmount(user.address);
      
      // Register the manually deployed proxy with the upgrades plugin
      await upgrades.forceImport(poolAddress, await ethers.getContractFactory("DeadCoinStakingPool"));
      
      // Upgrade pool implementation
      const DeadCoinStakingPoolV2 = await ethers.getContractFactory("DeadCoinStakingPool");
      await upgrades.upgradeProxy(poolAddress, DeadCoinStakingPoolV2);
      
      const stakedAfter = await pool.userStakedAmount(user.address);
      expect(stakedAfter).to.equal(stakedBefore);
    });

    it("Should allow upgrading ResurgeToken", async function () {
      // timelock holds TIMELOCK_ROLE, which now gates _authorizeUpgrade on ResurgeToken
      const ResurgeTokenV2 = await ethers.getContractFactory("ResurgeToken", timelock);
      await upgrades.upgradeProxy(await resurgeToken.getAddress(), ResurgeTokenV2);
      expect(await resurgeToken.name()).to.equal("Resurgence Protocol");
    });
  });
});
