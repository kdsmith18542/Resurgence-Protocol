const hre = require("hardhat");

const NEW_SENDER = "0x9E80244de87E7Ad68d76999659D7c36C26F39Aff";
const DEPLOYER   = "0x42060A5Fc138ee019BC3F777B51c6490A1b881f0";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const sender = await hre.ethers.getContractAt("CrossChainSender", NEW_SENDER, signer);
  
  // Get CallerAuthorized events
  const filter = sender.filters.CallerAuthorized();
  const events = await sender.queryFilter(filter, 0, "latest");
  console.log("CallerAuthorized events:", events.length);
  events.forEach(e => console.log("  pool:", e.args.caller));
  
  // LINK balance
  const AMOY_LINK = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
  const link = await hre.ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], AMOY_LINK, signer);
  const bal = await link.balanceOf(NEW_SENDER);
  console.log("LINK balance:", hre.ethers.formatEther(bal));
  
  // Check hub target
  const selector = await sender.hubChainSelector();
  const receiver = await sender.hubReceiver();
  console.log("Hub chain selector:", selector.toString());
  console.log("Hub receiver:", receiver);
}

main().catch(console.error);
