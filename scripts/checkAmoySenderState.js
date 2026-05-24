const hre = require("hardhat");

const NEW_SENDER = "0x9E80244de87E7Ad68d76999659D7c36C26F39Aff";
const POOL       = "0xbc3f08b905e8cf6d2a5329867d77477c5bb6b808";
const AMOY_LINK  = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const sender = await hre.ethers.getContractAt("CrossChainSender", NEW_SENDER, signer);
  const link   = await hre.ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], AMOY_LINK, signer);

  const linkBal       = await link.balanceOf(NEW_SENDER);
  const isAuthorized  = await sender.authorizedCallers(POOL);
  const hubSel        = await sender.hubChainSelector();
  const hubReceiver   = await sender.hubReceiver();
  const maxFee        = await sender.maxLinkFee();

  console.log("CrossChainSender:", NEW_SENDER);
  console.log("LINK balance:    ", hre.ethers.formatEther(linkBal), "LINK");
  console.log("Pool authorized: ", isAuthorized);
  console.log("Hub selector:    ", hubSel.toString());
  console.log("Hub receiver:    ", hubReceiver);
  console.log("maxLinkFee:      ", hre.ethers.formatEther(maxFee), "LINK");
}
main().catch(console.error);
