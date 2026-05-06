const hre = require("hardhat");
const { ethers, upgrades } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Resurgence Protocol to Optimism with:", deployer.address);

  const INITIAL_TOKEN_SUPPLY = ethers.parseUnits(process.env.INITIAL_TOKEN_SUPPLY || "1000000000", 18);
  const TIMELOCK_MIN_DELAY = parseInt(process.env.TIMELOCK_MIN_DELAY || "3600");
  const VOTING_DELAY = parseInt(process.env.VOTING_DELAY || "7200");
  const VOTING_PERIOD = parseInt(process.env.VOTING_PERIOD || "50400");
  const QUORUM_PERCENTAGE = parseInt(process.env.QUORUM_PERCENTAGE || "4");
  const PROPOSAL_THRESHOLD = ethers.parseUnits(process.env.PROPOSAL_THRESHOLD || "100000", 18);

  // 1. Deploy ResurgeToken
  console.log("\n1. Deploying ResurgeToken...");
  const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
  const token = await upgrades.deployProxy(ResurgeToken, [deployer.address, INITIAL_TOKEN_SUPPLY], {
    kind: "uups",
    initializer: "initialize",
  });
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("   ResurgeToken:", tokenAddress);

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

  // 4. Deploy DeadCoinStakingPool implementation
  console.log("\n4. Deploying DeadCoinStakingPool implementation...");
  const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
  const poolImpl = await PoolImpl.deploy();
  await poolImpl.waitForDeployment();
  const poolImplAddress = await poolImpl.getAddress();
  console.log("   Pool Implementation:", poolImplAddress);

  // 5. Deploy StakingPoolManager
  console.log("\n5. Deploying StakingPoolManager...");
  const Manager = await ethers.getContractFactory("StakingPoolManager");
  const manager = await upgrades.deployProxy(Manager, [
    tokenAddress, distributorAddress, poolImplAddress, timelockAddress,
  ], { kind: "uups", initializer: "initialize" });
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("   StakingPoolManager:", managerAddress);

  // 5.5. Deploy ResurgeStakingPool
  console.log("\n5.5. Deploying ResurgeStakingPool...");
  const ResurgeStakingPool = await ethers.getContractFactory("ResurgeStakingPool");
  const resurgeStaking = await upgrades.deployProxy(ResurgeStakingPool, [
    tokenAddress, distributorAddress, timelockAddress, ethers.parseUnits("1", 18)
  ], { kind: "uups", initializer: "initialize" });
  await resurgeStaking.waitForDeployment();
  const resurgeStakingAddress = await resurgeStaking.getAddress();
  console.log("   ResurgeStakingPool:", resurgeStakingAddress);

  // Authorize in distributor
  await distributor.authorizeStakingPool(resurgeStakingAddress);
  console.log("   Authorized ResurgeStakingPool in RewardDistributor");

  // 6. Deploy ResurgenceGovernance
  console.log("\n6. Deploying ResurgenceGovernance...");
  const Governance = await ethers.getContractFactory("ResurgenceGovernance");
  const governance = await Governance.deploy(
    tokenAddress,
    timelockAddress,
    VOTING_DELAY,
    VOTING_PERIOD,
    QUORUM_PERCENTAGE,
    PROPOSAL_THRESHOLD
  );
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("   ResurgenceGovernance:", governanceAddress);

  // 7. Transfer roles to Timelock
  console.log("\n7. Transferring roles to Timelock...");
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();

  await timelock.grantRole(PROPOSER_ROLE, governanceAddress);
  await timelock.grantRole(EXECUTOR_ROLE, governanceAddress);
  await timelock.grantRole(CANCELLER_ROLE, governanceAddress);

  await timelock.revokeRole(PROPOSER_ROLE, deployer.address);
  await timelock.revokeRole(EXECUTOR_ROLE, deployer.address);
  console.log("   Governance granted PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE");

  const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
  const MINTER_ROLE = await token.MINTER_ROLE();
  const PAUSER_ROLE = await token.PAUSER_ROLE();

  await token.grantRole(DEFAULT_ADMIN_ROLE, timelockAddress);
  await token.grantRole(MINTER_ROLE, distributorAddress);
  await token.grantRole(PAUSER_ROLE, timelockAddress);
  await token.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address);

  // 7.5. Renounce temporary deployer roles in other contracts
  console.log("   Renouncing temporary deployer roles...");
  await distributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await distributor.renounceRole(await distributor.TIMELOCK_ROLE(), deployer.address);
  await manager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await manager.renounceRole(await manager.TIMELOCK_ROLE(), deployer.address);
  await resurgeStaking.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await resurgeStaking.renounceRole(await resurgeStaking.TIMELOCK_ROLE(), deployer.address);

  console.log("   Distributor granted MINTER_ROLE on token");
  console.log("   Timelock granted DEFAULT_ADMIN_ROLE and PAUSER_ROLE on token");

  // 8. Output addresses
  console.log("\n===== OPTIMISM DEPLOYMENT COMPLETE =====");
  console.log(`NEXT_PUBLIC_RESURGE_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_TIMELOCK_ADDRESS=${timelockAddress}`);
  console.log(`NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=${distributorAddress}`);
  console.log(`NEXT_PUBLIC_STAKING_POOL_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`NEXT_PUBLIC_RESURGE_STAKING_POOL_ADDRESS=${resurgeStakingAddress}`);
  console.log(`NEXT_PUBLIC_GOVERNANCE_ADDRESS=${governanceAddress}`);
  console.log(`NEXT_PUBLIC_POOL_IMPL_ADDRESS=${poolImplAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
