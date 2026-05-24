const hre = require("hardhat");
const SENDER = "0x8beabf9277E21ee269e9b192D3b00d041aaCc6dd";
const LINK   = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
async function main() {
  const link = await hre.ethers.getContractAt("IERC20", LINK);
  const bal = await link.balanceOf(SENDER);
  console.log(`CrossChainSender LINK balance: ${hre.ethers.formatEther(bal)} LINK`);
}
main().catch(console.error);
