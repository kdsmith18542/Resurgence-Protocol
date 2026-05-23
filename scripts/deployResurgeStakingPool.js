const hre = require("hardhat");
const { upgrades } = require("hardhat");

const RESURGE_TOKEN      = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";
const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const TIMELOCK           = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
const REWARD_RATE        = 1000000000000000000n; // 1 RESURGE/sec

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check if deployer can authorize (needs MINTER_ROLE / admin on RewardDistributor)
  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, deployer);
  const DEFAULT_ADMIN = await rd.DEFAULT_ADMIN_ROLE();
  const TIMELOCK_ROLE = await rd.TIMELOCK_ROLE();
  const hasAdmin = await rd.hasRole(DEFAULT_ADMIN, deployer.address);
  const hasTimelock = await rd.hasRole(TIMELOCK_ROLE, deployer.address);
  console.log("RD deployer has DEFAULT_ADMIN:", hasAdmin);
  console.log("RD deployer has TIMELOCK_ROLE:", hasTimelock);

  // 1. Deploy implementation directly first
  console.log("Deploying ResurgeStakingPool implementation...");
  const RSP = await hre.ethers.getContractFactory("ResurgeStakingPool");
  const impl = await RSP.deploy();
  await impl.waitForDeployment();
  console.log("Impl:", await impl.getAddress());

  // 2. Deploy ERC1967Proxy manually
  console.log("Deploying proxy...");
  const initData = RSP.interface.encodeFunctionData("initialize", [
    RESURGE_TOKEN, REWARD_DISTRIBUTOR, TIMELOCK, REWARD_RATE
  ]);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy");
  const proxy = await Proxy.deploy(await impl.getAddress(), initData);
  await proxy.waitForDeployment();
  const poolAddr = await proxy.getAddress();
  console.log("Proxy:", poolAddr);

  const pool = RSP.attach(poolAddr);
  const rd2 = await pool.rewardDistributor();
  console.log("Pool rewardDistributor:", rd2);

  if (hasAdmin || hasTimelock) {
    console.log("Authorizing in RewardDistributor...");
    const tx = await rd.authorizeStakingPool(poolAddr);
    await tx.wait();
    console.log("Authorized. Tx:", tx.hash);
  } else {
    console.log("WARNING: deployer lacks RD admin — authorization needs governance");
  }

  // Renounce deployer roles on pool
  console.log("Renouncing deployer roles on pool...");
  const POOL_ADMIN = await pool.DEFAULT_ADMIN_ROLE();
  const POOL_TIMELOCK = await pool.TIMELOCK_ROLE();
  await (await pool.renounceRole(POOL_ADMIN, deployer.address)).wait();
  await (await pool.renounceRole(POOL_TIMELOCK, deployer.address)).wait();
  console.log("Done.");

  console.log("\n=== ResurgeStakingPool v3 ===");
  console.log("Proxy:", poolAddr);
}

main().catch((err) => { console.error(err); process.exit(1); });
