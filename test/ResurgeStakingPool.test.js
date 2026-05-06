const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("ResurgeStakingPool (Upgradeable)", function () {
  let resurgeToken, rewardDistributor, resurgePool, timelock;
  let owner, user1, user2;
  let poolAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000");
  const MAX_MINT = ethers.parseEther("500000000");
  const REWARD_RATE = ethers.parseEther("1");
  const STAKE_AMOUNT = ethers.parseEther("1000");

  beforeEach(async function () {
    [owner, timelock, user1, user2] = await ethers.getSigners();

    // 1. Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, INITIAL_SUPPLY], { kind: 'uups' });
    await resurgeToken.waitForDeployment();

    // 2. Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(), MAX_MINT, timelock.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();

    // 3. Deploy ResurgeStakingPool (Proxy)
    const ResurgeStakingPool = await ethers.getContractFactory("ResurgeStakingPool");
    resurgePool = await upgrades.deployProxy(ResurgeStakingPool, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      timelock.address,
      REWARD_RATE
    ], { kind: 'uups' });
    await resurgePool.waitForDeployment();
    poolAddress = await resurgePool.getAddress();

    // 4. Grant roles
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
    await rewardDistributor.connect(timelock).authorizeStakingPool(poolAddress);

    // 5. Fund users with RESURGE
    await resurgeToken.connect(timelock).mint(user1.address, ethers.parseEther("1000000"));
    await resurgeToken.connect(timelock).mint(user2.address, ethers.parseEther("1000000"));
    await resurgeToken.connect(user1).approve(poolAddress, ethers.parseEther("1000000"));
    await resurgeToken.connect(user2).approve(poolAddress, ethers.parseEther("1000000"));
  });

  describe("Staking", function () {
    it("should stake RESURGE tokens", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
      expect(await resurgePool.userStakedAmount(user1.address)).to.equal(STAKE_AMOUNT);
      expect(await resurgePool.totalStakedSupply()).to.equal(STAKE_AMOUNT);
    });

    it("should set delegation on stake", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user2.address);
      expect(await resurgePool.userDelegation(user1.address)).to.equal(user2.address);
    });

    it("should allow delegation to zero address", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, ethers.ZeroAddress);
      expect(await resurgePool.userStakedAmount(user1.address)).to.equal(STAKE_AMOUNT);
    });

    it("should revert staking zero amount", async function () {
      await expect(resurgePool.connect(user1).stake(0, user1.address))
        .to.be.revertedWithCustomError(resurgePool, "ResurgeStaking_InvalidAmount");
    });

    it("should update stakedAt timestamp on stake", async function () {
      const tx = await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(await resurgePool.userStakedAt(user1.address)).to.equal(block.timestamp);
    });

    it("should track voting power", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
      expect(await resurgePool.getVotingPower(user1.address)).to.equal(STAKE_AMOUNT);
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
    });

    it("should unstake full amount", async function () {
      await resurgePool.connect(user1).unstake(STAKE_AMOUNT);
      expect(await resurgePool.userStakedAmount(user1.address)).to.equal(0n);
      expect(await resurgePool.totalStakedSupply()).to.equal(0n);
      // 5% penalty = token balance is 999000 + 950 = 999950
      expect(await resurgeToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("1000000") - ethers.parseEther("50")
      );
    });

    it("should partial unstake", async function () {
      const partial = ethers.parseEther("400");
      await resurgePool.connect(user1).unstake(partial);
      expect(await resurgePool.userStakedAmount(user1.address)).to.equal(STAKE_AMOUNT - partial);
      expect(await resurgePool.totalStakedSupply()).to.equal(STAKE_AMOUNT - partial);
    });

    it("should apply early unstake penalty", async function () {
      // minStakeDuration is 7 days by default, unstaking immediately should trigger penalty
      await resurgePool.connect(user1).unstake(STAKE_AMOUNT);
      // 5% penalty = 50 tokens burned, 950 returned
      expect(await resurgeToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("1000000") - ethers.parseEther("50")
      );
    });

    it("should not apply penalty after minStakeDuration", async function () {
      await time.increase(7 * 86400 + 1);
      await mine();
      await resurgePool.connect(user1).unstake(STAKE_AMOUNT);
      // Full amount returned
      expect(await resurgeToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000000"));
    });

    it("should revert unstaking more than staked", async function () {
      await expect(resurgePool.connect(user1).unstake(STAKE_AMOUNT + 1n))
        .to.be.revertedWithCustomError(resurgePool, "ResurgeStaking_InsufficientBalance");
    });

    it("should revert unstaking zero amount", async function () {
      await expect(resurgePool.connect(user1).unstake(0))
        .to.be.revertedWithCustomError(resurgePool, "ResurgeStaking_InvalidAmount");
    });

    it("should burn penalty tokens", async function () {
      const totalBefore = await resurgeToken.totalSupply();
      await resurgePool.connect(user1).unstake(STAKE_AMOUNT);
      const totalAfter = await resurgeToken.totalSupply();
      // 5% of 1000 = 50 burned
      expect(totalBefore - totalAfter).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
    });

    it("should accrue rewards over time", async function () {
      await time.increase(100);
      await mine();
      const earned = await resurgePool.earned(user1.address);
      expect(earned).to.be.closeTo(REWARD_RATE * 100n, ethers.parseEther("2"));
    });

    it("should return zero for non-stakers", async function () {
      expect(await resurgePool.earned(user2.address)).to.equal(0n);
    });

    it("should claim rewards", async function () {
      await time.increase(100);
      await mine();
      const balanceBefore = await resurgeToken.balanceOf(user1.address);
      await resurgePool.connect(user1).claimRewards();
      const balanceAfter = await resurgeToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.closeTo(REWARD_RATE * 100n, ethers.parseEther("3"));
      expect(await resurgePool.userRewards(user1.address)).to.equal(0n);
    });

    it("should not revert when claiming zero rewards", async function () {
      await resurgePool.connect(user1).claimRewards();
    });

    it("should distribute rewards proportionally with multiple stakers", async function () {
      await resurgePool.connect(user2).stake(STAKE_AMOUNT, user2.address);
      await time.increase(100);
      await mine();
      const earned1 = await resurgePool.earned(user1.address);
      const earned2 = await resurgePool.earned(user2.address);
      // Both staked same amount at different times, rewards should be close
      expect(earned1).to.be.gt(earned2); // user1 staked earlier
      expect(earned1 + earned2).to.be.closeTo(REWARD_RATE * 100n, ethers.parseEther("5"));
    });
  });

  describe("Compounding", function () {
    beforeEach(async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
    });

    it("should compound rewards into stake", async function () {
      await time.increase(100);
      await mine();
      const earned = await resurgePool.earned(user1.address);
      expect(earned).to.be.gt(0n);

      const stakedBefore = await resurgePool.userStakedAmount(user1.address);
      await resurgePool.connect(user1).claimAndRestake();
      const stakedAfter = await resurgePool.userStakedAmount(user1.address);

      expect(stakedAfter - stakedBefore).to.be.closeTo(earned, ethers.parseEther("3"));
      expect(await resurgePool.userRewards(user1.address)).to.equal(0n);
      expect(await resurgePool.totalStakedSupply()).to.equal(stakedAfter);
    });

    it("should earn rewards on compounded stake", async function () {
      await time.increase(100);
      await mine();
      await resurgePool.connect(user1).claimAndRestake();

      await time.increase(100);
      await mine();
      const earnedAfterCompound = await resurgePool.earned(user1.address);
      expect(earnedAfterCompound).to.be.gt(0n);
    });
  });

  describe("Access Control", function () {
    it("should allow RATE_SETTER to set reward rate", async function () {
      const newRate = ethers.parseEther("2");
      await resurgePool.connect(timelock).setRewardRate(newRate);
      expect(await resurgePool.rewardRatePerSecond()).to.equal(newRate);
    });

    it("should prevent non-RATE_SETTER from setting reward rate", async function () {
      await expect(resurgePool.connect(user1).setRewardRate(ethers.parseEther("2")))
        .to.be.reverted;
    });

    it("should allow TIMELOCK to set user boost", async function () {
      await resurgePool.connect(timelock).setUserBoost(user1.address, 20000);
      expect(await resurgePool.userBoostBps(user1.address)).to.equal(20000);
    });

    it("should prevent boost below 1x", async function () {
      await expect(resurgePool.connect(timelock).setUserBoost(user1.address, 5000))
        .to.be.revertedWith("Boost must be >= 1x");
    });

    it("should allow TIMELOCK to set min stake duration", async function () {
      await resurgePool.connect(timelock).setMinStakeDuration(14 * 86400);
      expect(await resurgePool.minStakeDuration()).to.equal(14 * 86400);
    });

    it("should allow TIMELOCK to set early unstake penalty", async function () {
      await resurgePool.connect(timelock).setEarlyUnstakePenalty(1000); // 10%
      expect(await resurgePool.earlyUnstakePenaltyBps()).to.equal(1000);
    });

    it("should prevent penalty above 25%", async function () {
      await expect(resurgePool.connect(timelock).setEarlyUnstakePenalty(3000))
        .to.be.revertedWith("Max 25% penalty");
    });

    it("should allow EMERGENCY_PAUSER to pause", async function () {
      await resurgePool.connect(timelock).pause();
      expect(await resurgePool.paused()).to.be.true;
    });

    it("should prevent operations when paused", async function () {
      await resurgePool.connect(timelock).pause();
      await expect(resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address))
        .to.be.reverted;
    });

    it("should allow DEFAULT_ADMIN to unpause", async function () {
      await resurgePool.connect(timelock).pause();
      await resurgePool.connect(timelock).unpause();
      expect(await resurgePool.paused()).to.be.false;
    });
  });

  describe("Boost Mechanism", function () {
    beforeEach(async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
    });

    it("should apply 2x boost to rewards", async function () {
      await resurgePool.connect(timelock).setUserBoost(user1.address, 20000); // 200% of base = 2x
      await time.increase(100);
      await mine();
      const earned = await resurgePool.earned(user1.address);
      // 1 RESURGE/s * 100s * 2x = 200 (with tolerance)
      expect(earned).to.be.closeTo(REWARD_RATE * 100n * 20000n / 10000n, ethers.parseEther("5"));
    });

    it("should use base boost when user boost not set", async function () {
      await time.increase(100);
      await mine();
      const earned = await resurgePool.earned(user1.address);
      expect(earned).to.be.closeTo(REWARD_RATE * 100n, ethers.parseEther("3")); // baseBoostBps = 10000 = 1x
    });
  });

  describe("Delegation", function () {
    it("should set delegation after staking", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);
      await resurgePool.connect(user1).setDelegate(user2.address);
      expect(await resurgePool.userDelegation(user1.address)).to.equal(user2.address);
    });
  });

  describe("Upgradeability", function () {
    it("should preserve state after upgrade", async function () {
      await resurgePool.connect(user1).stake(STAKE_AMOUNT, user1.address);

      // Grant TIMELOCK_ROLE to owner for upgrade authorization
      await resurgePool.connect(timelock).grantRole(
        await resurgePool.TIMELOCK_ROLE(), owner.address
      );

      const V2 = await ethers.getContractFactory("ResurgeStakingPool");
      await upgrades.upgradeProxy(poolAddress, V2);

      expect(await resurgePool.userStakedAmount(user1.address)).to.equal(STAKE_AMOUNT);
      expect(await resurgePool.totalStakedSupply()).to.equal(STAKE_AMOUNT);
    });
  });
});
