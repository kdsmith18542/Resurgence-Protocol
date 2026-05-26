/**
 * checkPhase13Readiness.js
 *
 * Read-only on-chain readiness check for post-Phase-13 operational tasks.
 * Uses ethers + JSON-RPC directly (no Hardhat compile), so it still works
 * when local Solidity sources are in-flight.
 *
 * Checks:
 *  - Amoy active pool wiring (crossChainSender old vs new)
 *  - authorizedCallers(pool) on legacy + relay senders
 *  - relay/ccip flags + nonce on active relay senders
 *  - optional Base Sepolia pool wiring if BASE_POOL is provided
 *
 * Usage:
 *   node scripts/checkPhase13Readiness.js
 *
 * Optional env overrides:
 *   AMOY_RPC_URL, BASE_SEPOLIA_RPC_URL
 *   AMOY_POOL, AMOY_LEGACY_SENDER, AMOY_RELAY_SENDER
 *   BASE_RELAY_SENDER, BASE_POOL
 */

const { ethers } = require("ethers");

const CFG = {
  amoyRpc: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
  baseRpc: process.env.BASE_SEPOLIA_RPC_URL || "https://base-sepolia-rpc.publicnode.com",

  amoyPool: process.env.AMOY_POOL || "0xA47464986848447Efa93EF0Cd1b20a1a6227922D",
  amoyLegacySender:
    process.env.AMOY_LEGACY_SENDER || "0x3F1E0400fb8f19FeFA8aA6B8d23468949E73a7B5",
  amoyRelaySender:
    process.env.AMOY_RELAY_SENDER || "0xD41086DA2acCcD4EFfd47FA69ED3E6f71d9da5C6",

  baseRelaySender:
    process.env.BASE_RELAY_SENDER || "0xF38940C9Eb607521ba657AE1bd86328AD09712ea",
  basePool: process.env.BASE_POOL || "",
};

const poolAbi = [
  "function crossChainSender() view returns (address)",
  "function deadCoin() view returns (address)",
];

const senderAbi = [
  "function authorizedCallers(address) view returns (bool)",
  "function relayEnabled() view returns (bool)",
  "function ccipEnabled() view returns (bool)",
  "function relayNonce() view returns (uint256)",
];

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function asAddr(addr) {
  return ethers.getAddress(addr);
}

function yesNo(v) {
  return v ? "YES" : "NO";
}

async function readSenderState(provider, sender, pool) {
  const c = new ethers.Contract(sender, senderAbi, provider);
  const [authorized, relayEnabled, ccipEnabled, relayNonce] = await Promise.all([
    c.authorizedCallers(pool).catch(() => null),
    c.relayEnabled().catch(() => null),
    c.ccipEnabled().catch(() => null),
    c.relayNonce().catch(() => null),
  ]);
  return {
    authorized,
    relayEnabled,
    ccipEnabled,
    relayNonce: relayNonce == null ? null : relayNonce.toString(),
  };
}

async function main() {
  const amoy = new ethers.JsonRpcProvider(CFG.amoyRpc);
  const base = new ethers.JsonRpcProvider(CFG.baseRpc);

  const amoyPoolAddr = asAddr(CFG.amoyPool);
  const amoyLegacySender = asAddr(CFG.amoyLegacySender);
  const amoyRelaySender = asAddr(CFG.amoyRelaySender);
  const baseRelaySender = asAddr(CFG.baseRelaySender);
  const basePoolAddr = CFG.basePool ? asAddr(CFG.basePool) : "";

  section("Config");
  console.log("Amoy RPC:", CFG.amoyRpc);
  console.log("Base RPC:", CFG.baseRpc);
  console.log("Amoy pool:", amoyPoolAddr);
  console.log("Amoy legacy sender:", amoyLegacySender);
  console.log("Amoy relay sender:", amoyRelaySender);
  console.log("Base relay sender:", baseRelaySender);
  console.log("Base pool (optional):", basePoolAddr || "<not set>");

  section("Amoy Pool State");
  const amoyPool = new ethers.Contract(amoyPoolAddr, poolAbi, amoy);
  const [amoyPoolSender, amoyDeadCoin] = await Promise.all([
    amoyPool.crossChainSender(),
    amoyPool.deadCoin(),
  ]);
  console.log("pool.crossChainSender:", amoyPoolSender);
  console.log("pool.deadCoin:", amoyDeadCoin);

  section("Amoy Sender States");
  const [legacy, relay] = await Promise.all([
    readSenderState(amoy, amoyLegacySender, amoyPoolAddr),
    readSenderState(amoy, amoyRelaySender, amoyPoolAddr),
  ]);
  console.log(`legacy.authorizedCallers(pool): ${legacy.authorized}`);
  console.log(`relay.authorizedCallers(pool):  ${relay.authorized}`);
  console.log(
    `relay.flags: relayEnabled=${relay.relayEnabled} ccipEnabled=${relay.ccipEnabled} relayNonce=${relay.relayNonce}`
  );

  section("Base Relay Sender State");
  const baseRelay = await readSenderState(base, baseRelaySender, basePoolAddr || ethers.ZeroAddress);
  console.log(
    `baseRelay.flags: relayEnabled=${baseRelay.relayEnabled} ccipEnabled=${baseRelay.ccipEnabled} relayNonce=${baseRelay.relayNonce}`
  );
  if (basePoolAddr) {
    console.log(`baseRelay.authorizedCallers(basePool): ${baseRelay.authorized}`);
  } else {
    console.log("basePool not provided; skipping authorizedCallers(basePool) check.");
  }

  section("Action Summary");
  const amoyPoolOnRelay =
    asAddr(amoyPoolSender) === amoyRelaySender;
  console.log(`Amoy pool wired to relay sender? ${yesNo(amoyPoolOnRelay)}`);
  if (!amoyPoolOnRelay) {
    console.log("REQUIRED: governance call on Amoy pool:");
    console.log("  target:", amoyPoolAddr);
    console.log("  function: setCrossChainSender(address)");
    console.log("  arg:", amoyRelaySender);
    const iface = new ethers.Interface(["function setCrossChainSender(address)"]);
    const calldata = iface.encodeFunctionData("setCrossChainSender", [amoyRelaySender]);
    console.log("  calldata:", calldata);
  } else {
    console.log("Amoy pool sender wiring is already correct.");
  }

  if (!basePoolAddr) {
    console.log("BASE PENDING: no BASE_POOL provided. Deploy/wire a Base pool, then re-run with BASE_POOL=<addr>.");
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
