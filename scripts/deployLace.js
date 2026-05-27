const { ethers, upgrades } = require("hardhat");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying LACE contracts with deployer EOA: ${deployer.address}`);

  const TIMELOCK_ADDRESS = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const DISTRIBUTOR_ADDRESS = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

  // 1. Deploy LegacyClaimRegistry (UUPS Proxy)
  console.log("\nDeploying LegacyClaimRegistry (UUPS Proxy)...");
  const LegacyClaimRegistry = await ethers.getContractFactory("LegacyClaimRegistry");
  const registry = await upgrades.deployProxy(LegacyClaimRegistry, [TIMELOCK_ADDRESS], { kind: 'uups' });
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`LegacyClaimRegistry proxy deployed to: ${registryAddress}`);

  console.log("Waiting 5 seconds for network sync...");
  await sleep(5000);

  // 2. Deploy DormancyRewardController (UUPS Proxy)
  console.log("\nDeploying DormancyRewardController (UUPS Proxy)...");
  const DormancyRewardController = await ethers.getContractFactory("DormancyRewardController");
  const controller = await upgrades.deployProxy(DormancyRewardController, [
    registryAddress,
    DISTRIBUTOR_ADDRESS,
    TIMELOCK_ADDRESS
  ], { kind: 'uups' });
  await controller.waitForDeployment();
  const controllerAddress = await controller.getAddress();
  console.log(`DormancyRewardController proxy deployed to: ${controllerAddress}`);

  console.log("Waiting 5 seconds for network sync...");
  await sleep(5000);

  // 3. Deploy MockSP1DormancyVerifier
  console.log("\nDeploying MockSP1DormancyVerifier...");
  const MockSP1DormancyVerifier = await ethers.getContractFactory("MockSP1DormancyVerifier");
  const verifier = await MockSP1DormancyVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log(`MockSP1DormancyVerifier deployed to: ${verifierAddress}`);

  console.log("Waiting 5 seconds for network sync...");
  await sleep(5000);

  // 4. Link Registry to Controller
  console.log("\nLinking Registry to Controller...");
  const linkTx = await registry.setRewardController(controllerAddress);
  await linkTx.wait();
  console.log("Registry linked to RewardController successfully.");

  console.log("Waiting 5 seconds for network sync...");
  await sleep(5000);

  // 5. Transfer Admin/Roles to Timelock and renounce deployer permissions
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
  const TIMELOCK_ROLE = await registry.TIMELOCK_ROLE();
  const RISK_MANAGER_ROLE = await registry.RISK_MANAGER_ROLE();

  console.log("\nGranting roles to Timelock and renouncing temporary deployer permissions...");
  
  if (!(await registry.hasRole(TIMELOCK_ROLE, TIMELOCK_ADDRESS))) {
    await (await registry.grantRole(TIMELOCK_ROLE, TIMELOCK_ADDRESS)).wait();
    await sleep(2000);
  }
  if (!(await registry.hasRole(RISK_MANAGER_ROLE, TIMELOCK_ADDRESS))) {
    await (await registry.grantRole(RISK_MANAGER_ROLE, TIMELOCK_ADDRESS)).wait();
    await sleep(2000);
  }

  // Renounce EOA roles
  console.log("Renouncing deployer EOA roles in Registry...");
  await (await registry.renounceRole(TIMELOCK_ROLE, deployer.address)).wait();
  await sleep(2000);
  await (await registry.renounceRole(RISK_MANAGER_ROLE, deployer.address)).wait();
  await sleep(2000);
  await (await registry.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();
  await sleep(2000);

  console.log("Renouncing deployer EOA roles in Controller...");
  await (await controller.renounceRole(TIMELOCK_ROLE, deployer.address)).wait();
  await sleep(2000);
  await (await controller.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address)).wait();

  console.log("EOA roles renounced. Timelock is now the sole admin.");

  console.log("\n==================================================");
  console.log("LACE Deployment Summary:");
  console.log(`NEXT_PUBLIC_LEGACY_CLAIM_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_DORMANCY_REWARD_CONTROLLER_ADDRESS=${controllerAddress}`);
  console.log(`NEXT_PUBLIC_SP1_DORMANCY_VERIFIER_ADDRESS=${verifierAddress}`);
  console.log("==================================================");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
