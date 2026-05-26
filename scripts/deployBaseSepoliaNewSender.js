/**
 * deployBaseSepoliaNewSender.js
 *
 * Deploys a fresh CrossChainSender on Base Sepolia pointing to the new CrossChainReceiver.
 * Deployer KEEPS TIMELOCK_ROLE (no renounce) so we can admin this directly for testnet.
 *
 * Usage: npx hardhat run scripts/deployBaseSepoliaNewSender.js --network baseSepolia
 */
const hre = require("hardhat");

const NEW_HUB_RECEIVER  = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const HUB_CHAIN_SELECTOR = 3478487238524512106n; // Arbitrum Sepolia
const BASE_CCIP_ROUTER  = "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93";
const BASE_LINK_TOKEN   = "0xE4aB69C077896252FAFBD49EFD26B5D171A32410";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: ${hre.network.name}`);
  console.log(`New hub receiver: ${NEW_HUB_RECEIVER}`);

  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  console.log("\nDeploying CrossChainSender...");
  const sender = await CrossChainSender.deploy(
    BASE_CCIP_ROUTER,
    BASE_LINK_TOKEN,
    HUB_CHAIN_SELECTOR,
    NEW_HUB_RECEIVER,
    deployer.address,  // deployer IS the timelock for testnet — no renounce
  );
  await sender.waitForDeployment();
  const addr = await sender.getAddress();
  console.log(`CrossChainSender deployed: ${addr}`);

  // Verify state
  const hub = await sender.hubReceiver();
  const sel = await sender.hubChainSelector();
  const TIMELOCK_ROLE = await sender.TIMELOCK_ROLE();
  const hasRole = await sender.hasRole(TIMELOCK_ROLE, deployer.address);
  console.log(`\nVerification:`);
  console.log(`  hubReceiver: ${hub}`);
  console.log(`  hubChainSelector: ${sel}`);
  console.log(`  deployer TIMELOCK_ROLE: ${hasRole}`);

  console.log(`\n✅ Done. Next steps:`);
  console.log(`  1. Fund ${addr} with LINK for CCIP fees`);
  console.log(`  2. On hub: CrossChainReceiver.setAuthorizedSource(10344971235874465080, abi.encode(${addr}))`);
  console.log(`  3. Update frontend: NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_SENDER_ADDRESS=${addr}`);
  console.log(`  4. Wire existing Base Sepolia pool to this sender via authorizeCaller + setCrossChainSender`);
  console.log(`     (pool still controlled by hub timelock — needs separate governance)`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
