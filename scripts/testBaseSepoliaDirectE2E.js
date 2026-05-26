/**
 * testBaseSepoliaDirectE2E.js
 *
 * Direct E2E test for Base Sepolia CCIP bridge (bypasses pool).
 * Deployer is authorized as caller on the new CrossChainSender.
 *
 * Usage:
 *   BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com \
 *   npx hardhat run scripts/testBaseSepoliaDirectE2E.js --network baseSepolia
 */
const hre = require("hardhat");

const NEW_SENDER   = "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4";
const NEW_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const CLAIM_AMOUNT = hre.ethers.parseEther("500"); // 500 RESURGE

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Sender: ${NEW_SENDER}`);

  const sender = await hre.ethers.getContractAt("CrossChainSender", NEW_SENDER, deployer);

  // Preflight checks
  const hub = await sender.hubReceiver();
  const sel = await sender.hubChainSelector();
  const isAuth = await sender.authorizedCallers(deployer.address);
  const linkBal = await hre.ethers.provider.call({
    to: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    data: "0x70a08231" + deployer.address.slice(2).padStart(64, "0"),
  });
  const senderLink = await hre.ethers.provider.call({
    to: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    data: "0x70a08231" + NEW_SENDER.slice(2).padStart(64, "0"),
  });

  log(`hubReceiver: ${hub}`);
  log(`hubChainSelector: ${sel}`);
  log(`deployer authorized: ${isAuth}`);
  log(`Sender LINK balance: ${hre.ethers.formatEther(BigInt(senderLink))} LINK`);

  if (!isAuth) throw new Error("Deployer not authorized as caller");
  if (hub.toLowerCase() !== NEW_RECEIVER.toLowerCase())
    throw new Error(`hubReceiver mismatch: ${hub} != ${NEW_RECEIVER}`);

  // Estimate fee
  const fee = await sender.sendRewardClaim.estimateGas(deployer.address, CLAIM_AMOUNT);
  log(`Gas estimate for sendRewardClaim: ${fee}`);

  // Send bridge claim
  log(`Sending bridge claim: ${hre.ethers.formatEther(CLAIM_AMOUNT)} RESURGE for ${deployer.address}...`);
  const tx = await sender.sendRewardClaim(deployer.address, CLAIM_AMOUNT);
  const receipt = await tx.wait();
  log(`tx: ${receipt.hash}`);

  // Extract CCIP messageId from RewardClaimSent event
  const iface = sender.interface;
  const ev = receipt.logs.map(l => { try { return iface.parseLog(l); } catch {} }).find(e => e?.name === "RewardClaimSent");
  if (!ev) throw new Error("RewardClaimSent event not found");
  const messageId = ev.args.messageId;
  log(`CCIP messageId: ${messageId}`);
  log(`Amount: ${hre.ethers.formatEther(ev.args.amount)} RESURGE`);
  log(`Fee paid: ${hre.ethers.formatEther(ev.args.ccipFee)} LINK`);

  log("\n✅ Bridge claim sent. Check CCIP Explorer:");
  log(`   https://ccip.chain.link/tx/${receipt.hash}`);
  log(`\nTo verify hub delivery, run on arbitrumSepolia:`);
  log(`   MESSAGE_ID=${messageId} npx hardhat run scripts/checkHubDelivery.js --network arbitrumSepolia`);
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
