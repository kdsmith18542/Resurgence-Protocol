/**
 * deployAmoyRelaySender.js
 *
 * Deploys a new CrossChainSender on Polygon Amoy that includes bridgeClaimRelay().
 * Deployer keeps TIMELOCK_ROLE (no renounce) for testnet ease.
 * Authorizes the existing DeadCoinStakingPool as caller.
 *
 * Usage:
 *   npx hardhat run scripts/deployAmoyRelaySender.js --network amoy
 */
const hre = require("hardhat");

const HUB_RECEIVER        = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F"; // v2 receiver ✅
const HUB_CHAIN_SELECTOR  = 3478487238524512106n;                         // Arbitrum Sepolia
const AMOY_CCIP_ROUTER    = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
const AMOY_LINK_TOKEN     = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const EXISTING_AMOY_POOL  = "0xA47464986848447Efa93EF0Cd1b20a1a6227922D"; // active pool

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer:  ${deployer.address}`);
  log(`Network:   ${hre.network.name}`);
  log(`Hub recv:  ${HUB_RECEIVER}`);

  // 1. Deploy CrossChainSender — deployer is both TIMELOCK_ROLE holder and authorized caller
  log("Deploying CrossChainSender...");
  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  const sender = await CrossChainSender.deploy(
    AMOY_CCIP_ROUTER,
    AMOY_LINK_TOKEN,
    HUB_CHAIN_SELECTOR,
    HUB_RECEIVER,
    deployer.address,   // deployer = TIMELOCK_ROLE (no renounce for testnet)
  );
  await sender.waitForDeployment();
  const senderAddr = await sender.getAddress();
  log(`CrossChainSender deployed: ${senderAddr}`);

  // Verify
  const relayEnabled = await sender.relayEnabled();
  const ccipEnabled  = await sender.ccipEnabled();
  log(`relayEnabled: ${relayEnabled}  ccipEnabled: ${ccipEnabled}`);

  // 2. Authorize deployer as caller (for direct E2E testing without pool upgrade)
  log("Authorizing deployer as caller...");
  await (await sender.authorizeCaller(deployer.address)).wait();
  log(`  authorizedCallers[deployer]: ${await sender.authorizedCallers(deployer.address)}`);

  // 3. Authorize existing Amoy pool as caller
  log(`Authorizing existing pool ${EXISTING_AMOY_POOL}...`);
  await (await sender.authorizeCaller(EXISTING_AMOY_POOL)).wait();
  log(`  authorizedCallers[pool]: ${await sender.authorizedCallers(EXISTING_AMOY_POOL)}`);

  log("\n=== Amoy Relay Sender Deployed ===");
  log(`CrossChainSender: ${senderAddr}`);
  log("\nNext steps:");
  log("  1. Resurgence Phase 13.4 governance proposal — grantRole(RELAY_MINTER_ROLE, 0x201624cBa...)");
  log("  2. BaaLS VPS config: add [relay] section pointing to this sender");
  log("  3. Update Amoy pool crossChainSender via governance proposal (for pool-initiated relay claims)");
  log(`  4. E2E test: npx hardhat run scripts/testRelayE2E.js --network amoy with SENDER=${senderAddr}`);
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
