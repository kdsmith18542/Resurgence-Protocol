const hre = require("hardhat");

async function main() {
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log("Current block number on Amoy:", blockNumber);
}

main().catch(console.error);
