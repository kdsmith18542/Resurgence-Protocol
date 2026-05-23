const hre = require("hardhat");
const GOVERNANCE = "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228";
const RECEIVER   = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";
const AMOY_SEL   = 16281711391670634445n;
const AMOY_ADDR  = "0xB19BaeF4995A5DD6d50797928053789D20008B46";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov  = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);
  const recv = await hre.ethers.getContractAt("CrossChainReceiver",   RECEIVER,   signer);
  const encodedSender = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [AMOY_ADDR]);
  const calldata = recv.interface.encodeFunctionData("setAuthorizedSource", [AMOY_SEL, encodedSender]);
  const desc = "# Authorize Amoy spoke\n\nCCIP auth.\n\nChainSel: 16281711391670634445\nSender: " + AMOY_ADDR;

  const tx = await gov.propose([RECEIVER], [0n], [calldata], desc, { gasLimit: 500000 });
  const receipt = await tx.wait();
  const ev = receipt.logs.map(l => { try { return gov.interface.parseLog(l); } catch {} }).find(e => e?.name === "ProposalCreated");
  const proposalId = ev.args[0];
  const voteStart = ev.args[6];
  const voteEnd   = ev.args[7];
  console.log("PROPOSAL_ID:", proposalId.toString());
  console.log("Vote opens at L1 block:", voteStart.toString());
  console.log("Vote closes at L1 block:", voteEnd.toString());
  console.log("Tx:", receipt.hash);
}
main().catch(e => { console.error(e.message); process.exit(1); });
