const hre = require("hardhat");

const RECEIVER_ADDRESS = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";
const TIMELOCK_A = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869"; // from checkMinDelay.js
const TIMELOCK_B = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87"; // from deployAmoyPool.js (HUB_TIMELOCK)
const DEPLOYER  = "0x42060A5Fc138ee019BC3F777B51c6490A1b881f0";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const receiver = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER_ADDRESS, signer);
  
  const TIMELOCK_ROLE = await receiver.TIMELOCK_ROLE();
  const DEFAULT_ADMIN_ROLE = await receiver.DEFAULT_ADMIN_ROLE();
  
  for (const [label, addr] of [["Timelock A (0x65ddC4)", TIMELOCK_A], ["Timelock B (0xf412aD)", TIMELOCK_B], ["Deployer", DEPLOYER]]) {
    const hasT = await receiver.hasRole(TIMELOCK_ROLE, addr);
    const hasA = await receiver.hasRole(DEFAULT_ADMIN_ROLE, addr);
    console.log(`${label}:  TIMELOCK_ROLE=${hasT}  DEFAULT_ADMIN=${hasA}`);
  }
  
  const paused = await receiver.paused();
  console.log("Is paused:", paused);
}

main().catch(console.error);
