const hre = require("hardhat");
const PROPOSAL_ID = 60581147904759678974165330535425369601586576134270921547175942771044307328283n;
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228", signer);
  const state = Number(await gov.state(PROPOSAL_ID));
  console.log("State:", ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"][state]);
  if (state !== 1) { console.log("Not Active — cannot vote yet"); return; }
  const tx = await gov.castVoteWithReason(PROPOSAL_ID, 1, "Authorize Amoy");
  const r = await tx.wait();
  console.log("Voted! Tx:", r.hash);
}
main().catch(console.error);
