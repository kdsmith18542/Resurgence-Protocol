const hre = require("hardhat");

const GOVERNANCE_ADDRESS = "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228";
const PROPOSAL_ID = "66154242814250122256469741455559929831332664106510803553850108674335524033357";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, deployer);

  const snapshot = await governance.proposalSnapshot(PROPOSAL_ID);
  const deadline = await governance.proposalDeadline(PROPOSAL_ID);
  const currentBlock = await hre.ethers.provider.getBlockNumber();

  console.log("Proposal Snapshot Block:", snapshot.toString());
  console.log("Proposal Deadline Block:", deadline.toString());
  console.log("Current Block:", currentBlock.toString());
  
  if (currentBlock < deadline) {
    console.log("Blocks Remaining:", (deadline - BigInt(currentBlock)).toString());
    // Estimate time assuming 1 block per L2 block (0.25s) or L1 block (12s)
    // OpenZeppelin clock() on Arbitrum Sepolia returns L1 block number by default!
    console.log("Estimated L1 time remaining (12s/block):", ((deadline - BigInt(currentBlock)) * 12n).toString(), "seconds");
  } else {
    console.log("Proposal has passed deadline! State should transition now.");
  }
}

main().catch(console.error);
