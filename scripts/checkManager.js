const hre = require("hardhat");

const MANAGER_ADDRESS = "0xbc6d675069c57a1c039a4f0be0979cb6e6727a9b";
const DEAD_COIN = "0x26a657c4D4112ed78daE8cF40ffA159AD938683c";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const manager = await hre.ethers.getContractAt("StakingPoolManager", MANAGER_ADDRESS, deployer);

  const poolAddress = await manager.deadCoinToPoolAddress(DEAD_COIN);
  console.log("StakingPoolManager address:", MANAGER_ADDRESS);
  console.log("Querying Dead Coin:", DEAD_COIN);
  console.log("Registered Pool Address:", poolAddress);

  // Check if paused
  const paused = await manager.paused();
  console.log("Manager Paused:", paused);
}

main().catch(console.error);
