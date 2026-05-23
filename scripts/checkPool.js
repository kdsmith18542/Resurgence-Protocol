const hre = require("hardhat");

const POOL_PROXY_ADDRESS = "0xAa0510C739B14DaC10Df4EfbD1C093D3bd2662Ac";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester Address:", deployer.address);

  const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", POOL_PROXY_ADDRESS, deployer);

  const rewardRate = await pool.rewardRatePerSecond();
  const totalStaked = await pool.totalStakedSupply();
  const userStaked = await pool.userStakedAmount(deployer.address);
  const lastUpdate = await pool.lastUpdateTime();
  const paused = await pool.paused();
  const sender = await pool.crossChainSender();
  const deadCoin = await pool.deadCoin();
  const earned = await pool.earned(deployer.address);

  // Check if timelock code exists on Amoy
  const timelockAddr = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
  const code = await hre.ethers.provider.getCode(timelockAddr);
  const hasCode = code !== "0x";

  // Check roles on pool
  const timelockRole = await pool.TIMELOCK_ROLE();
  const adminRole = await pool.DEFAULT_ADMIN_ROLE();
  
  const deployerHasTimelock = await pool.hasRole(timelockRole, deployer.address);
  const deployerHasAdmin = await pool.hasRole(adminRole, deployer.address);
  const timelockHasTimelock = await pool.hasRole(timelockRole, timelockAddr);
  const timelockHasAdmin = await pool.hasRole(adminRole, timelockAddr);

  // Query deployer's LINK balance
  const AMOY_LINK_TOKEN = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
  const erc20Abi = ["function balanceOf(address account) external view returns (uint256)"];
  const linkToken = await hre.ethers.getContractAt(erc20Abi, AMOY_LINK_TOKEN, deployer);
  const linkBalance = await linkToken.balanceOf(deployer.address);

  console.log("Reward Rate Per Second:", rewardRate.toString());
  console.log("Total Staked Supply:", hre.ethers.formatEther(totalStaked));
  console.log("User Staked Amount:", hre.ethers.formatEther(userStaked));
  console.log("Last Update Time:", lastUpdate.toString());
  console.log("Is Paused:", paused);
  console.log("Cross Chain Sender:", sender);
  console.log("Dead Coin Address:", deadCoin);
  console.log("User Earned Rewards:", hre.ethers.formatEther(earned));
  console.log("Does Timelock contract exist on Amoy:", hasCode);
  console.log("Deployer has TIMELOCK_ROLE:", deployerHasTimelock);
  console.log("Deployer has DEFAULT_ADMIN_ROLE:", deployerHasAdmin);
  console.log("Timelock address has TIMELOCK_ROLE:", timelockHasTimelock);
  console.log("Timelock address has DEFAULT_ADMIN_ROLE:", timelockHasAdmin);
  console.log("Deployer LINK Balance:", hre.ethers.formatEther(linkBalance));
}

main().catch(console.error);
