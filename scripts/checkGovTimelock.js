const hre = require("hardhat");

const GOVERNANCE = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const TIMELOCK_A = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
const TIMELOCK_B = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);
  
  const timelock = await gov.timelock();
  console.log("Governance timelock():", timelock);
  console.log("Is Timelock A:", timelock.toLowerCase() === TIMELOCK_A.toLowerCase());
  console.log("Is Timelock B:", timelock.toLowerCase() === TIMELOCK_B.toLowerCase());
  
  // Check if timelock A has PROPOSER_ROLE on timelock B or vice versa
  const tlB = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK_B, signer);
  const PROPOSER = await tlB.PROPOSER_ROLE();
  const EXECUTOR = await tlB.EXECUTOR_ROLE();
  const govHasProposer = await tlB.hasRole(PROPOSER, GOVERNANCE);
  const govHasExecutor = await tlB.hasRole(EXECUTOR, GOVERNANCE);
  console.log("\nOn Timelock B:");
  console.log("Governance has PROPOSER_ROLE:", govHasProposer);
  console.log("Governance has EXECUTOR_ROLE:", govHasExecutor);
  console.log("Timelock A min delay:", (await (await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK_A, signer)).getMinDelay()).toString());
  console.log("Timelock B min delay:", (await tlB.getMinDelay()).toString());
}

main().catch(console.error);
