const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Staking Rewards Test (Upgradeable)", function () {
  let pool, token, distributor, deadCoin;
  let admin, timelock, user;
  
  before(async function () {
    this.timeout(120000);
    
    // Get signers
    [admin, timelock, user] = await ethers.getSigners();
    
    // Deploy ResurgeToken (Proxy)
    const Token = await ethers.getContractFactory("ResurgeToken");
    const maxSupply = ethers.parseEther("1000000000");
    token = await upgrades.deployProxy(Token, [timelock.address, maxSupply], { kind: 'uups' });
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    
    // Deploy MockDeadCoin (Not upgradeable)
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await MockERC20.deploy("DeadCoin", "DEAD", ethers.parseEther("1000000"));
    await deadCoin.waitForDeployment();
    const deadCoinAddress = await deadCoin.getAddress();
    
    // Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const initialMaxMintSupply = ethers.parseEther("1000000");
    distributor = await upgrades.deployProxy(RewardDistributor, [
      tokenAddress,
      initialMaxMintSupply,
      timelock.address
    ], { kind: 'uups' });
    await distributor.waitForDeployment();
    const distributorAddress = await distributor.getAddress();
    
    // Deploy DeadCoinStakingPool (Proxy)
    const StakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
    const stakingPoolManager = admin.address;
    pool = await upgrades.deployProxy(StakingPool, [
      deadCoinAddress,
      tokenAddress,
      distributorAddress,
      stakingPoolManager,
      timelock.address
    ], { kind: 'uups' });
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();
    
    // Authorize the staking pool in the distributor
    await distributor.connect(timelock).authorizeStakingPool(poolAddress);
    
    // Grant MINTER_ROLE to distributor
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(timelock).grantRole(MINTER_ROLE, distributorAddress);
    
    // Set reward rate
    const rewardRate = ethers.parseEther("0.001");
    await pool.connect(timelock).setRewardRate(rewardRate);
    
    // Transfer tokens to user
    await deadCoin.transfer(user.address, ethers.parseEther("10000"));
    await deadCoin.connect(user).approve(poolAddress, ethers.parseEther("10000"));
  });
  
  it("should allow user to stake DEAD tokens", async function () {
    const stakeAmount = ethers.parseEther("10000");
    await pool.connect(user).stake(stakeAmount);
    expect(await pool.userStakedAmount(user.address)).to.equal(stakeAmount);
  });
  
  it("should accumulate rewards over time", async function () {
    const stakingDuration = 86400;
    await ethers.provider.send("evm_increaseTime", [stakingDuration]);
    await ethers.provider.send("evm_mine");
    
    const pendingRewards = await pool.earned(user.address);
    const expectedRewards = ethers.parseEther("0.001") * BigInt(stakingDuration);
    expect(pendingRewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
  });
  
  it("should allow user to claim rewards", async function () {
    const initialUserBalance = await token.balanceOf(user.address);
    await pool.connect(user).claimRewards();
    const finalUserBalance = await token.balanceOf(user.address);
    expect(finalUserBalance).to.be.gt(initialUserBalance);
    expect(await pool.earned(user.address)).to.equal(0n);
  });
  
  it("should allow user to unstake tokens", async function () {
    const stakedAmount = await pool.userStakedAmount(user.address);
    await pool.connect(user).unstake(stakedAmount);
    expect(await pool.userStakedAmount(user.address)).to.equal(0n);
  });
});
