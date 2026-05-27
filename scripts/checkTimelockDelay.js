const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const DEFAULT_PROPOSAL_ID = 46846360571993993484613822599224421765116954802032087859303082758844643291359n;
  const PROPOSAL_ID = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : DEFAULT_PROPOSAL_ID;

  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);
  const tl = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK, signer);

  const proposalEta = await gov.proposalEta(PROPOSAL_ID).catch(() => 0n);
  const currentBlock = await hre.ethers.provider.getBlock("latest");
  const currentTimestamp = BigInt(currentBlock.timestamp);

  console.log("Proposal ETA timestamp:", proposalEta.toString());
  console.log("Current block timestamp:", currentTimestamp.toString());

  if (proposalEta === 0n) {
    console.log("Proposal not queued or error retrieving ETA.");
  } else if (currentTimestamp >= proposalEta) {
    console.log("Timelock has EXPIRED! The proposal is ready to execute now.");
  } else {
    const remaining = proposalEta - currentTimestamp;
    const minutes = Math.floor(Number(remaining) / 60);
    const seconds = Number(remaining) % 60;
    console.log(`Remaining time: ${minutes} minutes, ${seconds} seconds.`);
  }
}

main().catch(console.error);
