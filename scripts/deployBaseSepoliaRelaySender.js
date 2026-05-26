/**
 * deployBaseSepoliaRelaySender.js
 *
 * Deploys a new CrossChainSender on Base Sepolia that includes bridgeClaimRelay().
 * Deployer keeps TIMELOCK_ROLE (no renounce) for testnet ease.
 *
 * Usage:
 *   npx hardhat run scripts/deployBaseSepoliaRelaySender.js --network baseSepolia
 */
const hre = require("hardhat");

const HUB_RECEIVER        = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F"; // v2 receiver ✅
const HUB_CHAIN_SELECTOR  = 3478487238524512106n;                         // Arbitrum Sepolia
const BASE_CCIP_ROUTER    = "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93";
const BASE_LINK_TOKEN     = "0xE4aB69C077896252FAFBD49EFD26B5D171A32410";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);
  log(`Hub recv: ${HUB_RECEIVER}`);

  log("Deploying CrossChainSender...");
  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  const sender = await CrossChainSender.deploy(
    BASE_CCIP_ROUTER,
    BASE_LINK_TOKEN,
    HUB_CHAIN_SELECTOR,
    HUB_RECEIVER,
    deployer.address,  // deployer = TIMELOCK_ROLE (no renounce for testnet)
  );
  await sender.waitForDeployment();
  const senderAddr = await sender.getAddress();
  log(`CrossChainSender deployed: ${senderAddr}`);

  const relayEnabled = await sender.relayEnabled();
  const ccipEnabled  = await sender.ccipEnabled();
  log(`relayEnabled: ${relayEnabled}  ccipEnabled: ${ccipEnabled}`);

  // Authorize deployer as caller for direct E2E testing
  log("Authorizing deployer as caller...");
  await (await sender.authorizeCaller(deployer.address)).wait();
  log(`  authorizedCallers[deployer]: ${await sender.authorizedCallers(deployer.address)}`);

  log("\n=== Base Sepolia Relay Sender Deployed ===");
  log(`CrossChainSender: ${senderAddr}`);
  log("\nNext steps:");
  log("  1. BaaLS VPS config: add this sender under [[relay.spokes]] for base-sepolia");
  log("  2. grantRole(RELAY_MINTER_ROLE, 0x201624cBa...) via governance on hub");
  log(`  3. E2E test: SENDER=${senderAddr} npx hardhat run scripts/testRelayE2E.js --network baseSepolia`);
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
