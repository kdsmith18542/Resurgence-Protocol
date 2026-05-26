/**
 * postExecutionE2E.js
 *
 * Run after both governance authorizeBridge + Amoy setHub have executed.
 * 1. Verifies governance executed (authorizedBridges = true)
 * 2. Sends fresh Base Sepolia bridge claim (direct, no pool)
 * 3. Sends Amoy bridge claim (via pool)
 * 4. Polls for CCIP delivery on hub (both messages)
 *
 * Usage:
 *   On Arb Sepolia (check governance): npx hardhat run scripts/postExecutionE2E.js --network arbitrumSepolia
 *   On Base Sepolia (send claim):      BASE_SEPOLIA_RPC_URL=... npx hardhat run scripts/postExecutionE2E.js --network baseSepolia
 *   On Amoy (send claim):              npx hardhat run scripts/postExecutionE2E.js --network amoy
 */
const hre = require("hardhat");

const NEW_RECEIVER  = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const DISTRIBUTOR   = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const RESURGE       = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";
const BASE_SENDER   = "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4";
const AMOY_POOL     = "0xA47464986848447Efa93EF0Cd1b20a1a6227922D";
const AMOY_DEADCOIN = "0xc83702C54Ce1Cdb5C2A9ca3bbdc30e023859019A";

const POLL_MS = 30000; // 30s between delivery checks
const POLL_MAX = 40;   // Max 40 polls = 20 minutes

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkAuthorizeBridge() {
  const dist = await hre.ethers.getContractAt("RewardDistributor", DISTRIBUTOR);
  return dist.authorizedBridges(NEW_RECEIVER);
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  log(`Network: ${network}, Signer: ${signer.address}`);

  if (network === "arbitrumSepolia") {
    // Check governance status
    const authorized = await checkAuthorizeBridge();
    log(`authorizedBridges[newReceiver]: ${authorized}`);
    if (!authorized) {
      log("⚠️  Governance not yet executed. Wait for authorizeBridgeViaGov.js to complete first.");
      return;
    }
    log("✅ Bridge authorization confirmed. Hub is ready to process CCIP messages.");

    // Check for any previously delivered messages
    const receiver = await hre.ethers.getContractAt("CrossChainReceiver", NEW_RECEIVER);
    const baseMsgId = "0xf40c5f32fcc02f5efab725f9e501cfffa2c5cc688c6019b8eabb8c804dc096db";
    const baseProcessed = await receiver.processedMessages(baseMsgId);
    log(`Base Sepolia test message processed: ${baseProcessed}`);

    if (baseProcessed) {
      const resurge = await hre.ethers.getContractAt("ResurgeToken", RESURGE);
      const bal = await resurge.balanceOf(signer.address);
      log(`Deployer RESURGE balance: ${hre.ethers.formatEther(bal)}`);
    }

  } else if (network === "baseSepolia") {
    // Check if governance already done (from hub check)
    const sender = await hre.ethers.getContractAt("CrossChainSender", BASE_SENDER, signer);
    const hub = await sender.hubReceiver();
    log(`Base Sepolia sender hubReceiver: ${hub}`);

    log(`Sending fresh bridge claim (500 RESURGE)...`);
    const tx = await sender.sendRewardClaim(signer.address, hre.ethers.parseEther("500"));
    const receipt = await tx.wait();
    const iface = sender.interface;
    const ev = receipt.logs.map(l => { try { return iface.parseLog(l); } catch {} }).find(e => e?.name === "RewardClaimSent");
    if (!ev) throw new Error("RewardClaimSent event not found");
    log(`✅ Sent! tx: ${receipt.hash}`);
    log(`   messageId: ${ev.args.messageId}`);
    log(`   amount:    ${hre.ethers.formatEther(ev.args.amount)} RESURGE`);
    log(`   fee:       ${hre.ethers.formatEther(ev.args.ccipFee)} LINK`);
    log(`\n   Check delivery: MESSAGE_ID=${ev.args.messageId} npx hardhat run scripts/checkHubDelivery.js --network arbitrumSepolia`);

  } else if (network === "amoy") {
    // Send Amoy bridge claim via pool
    const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", AMOY_POOL, signer);
    const deadCoin = await hre.ethers.getContractAt("ERC20Mock", AMOY_DEADCOIN, signer);
    const sender = await pool.crossChainSender();
    const senderContract = await hre.ethers.getContractAt("CrossChainSender", sender);
    const hub = await senderContract.hubReceiver();

    log(`Pool crossChainSender: ${sender}`);
    log(`Sender hubReceiver: ${hub}`);
    if (hub.toLowerCase() !== NEW_RECEIVER.toLowerCase()) {
      log("⚠️  Amoy sender still points to old receiver. Wait for Amoy setHub to execute.");
      return;
    }

    // Mint + stake + bridge claim
    let bal = await deadCoin.balanceOf(signer.address);
    if (bal === 0n) {
      log("Minting 1000 DEADTEST...");
      await (await deadCoin.mint(signer.address, hre.ethers.parseEther("1000"))).wait();
    }
    const stakeAmt = hre.ethers.parseEther("100");
    log("Approving + staking...");
    await (await deadCoin.approve(AMOY_POOL, stakeAmt)).wait();
    await (await pool.stake(stakeAmt)).wait();
    log(`Staked ${hre.ethers.formatEther(stakeAmt)} DEADTEST`);

    log("Waiting 15s for rewards...");
    await sleep(15000);

    log("Calling bridgeClaim()...");
    const tx = await pool.bridgeClaim();
    const receipt = await tx.wait();
    // Find RewardClaimSent from CrossChainSender
    const senderIface = senderContract.interface;
    const ev = receipt.logs.map(l => { try { return senderIface.parseLog(l); } catch {} }).find(e => e?.name === "RewardClaimSent");
    if (!ev) throw new Error("RewardClaimSent event not found in logs");
    log(`✅ bridgeClaim sent! tx: ${receipt.hash}`);
    log(`   messageId: ${ev.args.messageId}`);
    log(`   amount:    ${hre.ethers.formatEther(ev.args.amount)} RESURGE`);
    log(`   fee:       ${hre.ethers.formatEther(ev.args.ccipFee)} LINK`);
    log(`\n   Check delivery: MESSAGE_ID=${ev.args.messageId} npx hardhat run scripts/checkHubDelivery.js --network arbitrumSepolia`);
  }
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
