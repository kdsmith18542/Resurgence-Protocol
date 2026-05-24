/**
 * verifyAmoyAuth.js
 *
 * Verifies the v4 Amoy spoke authorization on hub CrossChainReceiver.
 * Run on arbitrumSepolia after governance execution completes.
 */
const hre = require("hardhat");

const RECEIVER   = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";
const AMOY_SEL   = "16281711391670634445";
const NEW_SENDER = "0x9E80244de87E7Ad68d76999659D7c36C26F39Aff";
const GOVERNANCE = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const PROPOSAL_ID = BigInt("64481489832710862747298968629145951733263661129282255059706445031855614003852");
const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const receiver  = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER, signer);
  const gov       = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);

  const state = Number(await gov.state(PROPOSAL_ID));
  console.log("Proposal state:", STATE_NAMES[state]);

  const current = await receiver.authorizedSources(BigInt(AMOY_SEL));
  const expected = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [NEW_SENDER]);
  console.log("authorizedSources[Amoy]:", current);
  console.log("Expected:               ", expected);

  if (current.toLowerCase() === expected.toLowerCase()) {
    console.log("✅ v4 Amoy CrossChainSender authorized — ready for E2E test");
    console.log("   Run: npx hardhat run scripts/testAmoyE2E.js --network amoy");
  } else {
    console.log("❌ Not yet authorized. Proposal state:", STATE_NAMES[state]);
  }
}
main().catch(console.error);
