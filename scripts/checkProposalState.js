const hre = require("hardhat");

const GOVERNANCE = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const RECEIVER_ADDRESS = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";
const AMOY_CHAIN_SEL = "16281711391670634445";
const PROPOSAL_ID = BigInt("64481489832710862747298968629145951733263661129282255059706445031855614003852");
const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);
  const receiver = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER_ADDRESS, signer);

  const state = Number(await gov.state(PROPOSAL_ID));
  console.log("Proposal state:", STATE_NAMES[state], `(${state})`);
  
  // Check current authorized source
  const current = await receiver.authorizedSources(BigInt(AMOY_CHAIN_SEL));
  console.log("Current authorizedSources[Amoy]:", current);
  
  // Check timelock operation
  const TIMELOCK_B = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const tl = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK_B, signer);
  const minDelay = await tl.getMinDelay();
  console.log("Timelock B min delay:", minDelay.toString(), "seconds");
}

main().catch(console.error);
