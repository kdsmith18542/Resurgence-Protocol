/**
 * deployAmoyPool.js
 *
 * Deploys a dead coin staking pool on Amoy and wires it to a fresh CrossChainSender.
 *
 * Why a fresh CrossChainSender: the original sender (0xB19BaeF4...) had deployer roles
 * renounced, so authorizeCaller() can no longer be called without cross-chain governance.
 * This script deploys a new sender, wires the pool, then triggers a hub governance
 * proposal to update CrossChainReceiver to recognize the new sender.
 *
 * Usage:
 *   npx hardhat run scripts/deployAmoyPool.js --network amoy
 *
 * After running:
 *   - Note the new CrossChainSender address
 *   - Run hub governance to authorize new sender:
 *     STEP=1 NEW_SENDER=<addr> npx hardhat run scripts/authorizeNewAmoyViaGov.js --network arbitrumSepolia
 */

const hre = require("hardhat");

// Amoy spoke constants
const AMOY_CCIP_ROUTER   = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
const AMOY_LINK_TOKEN    = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const HUB_CHAIN_SELECTOR = "3478487238524512106"; // Arbitrum Sepolia
const HUB_RECEIVER       = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";
const HUB_TIMELOCK       = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
const SPOKE_RESURGE_TOKEN = "0x5cd4029539fc65b8c1ccd5d0aa544aa94adb48be";
const DCSP_IMPL          = "0xaf7f52ecb9aa4c7c61e0d93c17b75e149d285afc";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);

  // 1. Deploy a fresh CrossChainSender (deployer keeps TIMELOCK_ROLE for wiring)
  log("1. Deploying fresh CrossChainSender...");
  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  const sender = await CrossChainSender.deploy(
    AMOY_CCIP_ROUTER,
    AMOY_LINK_TOKEN,
    BigInt(HUB_CHAIN_SELECTOR),
    HUB_RECEIVER,
    HUB_TIMELOCK,
  );
  await sender.waitForDeployment();
  const senderAddr = await sender.getAddress();
  log(`   CrossChainSender: ${senderAddr}`);

  // 2. Deploy mock dead coin (simulates an abandoned ERC-20 on Amoy)
  log("2. Deploying mock dead coin (DEADTEST)...");
  const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
  const deadCoin = await ERC20Mock.deploy("Dead Test Token", "DEADTEST", 0);
  await deadCoin.waitForDeployment();
  const deadCoinAddr = await deadCoin.getAddress();
  log(`   DeadCoin: ${deadCoinAddr}`);

  // 3. Deploy DeadCoinStakingPool proxy using existing impl
  //    Pass deployer as _stakingPoolManagerAddress so deployer gets TIMELOCK_ROLE for setup.
  //    Hub timelock gets DEFAULT_ADMIN_ROLE + TIMELOCK_ROLE via _timelock param.
  log("3. Deploying DeadCoinStakingPool proxy...");
  const DCSP = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const initData = DCSP.interface.encodeFunctionData("initialize", [
    deadCoinAddr,
    SPOKE_RESURGE_TOKEN,
    deployer.address,  // rewardDistributor stub (no local minting on spoke)
    deployer.address,  // stakingPoolManagerAddress — deployer gets TIMELOCK_ROLE for setup
    HUB_TIMELOCK,      // timelock — gets DEFAULT_ADMIN_ROLE + TIMELOCK_ROLE
    HUB_TIMELOCK,      // treasury
  ]);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy");
  const poolProxy = await Proxy.deploy(DCSP_IMPL, initData);
  await poolProxy.waitForDeployment();
  const poolAddr = await poolProxy.getAddress();
  log(`   DeadCoinStakingPool proxy: ${poolAddr}`);

  const pool = DCSP.attach(poolAddr);

  // 4. Wire: setCrossChainSender on pool (deployer has TIMELOCK_ROLE)
  log("4. Setting CrossChainSender on pool...");
  await (await pool.setCrossChainSender(senderAddr)).wait();
  const storedSender = await pool.crossChainSender();
  log(`   crossChainSender: ${storedSender}`);

  // 5. Authorize pool as caller on CrossChainSender (deployer has TIMELOCK_ROLE)
  log("5. Authorizing pool as caller on CrossChainSender...");
  await (await sender.authorizeCaller(poolAddr)).wait();
  const isAuth = await sender.authorizedCallers(poolAddr);
  log(`   authorizedCallers[pool]: ${isAuth}`);

  // 6. Renounce deployer roles from pool (hub timelock retains TIMELOCK_ROLE)
  log("6. Renouncing deployer roles from pool...");
  const POOL_TIMELOCK = await pool.TIMELOCK_ROLE();
  await (await pool.renounceRole(POOL_TIMELOCK, deployer.address)).wait();
  log("   Pool: deployer TIMELOCK_ROLE renounced.");

  // 7. Renounce deployer roles from CrossChainSender (hub timelock retains TIMELOCK_ROLE)
  log("7. Renouncing deployer roles from CrossChainSender...");
  const SENDER_DEFAULT_ADMIN = await sender.DEFAULT_ADMIN_ROLE();
  const SENDER_TIMELOCK = await sender.TIMELOCK_ROLE();
  await (await sender.renounceRole(SENDER_DEFAULT_ADMIN, deployer.address)).wait();
  await (await sender.renounceRole(SENDER_TIMELOCK, deployer.address)).wait();
  log("   Sender: deployer roles renounced.");

  log("\n=== Amoy Pool Deployment Complete ===");
  log(`New CrossChainSender: ${senderAddr}`);
  log(`DeadCoinStakingPool:  ${poolAddr}`);
  log(`Dead coin (DEADTEST): ${deadCoinAddr}`);
  log(`\nNEXT: authorize new CrossChainSender on hub CrossChainReceiver:`);
  log(`  NEW_SENDER=${senderAddr} STEP=1 npx hardhat run scripts/authorizeNewAmoyViaGov.js --network arbitrumSepolia`);
  log(`\nAnd fund new CrossChainSender with LINK on Amoy:`);
  log(`  LINK ${AMOY_LINK_TOKEN} → transfer to ${senderAddr}`);
}

main().catch(err => { console.error(err); process.exit(1); });
