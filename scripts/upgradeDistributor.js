const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Upgrading RewardDistributor with account:", deployer.address);

  const DISTRIBUTOR_PROXY_ADDRESS = process.env.DISTRIBUTOR_PROXY_ADDRESS;
  if (!DISTRIBUTOR_PROXY_ADDRESS) {
    console.error("Set DISTRIBUTOR_PROXY_ADDRESS env var to the distributor proxy address");
    process.exit(1);
  }

  console.log("Current distributor proxy:", DISTRIBUTOR_PROXY_ADDRESS);

  const RewardDistributorV2 = await hre.ethers.getContractFactory("RewardDistributor");
  const upgraded = await upgrades.upgradeProxy(DISTRIBUTOR_PROXY_ADDRESS, RewardDistributorV2);
  await upgraded.waitForDeployment();

  console.log("RewardDistributor upgraded successfully");
  console.log("Proxy remains at:", DISTRIBUTOR_PROXY_ADDRESS);
  const implAddress = await upgrades.erc1967.getImplementationAddress(DISTRIBUTOR_PROXY_ADDRESS);
  console.log("New implementation:", implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
