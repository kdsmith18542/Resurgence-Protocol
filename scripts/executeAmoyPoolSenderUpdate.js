/**
 * executeAmoyPoolSenderUpdate.js
 *
 * Schedules and/or executes Amoy pool sender migration via Amoy timelock:
 *   DeadCoinStakingPool.setCrossChainSender(NEW_RELAY_SENDER)
 *
 * This script is idempotent:
 *  - If operation is unscheduled, it schedules it.
 *  - If scheduled and ready, it executes it.
 *  - If executed, it exits successfully.
 *
 * Usage:
 *   node scripts/executeAmoyPoolSenderUpdate.js
 *
 * Optional env overrides:
 *   AMOY_RPC_URL
 *   PRIVATE_KEY
 *   AMOY_TIMELOCK
 *   AMOY_POOL
 *   AMOY_RELAY_SENDER
 */

require("dotenv").config();
const { ethers } = require("ethers");

const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const AMOY_TIMELOCK = process.env.AMOY_TIMELOCK || "0xcce434614eC41f170Ca05a6bfaC9445bdDC58FA3";
const AMOY_POOL = process.env.AMOY_POOL || "0xA47464986848447Efa93EF0Cd1b20a1a6227922D";
const AMOY_RELAY_SENDER =
  process.env.AMOY_RELAY_SENDER || "0xD41086DA2acCcD4EFfd47FA69ED3E6f71d9da5C6";

const TIMELOCK_ABI = [
  "function getMinDelay() view returns (uint256)",
  "function hashOperation(address,uint256,bytes,bytes32,bytes32) view returns (bytes32)",
  "function isOperationPending(bytes32) view returns (bool)",
  "function isOperationReady(bytes32) view returns (bool)",
  "function isOperationDone(bytes32) view returns (bool)",
  "function getTimestamp(bytes32) view returns (uint256)",
  "function schedule(address,uint256,bytes,bytes32,bytes32,uint256) external",
  "function execute(address,uint256,bytes,bytes32,bytes32) external",
];

const POOL_IFACE = new ethers.Interface(["function setCrossChainSender(address)"]);
const PREDECESSOR = ethers.ZeroHash;
const SALT = ethers.ZeroHash;

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY is required");

  const provider = new ethers.JsonRpcProvider(AMOY_RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const timelock = new ethers.Contract(AMOY_TIMELOCK, TIMELOCK_ABI, signer);

  const calldata = POOL_IFACE.encodeFunctionData("setCrossChainSender", [
    ethers.getAddress(AMOY_RELAY_SENDER),
  ]);
  const opId = await timelock.hashOperation(AMOY_POOL, 0n, calldata, PREDECESSOR, SALT);

  log(`Signer: ${signer.address}`);
  log(`Timelock: ${AMOY_TIMELOCK}`);
  log(`Pool: ${AMOY_POOL}`);
  log(`Target sender: ${AMOY_RELAY_SENDER}`);
  log(`Operation ID: ${opId}`);

  const minDelay = await timelock.getMinDelay();
  let pending = await timelock.isOperationPending(opId);
  let ready = await timelock.isOperationReady(opId);
  let done = await timelock.isOperationDone(opId);
  let timestamp = await timelock.getTimestamp(opId);
  log(
    `State before: pending=${pending} ready=${ready} done=${done} ts=${timestamp.toString()} minDelay=${minDelay.toString()}`
  );

  if (done) {
    log("Operation already executed.");
    return;
  }

  if (!pending) {
    log("Scheduling operation...");
    const tx = await timelock.schedule(
      AMOY_POOL,
      0n,
      calldata,
      PREDECESSOR,
      SALT,
      minDelay
    );
    const receipt = await tx.wait();
    log(`Scheduled tx: ${receipt.hash}`);
  } else {
    log("Operation already scheduled.");
  }

  pending = await timelock.isOperationPending(opId);
  ready = await timelock.isOperationReady(opId);
  done = await timelock.isOperationDone(opId);
  timestamp = await timelock.getTimestamp(opId);
  log(`State after schedule: pending=${pending} ready=${ready} done=${done} ts=${timestamp.toString()}`);

  if (!ready || done) {
    const now = Math.floor(Date.now() / 1000);
    const eta = Number(timestamp);
    log(`Not ready to execute yet. Seconds until ready: ${Math.max(0, eta - now)}`);
    return;
  }

  log("Executing operation...");
  const txe = await timelock.execute(AMOY_POOL, 0n, calldata, PREDECESSOR, SALT);
  const rcpt = await txe.wait();
  log(`Executed tx: ${rcpt.hash}`);
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
});
