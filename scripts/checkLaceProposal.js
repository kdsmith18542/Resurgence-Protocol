const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const PROPOSAL_ID = 46846360571993993484613822599224421765116954802032087859303082758844643291359n;
  const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const token = await hre.ethers.getContractAt("ResurgeToken", await gov.token());

  try {
    const state = Number(await gov.state(PROPOSAL_ID));
    const snapshot = await gov.proposalSnapshot(PROPOSAL_ID);
    const deadline = await gov.proposalDeadline(PROPOSAL_ID);
    const currentClock = await token.clock();

    console.log("Proposal ID:", PROPOSAL_ID.toString());
    console.log("State:", STATE_NAMES[state], `(${state})`);
    console.log("Snapshot clock (when voting starts):", snapshot.toString());
    console.log("Deadline clock (when voting ends):", deadline.toString());
    console.log("Current Token Clock:", currentClock.toString());
    
    if (currentClock < snapshot) {
      console.log(`Voting starts in ${snapshot - currentClock} clock cycles.`);
    } else if (currentClock < deadline) {
      console.log(`Voting is active. Ends in ${deadline - currentClock} clock cycles.`);
    } else {
      console.log("Voting period ended.");
    }
  } catch (e) {
    console.log("Error querying state:", e.message);
  }
}

main().catch(console.error);
