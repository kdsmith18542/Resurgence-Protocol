const hre = require("hardhat");
async function main() {
  const RESURGE = "0xEf86D6646F5782807423E3573E5A99E3c9bbaeCd";
  const WALLET  = "0x99220419A29220ab0A2CDE25bF2C9ACBEddeEB1E";
  const GOV     = "0x7E38270a3077F1652D4bBdA5f0D5d2C986Ab00c3";

  const token = await hre.ethers.getContractAt("ResurgeToken", RESURGE);
  const gov   = await hre.ethers.getContractAt("ResurgenceGovernance", GOV);

  const bal     = await token.balanceOf(WALLET);
  const del     = await token.delegates(WALLET);
  const latest  = await hre.ethers.provider.getBlock("latest");
  const clock   = await token.clock();

  console.log("Balance:       ", hre.ethers.formatEther(bal));
  console.log("Delegates to:  ", del);
  console.log("Clock():       ", clock.toString());
  console.log("block.number:  ", latest.number);
  console.log("block.timestamp:", latest.timestamp);

  // Try getVotes with timestamp
  const v1 = await gov.getVotes(WALLET, latest.timestamp - 1).catch(e => "ERR:" + e.message.slice(0,60));
  const v2 = await gov.getVotes(WALLET, latest.number - 1).catch(e => "ERR:" + e.message.slice(0,60));
  const v3 = await token.getVotes(WALLET).catch(e => "ERR:" + e.message.slice(0,60));

  console.log("gov.getVotes(timestamp-1):", typeof v1 === 'bigint' ? hre.ethers.formatEther(v1) : v1);
  console.log("gov.getVotes(blockNum-1):", typeof v2 === 'bigint' ? hre.ethers.formatEther(v2) : v2);
  console.log("token.getVotes (current):", typeof v3 === 'bigint' ? hre.ethers.formatEther(v3) : v3);
}
main().catch(console.error);
