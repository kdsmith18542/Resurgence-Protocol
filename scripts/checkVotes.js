const hre = require("hardhat");

const GOVERNANCE_ADDRESS = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B"; // v4

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, deployer);
  const tokenAddress = await governance.token();
  const token = await hre.ethers.getContractAt("ResurgeToken", tokenAddress, deployer);

  const balance = await token.balanceOf(deployer.address);
  const delegates = await token.delegates(deployer.address);
  const clockNow = await token.clock();
  const votes = await governance.getVotes(deployer.address, clockNow - 1n).catch(() => 0n);
  const threshold = await governance.proposalThreshold();

  console.log("Token Address:", tokenAddress);
  console.log("RESURGE Balance:", hre.ethers.formatEther(balance));
  console.log("Delegated to:", delegates);
  console.log("Voting Power (at current clock - 1):", hre.ethers.formatEther(votes));
  console.log("Proposal Threshold:", hre.ethers.formatEther(threshold));
}

main().catch(console.error);
