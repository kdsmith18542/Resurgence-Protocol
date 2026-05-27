const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const PROPOSAL_ID = 112955358498852943249611259370828122919869653642177291226008541669948935476469n;
  const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const token = await hre.ethers.getContractAt("ResurgeToken", await gov.token());

  const state = Number(await gov.state(PROPOSAL_ID));
  const snapshot = await gov.proposalSnapshot(PROPOSAL_ID);
  const deadline = await gov.proposalDeadline(PROPOSAL_ID);
  const currentClock = await token.clock();

  console.log("Proposal ID:", PROPOSAL_ID.toString());
  console.log("State:", STATE_NAMES[state], `(${state})`);
  console.log("Snapshot block:", snapshot.toString());
  console.log("Deadline block:", deadline.toString());
  console.log("Current block clock:", currentClock.toString());
  
  if (currentClock < snapshot) {
    console.log(`Voting starts in ${snapshot - currentClock} blocks.`);
  } else if (currentClock < deadline) {
    console.log(`Voting is active. Ends in ${deadline - currentClock} blocks.`);
  } else {
    console.log("Voting period ended.");
  }
}

main().catch(console.error);
