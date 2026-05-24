const hre = require("hardhat");
const TOKEN = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";
const WALLET = "0x42060A5Fc138ee019BC3F777B51c6490A1b881f0";
const BASELINE = 1000000n * 10n**18n;

async function main() {
  const token = await hre.ethers.getContractAt("ResurgeToken", TOKEN);
  const bal = await token.balanceOf(WALLET);
  const delta = bal - BASELINE;
  console.log(`RESURGE balance: ${hre.ethers.formatEther(bal)}`);
  console.log(`Delta vs baseline: +${hre.ethers.formatEther(delta < 0n ? 0n : delta)} RESURGE`);
  console.log(delta > 0n ? "CCIP message delivered!" : "Not yet delivered — check back in a few minutes.");
}
main().catch(console.error);
