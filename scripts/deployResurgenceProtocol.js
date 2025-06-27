const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const ResurgenceProtocol = await hre.ethers.getContractFactory("ResurgenceProtocol");
  const resurgenceProtocol = await ResurgenceProtocol.deploy(deployer.address, 1000000000000000000000000000n); // Example cap: 1 billion tokens

  await resurgenceProtocol.waitForDeployment();

  console.log("ResurgenceProtocol deployed to:", await resurgenceProtocol.getAddress());

  // Deploy TimelockController
  const ResurgenceTimelockController = await hre.ethers.getContractFactory("ResurgenceTimelockController");
  // minDelay, proposers, executors, admin
  // For now, deployer is admin, and governor will be proposer/executor later
  const minDelay = 3600; // 1 hour
  const proposers = [deployer.address]; // Temporarily deployer, will be replaced by governance
  const executors = [deployer.address]; // Temporarily deployer, will be replaced by governance
  const admin = deployer.address;

  const timelockController = await ResurgenceTimelockController.deploy(minDelay, proposers, executors, admin);
  await timelockController.waitForDeployment();
  console.log("TimelockController deployed to:", await timelockController.getAddress());

  // Deploy RewardDistributor
  const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
  const rewardDistributor = await RewardDistributor.deploy(await resurgenceProtocol.getAddress());
  await rewardDistributor.waitForDeployment();
  console.log("RewardDistributor deployed to:", await rewardDistributor.getAddress());

  // Grant MINTER_ROLE to RewardDistributor
  const MINTER_ROLE = await resurgenceProtocol.MINTER_ROLE();
  await resurgenceProtocol.grantRole(MINTER_ROLE, await rewardDistributor.getAddress());
  console.log("MINTER_ROLE granted to RewardDistributor");

  // Deploy ResurgenceGovernance
  const ResurgenceGovernance = await hre.ethers.getContractFactory("ResurgenceGovernance");
  // _resurgeToken, _timelock, _votingDelay, _votingPeriod, _quorumNumeratorValue
  const votingDelay = 1; // 1 block
  const votingPeriod = 50400; // 1 week in blocks (assuming 12s/block)
  const quorumNumeratorValue = 4; // 4% quorum

  const resurgenceGovernance = await ResurgenceGovernance.deploy(
    await resurgenceProtocol.getAddress(),
    await timelockController.getAddress(),
    votingDelay,
    votingPeriod,
    quorumNumeratorValue
  );
  await resurgenceGovernance.waitForDeployment();
  console.log("ResurgenceGovernance deployed to:", await resurgenceGovernance.getAddress());

  // Grant PROPOSER_ROLE and EXECUTOR_ROLE to ResurgenceGovernance in TimelockController
  const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();

  // Revoke deployer's proposer and executor roles from TimelockController
  await timelockController.revokeRole(PROPOSER_ROLE, deployer.address);
  await timelockController.revokeRole(EXECUTOR_ROLE, deployer.address);

  // Grant governor proposer and executor roles
  await timelockController.grantRole(PROPOSER_ROLE, await resurgenceGovernance.getAddress());
  await timelockController.grantRole(EXECUTOR_ROLE, await resurgenceGovernance.getAddress());
  console.log("PROPOSER_ROLE and EXECUTOR_ROLE granted to ResurgenceGovernance");

  // Deploy StakingPoolManager
  const StakingPoolManager = await hre.ethers.getContractFactory("StakingPoolManager");
  const stakingPoolManager = await StakingPoolManager.deploy(
    await resurgenceProtocol.getAddress(),
    await rewardDistributor.getAddress()
  );
  await stakingPoolManager.waitForDeployment();
  console.log("StakingPoolManager deployed to:", await stakingPoolManager.getAddress());

  // Transfer ownership of StakingPoolManager and RewardDistributor to ResurgenceGovernance
  // This will be done via a governance proposal in a real scenario, but for deployment script, we do it directly.
  await stakingPoolManager.transferOwnership(await resurgenceGovernance.getAddress());
  console.log("StakingPoolManager ownership transferred to ResurgenceGovernance");

  await rewardDistributor.transferOwnership(await resurgenceGovernance.getAddress());
  console.log("RewardDistributor ownership transferred to ResurgenceGovernance");

  // Save the contract address to a file or update your configuration
  // For now, we will just log it.
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });