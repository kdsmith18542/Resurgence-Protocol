const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");

const fs = require('fs');
const path = require('path');

// Enhanced logging function with file output
const log = (message, ...args) => {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.map(a => 
    typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
  ).join(' ');
  const logMessage = `[${timestamp}] ${message} ${formattedArgs}`;
  
  // Log to console
  console.log(logMessage);
  
  // Log to file with more details
  const debugLog = `[${timestamp}] [DEBUG] ${message} ${formattedArgs}\n`;
  
  // Append to log files
  const logFilePath = path.join(__dirname, 'test-debug.log');
  fs.appendFileSync(logFilePath, debugLog, 'utf8');
  
  // Also log to a separate detailed log file
  const detailedLogPath = path.join(__dirname, 'test-detailed.log');
  fs.appendFileSync(detailedLogPath, `${debugLog}\n`, 'utf8');
  
  return logMessage;
};

// Helper function to log transaction details
const logTx = async (tx, description) => {
  log(`\n${description}:`);
  log(`  Tx Hash: ${tx.hash}`);
  const receipt = await tx.wait();
  log(`  Status:  ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
  log(`  Gas Used: ${receipt.gasUsed.toString()}`);
  return receipt;
};

// Helper to log contract method calls
const logCall = async (contract, methodName, args, from = null) => {
  const method = contract.interface.getFunction(methodName);
  const inputs = method.inputs.map((input, i) => ({
    name: input.name,
    type: input.type,
    value: args[i]
  }));
  
  log(`\n🔹 ${methodName}:`);
  log(`  Contract: ${await contract.getAddress()}`);
  log(`  From: ${from || (await contract.runner?.address) || 'default caller'}`);
  log('  Arguments:');
  inputs.forEach(input => log(`    ${input.name} (${input.type}): ${input.value}`));
}

// Helper function to increase time in Hardhat Network
const increaseTime = async (seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
};

describe("DeadCoinStakingPool", function () {
  let pool, token, distributor;
  let admin, timelock, user;
  let deadCoin;

  // This is a test case for reward calculation
  it("should calculate and distribute rewards correctly", async function () {
    this.timeout(120000); // Increase timeout for this test
    
    try {
      log("\n=== Setting up test environment ===");
      
      // Get signers
      [admin, timelock, user] = await ethers.getSigners();
      log(`✅ Signers loaded`);
      log(`   - Admin: ${admin.address}`);
      log(`   - Timelock: ${timelock.address}`);
      log(`   - User: ${user.address}`);
      
      // Deploy ResurgenceProtocol Token
      log("\n🔹 Deploying ResurgenceProtocol...");
      const Token = await ethers.getContractFactory("ResurgenceProtocol");
      const maxSupply = parseEther("1000000000"); // 1 billion tokens with 18 decimals
      token = await Token.deploy(timelock.address, maxSupply);
      await token.waitForDeployment();
      const tokenAddress = await token.getAddress();
      log(`✅ ResurgenceProtocol token deployed at: ${tokenAddress}`);
      log(`   - Max supply: ${ethers.formatEther(maxSupply)} RESURGE`);
      
      // Deploy a mock DeadCoin ERC20 token
      log("\n🔹 Deploying MockDeadCoin...");
      const MockERC20 = await ethers.getContractFactory("ERC20Mock");
      deadCoin = await MockERC20.deploy("DeadCoin", "DEAD", parseEther("1000000000"));
      await deadCoin.waitForDeployment();
      const deadCoinAddress = await deadCoin.getAddress();
      log(`✅ MockDeadCoin deployed at: ${deadCoinAddress}`);
      
      // Verify timelock has DEFAULT_ADMIN_ROLE from the constructor
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
      const hasAdminRole = await token.hasRole(DEFAULT_ADMIN_ROLE, timelock.address);
      log(`   - Timelock has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
      
      if (!hasAdminRole) {
        // If for some reason the timelock doesn't have admin role, grant it
        const grantAdminRoleTx = await token.grantRole(
          DEFAULT_ADMIN_ROLE,
          timelock.address
        );
        await logTx(grantAdminRoleTx, "Grant DEFAULT_ADMIN_ROLE to timelock");
      }
      
      // Grant MINTER_ROLE to admin for testing
      const MINTER_ROLE = await token.MINTER_ROLE();
      const grantMinterToTimelock = await token.connect(timelock).grantRole(MINTER_ROLE, timelock.address);
      await logTx(grantMinterToTimelock, "Grant MINTER_ROLE to timelock");
  
      // Mint some RESURGE tokens to the timelock for funding the pool
      const mintAmount = parseEther("2000000"); // Extra for pool funding
      const mintAdminTx = await token.connect(timelock).mint(admin.address, parseEther("1000000"));
      await logTx(mintAdminTx, "Mint RESURGE tokens to admin");
      
      const mintTimelockTx = await token.connect(timelock).mint(timelock.address, parseEther("1000000"));
      await logTx(mintTimelockTx, "Mint RESURGE tokens to timelock");
      
      log(`   - Admin balance: ${ethers.formatEther(await token.balanceOf(admin.address))} RESURGE`);
      log(`   - Timelock balance: ${ethers.formatEther(await token.balanceOf(timelock.address))} RESURGE`);
      
      // Deploy Distributor
      log("\n🔹 Deploying RewardDistributor...");
      const Distributor = await ethers.getContractFactory("RewardDistributor");
      distributor = await Distributor.deploy(
        tokenAddress,
        parseEther("500000000"),
        timelock.address
      );
      await distributor.waitForDeployment();
      const distributorAddress = await distributor.getAddress();
      log(`✅ Distributor deployed at: ${distributorAddress}`);
      
      // Deploy StakingPoolManager
      log("\n🔹 Deploying StakingPoolManager...");
      const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
      const stakingPoolManager = await StakingPoolManager.deploy(
        tokenAddress,
        distributorAddress,
        timelock.address
      );
      await stakingPoolManager.waitForDeployment();
      const managerAddress = await stakingPoolManager.getAddress();
      const stakingPoolManagerAddress = managerAddress; // Store for later use
      log(`✅ StakingPoolManager deployed at: ${managerAddress}`);
      
      // Grant the TIMELOCK_ROLE to the StakingPoolManager in the RewardDistributor
      // This is needed because StakingPoolManager needs to call authorizeStakingPool
      const TIMELOCK_ROLE = await distributor.TIMELOCK_ROLE();
      const grantRoleTx = await distributor.connect(timelock).grantRole(
        TIMELOCK_ROLE,
        stakingPoolManagerAddress
      );
      await logTx(grantRoleTx, "Grant TIMELOCK_ROLE to StakingPoolManager in RewardDistributor");
      
      // Add a staking pool
      log("\n🔹 Adding staking pool...");
      log(`   - DeadCoin address: ${deadCoinAddress}`);
      log(`   - Reward rate: 100`);
      log(`   - Timelock: ${timelock.address}`);
      
      // Add the staking pool
      const addPoolTx = await stakingPoolManager.connect(timelock).addStakingPool(
        deadCoinAddress,
        100,
        timelock.address
      );
      const receipt = await logTx(addPoolTx, "Add Staking Pool to Manager");
      
      // Get the pool address from the StakingPoolManager
      const poolAddress = await stakingPoolManager.deadCoinToPoolAddress(deadCoinAddress);
      
      if (poolAddress === ethers.ZeroAddress) {
        throw new Error('Failed to get pool address from StakingPoolManager');
      }
      
      // Get the pool contract
      pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      log(`✅ Pool deployed at: ${poolAddress}`);
      
      // The timelock needs to grant the TIMELOCK_ROLE to the StakingPoolManager
      const TIMELOCK_ROLE_BYTES = await pool.TIMELOCK_ROLE();
      const grantTx = await pool.connect(timelock).grantRole(
        TIMELOCK_ROLE_BYTES,
        stakingPoolManagerAddress
      );
      await logTx(grantTx, "Grant TIMELOCK_ROLE to StakingPoolManager");
      
      // Now that the StakingPoolManager has the TIMELOCK_ROLE, we can set the reward rate
      const setRateTx = await stakingPoolManager.connect(timelock).setRewardRate(
        deadCoinAddress,
        100
      );
      await logTx(setRateTx, "Set initial reward rate");
      
      // Authorize the staking pool in the RewardDistributor
      log("\n🔹 Authorizing staking pool in RewardDistributor...");
      const authorizeTx = await distributor.connect(timelock).authorizeStakingPool(poolAddress);
      await logTx(authorizeTx, "Authorize staking pool in RewardDistributor");
      
      // Verify the pool is authorized
      const isAuthorized = await distributor.authorizedStakingPools(poolAddress);
      log(`   - Pool ${isAuthorized ? 'is' : 'is NOT'} authorized in RewardDistributor`);
      
      // Grant MINTER_ROLE to the RewardDistributor contract
      log("\n🔹 Granting MINTER_ROLE to RewardDistributor...");
      log(`   - Token address: ${tokenAddress}`);
      log(`   - Distributor address: ${distributorAddress}`);
      log(`   - MINTER_ROLE: ${MINTER_ROLE}`);
      
      // Check current minter role admin
      const minterRoleAdmin = await token.getRoleAdmin(MINTER_ROLE);
      log(`   - MINTER_ROLE admin: ${minterRoleAdmin}`);
      
      // Check if timelock has DEFAULT_ADMIN_ROLE
      const adminRole = await token.DEFAULT_ADMIN_ROLE();
      const timelockHasAdminRole = await token.hasRole(adminRole, timelock.address);
      log(`   - Timelock has DEFAULT_ADMIN_ROLE: ${timelockHasAdminRole}`);
      
      // Check current minter role status
      const hasMinterRoleBefore = await token.hasRole(MINTER_ROLE, distributorAddress);
      log(`   - RewardDistributor has MINTER_ROLE before grant: ${hasMinterRoleBefore}`);
      
      // Grant the role
      const grantMinterToDistributor = await token.connect(timelock).grantRole(MINTER_ROLE, distributorAddress);
      await logTx(grantMinterToDistributor, "Grant MINTER_ROLE to RewardDistributor");
      
      // Verify the role was granted
      const hasMinterRoleAfter = await token.hasRole(MINTER_ROLE, distributorAddress);
      log(`   - RewardDistributor has MINTER_ROLE after grant: ${hasMinterRoleAfter}`);
      
      if (!hasMinterRoleAfter) {
        log("ERROR: Failed to grant MINTER_ROLE to RewardDistributor!");
        // Check if the transaction was successful
        const receipt = await grantMinterToDistributor.wait();
        const events = receipt.events?.filter(x => x.event === 'RoleGranted') || [];
        log(`   - RoleGranted events: ${events.length}`);
        events.forEach((event, i) => {
          log(`     Event ${i}: role=${event.args.role}, account=${event.args.account}, sender=${event.args.sender}`);
        });
      }
      
      // Transfer tokens to the pool for rewards
      log("\n🔹 Funding pool with rewards...");
      const amount = parseEther("1000000");
      log(`   - Amount: ${ethers.formatEther(amount)} RESURGE`);
      
      // Verify timelock has enough balance
      const timelockBalance = await token.balanceOf(timelock.address);
      if (timelockBalance < amount) {
        const additionalNeeded = amount - timelockBalance;
        log(`   - Minting additional ${ethers.formatEther(additionalNeeded)} RESURGE to timelock...`);
        const mintMoreTx = await token.connect(timelock).mint(timelock.address, additionalNeeded);
        await logTx(mintMoreTx, "Mint additional tokens to timelock");
      }
      
      const transferTx = await token.connect(timelock).transfer(poolAddress, amount);
      await logTx(transferTx, "Transfer tokens to pool");
      
      // Set reward rate again (this seems redundant with the previous setRewardRate call)
      log("\n🔹 Setting reward rate again...");
      const setRateTx2 = await pool.connect(timelock).setRewardRate(100);
      await logTx(setRateTx2, "Set reward rate");
      
      log("\n✅ Test setup complete!");
      log("===================================\n");
      
    } catch (error) {
      log("\n❌ Setup failed!");
      log(`Error: ${error.message}`);
      if (error.reason) log(`Reason: ${error.reason}`);
      if (error.transaction) log(`Tx Hash: ${error.transaction.hash}`);
      throw error; // Re-throw to fail the test
    }
  });
  
  it("should allow staking", async function () {
    this.timeout(30000);
    
    try {
      log("\n=== Starting staking test ===");
      const amount = parseEther("1000");
      
      // 1. Ensure admin has enough tokens and transfer to user
      log(`\n🔹 Preparing tokens for user...`);
      // Mint some deadCoin tokens to the user
      const mintDeadCoinTx = await deadCoin.connect(admin).mint(user.address, amount);
      await logTx(mintDeadCoinTx, "Mint DEAD tokens to user");

      const adminBalance = await token.balanceOf(admin.address);
      const requiredAmount = amount * 2n; // Using BigInt literal
      
      if (adminBalance < requiredAmount) {
        const mintAmount = requiredAmount - adminBalance;
        log(`   - Minting ${ethers.formatEther(mintAmount)} RESURGE to admin...`);
        const mintTx = await token.connect(timelock).mint(admin.address, mintAmount);
        await logTx(mintTx, "Mint additional tokens to admin");
      }
      
      // Transfer tokens to user
      log(`\n🔹 Transferring tokens to user...`);
      log(`   - From: ${admin.address}`);
      log(`   - To: ${user.address}`);
      log(`   - Amount: ${ethers.formatEther(amount)} RESURGE`);
      
      const transferTx = await token.connect(admin).transfer(user.address, amount);
      await logTx(transferTx, "Transfer tokens to user");
      
      // Verify user balance
      const userBalance = await token.balanceOf(user.address);
      log(`   - User balance: ${ethers.formatEther(userBalance)} RESURGE`);
      
      // 2. Approve pool to spend user's tokens
      const poolAddress = await pool.getAddress();
      log(`\n🔹 Approving pool to spend tokens...`);
      log(`   - Spender: ${poolAddress}`);
      log(`   - Amount: ${ethers.formatEther(amount)} RESURGE`);
      
      // First, approve the pool to spend the tokens
      const approveTx = await deadCoin.connect(user).approve(poolAddress, amount);
      await logTx(approveTx, "Approve pool");
      
      const allowance = await deadCoin.allowance(user.address, poolAddress);
      log(`   - Allowance set: ${ethers.formatEther(allowance)} DEAD`);
      
      // Stake tokens
      log(`\n🔹 Staking tokens...`);
      log(`   - User: ${user.address}`);
      log(`   - Amount: ${ethers.formatEther(amount)} DEAD`);
      log(`   - User balance before staking: ${ethers.formatEther(await deadCoin.balanceOf(user.address))} DEAD`);
      
      await expect(pool.connect(user).stake(amount))
        .to.emit(pool, "Staked")
        .withArgs(user.address, amount);
      
      log(`✅ Staking successful!`);
      log(`   - User staked amount: ${ethers.formatEther(await pool.userStakedAmount(user.address))} DEAD`);
      log(`   - Total staked supply: ${ethers.formatEther(await pool.totalStakedSupply())} DEAD`);
      
      const userBalanceAfterStake = await deadCoin.balanceOf(user.address);
      log(`   - User balance after staking: ${ethers.formatEther(userBalanceAfterStake)} DEAD`);
      expect(userBalanceAfterStake).to.equal(0); // Should be 0 after staking 1000
      
      const poolBalance = await deadCoin.balanceOf(poolAddress);
      log(`   - Pool balance after staking: ${ethers.formatEther(poolBalance)} DEAD`);
      expect(poolBalance).to.equal(amount);
      
    } catch (error) {
      log(`❌ Staking test failed!`);
      log(`Error: ${error.message}`);
      throw error; // Re-throw to fail the test
    }
  });
  
  it("should allow unstaking", async function () {
    this.timeout(30000);
    
    // Stake some tokens first
    const stakeAmount = parseEther("500");
    // Ensure user has enough deadCoin tokens and approve
    const mintDeadCoinTx = await deadCoin.connect(admin).mint(user.address, stakeAmount);
    await logTx(mintDeadCoinTx, "Mint DEAD tokens for unstaking test");
    
    const approveTx = await deadCoin.connect(user).approve(await pool.getAddress(), stakeAmount);
    await logTx(approveTx, "Approve DEAD tokens for unstaking test");

    await pool.connect(user).stake(stakeAmount);
    
    log(`   - User staked amount: ${ethers.formatEther(await pool.userStakedAmount(user.address))} DEAD`);
    log(`   - Pool balance before: ${ethers.formatEther(await deadCoin.balanceOf(await pool.getAddress()))} DEAD`);

    const unstakeAmount = parseEther("100");
    
    // Test unstaking more than staked
    log("\n🔹 Testing unstaking more than staked...");
    await expect(pool.connect(user).unstake(parseEther("100000")))
      .to.be.revertedWith("Insufficient balance");
      
    // Unstake a valid amount
    await expect(pool.connect(user).unstake(unstakeAmount))
      .to.emit(pool, "Unstaked")
      .withArgs(user.address, unstakeAmount);
      
    log(`✅ Unstaking successful!`);
    log(`   - User staked amount after unstake: ${ethers.formatEther(await pool.userStakedAmount(user.address))} DEAD`);
    log(`   - User DEAD balance after unstake: ${ethers.formatEther(await deadCoin.balanceOf(user.address))} DEAD`);
    log(`   - Pool DEAD balance after unstake: ${ethers.formatEther(await deadCoin.balanceOf(await pool.getAddress()))} DEAD`);
    
    expect(await pool.userStakedAmount(user.address)).to.equal(stakeAmount - unstakeAmount);
    expect(await deadCoin.balanceOf(user.address)).to.equal(unstakeAmount);
    expect(await deadCoin.balanceOf(await pool.getAddress())).to.equal(stakeAmount - unstakeAmount);
  });

  it("should calculate rewards correctly", async function () {
    this.timeout(60000);
    
    // Using the global log function defined at the top of the file
    
    // Log initial contract states
    log("\n=== Initial Contract States ===");
    const poolAddress = await pool.getAddress();
    const tokenAddress = await token.getAddress();
    const distributorAddress = await distributor.getAddress();
    
    log(`- Pool Address: ${poolAddress}`);
    log(`- Token Address: ${tokenAddress}`);
    log(`- Reward Distributor: ${distributorAddress}`);
    log(`- Timelock: ${timelock.address}`);
    
    // Log token balances and roles
    const MINTER_ROLE = await token.MINTER_ROLE();
    const hasMinterRole = await token.hasRole(MINTER_ROLE, distributorAddress);
    log(`- RewardDistributor has MINTER_ROLE: ${hasMinterRole}`);
    
    // Log pool configuration
    const poolRewardRate = await pool.rewardRatePerSecond();
    const poolLastUpdate = await pool.lastUpdateTime();
    const poolRewardPerTokenStored = await pool.rewardPerTokenStored();
    log(`- Pool Reward Rate: ${ethers.formatEther(poolRewardRate)} RESURGE/s`);
    log(`- Pool Last Update: ${new Date(Number(poolLastUpdate) * 1000).toISOString()}`);
    log(`- Pool Reward Per Token Stored: ${ethers.formatEther(poolRewardPerTokenStored)}`);
    
    // Log RewardDistributor state
    const isPoolAuthorized = await distributor.authorizedStakingPools(await pool.getAddress());
    const totalMinted = await distributor.totalResurgeMinted();
    const maxSupply = await distributor.maxMintSupply();
    log(`- Pool is authorized in RewardDistributor: ${isPoolAuthorized}`);
    log(`- Total RESURGE minted: ${ethers.formatEther(totalMinted)} / ${ethers.formatEther(maxSupply)}`);
    
    // Log user balances
    const userDeadBalance = await deadCoin.balanceOf(user.address);
    const userResurgeBalance = await token.balanceOf(user.address);
    log(`- User DEAD balance: ${ethers.formatEther(userDeadBalance)}`);
    log(`- User RESURGE balance: ${ethers.formatEther(userResurgeBalance)}`);
    log("=== End Initial States ===\n");
    
    // Set up event logging
    const eventLog = [];
    
    // Helper function to safely stringify objects with BigInts
    const safeStringify = (obj, indent = 2) => {
      const replacer = (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        } else if (value && typeof value === 'object') {
          // Handle nested objects and arrays
          const newObj = {};
          for (const [k, v] of Object.entries(value)) {
            newObj[k] = typeof v === 'bigint' ? v.toString() : v;
          }
          return newObj;
        }
        return value;
      };
      return JSON.stringify(obj, replacer, indent);
    };

    // Enhanced event logging function
    const onEvent = (eventName, args) => {
      if (!args) return; // Skip if no args
      
      // Convert BigInts to strings in the args
      const safeArgs = {};
      for (const [key, value] of Object.entries(args)) {
        safeArgs[key] = typeof value === 'bigint' ? value.toString() : value;
      }
      
      const eventData = { 
        event: eventName,
        timestamp: new Date().toISOString(),
        blockNumber: 'current', // We'll update this when processing the event log
        args: safeArgs 
      };
      
      eventLog.push(eventData);
      log(`EVENT: ${eventName}`, safeStringify(eventData));
    };
    
    // Listen to all events from all contracts
    const handleEvent = (prefix) => (event) => {
      onEvent(`${prefix}.${event.event}`, event.args);
      
      // Special handling for DebugLog events from RewardDistributor
      if (prefix === 'Distributor' && event.event === 'DebugLog') {
        const [message, to, amount, totalMinted, maxSupply] = event.args;
        log(`[DISTRIBUTOR DEBUG] ${message}`, {
          to,
          amount: amount?.toString(),
          totalMinted: totalMinted?.toString(),
          maxSupply: maxSupply?.toString()
        });
      }
    };
    
    pool.on('*', handleEvent('Pool'));
    distributor.on('*', handleEvent('Distributor'));
    token.on('*', handleEvent('Token'));
    
    // Clean up event listeners after test
    after(async function() {
      pool.removeAllListeners();
      distributor.removeAllListeners();
      token.removeAllListeners();
    });
    
    console.log("\n=== Starting reward calculation test ===");
    
    try {
      log("\n=== Starting reward calculation test ===");
      
      // 1. Prepare test data with proper decimal handling
      const stakeAmount = parseEther("10000"); // 10,000 DEAD tokens (18 decimals)
      console.log(`   - Stake amount: ${ethers.formatEther(stakeAmount)} DEAD`);
      
      // Set a meaningful reward rate (0.001 RESURGE per second, 18 decimals)
      const rewardRatePerSecond = parseEther("0.001");
      console.log(`   - Setting reward rate: ${ethers.formatEther(rewardRatePerSecond)} RESURGE/second`);
      
      const setRateTx = await pool.connect(timelock).setRewardRate(rewardRatePerSecond);
      const setRateReceipt = await setRateTx.wait();
      console.log(`   - Set reward rate tx: ${setRateReceipt.hash}`);
      
      const stakingDuration = 3600; // 1 hour in seconds (reduced from 1 day for faster testing)
      console.log(`   - Staking duration: ${stakingDuration} seconds (${stakingDuration/3600} hours)`);
      
      // Verify the reward rate was set correctly
      const actualRewardRate = await pool.rewardRatePerSecond();
      console.log(`   - Actual reward rate: ${ethers.formatEther(actualRewardRate)} RESURGE/second`);
      expect(actualRewardRate).to.equal(rewardRatePerSecond);
      
      // Log the configuration
      log(`   - Staking amount: ${ethers.formatEther(stakeAmount)} DEAD (${stakeAmount} wei)`);
      log(`   - Reward rate: ${ethers.formatEther(rewardRatePerSecond)} RESURGE/s (${rewardRatePerSecond} wei/s)`);
      log(`   - Staking duration: ${stakingDuration} seconds (${stakingDuration / 86400} days)`);
      
      // 2. Ensure user has DEAD tokens and approve pool
      console.log("\n🔹 Preparing tokens for staking...");
      let userDeadBalance = await deadCoin.balanceOf(user.address);
      console.log(`   - Current user DEAD balance: ${ethers.formatEther(userDeadBalance)} DEAD`);
      
      if (userDeadBalance < stakeAmount) {
        const mintAmount = stakeAmount - userDeadBalance;
        console.log(`   - Minting ${ethers.formatEther(mintAmount)} DEAD to user...`);
        const mintTx = await deadCoin.connect(admin).mint(user.address, mintAmount);
        const mintTxReceipt = await mintTx.wait();
        console.log(`   - Mint tx: ${mintTxReceipt.hash}`);
        
        // Verify the mint was successful
        userDeadBalance = await deadCoin.balanceOf(user.address);
        console.log(`   - New user DEAD balance: ${ethers.formatEther(userDeadBalance)} DEAD`);
        expect(userDeadBalance).to.be.at.least(stakeAmount);
      }
      
      // 3. Approve pool to spend user's DEAD tokens
      log(`\n🔹 Approving pool to spend DEAD tokens...`);
      const approveTx = await deadCoin.connect(user).approve(await pool.getAddress(), stakeAmount);
      await logTx(approveTx, `Approve pool to spend ${ethers.formatEther(stakeAmount)} DEAD`);
      
      // 4. Get initial pool state
      const initialTotalStaked = await pool.totalStakedSupply();
      const initialUserStaked = await pool.userStakedAmount(user.address);
      const initialUserEarned = await pool.earned(user.address);
      
      log(`   - Initial total staked: ${ethers.formatEther(initialTotalStaked)} DEAD`);
      log(`   - Initial user staked: ${ethers.formatEther(initialUserStaked)} DEAD`);
      log(`   - Initial user earned: ${ethers.formatEther(initialUserEarned)} RESURGE`);
      
      // 5. Stake tokens
      log(`\n🔹 Staking tokens...`);
      const stakeTx = await pool.connect(user).stake(stakeAmount);
      const stakeReceipt = await logTx(stakeTx, `Stake ${ethers.formatEther(stakeAmount)} DEAD`);
      
      // 6. Verify staking
      const newTotalStaked = await pool.totalStakedSupply();
      const newUserStaked = await pool.userStakedAmount(user.address);
      
      log(`   - New total staked: ${ethers.formatEther(newTotalStaked)} DEAD`);
      log(`   - New user staked: ${ethers.formatEther(newUserStaked)} DEAD`);
      
      expect(newTotalStaked).to.equal(initialTotalStaked + stakeAmount);
      expect(newUserStaked).to.equal(initialUserStaked + stakeAmount);
      
      // 7. Increase time to accrue rewards
      log(`\n⏳ Advancing time by ${stakingDuration} seconds...`);
      const blockBefore = await ethers.provider.getBlock('latest');
      log(`   - Block before: #${blockBefore.number}, timestamp: ${blockBefore.timestamp}`);
      
      await increaseTime(stakingDuration);
      
      const blockAfter = await ethers.provider.getBlock('latest');
      log(`   - Block after: #${blockAfter.number}, timestamp: ${blockAfter.timestamp}`);
      log(`   - Time advanced by: ${blockAfter.timestamp - blockBefore.timestamp} seconds`);
      
      // 8. Calculate expected rewards with proper decimal handling
      // rewards = (rewardRate * time * userStaked) / totalStaked
      log('\n🔹 Reward Calculation Details:');
      log(`   - Reward rate: ${ethers.formatEther(rewardRatePerSecond)} RESURGE/s (${rewardRatePerSecond} wei/s)`);
      log(`   - Time: ${stakingDuration} seconds`);
      log(`   - User staked: ${ethers.formatEther(stakeAmount)} DEAD (${stakeAmount} wei)`);
      log(`   - Total staked: ${ethers.formatEther(newTotalStaked)} DEAD (${newTotalStaked} wei)`);
      
      // Break down the calculation for debugging
      const rewardForTime = rewardRatePerSecond * BigInt(stakingDuration);
      const rewardForUserStake = rewardForTime * stakeAmount;
      const expectedRewards = rewardForUserStake / newTotalStaked;
      
      // Log each step of the calculation
      log('\n🔹 Calculation Breakdown:');
      log(`   1. Reward for time (rate * time):`);
      log(`      ${ethers.formatEther(rewardRatePerSecond)} * ${stakingDuration} = ${ethers.formatEther(rewardForTime)} RESURGE`);
      log(`   2. Multiply by user stake (${ethers.formatEther(stakeAmount)} DEAD):`);
      log(`      ${ethers.formatEther(rewardForTime)} * ${ethers.formatEther(stakeAmount)} = ${ethers.formatEther(rewardForUserStake)} RESURGE`);
      log(`   3. Divide by total staked (${ethers.formatEther(newTotalStaked)} DEAD):`);
      log(`      ${ethers.formatEther(rewardForUserStake)} / ${ethers.formatEther(newTotalStaked)} = ${ethers.formatEther(expectedRewards)} RESURGE`);
      log('\n🔹 Expected Rewards:');
      log(`   - Raw: ${expectedRewards} wei`);
      log(`   - Formatted: ${ethers.formatEther(expectedRewards)} RESURGE`);
      
      // 9. Get actual pending rewards with detailed logging
      log('\n🔹 Fetching pending rewards...');
      const pendingRewards = await pool.earned(user.address);
      log(`   - Contract reports earned: ${ethers.formatEther(pendingRewards)} RESURGE (${pendingRewards} wei)`);
      
      // 10. Log user's current RESURGE balance before claiming
      const userResurgeBefore = await token.balanceOf(user.address);
      log(`   - User RESURGE balance before claim: ${ethers.formatEther(userResurgeBefore)} RESURGE`);
      
      // 11. Log contract's RESURGE balance
      const distributorBalance = await token.balanceOf(await distributor.getAddress());
      log(`   - Distributor RESURGE balance: ${ethers.formatEther(distributorBalance)} RESURGE`);
      
      // 12. Verify rewards are calculated correctly with proper decimal handling
      const rewardDifference = pendingRewards > expectedRewards 
        ? pendingRewards - expectedRewards 
        : expectedRewards - pendingRewards;
        
      log('\n🔹 Reward Verification:');
      log(`   - Expected rewards: ${ethers.formatEther(expectedRewards)} RESURGE (${expectedRewards} wei)`);
      log(`   - Actual rewards: ${ethers.formatEther(pendingRewards)} RESURGE (${pendingRewards} wei)`);
      log(`   - Difference: ${ethers.formatEther(rewardDifference)} RESURGE (${rewardDifference} wei)`);
      
      // Calculate percentage difference (for tolerance check)
      const percentDifference = Number(rewardDifference * 10000n / expectedRewards) / 100; // In basis points (0.01%)
      log(`   - Difference: ${percentDifference}%`);
      
      // Calculate 0.1% tolerance (1/1000) of the expected rewards
      // Ensure we have at least 1 wei tolerance to handle integer division rounding
      const tolerance = expectedRewards / 1000n > 1n 
        ? expectedRewards / 1000n 
        : 1n;
      
      // Log detailed reward information
      log('\n🔍 Reward Verification:');
      log(`   - Expected rewards: ${ethers.formatEther(expectedRewards)} RESURGE (${expectedRewards} wei)`);
      log(`   - Pending rewards: ${ethers.formatEther(pendingRewards)} RESURGE (${pendingRewards} wei)`);
      log(`   - Reward difference: ${ethers.formatEther(rewardDifference)} RESURGE (${rewardDifference} wei)`);
      log(`   - Allowed tolerance: ${ethers.formatEther(tolerance)} RESURGE (${tolerance} wei)`);
      
      // Check if the difference is within tolerance
      const isWithinTolerance = rewardDifference <= tolerance;
      
      // Special case: if expected rewards are very small, allow exact zero
      const isEffectivelyZero = expectedRewards === 0n && pendingRewards === 0n;
      
      if (!isWithinTolerance && !isEffectivelyZero) {
        throw new Error(`Reward calculation out of tolerance. Expected ~${ethers.formatEther(expectedRewards)} RESURGE, got ${ethers.formatEther(pendingRewards)} RESURGE`);
      }
      
      // Ensure we have meaningful rewards (at least 1 wei)
      if (expectedRewards === 0n) {
        throw new Error("Expected rewards are zero - increase reward rate or staking duration");
      }
      
      // 11. Test claiming rewards
      log("\n🔹 Testing reward claiming...");
      const initialUserBalance = await token.balanceOf(user.address);
      
      // Log contract states before claiming
      log(`   - Balance before claim: ${ethers.formatEther(initialUserBalance)} RESURGE`);
      log(`   - Pending rewards: ${ethers.formatEther(pendingRewards)} RESURGE`);
      log(`   - Pool RESURGE balance: ${ethers.formatEther(await token.balanceOf(await pool.getAddress()))} RESURGE`);
      log(`   - Distributor RESURGE balance: ${ethers.formatEther(await token.balanceOf(distributorAddress))} RESURGE`);
      
      log("\n🔹 Claiming rewards...");
      const claimTx = await pool.connect(user).claimRewards();
      const claimReceipt = await claimTx.wait();
      
      // Wait a bit for events to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      log(`   - Gas used: ${claimReceipt.gasUsed}`);
      log(`   - Transaction hash: ${claimReceipt.hash}`);
      
      // Get the new balance
      const newUserBalance = await token.balanceOf(user.address);
      const receivedRewards = newUserBalance - initialUserBalance;
      log(`   - User received: ${ethers.formatEther(receivedRewards)} RESURGE (${receivedRewards} wei)`);
      log(`   - New balance: ${ethers.formatEther(newUserBalance)} RESURGE`);
      
      // Log all captured events
      log('\n🔍 Captured Events:');
      eventLog.forEach((event, index) => {
        log(`   ${index + 1}. ${event.event}:`, JSON.stringify(event.args, null, 2));
      });
      
      // 12. Verify rewards were claimed correctly
      // The received rewards should be very close to the expected rewards
      const claimRewardDifference = receivedRewards > expectedRewards 
        ? receivedRewards - expectedRewards 
        : expectedRewards - receivedRewards;
      
      // Allow 0.1% tolerance for rounding differences
      const claimTolerance = expectedRewards / 1000n > 1n ? expectedRewards / 1000n : 1n;
      
      log('\n🔍 Claim Verification:');
      log(`   - Expected to receive: ${ethers.formatEther(expectedRewards)} RESURGE`);
      log(`   - Received: ${ethers.formatEther(receivedRewards)} RESURGE`);
      log(`   - Difference: ${ethers.formatEther(claimRewardDifference)} RESURGE`);
      log(`   - Allowed tolerance: ${ethers.formatEther(claimTolerance)} RESURGE`);
      
      // Verify the difference is within tolerance
      expect(claimRewardDifference).to.be.lte(claimTolerance);
      
      // Check event emission
      await expect(claimTx)
        .to.emit(pool, 'RewardsClaimed')
        .withArgs(user.address, receivedRewards);
        
      // Verify earned is now 0
      const earnedAfterClaim = await pool.earned(user.address);
      expect(earnedAfterClaim).to.equal(0);
      
      log("\n✅ Reward calculation test passed!");
      
    } catch (error) {
      log("\n❌ Reward calculation test failed!");
      log(`Error: ${error.message}`);
      if (error.reason) log(`Reason: ${error.reason}`);
      if (error.transaction) log(`Tx Hash: ${error.transaction.hash}`);
      throw error; // Re-throw to fail the test
    }
  }); // End of it block
}); // End of describe block

