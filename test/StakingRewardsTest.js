const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");

describe("Staking Rewards Test", function () {
  let pool, token, distributor, deadCoin;
  let admin, timelock, user;
  
  before(async function () {
    this.timeout(120000);
    
    // Get signers
    [admin, timelock, user] = await ethers.getSigners();
    console.log(`\n✅ Signers loaded`);
    console.log(`   - Admin: ${admin.address}`);
    console.log(`   - Timelock: ${timelock.address}`);
    console.log(`   - User: ${user.address}`);
    
    // Deploy ResurgenceProtocol Token
    console.log("\n🔹 Deploying ResurgenceProtocol...");
    const Token = await ethers.getContractFactory("ResurgenceProtocol");
    const maxSupply = parseEther("1000000000"); // 1 billion tokens with 18 decimals
    token = await Token.deploy(timelock.address, maxSupply);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`✅ ResurgenceProtocol token deployed at: ${tokenAddress}`);
    
    // Deploy MockDeadCoin
    console.log("\n🔹 Deploying MockDeadCoin...");
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await MockERC20.deploy("DeadCoin", "DEAD", parseEther("1000000"));
    await deadCoin.waitForDeployment();
    const deadCoinAddress = await deadCoin.getAddress();
    console.log(`✅ MockDeadCoin deployed at: ${deadCoinAddress}`);
    
    // Deploy RewardDistributor
    console.log("\n🔹 Deploying RewardDistributor...");
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const initialMaxMintSupply = parseEther("1000000"); // 1 million tokens
    distributor = await RewardDistributor.deploy(
      tokenAddress,
      initialMaxMintSupply,
      timelock.address
    );
    await distributor.waitForDeployment();
    const distributorAddress = await distributor.getAddress();
    console.log(`✅ RewardDistributor deployed at: ${distributorAddress}`);
    console.log(`   - Initial max mint supply: ${ethers.formatEther(initialMaxMintSupply)} RESURGE`);
    
    // Deploy DeadCoinStakingPool
    console.log("\n🔹 Deploying DeadCoinStakingPool...");
    const StakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
    const stakingPoolManager = admin.address; // Using admin as staking pool manager for testing
    pool = await StakingPool.deploy(
      deadCoinAddress,
      tokenAddress,
      distributorAddress,
      stakingPoolManager,
      timelock.address
    );
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();
    console.log(`✅ DeadCoinStakingPool deployed at: ${poolAddress}`);
    console.log(`   - Staking Pool Manager: ${stakingPoolManager}`);
    
    // Authorize the staking pool in the distributor
    console.log("\n🔹 Authorizing staking pool in distributor...");
    const distributorWithTimelock = distributor.connect(timelock);
    await distributorWithTimelock.authorizeStakingPool(poolAddress);
    console.log("✅ Staking pool authorized");
    
    // Grant MINTER_ROLE to distributor
    console.log("\n🔹 Granting MINTER_ROLE to distributor...");
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.connect(timelock).grantRole(MINTER_ROLE, distributorAddress);
    console.log("✅ MINTER_ROLE granted to distributor");
    
    // Set reward rate (0.001 RESURGE per second)
    const rewardRate = parseEther("0.001");
    console.log(`\n🔹 Setting reward rate to ${ethers.formatEther(rewardRate)} RESURGE/s...`);
    await pool.connect(timelock).setRewardRate(rewardRate);
    console.log("✅ Reward rate set");
    
    // Transfer some DEAD tokens to user for staking
    const userStakeAmount = parseEther("10000");
    console.log(`\n🔹 Transferring ${ethers.formatEther(userStakeAmount)} DEAD to user...`);
    await deadCoin.transfer(user.address, userStakeAmount);
    console.log("✅ Tokens transferred to user");
    
    // Approve staking pool to spend user's DEAD tokens
    console.log("\n🔹 Approving staking pool to spend user's DEAD...");
    await deadCoin.connect(user).approve(poolAddress, userStakeAmount);
    console.log("✅ Staking pool approved");
  });
  
  it("should allow user to stake DEAD tokens", async function () {
    const stakeAmount = parseEther("10000");
    
    // Get initial balances
    const initialUserBalance = await deadCoin.balanceOf(user.address);
    const initialStakedAmount = await pool.userStakedAmount(user.address);
    
    // Stake tokens
    console.log(`\n🔹 User staking ${ethers.formatEther(stakeAmount)} DEAD...`);
    const tx = await pool.connect(user).stake(stakeAmount);
    await tx.wait();
    
    // Verify staking
    const finalUserBalance = await deadCoin.balanceOf(user.address);
    const finalStakedAmount = await pool.userStakedAmount(user.address);
    
    console.log(`   - User DEAD balance: ${ethers.formatEther(initialUserBalance)} -> ${ethers.formatEther(finalUserBalance)}`);
    console.log(`   - User staked amount: ${ethers.formatEther(initialStakedAmount)} -> ${ethers.formatEther(finalStakedAmount)}`);
    
    expect(finalStakedAmount.toString()).to.equal(stakeAmount.toString());
    expect(initialUserBalance.sub(finalUserBalance).toString()).to.equal(stakeAmount.toString());
  });
  
  it("should accumulate rewards over time", async function () {
    // Set reward rate through timelock
    const rewardRate = parseEther("0.001");
    await pool.connect(timelock).setRewardRate(rewardRate);
    
    // Wait for some time to accumulate rewards
    const stakingDuration = 86400; // 1 day in seconds
    console.log(`\n⏳ Advancing time by ${stakingDuration} seconds...`);
    await ethers.provider.send("evm_increaseTime", [stakingDuration]);
    await ethers.provider.send("evm_mine");
    
    // Check pending rewards
    const pendingRewards = await pool.earned(user.address);
    console.log(`   - Pending rewards: ${ethers.formatEther(pendingRewards)} RESURGE`);
    
    // Expected rewards: 0.001 RESURGE/s * 86400s = 86.4 RESURGE
    const expectedRewards = rewardRate.mul(stakingDuration);
    const tolerance = parseEther("0.01"); // 0.01 RESURGE tolerance for timing differences
    
    // Convert to BigInt for comparison
    const pendingRewardsBN = BigInt(pendingRewards.toString());
    const expectedRewardsBN = BigInt(expectedRewards.toString());
    const toleranceBN = BigInt(tolerance.toString());
    
    const diff = pendingRewardsBN > expectedRewardsBN 
      ? pendingRewardsBN - expectedRewardsBN
      : expectedRewardsBN - pendingRewardsBN;
    
    expect(diff <= toleranceBN, 
      `Expected rewards to be close to ${formatEther(expectedRewards)} RESURGE, but got ${formatEther(pendingRewards)}`
    ).to.be.true;
  });
  
  it("should allow user to claim rewards", async function () {
    // Get initial balances
    const initialUserBalance = await token.balanceOf(user.address);
    console.log(`\n💰 Initial user RESURGE balance: ${ethers.formatEther(initialUserBalance)}`);
    
    // Claim rewards
    console.log("🔹 Claiming rewards...");
    const tx = await pool.connect(user).claimRewards();
    await tx.wait();
    
    // Verify rewards claimed
    const finalUserBalance = await token.balanceOf(user.address);
    const rewardsReceived = finalUserBalance.sub(initialUserBalance);
    console.log(`   - Rewards received: ${ethers.formatEther(rewardsReceived)} RESURGE`);
    console.log(`   - New user balance: ${ethers.formatEther(finalUserBalance)} RESURGE`);
    
    // Expected rewards: ~86.4 RESURGE (from previous test)
    const expectedRewards = parseEther("86.4");
    const tolerance = parseEther("0.01");
    
    // Convert to BigInt for comparison
    const rewardsReceivedBN = BigInt(rewardsReceived.toString());
    const expectedRewardsBN = BigInt(expectedRewards.toString());
    const toleranceBN = BigInt(tolerance.toString());
    
    const diff = rewardsReceivedBN > expectedRewardsBN 
      ? rewardsReceivedBN - expectedRewardsBN
      : expectedRewardsBN - rewardsReceivedBN;
    
    expect(diff <= toleranceBN, 
      `Expected to receive close to ${formatEther(expectedRewards)} RESURGE in rewards, but got ${formatEther(rewardsReceived)}`
    ).to.be.true;
    
    // Verify rewards are reset
    const pendingAfterClaim = await pool.earned(user.address);
    console.log(`   - Pending rewards after claim: ${ethers.formatEther(pendingAfterClaim)} RESURGE`);
    expect(pendingAfterClaim).to.equal(0);
  });
  
  it("should allow user to unstake tokens", async function () {
    const stakedAmount = await pool.userStakedAmount(user.address);
    console.log(`\n🔹 User unstaking ${ethers.formatEther(stakedAmount)} DEAD...`);
    
    // Get initial balances
    const initialStakedAmount = await pool.userStakedAmount(user.address);
    const initialUserBalance = await deadCoin.balanceOf(user.address);
    
    // Unstake
    const tx = await pool.connect(user).unstake(stakedAmount);
    await tx.wait();
    
    // Verify unstaking
    const finalStakedAmount = await pool.userStakedAmount(user.address);
    const finalUserBalance = await deadCoin.balanceOf(user.address);
    
    console.log(`   - User staked amount: ${ethers.formatEther(initialStakedAmount)} -> ${ethers.formatEther(finalStakedAmount)}`);
    console.log(`   - User DEAD balance: ${ethers.formatEther(initialUserBalance)} -> ${ethers.formatEther(finalUserBalance)}`);
    
    expect(finalStakedAmount.toString()).to.equal('0');
    expect(finalUserBalance.sub(initialUserBalance).toString()).to.equal(stakedAmount.toString());
  });
});
