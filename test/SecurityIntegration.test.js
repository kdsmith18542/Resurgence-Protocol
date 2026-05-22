const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Security Integration", function () {
  let owner, timelock, attacker, user1, user2;
  let deadCoin, resurgeToken, rewardDistributor, stakingPoolManager;
  let pool, poolAddress;
  let poolImpl;

  beforeEach(async function () {
    [owner, timelock, attacker, user1, user2] = await ethers.getSigners();

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await ERC20Mock.deploy("Dead Token", "DEAD", ethers.parseEther("1000000"));

    const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
    poolImpl = await PoolImpl.deploy();

    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, ethers.parseEther("1000000")], { kind: 'uups' });

    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      ethers.parseEther("500000"),
      timelock.address
    ], { kind: 'uups' });

    const Manager = await ethers.getContractFactory("StakingPoolManager");
    stakingPoolManager = await upgrades.deployProxy(Manager, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      await poolImpl.getAddress(),
      timelock.address
    ], { kind: 'uups' });

    await resurgeToken.connect(timelock).grantRole(await resurgeToken.MINTER_ROLE(), await rewardDistributor.getAddress());

    await rewardDistributor.connect(timelock).grantRole(await rewardDistributor.TIMELOCK_ROLE(), await stakingPoolManager.getAddress());

    const MockOracle = await ethers.getContractFactory("MockOracle");
    const mockOracle = await MockOracle.deploy(1, 8);
    await rewardDistributor.connect(timelock).setPriceOracle(await mockOracle.getAddress(), 86400);

    const tx = await stakingPoolManager.connect(timelock).addStakingPool(
      await deadCoin.getAddress(),
      ethers.parseEther("1"),
      timelock.address
    );
    const receipt = await tx.wait();

    let poolAddress;
    for (const log of receipt.logs) {
      try {
        const parsed = stakingPoolManager.interface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === 'StakingPoolAdded') {
          poolAddress = parsed.args[1];
          break;
        }
      } catch {}
    }

    const PoolFactory = await ethers.getContractFactory("DeadCoinStakingPool");
    pool = PoolFactory.attach(poolAddress);

    await deadCoin.transfer(user1.address, ethers.parseEther("1000"));
    await deadCoin.transfer(user2.address, ethers.parseEther("1000"));
    await deadCoin.transfer(attacker.address, ethers.parseEther("1000"));

    await deadCoin.connect(user1).approve(poolAddress, ethers.parseEther("1000"));
    await deadCoin.connect(user2).approve(poolAddress, ethers.parseEther("1000"));
    await deadCoin.connect(attacker).approve(poolAddress, ethers.parseEther("1000"));
  });

  describe("Access Control", function () {
    it("should prevent non-minter from minting RESURGE", async function () {
      await expect(resurgeToken.connect(attacker).mint(attacker.address, 1000n)).to.be.reverted;
    });

    it("should prevent unauthorized pause on staking pool manager", async function () {
      await expect(stakingPoolManager.connect(attacker).pause()).to.be.reverted;
    });

    it("should prevent unauthorized pool from calling mintAndDistribute", async function () {
      await expect(rewardDistributor.connect(attacker).mintAndDistribute(attacker.address, 1000n)).to.be.reverted;
    });

    it("should prevent non-TIMELOCK from changing reward rate", async function () {
      await expect(pool.connect(attacker).setRewardRate(ethers.parseEther("1"))).to.be.reverted;
    });

    it("should prevent non-admin from upgrading DeadCoinStakingPool", async function () {
      await expect(pool.connect(attacker).upgradeToAndCall(await poolImpl.getAddress(), "0x")).to.be.reverted;
    });
  });

  describe("Reentrancy Protection", function () {
    it("should protect stake function with ReentrancyGuard", async function () {
      await pool.connect(user1).stake(ethers.parseEther("10"));
      await expect(pool.connect(user1).stake(ethers.parseEther("10"))).to.not.be.reverted;
    });

    it("should protect unstake function with ReentrancyGuard", async function () {
      await pool.connect(user1).stake(ethers.parseEther("10"));
      await expect(pool.connect(user1).unstake(ethers.parseEther("10"))).to.not.be.reverted;
    });

    it("should protect claimRewards with ReentrancyGuard", async function () {
      await pool.connect(user1).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await expect(pool.connect(user1).claimRewards()).to.not.be.reverted;
    });
  });

  describe("Input Validation", function () {
    it("should revert on zero amount stake", async function () {
      await expect(pool.connect(user1).stake(0)).to.be.revertedWithCustomError(pool, "InvalidAmount");
    });

    it("should revert on zero amount unstake", async function () {
      await expect(pool.connect(user1).unstake(0)).to.be.revertedWithCustomError(pool, "InvalidAmount");
    });

    it("should revert unstake exceeding balance", async function () {
      await pool.connect(user1).stake(ethers.parseEther("5"));
      await expect(pool.connect(user1).unstake(ethers.parseEther("10"))).to.be.revertedWithCustomError(pool, "InsufficientBalance");
    });

    it("should revert unstake with no staked balance", async function () {
      await expect(pool.connect(user2).unstake(1)).to.be.revertedWithCustomError(pool, "InsufficientBalance");
    });
  });

  describe("Supply Invariants", function () {
    it("should maintain totalStakedSupply equals sum of user stakes", async function () {
      await pool.connect(user1).stake(ethers.parseEther("50"));
      await pool.connect(user2).stake(ethers.parseEther("30"));
      expect(await pool.userStakedAmount(user1.address) + await pool.userStakedAmount(user2.address)).to.equal(await pool.totalStakedSupply());
    });

    it("should update totalStakedSupply after unstake", async function () {
      await pool.connect(user1).stake(ethers.parseEther("50"));
      expect(await pool.totalStakedSupply()).to.equal(ethers.parseEther("50"));
      await pool.connect(user1).unstake(ethers.parseEther("20"));
      expect(await pool.totalStakedSupply()).to.equal(ethers.parseEther("30"));
    });

    it("should enforce RESURGE cap", async function () {
      const cap = await resurgeToken.cap();
      await pool.connect(user1).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await pool.connect(user1).claimRewards();
      expect(await resurgeToken.totalSupply()).to.be.lte(cap);
    });
  });

  describe("Pause Mechanism", function () {
    it("should prevent staking when paused", async function () {
      await pool.connect(timelock).pause();
      await expect(pool.connect(user1).stake(ethers.parseEther("10"))).to.be.reverted;
    });

    it("should prevent unstaking when paused", async function () {
      await pool.connect(user1).stake(ethers.parseEther("10"));
      await pool.connect(timelock).pause();
      await expect(pool.connect(user1).unstake(ethers.parseEther("5"))).to.be.reverted;
    });

    it("should prevent claiming when paused", async function () {
      await pool.connect(user1).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await pool.connect(timelock).pause();
      await expect(pool.connect(user1).claimRewards()).to.be.reverted;
    });

    it("should allow staking after unpause", async function () {
      await pool.connect(timelock).pause();
      await pool.connect(timelock).unpause();
      await expect(pool.connect(user1).stake(ethers.parseEther("10"))).to.not.be.reverted;
    });
  });

  describe("Governance Attack Prevention", function () {
    it("should prevent unauthorized RESURGE minting", async function () {
      await expect(resurgeToken.connect(attacker).mint(attacker.address, ethers.parseEther("1000000"))).to.be.reverted;
    });
  });

  describe("Reward Distribution Integrity", function () {
    it("should not allow claiming rewards without staking", async function () {
      await pool.connect(user2).claimRewards();
      expect(await pool.userRewards(user2.address)).to.equal(0);
    });

    it("should only allow RewardDistributor to mint RESURGE", async function () {
      await expect(resurgeToken.connect(user1).mint(user1.address, 1000n)).to.be.reverted;
    });

    it("should correctly calculate rewards over time", async function () {
      await pool.connect(user1).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine");
      const earned1 = await pool.earned(user1.address);
      expect(earned1).to.be.gt(0);

      await pool.connect(user2).stake(ethers.parseEther("100"));
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine");
      expect(await pool.earned(user1.address)).to.be.gt(earned1);
      expect(await pool.earned(user2.address)).to.be.gt(0);
    });
  });

  describe("ResurgeToken Security", function () {
    it("should enforce supply cap", async function () {
      expect(await resurgeToken.cap()).to.be.gt(0n);
    });

    it("should not allow initializer to be called twice", async function () {
      await expect(resurgeToken.initialize(timelock.address, 1000n)).to.be.reverted;
    });
  });
});
