const hre = require("hardhat");
const { upgrades } = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Upgrading DeadCoinStakingPool with account:", deployer.address);

  const POOL_PROXY_ADDRESS = process.env.POOL_PROXY_ADDRESS;
  if (!POOL_PROXY_ADDRESS) {
    console.error("Set POOL_PROXY_ADDRESS env var to the pool proxy address");
    process.exit(1);
  }

  console.log("Current pool proxy:", POOL_PROXY_ADDRESS);

  const DeadCoinStakingPoolV2 = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const upgraded = await upgrades.upgradeProxy(POOL_PROXY_ADDRESS, DeadCoinStakingPoolV2);
  await upgraded.waitForDeployment();

  console.log("DeadCoinStakingPool upgraded successfully");
  console.log("Proxy remains at:", POOL_PROXY_ADDRESS);
  const implAddress = await upgrades.erc1967.getImplementationAddress(POOL_PROXY_ADDRESS);
  console.log("New implementation:", implAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
