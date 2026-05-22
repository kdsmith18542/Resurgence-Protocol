const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("");

  // 1. Deploy ResurgeToken (UUPS Proxy)
  console.log("1. Deploying ResurgeToken (UUPS proxy)...");
  const ResurgeToken = await hre.ethers.getContractFactory("ResurgeToken");
  const maxSupply = 1000000000000000000000000000n; // 1 billion tokens
  const resurgenceToken = await upgrades.deployProxy(
    ResurgeToken,
    [deployer.address, maxSupply],
    { kind: 'uups' }
  );
  await resurgenceToken.waitForDeployment();
  console.log("   ResurgeToken proxy:", await resurgenceToken.getAddress());
  console.log("");

  // 2. Deploy TimelockController
  console.log("2. Deploying TimelockController...");
  const ResurgenceTimelockController = await hre.ethers.getContractFactory("ResurgenceTimelockController");
  const minDelay = 3600; // 1 hour
  const proposers = [deployer.address];
  const executors = [deployer.address];
  const admin = deployer.address;
  const timelockController = await ResurgenceTimelockController.deploy(minDelay, proposers, executors, admin);
  await timelockController.waitForDeployment();
  console.log("   TimelockController:", await timelockController.getAddress());
  console.log("");

  // 3. Deploy RewardDistributor (UUPS Proxy)
  console.log("3. Deploying RewardDistributor (UUPS proxy)...");
  const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
  const initialMaxMintSupply = 500000000n * 10n**18n; // 500 million tokens
  const rewardDistributor = await upgrades.deployProxy(
    RewardDistributor,
    [await resurgenceToken.getAddress(), initialMaxMintSupply, await timelockController.getAddress()],
    { kind: 'uups' }
  );
  await rewardDistributor.waitForDeployment();
  console.log("   RewardDistributor proxy:", await rewardDistributor.getAddress());
  console.log("");

  // 4. Grant MINTER_ROLE to RewardDistributor
  console.log("4. Granting MINTER_ROLE to RewardDistributor...");
  const MINTER_ROLE = await resurgenceToken.MINTER_ROLE();
  await resurgenceToken.grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
  console.log("   Done");
  console.log("");

  // 5. Deploy DeadCoinStakingPool implementation (logic contract)
  console.log("5. Deploying DeadCoinStakingPool implementation...");
  const DeadCoinStakingPool = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const stakingPoolImplementation = await DeadCoinStakingPool.deploy();
  await stakingPoolImplementation.waitForDeployment();
  console.log("   Implementation:", await stakingPoolImplementation.getAddress());
  console.log("");

  // 6. Deploy StakingPoolManager (UUPS Proxy)
  console.log("6. Deploying StakingPoolManager (UUPS proxy)...");
  const StakingPoolManager = await hre.ethers.getContractFactory("StakingPoolManager");
  const stakingPoolManager = await upgrades.deployProxy(
    StakingPoolManager,
    [
      await resurgenceToken.getAddress(),
      await rewardDistributor.getAddress(),
      await stakingPoolImplementation.getAddress(),
      await timelockController.getAddress()
    ],
    { kind: 'uups' }
  );
  await stakingPoolManager.waitForDeployment();
  console.log("   StakingPoolManager proxy:", await stakingPoolManager.getAddress());
  console.log("");

  // 6.5. Deploy ResurgeStakingPool (UUPS Proxy)
  console.log("6.5. Deploying ResurgeStakingPool (UUPS proxy)...");
  const ResurgeStakingPool = await hre.ethers.getContractFactory("ResurgeStakingPool");
  const nativeRewardRate = 1000000000000000000n; // 1 RESURGE/sec
  const resurgeStakingPool = await upgrades.deployProxy(
    ResurgeStakingPool,
    [
      await resurgenceToken.getAddress(),
      await rewardDistributor.getAddress(),
      await timelockController.getAddress(),
      nativeRewardRate
    ],
    { kind: 'uups' }
  );
  await resurgeStakingPool.waitForDeployment();
  console.log("   ResurgeStakingPool proxy:", await resurgeStakingPool.getAddress());
  console.log("");

  // 6.6. Authorize ResurgeStakingPool in RewardDistributor
  console.log("6.6. Authorizing ResurgeStakingPool in RewardDistributor...");
  await rewardDistributor.authorizeStakingPool(await resurgeStakingPool.getAddress());
  console.log("   Done");
  console.log("");

  // 7. Deploy ResurgenceGovernance (not upgradeable by design)
  console.log("7. Deploying ResurgenceGovernance...");
  const ResurgenceGovernance = await hre.ethers.getContractFactory("ResurgenceGovernance");
  const votingDelay = 1;
  const votingPeriod = 50400; // ~1 week at 12s/block
  const quorumPercentage = 4; // 4%
  const proposalThreshold = 1000n * 10n**18n; // 1000 RESURGE
  const resurgenceGovernance = await ResurgenceGovernance.deploy(
    await resurgenceToken.getAddress(),
    await timelockController.getAddress(),
    votingDelay,
    votingPeriod,
    quorumPercentage,
    proposalThreshold
  );
  await resurgenceGovernance.waitForDeployment();
  console.log("   ResurgenceGovernance:", await resurgenceGovernance.getAddress());
  console.log("");

  // 8. Configure governance roles in Timelock
  console.log("8. Configuring Timelock roles for Governance...");
  const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelockController.DEFAULT_ADMIN_ROLE();

  await timelockController.grantRole(PROPOSER_ROLE, await resurgenceGovernance.getAddress());
  await timelockController.grantRole(EXECUTOR_ROLE, await resurgenceGovernance.getAddress());
  await timelockController.revokeRole(PROPOSER_ROLE, deployer.address);
  await timelockController.revokeRole(EXECUTOR_ROLE, deployer.address);
  console.log("   Governance is now proposer and executor");
  console.log("");

  // 9. Transfer all admin roles to Timelock
  console.log("9. Transferring admin roles to Timelock...");
  await resurgenceToken.grantRole(DEFAULT_ADMIN_ROLE, await timelockController.getAddress());
  await resurgenceToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("   ResurgeToken admin -> Timelock");
  console.log("");

  // 10. Renounce temporary deployer roles in other contracts
  console.log("10. Renouncing temporary deployer roles...");
  await rewardDistributor.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await rewardDistributor.renounceRole(await rewardDistributor.TIMELOCK_ROLE(), deployer.address);
  
  await stakingPoolManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await stakingPoolManager.renounceRole(await stakingPoolManager.TIMELOCK_ROLE(), deployer.address);
  
  await resurgeStakingPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await resurgeStakingPool.renounceRole(await resurgeStakingPool.TIMELOCK_ROLE(), deployer.address);
  console.log("    Done");
  console.log("");

  console.log("=== Deployment Complete ===");
  console.log("ResurgeToken (proxy):        ", await resurgenceToken.getAddress());
  console.log("TimelockController:           ", await timelockController.getAddress());
  console.log("RewardDistributor (proxy):    ", await rewardDistributor.getAddress());
  console.log("DeadCoinStakingPool (impl):   ", await stakingPoolImplementation.getAddress());
  console.log("ResurgeStakingPool (proxy):  ", await resurgeStakingPool.getAddress());
  console.log("StakingPoolManager (proxy):   ", await stakingPoolManager.getAddress());
  console.log("ResurgenceGovernance:         ", await resurgenceGovernance.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });