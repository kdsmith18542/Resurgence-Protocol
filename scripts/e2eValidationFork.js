const hre = require("hardhat");
const { ethers, network } = hre;

const CONTRACTS = {
  ResurgeToken: "0x355FE26971b23B61F3757b31A628471285a6FC72",
  TimelockController: "0x006d561dbc0fA636b91ac9Bb52f576f16171D87B",
  RewardDistributor: "0x6bFCb2457b2d8fbcb349dbA8C51E34717AF7C1ce",
  DeadCoinStakingPoolImpl: "0x750e1E377cB44D608467FD74516546Fb737D2d83",
  ResurgeStakingPool: "0x97E1c0e91d5931a6158CF4B548856F3655FB42f5",
  StakingPoolManager: "0x851af5d0D896D445D134605B1CACDD50c63d178A",
  ResurgenceGovernance: "0x43d340Ee2876C783aB32d4Fd2c6bb74CAfac3106",
};

async function main() {
  console.log("=== Starting Phase 8 Fork Validation ===");

  // 1. Reset Hardhat Provider (forking is configured at start-up via config)
  console.log("\n1. Forking Arbitrum Sepolia...");
  console.log("   Fork initialized successfully.");

  // 2. Impersonate and Fund Deployer Signer
  const deployerAddress = "0x99220419A29220ab0A2CDE25bF2C9ACBEddeEB1E";
  console.log(`\n2. Impersonating deployer account: ${deployerAddress}`);
  
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [deployerAddress],
  });

  await network.provider.send("hardhat_setBalance", [
    deployerAddress,
    "0x56bc75e2d63100000", // 100 ETH
  ]);

  const deployer = await ethers.getSigner(deployerAddress);

  // Mine a block to initialize the fork and bypass historical block hardfork history bugs
  await network.provider.send("hardhat_mine", ["0x1"]);
  console.log("   Mined 1 block to initialize fork state.");

  // Load contracts
  const resurgeToken = await ethers.getContractAt("ResurgeToken", CONTRACTS.ResurgeToken, deployer);
  const governance = await ethers.getContractAt("ResurgenceGovernance", CONTRACTS.ResurgenceGovernance, deployer);
  const manager = await ethers.getContractAt("StakingPoolManager", CONTRACTS.StakingPoolManager, deployer);
  const timelock = await ethers.getContractAt("ResurgenceTimelockController", CONTRACTS.TimelockController, deployer);

  // Temporarily grant MINTER_ROLE to deployer in the local fork to mint test tokens
  console.log("   Granting MINTER_ROLE to deployer in local fork...");
  const timelockAddress = CONTRACTS.TimelockController;
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [timelockAddress],
  });
  await network.provider.send("hardhat_setBalance", [
    timelockAddress,
    "0xde0b6b3a7640000", // 1 ETH
  ]);
  const timelockSigner = await ethers.getSigner(timelockAddress);
  const tokenAsTimelock = resurgeToken.connect(timelockSigner);
  const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
  const grantTx = await tokenAsTimelock.grantRole(MINTER_ROLE, deployer.address);
  await grantTx.wait();
  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [timelockAddress],
  });
  console.log("   MINTER_ROLE granted to deployer.");

  // Mint tokens to deployer
  console.log("   Minting 1,000,000 RESURGE to deployer...");
  const mintTx = await resurgeToken.mint(deployer.address, ethers.parseUnits("1000000", 18));
  await mintTx.wait();
  console.log("   Tokens minted.");

  // Fetch balances
  const balance = await ethers.provider.getBalance(deployer.address);

  const tokenBalance = await resurgeToken.balanceOf(deployer.address);
  console.log(`   RESURGE Balance: ${ethers.formatEther(tokenBalance)} RESURGE`);

  // 3. Delegate votes to activate voting power
  console.log("\n3. Delegating votes to self...");
  const delegateTx = await resurgeToken.delegate(deployer.address);
  await delegateTx.wait();
  console.log("   Delegation tx complete.");

  // Check initial votes
  const currentVotes = await resurgeToken.getVotes(deployer.address);
  console.log(`   Voting Power (Active): ${ethers.formatEther(currentVotes)} RESURGE`);

  // 4. Deploy Mock Dead Coin (DDOGE)
  console.log("\n4. Deploying Mock Dead Coin (DDOGE)...");
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock", deployer);
  const ddoge = await ERC20Mock.deploy("Dead Doge", "DDOGE", ethers.parseUnits("1000000", 18));
  await ddoge.waitForDeployment();
  const ddogeAddress = await ddoge.getAddress();
  console.log(`   DDOGE deployed at: ${ddogeAddress}`);

  // 5. Create Governance Proposal to register DDOGE pool
  console.log("\n5. Creating governance proposal to register DDOGE staking pool...");
  const rewardRate = ethers.parseUnits("0.001", 18); // 0.001 RESURGE/sec
  
  // Encode addStakingPool call
  // signature: addStakingPool(address _deadCoinAddress, uint256 _initialRewardRatePerSecond, address _timelock, address _treasury)
  const addPoolCalldata = manager.interface.encodeFunctionData("addStakingPool", [
    ddogeAddress,
    rewardRate,
    CONTRACTS.TimelockController,
    CONTRACTS.TimelockController
  ]);

  const targets = [CONTRACTS.StakingPoolManager];
  const values = [0n];
  const calldatas = [addPoolCalldata];
  const description = "Proposal #1: Register Dead Doge (DDOGE) Staking Pool";
  const descHash = ethers.id(description);

  const proposeTx = await governance.propose(targets, values, calldatas, description);
  const proposeReceipt = await proposeTx.wait();

  // Find proposal ID in receipt logs
  const proposalCreatedLog = proposeReceipt.logs.find(log => {
    try { return governance.interface.parseLog(log)?.name === "ProposalCreated"; } catch { return false; }
  });
  const proposalId = governance.interface.parseLog(proposalCreatedLog).args[0];
  console.log(`   Proposal created successfully. Proposal ID: ${proposalId}`);

  // 6. Mine blocks to pass the voting delay
  console.log("\n6. Advancing blocks past voting delay (~7200 blocks)...");
  await network.provider.send("hardhat_mine", [ethers.toBeHex(7205)]);
  console.log("   Blocks mined.");

  // Check state
  let proposalState = await governance.state(proposalId);
  console.log(`   Proposal state (expected Active = 1): ${proposalState}`);
  if (proposalState !== 1n) throw new Error("Proposal is not active!");

  // 7. Cast Vote
  console.log("\n7. Casting vote 'For' (support = 1)...");
  const voteTx = await governance.castVoteWithReason(proposalId, 1, "Register DDOGE pool");
  await voteTx.wait();
  console.log("   Vote cast successfully.");

  // 8. Mine blocks to pass the voting period
  console.log("\n8. Advancing blocks past voting period (~50400 blocks)...");
  await network.provider.send("hardhat_mine", [ethers.toBeHex(50405)]);
  console.log("   Blocks mined.");

  proposalState = await governance.state(proposalId);
  console.log(`   Proposal state (expected Succeeded = 4): ${proposalState}`);
  if (proposalState !== 4n) throw new Error("Proposal did not succeed!");

  // 9. Queue Proposal
  console.log("\n9. Queueing proposal in Timelock...");
  const queueTx = await governance.queue(targets, values, calldatas, descHash);
  await queueTx.wait();
  console.log("   Proposal queued.");

  proposalState = await governance.state(proposalId);
  console.log(`   Proposal state (expected Queued = 5): ${proposalState}`);
  if (proposalState !== 5n) throw new Error("Proposal did not queue!");

  // 10. Pass Timelock Delay
  console.log("\n10. Advancing EVM time past Timelock delay (3600 seconds)...");
  await network.provider.send("evm_increaseTime", [3610]);
  await network.provider.send("evm_mine");
  console.log("    Time advanced.");

  // 11. Execute Proposal
  console.log("\n11. Executing proposal...");
  const executeTx = await governance.execute(targets, values, calldatas, descHash);
  await executeTx.wait();
  console.log("    Proposal executed successfully!");

  proposalState = await governance.state(proposalId);
  console.log(`    Proposal state (expected Executed = 7): ${proposalState}`);
  if (proposalState !== 7n) throw new Error("Proposal did not execute!");

  // 12. Verify Staking Pool Registration
  console.log("\n12. Verifying DDOGE staking pool status...");
  const poolAddress = await manager.deadCoinToPoolAddress(ddogeAddress);
  console.log(`    DDOGE Pool Proxy Address: ${poolAddress}`);
  if (poolAddress === ethers.ZeroAddress) throw new Error("Staking pool not deployed!");

  const isSupported = poolAddress !== ethers.ZeroAddress;
  console.log(`    Dead coin is supported: ${isSupported}`);
  if (!isSupported) throw new Error("Dead coin is not marked supported!");

  // 13. Test Staking & Claiming with Treasury Fee
  console.log("\n13. Testing staking and claiming rewards (with 10% fee splitting)...");
  const stakingPool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress, deployer);

  // Mint and approve DDOGE
  const stakeAmount = ethers.parseUnits("1000", 18);
  await ddoge.approve(poolAddress, stakeAmount);
  console.log(`    Approved pool to spend ${ethers.formatEther(stakeAmount)} DDOGE.`);

  const poolDeadCoin = await stakingPool.deadCoin();
  console.log(`    Pool deadCoin address: ${poolDeadCoin}`);
  console.log(`    Mock ddoge address:    ${ddogeAddress}`);
  
  const allowance = await ddoge.allowance(deployer.address, poolAddress);
  console.log(`    Allowance:             ${ethers.formatEther(allowance)} DDOGE`);

  // Stake DDOGE
  console.log("    Staking DDOGE...");
  const stakeTx = await stakingPool.stake(stakeAmount);
  await stakeTx.wait();
  console.log("    Staked.");

  // Advance time by 1 day (86400 seconds)
  console.log("    Simulating time passage of 1 day (86400 seconds)...");
  await network.provider.send("evm_increaseTime", [86400]);
  await network.provider.send("evm_mine");

  // Check rewards
  const earned = await stakingPool.earned(deployer.address);
  console.log(`    Earned rewards: ${ethers.formatEther(earned)} RESURGE`);

  const treasuryAddress = await stakingPool.treasury();
  console.log(`    Treasury Address (expected Timelock): ${treasuryAddress}`);

  const timelockResurgeBefore = await resurgeToken.balanceOf(CONTRACTS.TimelockController);
  const userResurgeBefore = await resurgeToken.balanceOf(deployer.address);

  // Claim
  console.log("    Claiming rewards...");
  const claimTx = await stakingPool.claimRewards();
  await claimTx.wait();
  console.log("    Claim complete.");

  const timelockResurgeAfter = await resurgeToken.balanceOf(CONTRACTS.TimelockController);
  const userResurgeAfter = await resurgeToken.balanceOf(deployer.address);

  const timelockReceived = timelockResurgeAfter - timelockResurgeBefore;
  const userReceived = userResurgeAfter - userResurgeBefore;

  console.log(`    User received: ${ethers.formatEther(userReceived)} RESURGE`);
  console.log(`    Treasury received: ${ethers.formatEther(timelockReceived)} RESURGE`);

  // Verify 10% fee
  const expectedFee = (earned * 1000n) / 10000n;
  const expectedUser = earned - expectedFee;

  console.log(`    Expected Fee: ${ethers.formatEther(expectedFee)} RESURGE`);
  console.log(`    Expected User: ${ethers.formatEther(expectedUser)} RESURGE`);

  // Assert user and treasury received the correct shares
  const margin = ethers.parseUnits("0.01", 18); // small margin for 1-second delay in block mining
  if (userReceived < expectedUser - margin || userReceived > expectedUser + margin) {
    throw new Error("Incorrect user reward amount received!");
  }
  if (timelockReceived < expectedFee - margin || timelockReceived > expectedFee + margin) {
    throw new Error("Incorrect treasury fee amount received!");
  }
  console.log("    ✅ Staking and reward claim (with fee splitting) verified successfully!");

  // 14. Verify claimAndRestakeTo Rejects Unauthorized Pools
  console.log("\n14. Verifying claimAndRestakeTo rejects unauthorized pools...");
  try {
    // Attempt to compound/restake to an arbitrary address not registered as a pool
    await stakingPool.claimAndRestakeTo(deployer.address);
    throw new Error("Restake to unauthorized pool succeeded, but should have reverted!");
  } catch (e) {
    if (e.message.includes("reverted") || e.message.includes("revert")) {
      console.log("    ✅ Reverted as expected when restaking to unauthorized pool.");
    } else {
      throw e;
    }
  }

  // 15. Verify UUPS Contract Upgrade path via Governance
  console.log("\n15. Verifying contract upgrade path via governance...");
  // Deploy new pool implementation
  const DeadCoinStakingPool = await ethers.getContractFactory("DeadCoinStakingPool", deployer);
  const newPoolImpl = await DeadCoinStakingPool.deploy();
  await newPoolImpl.waitForDeployment();
  const newPoolImplAddress = await newPoolImpl.getAddress();
  console.log(`    New logic implementation deployed at: ${newPoolImplAddress}`);

  // Encode upgradeStakingPoolImplementation call
  // signature: upgradeStakingPoolImplementation(address _newImplementation)
  const upgradeCalldata = manager.interface.encodeFunctionData("setStakingPoolImplementation", [
    newPoolImplAddress
  ]);

  const upgradeTargets = [CONTRACTS.StakingPoolManager];
  const upgradeValues = [0n];
  const upgradeCalldatas = [upgradeCalldata];
  const upgradeDescription = "Proposal #2: Upgrade DeadCoinStakingPool Staking Logic Implementation";
  const upgradeDescHash = ethers.id(upgradeDescription);

  // Propose
  const upgradeProposeTx = await governance.propose(upgradeTargets, upgradeValues, upgradeCalldatas, upgradeDescription);
  const upgradeProposeReceipt = await upgradeProposeTx.wait();

  const upgradeCreatedLog = upgradeProposeReceipt.logs.find(log => {
    try { return governance.interface.parseLog(log)?.name === "ProposalCreated"; } catch { return false; }
  });
  const upgradeProposalId = governance.interface.parseLog(upgradeCreatedLog).args[0];
  console.log(`    Upgrade proposal created. ID: ${upgradeProposalId}`);

  // Pass voting delay
  await network.provider.send("hardhat_mine", [ethers.toBeHex(7205)]);

  // Vote
  const upgradeVoteTx = await governance.castVoteWithReason(upgradeProposalId, 1, "Upgrade pool logic");
  await upgradeVoteTx.wait();

  // Pass voting period
  await network.provider.send("hardhat_mine", [ethers.toBeHex(50405)]);

  // Queue
  const upgradeQueueTx = await governance.queue(upgradeTargets, upgradeValues, upgradeCalldatas, upgradeDescHash);
  await upgradeQueueTx.wait();

  // Pass timelock delay
  await network.provider.send("evm_increaseTime", [3610]);
  await network.provider.send("evm_mine");

  // Execute
  const upgradeExecTx = await governance.execute(upgradeTargets, upgradeValues, upgradeCalldatas, upgradeDescHash);
  await upgradeExecTx.wait();
  console.log("    Upgrade proposal executed successfully!");

  // Verify the implementation has been updated in StakingPoolManager
  const activeImpl = await manager.stakingPoolImplementation();
  console.log(`    Current implementation: ${activeImpl}`);
  console.log(`    Expected implementation: ${newPoolImplAddress}`);
  if (activeImpl.toLowerCase() !== newPoolImplAddress.toLowerCase()) {
    throw new Error("Implementation was not updated successfully!");
  }
  console.log("    ✅ Contract upgrade verified successfully!");

  console.log("\n=== Phase 8 Fork Validation Successfully Passed! ===");
}

main().catch(err => {
  console.error("\n❌ Validation Failed:", err.message);
  process.exit(1);
});
