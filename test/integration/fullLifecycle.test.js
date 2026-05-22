const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration: Full Protocol Lifecycle (Upgradeable)", function () {
  let resurgeToken, rewardDistributor, stakingPoolManager, timelock, deadCoin;
  let owner, user;
  let poolAddress, pool, poolImplementation;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000"); // 1B
  const REWARD_RATE = ethers.parseEther("1"); // 1 RESURGE per second
  const STAKE_AMOUNT = ethers.parseEther("1000");

  before(async function () {
    [owner, user] = await ethers.getSigners();

    // 1. Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [owner.address, INITIAL_SUPPLY], { kind: 'uups' });
    await resurgeToken.waitForDeployment();

    // 2. Deploy Timelock
    const Timelock = await ethers.getContractFactory("ResurgenceTimelockController");
    timelock = await Timelock.deploy(3600, [], [], owner.address);
    await timelock.waitForDeployment();

    // 3. Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_SUPPLY / 2n,
      owner.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();

    // 4. Deploy DeadCoinStakingPool Implementation
    const DeadCoinStakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
    poolImplementation = await DeadCoinStakingPool.deploy();
    await poolImplementation.waitForDeployment();

    // 5. Deploy StakingPoolManager (Proxy)
    const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
    stakingPoolManager = await upgrades.deployProxy(StakingPoolManager, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      await poolImplementation.getAddress(),
      owner.address
    ], { kind: 'uups' });
    await stakingPoolManager.waitForDeployment();

    // 6. Deploy Mock Dead Coin
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await MockERC20.deploy("Dead Coin", "DEAD", INITIAL_SUPPLY);
    await deadCoin.waitForDeployment();

    // 7. Setup Roles
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();

    // RewardDistributor can mint RESURGE
    await resurgeToken.grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
    
    // StakingPoolManager can manage distributor
    await rewardDistributor.grantRole(TIMELOCK_ROLE, await stakingPoolManager.getAddress());
  });

  it("Should go through the full lifecycle of a staking pool", async function () {
    // 1. Add Staking Pool via Manager
    const tx = await stakingPoolManager.connect(owner).addStakingPool(
      await deadCoin.getAddress(),
      REWARD_RATE,
      owner.address
    );
    await tx.wait();
    poolAddress = await stakingPoolManager.deadCoinToPoolAddress(await deadCoin.getAddress());
    pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);

    // 2. Grant roles on the pool
    const POOL_TIMELOCK_ROLE = await pool.TIMELOCK_ROLE();
    await pool.connect(owner).grantRole(POOL_TIMELOCK_ROLE, await timelock.getAddress());
    await pool.connect(owner).grantRole(POOL_TIMELOCK_ROLE, await stakingPoolManager.getAddress());

    // 3. Set reward rate via Manager
    await stakingPoolManager.connect(owner).setRewardRate(await deadCoin.getAddress(), REWARD_RATE);
    expect(await pool.rewardRatePerSecond()).to.equal(REWARD_RATE);

    // 4. User stakes tokens
    await deadCoin.mint(user.address, STAKE_AMOUNT);
    await deadCoin.connect(user).approve(poolAddress, STAKE_AMOUNT);
    await pool.connect(user).stake(STAKE_AMOUNT);

    expect(await pool.userStakedAmount(user.address)).to.equal(STAKE_AMOUNT);

    // 5. Wait for rewards to accrue
    const duration = 10;
    await time.increase(duration);
    await mine();

    const expectedRewards = REWARD_RATE * BigInt(duration);
    const earned = await pool.earned(user.address);
    expect(earned).to.be.closeTo(expectedRewards, ethers.parseEther("1.1")); 

    // 6. Claim rewards
    const balanceBefore = await resurgeToken.balanceOf(user.address);
    await pool.connect(user).claimRewards();
    const balanceAfter = await resurgeToken.balanceOf(user.address);
    
    expect(balanceAfter - balanceBefore).to.be.closeTo(expectedRewards, ethers.parseEther("2.1"));
    expect(await pool.earned(user.address)).to.equal(0);

    // 7. Unstake everything
    await pool.connect(user).unstake(STAKE_AMOUNT);
    expect(await pool.userStakedAmount(user.address)).to.equal(0);
    expect(await deadCoin.balanceOf(user.address)).to.equal(STAKE_AMOUNT);
  });
});
