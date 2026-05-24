/**
 * deployNonEvmPool.js — Deploy NonEvmStakingPool proxy to Arbitrum Sepolia
 *
 * Usage:
 *   npx hardhat run scripts/deployNonEvmPool.js --network arbitrumSepolia
 *
 * After deploy, set NON_EVM_POOL_ADDRESS in .env and run liveNonEvmProof.js
 */
const hre = require("hardhat");

const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87"; // v4 new timelock

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Timelock:", TIMELOCK);
  console.log("");

  const NonEvmStakingPool = await hre.ethers.getContractFactory("NonEvmStakingPool", deployer);

  console.log("Deploying NonEvmStakingPool implementation...");
  const impl = await NonEvmStakingPool.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("Impl:", implAddr);

  console.log("Deploying ERC1967Proxy...");
  const initData = NonEvmStakingPool.interface.encodeFunctionData("initialize", [TIMELOCK]);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy", deployer);
  const proxy = await Proxy.deploy(implAddr, initData);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("Proxy:", proxyAddr);

  const pool = NonEvmStakingPool.attach(proxyAddr);

  // Verify initialization
  const hasTimelock = await pool.hasRole(await pool.TIMELOCK_ROLE(), TIMELOCK);
  console.log("Timelock has TIMELOCK_ROLE:", hasTimelock);

  // Renounce deployer's default admin (timelock governs)
  const DEFAULT_ADMIN = await pool.DEFAULT_ADMIN_ROLE();
  const TIMELOCK_ROLE = await pool.TIMELOCK_ROLE();
  const deployerHasAdmin = await pool.hasRole(DEFAULT_ADMIN, deployer.address);
  if (deployerHasAdmin) {
    console.log("Renouncing deployer DEFAULT_ADMIN_ROLE...");
    await (await pool.renounceRole(DEFAULT_ADMIN, deployer.address)).wait();
  }
  const deployerHasTimelock = await pool.hasRole(TIMELOCK_ROLE, deployer.address);
  if (deployerHasTimelock) {
    console.log("Renouncing deployer TIMELOCK_ROLE...");
    await (await pool.renounceRole(TIMELOCK_ROLE, deployer.address)).wait();
  }

  console.log("\n=== NonEvmStakingPool deployed ===");
  console.log("Impl:  ", implAddr);
  console.log("Proxy: ", proxyAddr);
  console.log("");
  console.log("Add to .env:");
  console.log(`NON_EVM_POOL_ADDRESS=${proxyAddr}`);
  console.log("");
  console.log("Run proof submission:");
  console.log(`NON_EVM_POOL_ADDRESS=${proxyAddr} ORACLE_PRIVATE_KEY=<baals_key> npx hardhat run scripts/liveNonEvmProof.js --network arbitrumSepolia`);
}

main().catch((err) => { console.error(err); process.exit(1); });
