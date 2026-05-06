const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RewardDistributor (Upgradeable)", function () {
  let resurgeToken, rewardDistributor, timelock, oracle, owner, addr1, stakingPool1;

  const INITIAL_MAX_MINT = ethers.parseEther("500000000");

  beforeEach(async function () {
    [owner, addr1, timelock, stakingPool1] = await ethers.getSigners();
    
    // Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, ethers.parseEther("1000000000")], { kind: 'uups' });
    await resurgeToken.waitForDeployment();
    
    // Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_MAX_MINT,
      timelock.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();
    
    // Deploy Mock Oracle (Initial price $0.05 = 5000000 with 8 decimals)
    const MockOracle = await ethers.getContractFactory("MockOracle");
    oracle = await MockOracle.deploy(5000000, 8);
    await oracle.waitForDeployment();

    // Setup Roles
    const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the correct ResurgeToken address", async function () {
      expect(await rewardDistributor.resurgenceToken()).to.equal(await resurgeToken.getAddress());
    });
    
    it("Should set the correct max mint supply", async function () {
      expect(await rewardDistributor.maxMintSupply()).to.equal(INITIAL_MAX_MINT);
    });
  });

  describe("Pool Authorization", function () {
    it("Should allow TIMELOCK to authorize a staking pool", async function () {
      await rewardDistributor.connect(timelock).authorizeStakingPool(stakingPool1.address);
      expect(await rewardDistributor.authorizedStakingPools(stakingPool1.address)).to.be.true;
    });

    it("Should allow TIMELOCK to unauthorize a staking pool", async function () {
      await rewardDistributor.connect(timelock).authorizeStakingPool(stakingPool1.address);
      await rewardDistributor.connect(timelock).unauthorizeStakingPool(stakingPool1.address);
      expect(await rewardDistributor.authorizedStakingPools(stakingPool1.address)).to.be.false;
    });

    it("Should prevent non-TIMELOCK from authorizing pools", async function () {
      await expect(rewardDistributor.connect(addr1).authorizeStakingPool(stakingPool1.address))
        .to.be.reverted;
    });
  });

  describe("Minting and Distribution", function () {
    beforeEach(async function () {
      await rewardDistributor.connect(timelock).authorizeStakingPool(stakingPool1.address);
    });

    it("Should mint and distribute tokens when called by authorized pool", async function () {
      const amount = ethers.parseEther("100");
      await rewardDistributor.connect(stakingPool1).mintAndDistribute(addr1.address, amount);
      
      expect(await resurgeToken.balanceOf(addr1.address)).to.equal(amount);
      expect(await rewardDistributor.totalResurgeMinted()).to.equal(amount);
    });

    it("Should revert if called by unauthorized pool", async function () {
      await expect(rewardDistributor.connect(addr1).mintAndDistribute(addr1.address, 100))
        .to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_UnauthorizedPool");
    });

    it("Should revert if minting exceeds max supply", async function () {
      const hugeAmount = INITIAL_MAX_MINT + 1n;
      await expect(rewardDistributor.connect(stakingPool1).mintAndDistribute(addr1.address, hugeAmount))
        .to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_ExceedsMaxSupply");
    });

    it("Should enforce pause", async function () {
      await rewardDistributor.connect(timelock).pause();
      await expect(rewardDistributor.connect(stakingPool1).mintAndDistribute(addr1.address, 100))
        .to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Oracle and Emissions", function () {
    beforeEach(async function () {
      await rewardDistributor.connect(timelock).setPriceOracle(await oracle.getAddress(), 3600);
      await rewardDistributor.connect(timelock).setOracleEnabled(true);
    });

    it("Should return correct price from oracle", async function () {
      const [price, valid] = await rewardDistributor.getResurgePrice();
      expect(price).to.equal(5000000);
      expect(valid).to.be.true;
    });

    it("Should return 1x multiplier when price is at base ($0.05)", async function () {
      expect(await rewardDistributor.getEmissionMultiplier()).to.equal(10000);
    });

    it("Should return increased multiplier when price increases", async function () {
      // Set price to $0.07 (2000000 above base)
      // 10% increase per $0.01 above base ($0.05) -> 20% increase = 12000 bps
      await oracle.updateAnswer(7000000);
      expect(await rewardDistributor.getEmissionMultiplier()).to.equal(12000);
    });

    it("Should cap multiplier at 2x ($0.15+)", async function () {
      await oracle.updateAnswer(20000000); // $0.20
      expect(await rewardDistributor.getEmissionMultiplier()).to.equal(20000);
    });

    it("Should handle oracle failure gracefully", async function () {
      await oracle.updateAnswer(0);
      const [price, valid] = await rewardDistributor.getResurgePrice();
      expect(valid).to.be.false;
      expect(await rewardDistributor.getEmissionMultiplier()).to.equal(10000);
    });

    it("Should detect stale oracle data", async function () {
      // Advance time by 2 hours (threshold is 1 hour)
      await ethers.provider.send("evm_increaseTime", [7200]);
      await ethers.provider.send("evm_mine");
      
      const [price, valid] = await rewardDistributor.getResurgePrice();
      expect(valid).to.be.false;
      expect(await rewardDistributor.getEmissionMultiplier()).to.equal(10000);
    });
  });

  describe("Upgradeability", function () {
    it("Should allow upgrading RewardDistributor", async function () {
      const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();
      await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);
      
      const RewardDistributorV2 = await ethers.getContractFactory("RewardDistributor");
      await upgrades.upgradeProxy(await rewardDistributor.getAddress(), RewardDistributorV2);
      expect(await rewardDistributor.maxMintSupply()).to.equal(INITIAL_MAX_MINT);
    });
  });
});