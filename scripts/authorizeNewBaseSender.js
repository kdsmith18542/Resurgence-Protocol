/**
 * authorizeNewBaseSender.js
 * 
 * 1. Authorizes new Base Sepolia CrossChainSender on CrossChainReceiver (Arb Sepolia hub)
 * 2. Authorizes deployer as caller on new Base Sepolia sender
 *
 * Usage:
 *   npx hardhat run scripts/authorizeNewBaseSender.js --network arbitrumSepolia  (step 1)
 */
const hre = require("hardhat");

const NEW_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const NEW_BASE_SENDER = "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4";
const BASE_SEPOLIA_SELECTOR = 10344971235874465080n;

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  log(`Network: ${network}, Signer: ${signer.address}`);

  if (network === "arbitrumSepolia") {
    // Step 1: authorize new Base Sepolia sender on CrossChainReceiver
    const receiver = await hre.ethers.getContractAt("CrossChainReceiver", NEW_RECEIVER, signer);
    const encoded = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [NEW_BASE_SENDER]);
    
    const current = await receiver.authorizedSources(BASE_SEPOLIA_SELECTOR);
    log(`Current authorizedSource[baseSepolia]: ${current}`);
    
    if (current.toLowerCase() === encoded.toLowerCase()) {
      log("✅ Already authorized — nothing to do.");
    } else {
      log("Setting authorized source for Base Sepolia...");
      const tx = await receiver.setAuthorizedSource(BASE_SEPOLIA_SELECTOR, encoded);
      await tx.wait();
      log(`✅ Done. tx: ${tx.hash}`);
      const updated = await receiver.authorizedSources(BASE_SEPOLIA_SELECTOR);
      log(`Updated authorizedSource: ${updated}`);
    }
  } else {
    throw new Error(`Run with --network arbitrumSepolia`);
  }
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
