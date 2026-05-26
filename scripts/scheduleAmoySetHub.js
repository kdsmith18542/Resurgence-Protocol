/**
 * scheduleAmoySetHub.js
 * Schedules CrossChainSender.setHub() on Amoy via the local Amoy Timelock.
 * Then waits the minDelay and executes.
 *
 * Usage: npx hardhat run scripts/scheduleAmoySetHub.js --network amoy
 */
const hre = require("hardhat");

const AMOY_SENDER   = "0x3F1E0400fb8f19FeFA8aA6B8d23468949E73a7B5";
const AMOY_TIMELOCK = "0xcce434614eC41f170Ca05a6bfaC9445bdDC58FA3";
const NEW_HUB       = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const HUB_SELECTOR  = 3478487238524512106n; // Arbitrum Sepolia

const POLL_MS = 15000;
function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  log(`Signer: ${signer.address}`);

  const sender   = await hre.ethers.getContractAt("CrossChainSender", AMOY_SENDER, signer);
  const timelock = await hre.ethers.getContractAt("ResurgenceTimelockController", AMOY_TIMELOCK, signer);

  const currentHub = await sender.hubReceiver();
  log(`Current hubReceiver: ${currentHub}`);
  if (currentHub.toLowerCase() === NEW_HUB.toLowerCase()) {
    log("✅ hubReceiver already updated — nothing to do.");
    return;
  }

  const minDelay = await timelock.getMinDelay();
  log(`Timelock minDelay: ${minDelay}s`);

  // Encode the call
  const iface = sender.interface;
  const calldata = iface.encodeFunctionData("setHub", [HUB_SELECTOR, NEW_HUB]);
  const salt = hre.ethers.ZeroHash;
  const predecessor = hre.ethers.ZeroHash;

  const opId = await timelock.hashOperation(AMOY_SENDER, 0n, calldata, predecessor, salt);
  log(`Operation ID: ${opId}`);

  const isPending = await timelock.isOperationPending(opId);
  const isReady   = await timelock.isOperationReady(opId);
  const isDone    = await timelock.isOperationDone(opId);
  log(`isPending=${isPending} isReady=${isReady} isDone=${isDone}`);

  if (isDone) {
    log("✅ Operation already executed.");
    return;
  }

  if (!isPending) {
    log("Scheduling setHub...");
    const tx = await timelock.schedule(AMOY_SENDER, 0n, calldata, predecessor, salt, minDelay);
    await tx.wait();
    log(`Scheduled tx: ${tx.hash}`);
    log(`Will be ready in ${minDelay}s — waiting...`);
  } else if (isReady) {
    log("Operation already pending and ready — proceeding to execute.");
  } else {
    log("Operation already scheduled but not ready yet — polling...");
  }

  // Poll until ready
  while (true) {
    const ready = await timelock.isOperationReady(opId);
    if (ready) break;
    log(`  Not ready yet, waiting ${POLL_MS/1000}s...`);
    await sleep(POLL_MS);
  }

  log("Executing setHub via timelock...");
  const execTx = await timelock.execute(AMOY_SENDER, 0n, calldata, predecessor, salt);
  await execTx.wait();
  log(`Executed! tx: ${execTx.hash}`);

  const updatedHub = await sender.hubReceiver();
  log(`Updated hubReceiver: ${updatedHub}`);
  if (updatedHub.toLowerCase() === NEW_HUB.toLowerCase()) {
    log("✅ SUCCESS — Amoy CrossChainSender now points to new receiver.");
  } else {
    log("⚠️ Hub not updated as expected.");
  }
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
