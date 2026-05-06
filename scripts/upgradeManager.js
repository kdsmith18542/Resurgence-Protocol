const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Upgrading StakingPoolManager with account:", deployer.address);

  const MANAGER_PROXY_ADDRESS = process.env.MANAGER_PROXY_ADDRESS;
  if (!MANAGER_PROXY_ADDRESS) {
    console.error("Set MANAGER_PROXY_ADDRESS env var to the manager proxy address");
    process.exit(1);
  }

  console.log("Current manager proxy:", MANAGER_PROXY_ADDRESS);

  const StakingPoolManagerV2 = await hre.ethers.getContractFactory("StakingPoolManager");
  const upgraded = await upgrades.upgradeProxy(MANAGER_PROXY_ADDRESS, StakingPoolManagerV2);
  await upgraded.waitForDeployment();

  console.log("StakingPoolManager upgraded successfully");
  console.log("Proxy remains at:", MANAGER_PROXY_ADDRESS);
  const implAddress = await upgrades.erc1967.getImplementationAddress(MANAGER_PROXY_ADDRESS);
  console.log("New implementation:", implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