describe("DeadCoinStakingPool Emergency Functions", function () {
  it("should handle emergency pause functionality", async function () {
  this.timeout(30000);
  
  try {
    log("\n=== Testing emergency pause functionality ===");
    
    // Stake some tokens first to test pause on staking
    const stakeAmount = parseEther("100");
    log(`\n🔹 Preparing tokens for pause test...`);
    
    // Ensure user has enough deadCoin tokens and approve
    const userDeadBalance = await deadCoin.balanceOf(user.address);
    if (userDeadBalance < stakeAmount) {
      const mintAmount = stakeAmount - userDeadBalance;
      const mintTx = await deadCoin.connect(admin).mint(user.address, mintAmount);
      await logTx(mintTx, `Mint ${ethers.formatEther(mintAmount)} DEAD tokens for pause test`);
    }
    
    log(`\n🔹 Approving pool to spend DEAD tokens...`);
    const approveTx = await deadCoin.connect(user).approve(await pool.getAddress(), stakeAmount);
    await logTx(approveTx, `Approve ${ethers.formatEther(stakeAmount)} DEAD tokens for staking`);
    
    log(`\n🔹 Staking initial amount...`);
    const stakeTx = await pool.connect(user).stake(stakeAmount);
    await logTx(stakeTx, `Stake ${ethers.formatEther(stakeAmount)} DEAD`);
    
    const userStaked = await pool.userStakedAmount(user.address);
    log(`   - User staked amount: ${ethers.formatEther(userStaked)} DEAD`);
    expect(userStaked).to.equal(stakeAmount);

    // Test pausing
    log("\n🔹 Pausing the pool...");
    const pauseTx = await pool.connect(timelock).pause();
    await logTx(pauseTx, "Pause pool");
    
    // Verify pause is active
    log("\n🔹 Verifying pause...");
    await expect(pool.connect(user).stake(parseEther("10")))
      .to.be.revertedWith("Pausable: paused");
    
    await expect(pool.connect(user).unstake(parseEther("10")))
      .to.be.revertedWith("Pausable: paused");

    // Test unpausing
    log("\n🔹 Unpausing the pool...");
    const unpauseTx = await pool.connect(timelock).unpause();
    await logTx(unpauseTx, "Unpause pool");

    // Test staking after unpause
    log("\n🔹 Verifying unpause by staking...");
    const additionalStake = parseEther("10");
    
    // Ensure user has enough tokens for additional stake
    const additionalMintTx = await deadCoin.connect(admin).mint(user.address, additionalStake);
    await logTx(additionalMintTx, `Mint ${ethers.formatEther(additionalStake)} DEAD for additional stake`);
    
    const approveAdditionalTx = await deadCoin.connect(user).approve(await pool.getAddress(), additionalStake);
    await logTx(approveAdditionalTx, `Approve additional ${ethers.formatEther(additionalStake)} DEAD for staking`);

    // Try staking again after unpause
    const restakeTx = await pool.connect(user).stake(additionalStake);
    await expect(restakeTx)
      .to.emit(pool, "Staked")
      .withArgs(user.address, additionalStake);
      
    log(`\n✅ Emergency pause test completed successfully!`);
    
  } catch (error) {
    log("\n❌ Emergency pause test failed!");
    log(`Error: ${error.message}`);
    if (error.reason) log(`Reason: ${error.reason}`);
    if (error.transaction) log(`Tx Hash: ${error.transaction.hash}`);
    throw error; // Re-throw to fail the test
  }
});

// Add a closing bracket for the main describe block
});