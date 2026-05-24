const hre = require("hardhat");

const TIMELOCK_ADDRESS = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const timelock = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK_ADDRESS, deployer);

  const minDelay = await timelock.getMinDelay();
  console.log("Timelock Minimum Delay:", minDelay.toString(), "seconds");
}

main().catch(console.error);
