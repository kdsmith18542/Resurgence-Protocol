const hre = require("hardhat");
const { ethers, upgrades } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Resurgence Protocol to Polygon Mainnet with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  const INITIAL_TOKEN_SUPPLY = ethers.parseUnits(process.env.INITIAL_TOKEN_SUPPLY || "1000000000", 18);
  const TIMELOCK_MIN_DELAY = parseInt(process.env.TIMELOCK_MIN_DELAY || "3600");
  const VOTING_DELAY = parseInt(process.env.VOTING_DELAY || "7200");
  const VOTING_PERIOD = parseInt(process.env.VOTING_PERIOD || "50400");
  const QUORUM_PERCENTAGE = parseInt(process.env.QUORUM_PERCENTAGE || "4");
  const PROPOSAL_THRESHOLD = ethers.parseUnits(process.env.PROPOSAL_THRESHOLD || "100000", 18);

  // 1. Deploy ResurgeToken
  console.log("1. Deploying ResurgeToken...");
  const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
  const token = await upgrades.deployProxy(ResurgeToken, [deployer.address, INITIAL_TOKEN_SUPPLY], {
    kind: "uups",
    initializer: "initialize",
  });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   ResurgeToken:", tokenAddress);
  await verify(tokenAddress, []);

  // 2. Deploy TimelockController
  console.log("\n2. Deploying TimelockController...");
  const Timelock = await ethers.getContractFactory("ResurgenceTimelockController");
  const timelock = await Timelock.deploy(
    TIMELOCK_MIN_DELAY,
    [deployer.address],
    [deployer.address],
    deployer.address
  );
  await timelock.waitForDeployment();
  const timelockAddress = await timelock.getAddress();
  console.log("   TimelockController:", timelockAddress);
  await verify(timelockAddress, [TIMELOCK_MIN_DELAY, [deployer.address], [deployer.address], deployer.address]);

  // 3. Deploy RewardDistributor
  console.log("\n3. Deploying RewardDistributor...");
  const maxMintSupply = ethers.parseUnits("500000000", 18);
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const distributor = await upgrades.deployProxy(RewardDistributor, [
    tokenAddress, maxMintSupply, timelockAddress,
  ], { kind: "uups", initializer: "initialize" });
  await distributor.waitForDeployment();
  const distributorAddress = await distributor.getAddress();
  console.log("   RewardDistributor:", distributorAddress);
  await verify(distributorAddress, []);

  // 4. Deploy DeadCoinStakingPool implementation
  console.log("\n4. Deploying DeadCoinStakingPool implementation...");
  const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
  const poolImpl = await PoolImpl.deploy();
  await poolImpl.waitForDeployment();
  const poolImplAddress = await poolImpl.getAddress();
  console.log("   Pool Implementation:", poolImplAddress);
  await verify(poolImplAddress, []);

  // 5. Deploy StakingPoolManager
  console.log("\n5. Deploying StakingPoolManager...");
  const Manager = await ethers.getContractFactory("StakingPoolManager");
  const manager = await upgrades.deployProxy(Manager, [
    tokenAddress, distributorAddress, poolImplAddress, timelockAddress,
  ], { kind: "uups", initializer: "initialize" });
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("   StakingPoolManager:", managerAddress);
  await verify(managerAddress, []);

  // 6. Deploy ResurgeStakingPool
  console.log("\n6. Deploying ResurgeStakingPool...");
  const INITIAL_RESURGE_REWARD_RATE = ethers.parseUnits(process.env.RESURGE_REWARD_RATE || "1", 18); // 1 RESURGE/sec default
  const ResurgeStakingPool = await ethers.getContractFactory("ResurgeStakingPool");
  const resurgePool = await upgrades.deployProxy(ResurgeStakingPool, [
    tokenAddress,
    distributorAddress,
    timelockAddress,
    INITIAL_RESURGE_REWARD_RATE,
  ], { kind: "uups", initializer: "initialize" });
  await resurgePool.waitForDeployment();
  const resurgePoolAddress = await resurgePool.getAddress();
  console.log("   ResurgeStakingPool:", resurgePoolAddress);
  await verify(resurgePoolAddress, []);

  // Authorize ResurgeStakingPool in RewardDistributor
  const distributorContract = await ethers.getContractAt("RewardDistributor", distributorAddress);
  await distributorContract.authorizeStakingPool(resurgePoolAddress);
  console.log("   ResurgeStakingPool authorized in RewardDistributor");

  // 7. Deploy ResurgenceGovernance
  console.log("\n7. Deploying ResurgenceGovernance...");
  const Governance = await ethers.getContractFactory("ResurgenceGovernance");
  const governance = await Governance.deploy(
    tokenAddress,
    timelockAddress,
    resurgePoolAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    QUORUM_PERCENTAGE,
    PROPOSAL_THRESHOLD
  );
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("   ResurgenceGovernance:", governanceAddress);
  await verify(governanceAddress, [tokenAddress, timelockAddress, resurgePoolAddress, VOTING_DELAY, VOTING_PERIOD, QUORUM_PERCENTAGE, PROPOSAL_THRESHOLD]);

  // 8. Transfer roles to Timelock
  console.log("\n8. Transferring roles to Timelock...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();

  await timelock.grantRole(PROPOSER_ROLE, governanceAddress);
  console.log("   Governance granted PROPOSER_ROLE");
  await timelock.grantRole(EXECUTOR_ROLE, governanceAddress);
  console.log("   Governance granted EXECUTOR_ROLE");
  await timelock.grantRole(CANCELLER_ROLE, governanceAddress);
  console.log("   Governance granted CANCELLER_ROLE");

  await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
  await timelock.revokeRole(EXECUTOR_ROLE, deployer.address);
  console.log("   Deployer roles revoked from Timelock");

  const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await token.MINTER_ROLE();
  const PAUSER_ROLE = await token.PAUSER_ROLE();

  const TIMELOCK_ROLE_TOKEN = await token.TIMELOCK_ROLE();
  await token.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
  await token.grantRole(MINTER_ROLE, distributorAddress);
  await token.grantRole(PAUSER_ROLE, timelockAddress);
  await token.grantRole(TIMELOCK_ROLE_TOKEN, timelockAddress);
  // Revoke all deployer privileges before losing DEFAULT_ADMIN_ROLE
  await token.revokeRole(MINTER_ROLE, deployer.address);
  await token.revokeRole(PAUSER_ROLE, deployer.address);
  await token.revokeRole(TIMELOCK_ROLE_TOKEN, deployer.address);
  await token.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("   Token roles transferred (deployer MINTER/PAUSER/TIMELOCK revoked)");

  // 8.5. Grant manager TIMELOCK_ROLE on the distributor so addStakingPool can authorize/deauthorize pools
  await distributor.grantRole(await distributor.TIMELOCK_ROLE(), managerAddress);
  console.log("   StakingPoolManager granted TIMELOCK_ROLE on RewardDistributor");

  // 8.6. Renounce temporary deployer roles so no EOA retains admin/timelock access
  console.log("\n8.6. Renouncing temporary deployer roles...");
  await distributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await distributor.renounceRole(await distributor.TIMELOCK_ROLE(), deployer.address);
  await manager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await manager.renounceRole(await manager.TIMELOCK_ROLE(), deployer.address);
  await resurgePool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await resurgePool.renounceRole(await resurgePool.TIMELOCK_ROLE(), deployer.address);

  // Renounce the deployer's admin over the Timelock itself (Timelock self-administers in OZ v5)
  await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("   Deployer roles renounced on distributor, manager, ResurgeStakingPool, and Timelock");

  // 9. Output deployment summary
  console.log("\n========== POLYGON MAINNET DEPLOYMENT COMPLETE ==========");
  console.log(`NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_TIMELOCK_ADDRESS=${timelockAddress}`);
  console.log(`NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_RESURGE_STAKING_POOL_ADDRESS=${resurgePoolAddress}`);
  console.log(`NEXT_PUBLIC_GOVERNANCE_ADDRESS=${governanceAddress}`);
  console.log("==========================================================\n");
}

async function verify(address, args) {
  if (process.env.POLYGONSCAN_API_KEY) {
    console.log(`   Verifying ${address}...`);
    try {
      await hre.run("verify:verify", { address, constructorArguments: args });
      console.log("   Verified!");
    } catch (e) {
      console.log("   Verification skipped:", e.message?.slice(0, 100));
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
