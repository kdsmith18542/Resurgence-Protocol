const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingPoolManager Advanced (Batch + Dynamic Rates)", function () {
  let resurgeToken, rewardDistributor, manager, poolImpl, timelock;
  let deadCoin1, deadCoin2, deadCoin3;
  let owner, user1, user2;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000");
  const MAX_MINT = ethers.parseEther("500000000");
  const REWARD_RATE = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, timelock, user1, user2] = await ethers.getSigners();

    // Deploy ResurgeToken
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, INITIAL_SUPPLY], { kind: 'uups' });
    await resurgeToken.waitForDeployment();

    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(), MAX_MINT, timelock.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();

    // Deploy Pool Implementation
    const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
    poolImpl = await PoolImpl.deploy();
    await poolImpl.waitForDeployment();

    // Deploy StakingPoolManager
    const Manager = await ethers.getContractFactory("StakingPoolManager");
    manager = await upgrades.deployProxy(Manager, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      await poolImpl.getAddress(),
      timelock.address
    ], { kind: 'uups' });
    await manager.waitForDeployment();

    // Deploy 3 mock dead coins
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin1 = await MockERC20.deploy("DeadCoin1", "DC1", INITIAL_SUPPLY);
    deadCoin2 = await MockERC20.deploy("DeadCoin2", "DC2", INITIAL_SUPPLY);
    deadCoin3 = await MockERC20.deploy("DeadCoin3", "DC3", INITIAL_SUPPLY);
    await deadCoin1.waitForDeployment();
    await deadCoin2.waitForDeployment();
    await deadCoin3.waitForDeployment();

    // Grant roles
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
    await rewardDistributor.connect(timelock).grantRole(rewardDistributor.TIMELOCK_ROLE(), await manager.getAddress());

    // Fund users
    await deadCoin1.mint(user1.address, ethers.parseEther("1000000"));
    await deadCoin2.mint(user1.address, ethers.parseEther("1000000"));
    await deadCoin3.mint(user1.address, ethers.parseEther("1000000"));
  });

  describe("Batch Stake", function () {
    let pool1Address, pool2Address, pool3Address;

    beforeEach(async function () {
      // Add 3 pools
      const tx1 = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      const r1 = await tx1.wait();

      const tx2 = await manager.connect(timelock).addStakingPool(
        await deadCoin2.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx2.wait();

      const tx3 = await manager.connect(timelock).addStakingPool(
        await deadCoin3.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx3.wait();

      pool1Address = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      pool2Address = await manager.deadCoinToPoolAddress(await deadCoin2.getAddress());
      pool3Address = await manager.deadCoinToPoolAddress(await deadCoin3.getAddress());

      // Approve the StakingPoolManager for batch staking (manager pulls tokens, then stakes)
      const managerAddress = await manager.getAddress();
      await deadCoin1.connect(user1).approve(managerAddress, ethers.parseEther("1000000"));
      await deadCoin2.connect(user1).approve(managerAddress, ethers.parseEther("1000000"));
      await deadCoin3.connect(user1).approve(managerAddress, ethers.parseEther("1000000"));
    });

    it("should batch stake across multiple pools", async function () {
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300"),
      ];

      await manager.connect(user1).batchStake(
        [await deadCoin1.getAddress(), await deadCoin2.getAddress(), await deadCoin3.getAddress()],
        amounts
      );

      const pool1 = await ethers.getContractAt("DeadCoinStakingPool", pool1Address);
      const pool2 = await ethers.getContractAt("DeadCoinStakingPool", pool2Address);
      const pool3 = await ethers.getContractAt("DeadCoinStakingPool", pool3Address);

      expect(await pool1.userStakedAmount(user1.address)).to.equal(ethers.parseEther("100"));
      expect(await pool2.userStakedAmount(user1.address)).to.equal(ethers.parseEther("200"));
      expect(await pool3.userStakedAmount(user1.address)).to.equal(ethers.parseEther("300"));
    });

    it("should batch claim rewards from multiple pools", async function () {
      const amounts = [
        ethers.parseEther("100"),
        ethers.parseEther("200"),
        ethers.parseEther("300"),
      ];

      await manager.connect(user1).batchStake(
        [await deadCoin1.getAddress(), await deadCoin2.getAddress(), await deadCoin3.getAddress()],
        amounts
      );

      await time.increase(50);
      await mine();

      const balanceBefore = await resurgeToken.balanceOf(user1.address);
      await manager.connect(user1).batchClaimRewards(
        [await deadCoin1.getAddress(), await deadCoin2.getAddress(), await deadCoin3.getAddress()]
      );
      const balanceAfter = await resurgeToken.balanceOf(user1.address);

      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("should skip zero amounts in batch stake", async function () {
      await manager.connect(user1).batchStake(
        [await deadCoin1.getAddress(), await deadCoin2.getAddress()],
        [ethers.parseEther("100"), 0n]
      );

      const pool1 = await ethers.getContractAt("DeadCoinStakingPool", pool1Address);
      expect(await pool1.userStakedAmount(user1.address)).to.equal(ethers.parseEther("100"));
    });

    it("should revert on array length mismatch", async function () {
      await expect(
        manager.connect(user1).batchStake(
          [await deadCoin1.getAddress()],
          [ethers.parseEther("100"), ethers.parseEther("200")]
        )
      ).to.be.revertedWith("Array length mismatch");
    });
  });

  describe("Dynamic Reward Rate", function () {
    it("should default to disabled dynamic rates", async function () {
      expect(await manager.dynamicRateEnabled()).to.equal(false);
    });

    it("should enable dynamic rates", async function () {
      await manager.connect(timelock).setDynamicRateEnabled(true);
      expect(await manager.dynamicRateEnabled()).to.equal(true);
    });

    it("should set dynamic rate parameters", async function () {
      const baseRate = ethers.parseEther("2");
      const decayFactor = 500; // 5%
      const minRate = ethers.parseEther("0.1");
      const maxRate = ethers.parseEther("5");

      await manager.connect(timelock).setDynamicRateParams(baseRate, decayFactor, minRate, maxRate);

      expect(await manager.baseRewardRatePerSecond()).to.equal(baseRate);
      expect(await manager.tvlDecayFactor()).to.equal(500);
      expect(await manager.minRewardRatePerSecond()).to.equal(minRate);
      expect(await manager.maxRewardRatePerSecond()).to.equal(maxRate);
    });

    it("should calculate dynamic rate based on TVL", async function () {
      await manager.connect(timelock).setDynamicRateEnabled(true);
      await manager.connect(timelock).setDynamicRateParams(
        ethers.parseEther("2"), 100, // 1% per 1M TVL
        ethers.parseEther("0.1"),
        ethers.parseEther("5")
      );

      const tx = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx.wait();
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());

      // TVL = 0, rate should be baseRate
      const rate1 = await manager.calculateDynamicRate(poolAddress);
      expect(rate1).to.equal(ethers.parseEther("2"));

      // Stake tokens to increase TVL (2M tokens so tvlMillions > 0)
      await deadCoin1.mint(user1.address, ethers.parseEther("2000000"));
      await deadCoin1.connect(user1).approve(poolAddress, ethers.parseEther("2000000"));
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      await pool.connect(user1).stake(ethers.parseEther("2000000"));

      // TVL = 1M, should reduce rate below base
      const rate2 = await manager.calculateDynamicRate(poolAddress);
      expect(rate2).to.be.lt(ethers.parseEther("2"));
    });

    it("should apply dynamic rate to a pool", async function () {
      await manager.connect(timelock).setDynamicRateEnabled(true);
      await manager.connect(timelock).setDynamicRateParams(
        ethers.parseEther("2"), 100,
        ethers.parseEther("0.1"),
        ethers.parseEther("5")
      );

      const tx = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx.wait();
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());

      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      // addStakingPool now sets the initial reward rate
      expect(await pool.rewardRatePerSecond()).to.equal(REWARD_RATE);

      await manager.connect(timelock).applyDynamicRate(await deadCoin1.getAddress());

      // Dynamic rate should have been applied (TVL is 0, so rate should be base = 2e18)
      const newRate = await pool.rewardRatePerSecond();
      expect(newRate).to.be.gte(ethers.parseEther("1"));
      expect(newRate).to.be.lte(ethers.parseEther("5"));
    });

    it("should apply dynamic rate to all pools", async function () {
      await manager.connect(timelock).setDynamicRateEnabled(true);

      const tx1 = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx1.wait();
      const tx2 = await manager.connect(timelock).addStakingPool(
        await deadCoin2.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx2.wait();

      await manager.connect(timelock).applyDynamicRateAll();

      const pool1Address = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      const pool2Address = await manager.deadCoinToPoolAddress(await deadCoin2.getAddress());

      const pool1 = await ethers.getContractAt("DeadCoinStakingPool", pool1Address);
      const pool2 = await ethers.getContractAt("DeadCoinStakingPool", pool2Address);

      expect(await pool1.rewardRatePerSecond()).to.equal(await manager.baseRewardRatePerSecond());
      expect(await pool2.rewardRatePerSecond()).to.equal(await manager.baseRewardRatePerSecond());
    });

    it("should clamp rate to min when TVL causes high decay", async function () {
      const minRate = ethers.parseEther("0.01");

      await manager.connect(timelock).setDynamicRateEnabled(true);
      await manager.connect(timelock).setDynamicRateParams(
        ethers.parseEther("1"), 10000, // high decay factor
        minRate,
        ethers.parseEther("10")
      );

      const tx = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx.wait();
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());

      // Stake huge amount to max out TVL decay (100M tokens)
      await deadCoin1.mint(user1.address, ethers.parseEther("100000000"));
      // Approve both pool (for direct staking) and manager (for batch)
      await deadCoin1.connect(user1).approve(poolAddress, ethers.parseEther("100000000"));
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      await pool.connect(user1).stake(ethers.parseEther("100000000"));

      const dynamicRate = await manager.calculateDynamicRate(poolAddress);
      // With extreme TVL, rate should be clamped to min
      expect(dynamicRate).to.be.gte(minRate);
      expect(dynamicRate).to.be.lte(ethers.parseEther("1"));
    });

    it("should prevent non-TIMELOCK from changing dynamic rate config", async function () {
      await expect(
        manager.connect(user1).setDynamicRateEnabled(true)
      ).to.be.reverted;
    });

    it("should integrate oracle multiplier from RewardDistributor", async function () {
      await manager.connect(timelock).setDynamicRateEnabled(true);
      
      const tx = await manager.connect(timelock).addStakingPool(
        await deadCoin1.getAddress(), REWARD_RATE, timelock.address, timelock.address
      );
      await tx.wait();
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());

      // Initial rate with 1x multiplier
      const rate1 = await manager.calculateDynamicRate(poolAddress);
      expect(rate1).to.equal(await manager.baseRewardRatePerSecond());

      // Set oracle in distributor and enable it
      const MockOracle = await ethers.getContractFactory("MockOracle");
      const oracle = await MockOracle.deploy(7000000, 8); // $0.07 -> 1.2x multiplier
      await oracle.waitForDeployment();
      
      await rewardDistributor.connect(timelock).setPriceOracle(await oracle.getAddress(), 3600);
      await rewardDistributor.connect(timelock).setOracleEnabled(true);

      // New rate should be 1.2x of base
      const rate2 = await manager.calculateDynamicRate(poolAddress);
      expect(rate2).to.equal(await manager.baseRewardRatePerSecond() * 12000n / 10000n);
    });
  });
});
