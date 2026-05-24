const hre = require("hardhat");
const GOV = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const RSP = "0x169CCD5dF5b4C37B40A4ad2e2D18ADC19BED190B";
const TOKEN = "0x3c5728fcA2fFe74644f6476B7DC30536FF7D02FB";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov   = await hre.ethers.getContractAt("ResurgenceGovernance", GOV, signer);
  const rsp   = await hre.ethers.getContractAt("ResurgeStakingPool",   RSP, signer);
  const token = await hre.ethers.getContractAt("ResurgeToken",         TOKEN, signer);

  const clock = await token.clock();
  console.log("Token clock:", clock.toString());

  const liquidVotes = await token.getPastVotes(signer.address, clock - 1n);
  console.log("Liquid votes at clock-1:", hre.ethers.formatEther(liquidVotes));

  const stakedVotes = await rsp.getPastStakedVotes(signer.address, clock - 1n);
  console.log("Staked votes at clock-1:", hre.ethers.formatEther(stakedVotes));

  const govVotes = await gov.getVotes(signer.address, clock - 1n);
  console.log("Governor getVotes:", hre.ethers.formatEther(govVotes));

  const threshold = await gov.proposalThreshold();
  console.log("Proposal threshold:", hre.ethers.formatEther(threshold));

  console.log("Sufficient?", govVotes >= threshold ? "YES" : "NO");
}
main().catch(console.error);
