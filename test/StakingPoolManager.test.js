const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("StakingPoolManager", function () {
  async function deployFixture() {
    const [admin, timelock, emergencyPauser, user1] = await ethers.getSigners();

    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    const resurgeToken = await upgrades.deployProxy(ResurgeToken, [admin.address, ethers.parseEther("1000000000")], { kind: "uups" });

    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const distributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      ethers.parseEther("500000000"),
      timelock.address,
    ], { kind: "uups" });

    const DeadCoinStakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
    const poolImpl = await DeadCoinStakingPool.deploy();

    const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
    const manager = await upgrades.deployProxy(StakingPoolManager, [
      await resurgeToken.getAddress(),
      await distributor.getAddress(),
      await poolImpl.getAddress(),
      timelock.address,
    ], { kind: "uups" });

    await resurgeToken.grantRole(await resurgeToken.MINTER_ROLE(), await distributor.getAddress());
    await distributor.grantRole(await distributor.TIMELOCK_ROLE(), await manager.getAddress());

    // Give manager EMERGENCY_PAUSER to emergencyPauser
    await manager.grantRole(await manager.EMERGENCY_PAUSER(), emergencyPauser.address);

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    const deadCoin1 = await ERC20Mock.deploy("Dead Coin A", "DCA", ethers.parseEther("1000000"));
    const deadCoin2 = await ERC20Mock.deploy("Dead Coin B", "DCB", ethers.parseEther("1000000"));

    return { manager, distributor, resurgeToken, deadCoin1, deadCoin2, admin, timelock, emergencyPauser, user1 };
  }

  describe("Deployment", function () {
    it("stores correct contract references", async function () {
      const { manager, resurgeToken, distributor } = await loadFixture(deployFixture);
      expect(await manager.resurgenceTokenAddress()).to.equal(await resurgeToken.getAddress());
      expect(await manager.rewardDistributorAddress()).to.equal(await distributor.getAddress());
    });

    it("starts with no supported dead coins", async function () {
      const { manager } = await loadFixture(deployFixture);
      const coins = await manager.getAllSupportedDeadCoins();
      expect(coins.length).to.equal(0);
    });
  });

  describe("addStakingPool", function () {
    it("TIMELOCK_ROLE can add a new pool", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), ethers.parseEther("1"), timelock.address);
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("non-TIMELOCK cannot add a pool", async function () {
      const { manager, deadCoin1, user1 } = await loadFixture(deployFixture);
      await expect(manager.connect(user1).addStakingPool(await deadCoin1.getAddress(), 0n, user1.address))
        .to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });

    it("adds dead coin to supportedDeadCoins array", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      const coins = await manager.getAllSupportedDeadCoins();
      expect(coins).to.include(await deadCoin1.getAddress());
    });

    it("reverts on duplicate pool for same dead coin", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await expect(manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address))
        .to.be.revertedWithCustomError(manager, "StakingPoolManager_PoolExists");
    });

    it("sets initial reward rate on the new pool", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      const rate = ethers.parseEther("5");
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), rate, timelock.address);
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      expect(await pool.rewardRatePerSecond()).to.equal(rate);
    });

    it("emits StakingPoolAdded event", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await expect(manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address))
        .to.emit(manager, "StakingPoolAdded");
    });
  });

  describe("getAllSupportedDeadCoins", function () {
    it("returns all added dead coins", async function () {
      const { manager, deadCoin1, deadCoin2, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).addStakingPool(await deadCoin2.getAddress(), 0n, timelock.address);
      const coins = await manager.getAllSupportedDeadCoins();
      expect(coins.length).to.equal(2);
      expect(coins).to.include(await deadCoin1.getAddress());
      expect(coins).to.include(await deadCoin2.getAddress());
    });

    it("returns empty array before any pools added", async function () {
      const { manager } = await loadFixture(deployFixture);
      expect((await manager.getAllSupportedDeadCoins()).length).to.equal(0);
    });
  });

  describe("setRewardRate", function () {
    it("TIMELOCK_ROLE can update reward rate", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      const newRate = ethers.parseEther("10");
      await manager.connect(timelock).setRewardRate(await deadCoin1.getAddress(), newRate);
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      expect(await pool.rewardRatePerSecond()).to.equal(newRate);
    });

    it("non-TIMELOCK cannot set reward rate", async function () {
      const { manager, deadCoin1, timelock, user1 } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await expect(manager.connect(user1).setRewardRate(await deadCoin1.getAddress(), ethers.parseEther("1")))
        .to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("pauseStakingPool / unpauseStakingPool", function () {
    it("TIMELOCK_ROLE can pause a pool", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).pauseStakingPool(await deadCoin1.getAddress());
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      expect(await pool.paused()).to.be.true;
    });

    it("TIMELOCK_ROLE can unpause a pool", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).pauseStakingPool(await deadCoin1.getAddress());
      await manager.connect(timelock).unpauseStakingPool(await deadCoin1.getAddress());
      const poolAddress = await manager.deadCoinToPoolAddress(await deadCoin1.getAddress());
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      expect(await pool.paused()).to.be.false;
    });

    it("non-TIMELOCK cannot pause a pool", async function () {
      const { manager, deadCoin1, timelock, user1 } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await expect(manager.connect(user1).pauseStakingPool(await deadCoin1.getAddress()))
        .to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("removeStakingPool", function () {
    it("TIMELOCK_ROLE can remove a pool", async function () {
      const { manager, deadCoin1, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).removeStakingPool(await deadCoin1.getAddress());
      expect(await manager.deadCoinToPoolAddress(await deadCoin1.getAddress())).to.equal(ethers.ZeroAddress);
    });

    it("removes coin from supportedDeadCoins array", async function () {
      const { manager, deadCoin1, deadCoin2, timelock } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).addStakingPool(await deadCoin2.getAddress(), 0n, timelock.address);
      await manager.connect(timelock).removeStakingPool(await deadCoin1.getAddress());
      const coins = await manager.getAllSupportedDeadCoins();
      expect(coins).to.not.include(await deadCoin1.getAddress());
      expect(coins).to.include(await deadCoin2.getAddress());
    });

    it("non-TIMELOCK cannot remove a pool", async function () {
      const { manager, deadCoin1, timelock, user1 } = await loadFixture(deployFixture);
      await manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address);
      await expect(manager.connect(user1).removeStakingPool(await deadCoin1.getAddress()))
        .to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Manager Pause", function () {
    it("EMERGENCY_PAUSER can pause the manager", async function () {
      const { manager, emergencyPauser } = await loadFixture(deployFixture);
      await manager.connect(emergencyPauser).pause();
      expect(await manager.paused()).to.be.true;
    });

    it("addStakingPool reverts when manager is paused", async function () {
      const { manager, deadCoin1, timelock, emergencyPauser } = await loadFixture(deployFixture);
      await manager.connect(emergencyPauser).pause();
      await expect(manager.connect(timelock).addStakingPool(await deadCoin1.getAddress(), 0n, timelock.address))
        .to.be.revertedWithCustomError(manager, "EnforcedPause");
    });

    it("admin can unpause the manager", async function () {
      const { manager, admin, emergencyPauser } = await loadFixture(deployFixture);
      await manager.connect(emergencyPauser).pause();
      await manager.connect(admin).unpause();
      expect(await manager.paused()).to.be.false;
    });
  });
});
