const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const tokenAddress = await gov.token();
  const token = await hre.ethers.getContractAt("ResurgeToken", tokenAddress);

  console.log("Signer address:", signer.address);
  console.log("Token address:", tokenAddress);

  const block = await hre.ethers.provider.getBlockNumber();
  console.log("Current block:", block);

  const clock = await token.clock();
  console.log("Token clock:", clock.toString());

  const votesCurrent = await token.getVotes(signer.address);
  console.log("Signer current votes:", hre.ethers.formatEther(votesCurrent));

  const votesPast = await gov.getVotes(signer.address, clock - 1n).catch(e => {
    console.log("Failed to getVotes past:", e.message);
    return 0n;
  });
  console.log("Signer past votes (clock-1):", hre.ethers.formatEther(votesPast));

  const thresh = await gov.proposalThreshold();
  console.log("Proposal threshold:", hre.ethers.formatEther(thresh));

  const latestId = await gov.latestProposalId().catch(() => 0n);
  console.log("Latest proposal ID from governance:", latestId.toString());

  if (latestId !== 0n) {
    try {
      const state = await gov.state(latestId);
      const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
      console.log("Latest proposal state:", STATE_NAMES[Number(state)], `(${state})`);
    } catch (e) {
      console.log("Error getting latest proposal state:", e.message);
    }
  }
}

main().catch(console.error);
