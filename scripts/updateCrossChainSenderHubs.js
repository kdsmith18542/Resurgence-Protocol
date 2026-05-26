/**
 * updateCrossChainSenderHubs.js
 *
 * Updates hubReceiver on Amoy and Base Sepolia CrossChainSenders
 * to point to the new CrossChainReceiver (v2, with supportsInterface fix).
 *
 * Run once on EACH spoke network:
 *   npx hardhat run scripts/updateCrossChainSenderHubs.js --network amoy
 *   npx hardhat run scripts/updateCrossChainSenderHubs.js --network baseSepolia
 */

const hre = require("hardhat");

const HUB_CHAIN_SELECTOR = 3478487238524512106n; // Arbitrum Sepolia
const NEW_HUB_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";

const SENDERS = {
  amoy: "0x3F1E0400fb8f19FeFA8aA6B8d23468949E73a7B5",
  baseSepolia: "0xafA9aF72d455dd6c2669306D99956E6444C5c181",
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const senderAddr = SENDERS[network];

  if (!senderAddr) {
    throw new Error(`No CrossChainSender configured for network: ${network}`);
  }

  console.log(`Network: ${network}`);
  console.log(`Signer: ${signer.address}`);
  console.log(`CrossChainSender: ${senderAddr}`);
  console.log(`New hubReceiver: ${NEW_HUB_RECEIVER}`);

  const sender = await hre.ethers.getContractAt("CrossChainSender", senderAddr, signer);

  const currentHub = await sender.hubReceiver();
  const currentSelector = await sender.hubChainSelector();
  console.log(`Current hubReceiver: ${currentHub}`);
  console.log(`Current hubChainSelector: ${currentSelector}`);

  if (currentHub.toLowerCase() === NEW_HUB_RECEIVER.toLowerCase()) {
    console.log("✅ hubReceiver is already the new receiver — nothing to do.");
    return;
  }

  console.log("\nCalling setHub...");
  const tx = await sender.setHub(HUB_CHAIN_SELECTOR, NEW_HUB_RECEIVER);
  await tx.wait();
  console.log(`✅ setHub tx: ${tx.hash}`);

  const updatedHub = await sender.hubReceiver();
  console.log(`Updated hubReceiver: ${updatedHub}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
