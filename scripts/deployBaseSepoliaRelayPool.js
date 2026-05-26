/**
 * deployBaseSepoliaRelayPool.js
 *
 * Deploys a fresh Base Sepolia DeadCoinStakingPool proxy and wires it to the
 * active Phase 13 relay sender.
 *
 * This script intentionally avoids upgrades.deployProxy() because Base Sepolia
 * RPC endpoints have intermittently timed out during proxy deployment polling.
 *
 * Usage:
 *   npx hardhat run --no-compile scripts/deployBaseSepoliaRelayPool.js --network baseSepolia
 */
const hre = require("hardhat");

const RELAY_SENDER = "0xF38940C9Eb607521ba657AE1bd86328AD09712ea";
const STUB_RESURGE_TOKEN = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
const HUB_TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";

function log(msg) {
  console.log(`[${new Date().toISOString().replace("T", " ").slice(0, 19)}] ${msg}`);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network: ${hre.network.name}`);
  log(`Relay sender: ${RELAY_SENDER}`);

  log("1. Deploying mock dead coin (DEADBASE)...");
  const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
  const deadCoin = await ERC20Mock.deploy("Dead Base Token", "DEADBASE", 0);
  await deadCoin.waitForDeployment();
  const deadCoinAddress = await deadCoin.getAddress();
  log(`   Dead coin: ${deadCoinAddress}`);

  log("2. Deploying DeadCoinStakingPool implementation...");
  const DeadCoinStakingPool = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const poolImpl = await DeadCoinStakingPool.deploy();
  await poolImpl.waitForDeployment();
  const poolImplAddress = await poolImpl.getAddress();
  log(`   Pool impl: ${poolImplAddress}`);

  log("3. Deploying DeadCoinStakingPool proxy...");
  const initData = DeadCoinStakingPool.interface.encodeFunctionData("initialize", [
    deadCoinAddress,
    STUB_RESURGE_TOKEN,
    deployer.address,
    deployer.address,
    HUB_TIMELOCK,
    HUB_TIMELOCK,
  ]);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy");
  const poolProxy = await Proxy.deploy(poolImplAddress, initData);
  await poolProxy.waitForDeployment();
  const poolAddress = await poolProxy.getAddress();
  log(`   Pool proxy: ${poolAddress}`);

  const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", poolAddress, deployer);

  log("4. Setting pool config...");
  await (await pool.setRewardRate(hre.ethers.parseEther("1"))).wait();
  await (await pool.setProtocolFee(0)).wait();
  await (await pool.setCrossChainSender(RELAY_SENDER)).wait();
  log(`   rewardRate: ${hre.ethers.formatEther(await pool.rewardRatePerSecond())} RESURGE/sec`);
  log(`   protocolFeeBps: ${(await pool.protocolFeeBps()).toString()}`);
  log(`   crossChainSender: ${await pool.crossChainSender()}`);

  log("5. Authorizing pool on relay sender...");
  const relaySender = await hre.ethers.getContractAt("CrossChainSender", RELAY_SENDER, deployer);
  const senderTimelockRole = await relaySender.TIMELOCK_ROLE();
  const deployerCanAuthorize = await relaySender.hasRole(senderTimelockRole, deployer.address);
  if (!deployerCanAuthorize) throw new Error("deployer lacks TIMELOCK_ROLE on relay sender");

  await (await relaySender.authorizeCaller(poolAddress)).wait();
  const isAuthorized = await relaySender.authorizedCallers(poolAddress);
  log(`   authorizedCallers[pool]: ${isAuthorized}`);

  log("");
  log("=== Base Sepolia Relay Pool Deployment Complete ===");
  log(`Dead coin (DEADBASE): ${deadCoinAddress}`);
  log(`DeadCoinStakingPool:  ${poolAddress}`);
  log(`CrossChainSender:     ${RELAY_SENDER}`);
  log("");
  log("Readiness check command:");
  log(`BASE_POOL=${poolAddress} node scripts/checkPhase13Readiness.js`);
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
