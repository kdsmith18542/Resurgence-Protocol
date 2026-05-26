/**
 * checkBscTestnetReadiness.js
 *
 * Read-only preflight for the remaining BSC Testnet spoke deployment work.
 *
 * Usage:
 *   node scripts/checkBscTestnetReadiness.js
 */
require("dotenv").config();
const { ethers } = require("ethers");

const BSC_RPC = process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";
const ARB_RPC =
  process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://arbitrum-sepolia-rpc.publicnode.com";

const HUB_CHAIN_SELECTOR = "3478487238524512106";
const HUB_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const BSC_CCIP_ROUTER = "0xE1053aE1857476f36A3C62580FF9b016E8EE8F6f";
const BSC_LINK = "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06";
const HUB_TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";

function log(msg) {
  console.log(msg);
}

async function hasCode(provider, address) {
  const code = await provider.getCode(address);
  return Boolean(code && code !== "0x");
}

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY missing in environment");
  }

  const bscProvider = new ethers.JsonRpcProvider(BSC_RPC);
  const arbProvider = new ethers.JsonRpcProvider(ARB_RPC);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, bscProvider);

  const [bscNet, bscBlock, balWei] = await Promise.all([
    bscProvider.getNetwork(),
    bscProvider.getBlockNumber(),
    bscProvider.getBalance(signer.address),
  ]);

  const [routerCode, linkCode, receiverCode, timelockCode] = await Promise.all([
    hasCode(bscProvider, BSC_CCIP_ROUTER),
    hasCode(bscProvider, BSC_LINK),
    hasCode(arbProvider, HUB_RECEIVER),
    hasCode(arbProvider, HUB_TIMELOCK),
  ]);

  const bal = Number(ethers.formatEther(balWei));

  log("=== BSC Testnet Spoke Readiness ===");
  log(`BSC RPC: ${BSC_RPC}`);
  log(`Arbitrum Sepolia RPC: ${ARB_RPC}`);
  log(`Deployer: ${signer.address}`);
  log(`BSC chainId: ${bscNet.chainId.toString()} (expected 97)`);
  log(`BSC latest block: ${bscBlock}`);
  log(`Deployer tBNB: ${bal.toString()}`);
  log("");
  log("Address/code checks:");
  log(`- BSC CCIP router (${BSC_CCIP_ROUTER}) code present: ${routerCode}`);
  log(`- BSC LINK token (${BSC_LINK}) code present: ${linkCode}`);
  log(`- Hub receiver (${HUB_RECEIVER}) code present: ${receiverCode}`);
  log(`- Hub timelock (${HUB_TIMELOCK}) code present: ${timelockCode}`);
  log("");

  const prerequisitesOk =
    Number(bscNet.chainId) === 97 && routerCode && linkCode && receiverCode && timelockCode;

  if (!prerequisitesOk) {
    log("STATUS: BLOCKED (config mismatch or missing contract code)");
    process.exit(1);
  }

  if (bal <= 0) {
    log("STATUS: BLOCKED (no tBNB for gas)");
    log("Action: fund deployer with tBNB, then run deploy command below.");
  } else {
    log("STATUS: READY to deploy BSC spoke contracts");
  }

  log("");
  log("Deploy command:");
  log(
    `HUB_CHAIN_SELECTOR=${HUB_CHAIN_SELECTOR} HUB_RECEIVER_ADDRESS=${HUB_RECEIVER} CCIP_ROUTER_ADDRESS=${BSC_CCIP_ROUTER} LINK_TOKEN_ADDRESS=${BSC_LINK} TIMELOCK_ADDRESS=${HUB_TIMELOCK} npx hardhat run --no-compile scripts/deploySpoke.js --network bscTestnet`
  );
}

main().catch((err) => {
  console.error(`ERROR: ${err.message || err}`);
  process.exit(1);
});

