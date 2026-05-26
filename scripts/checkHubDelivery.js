/**
 * checkHubDelivery.js
 *
 * Checks if a CCIP message has been delivered to the new CrossChainReceiver.
 * Also checks if RESURGE was minted (requires authorizeBridge governance).
 *
 * Usage:
 *   MESSAGE_ID=0x... npx hardhat run scripts/checkHubDelivery.js --network arbitrumSepolia
 */
const hre = require("hardhat");

const RECEIVER   = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const RESURGE    = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";
const DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const messageId = process.env.MESSAGE_ID;
  if (!messageId) throw new Error("Set MESSAGE_ID env var");

  const receiver = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER);
  const resurge = await hre.ethers.getContractAt("ResurgeToken", RESURGE);
  const dist = await hre.ethers.getContractAt("RewardDistributor", DISTRIBUTOR);

  const processed = await receiver.processedMessages(messageId);
  const authorized = await dist.authorizedBridges(RECEIVER);

  log(`Message ID: ${messageId}`);
  log(`processedMessages[messageId]: ${processed}`);
  log(`authorizedBridges[receiver]: ${authorized}`);

  if (processed) {
    log("✅ CCIP message delivered and processed by CrossChainReceiver!");
    if (!authorized) {
      log("⚠️ Receiver not yet authorized as bridge — mintForBridge may have failed.");
      log("   Governance execute pending? Check authorizeBridgeViaGov.js");
    }
  } else {
    log("⏳ Message not yet delivered. CCIP in transit (typically 15-30 min on testnet).");
    log("   Check: https://ccip.chain.link");
  }
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
