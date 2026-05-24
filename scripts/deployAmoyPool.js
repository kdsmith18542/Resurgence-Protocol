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

// Amoy spoke constants — v4 addresses
const AMOY_CCIP_ROUTER    = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
const AMOY_LINK_TOKEN     = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const HUB_CHAIN_SELECTOR  = "3478487238524512106"; // Arbitrum Sepolia
const HUB_RECEIVER        = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB"; // v4
const HUB_TIMELOCK        = process.env.SPOKE_TIMELOCK_ADDRESS || "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
const SPOKE_RESURGE_TOKEN = "0xD4f9ca34D21Df340252953926C4B16fcC3c5449D"; // v4 stub
const DCSP_IMPL           = "0xB4BabB6b1E8E60A9b4EDa85296701Fe5906b2982"; // v4 impl
const FUND_LINK_AMOUNT    = process.env.FUND_LINK_AMOUNT || "5";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);
  log(`Timelock: ${HUB_TIMELOCK}`);

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

  // 4. Set reward rate BEFORE renouncing roles
  log("4. Setting reward rate to 1 RESURGE/sec...");
  await (await pool.setRewardRate(hre.ethers.parseEther("1"))).wait();
  log(`   Rate set: ${hre.ethers.formatEther(await pool.rewardRatePerSecond())} RESURGE/sec`);

  // Spoke pools use a stub rewardDistributor (no local minting), so protocol fee must be disabled.
  // Otherwise bridgeClaim() tries to mint fee locally and reverts.
  log("4b. Setting spoke protocol fee to 0 bps...");
  await (await pool.setProtocolFee(0)).wait();
  log(`   protocolFeeBps: ${(await pool.protocolFeeBps()).toString()}`);

  // Wire: setCrossChainSender on pool (deployer has TIMELOCK_ROLE)
  log("5. Setting CrossChainSender on pool...");
  await (await pool.setCrossChainSender(senderAddr)).wait();
  const storedSender = await pool.crossChainSender();
  log(`   crossChainSender: ${storedSender}`);

  // 6. Authorize pool as caller on CrossChainSender (deployer has TIMELOCK_ROLE)
  log("6. Authorizing pool as caller on CrossChainSender...");
  await (await sender.authorizeCaller(poolAddr)).wait();
  const isAuth = await sender.authorizedCallers(poolAddr);
  log(`   authorizedCallers[pool]: ${isAuth}`);

  // 7. Fund CrossChainSender with LINK
  log(`7. Transferring ${FUND_LINK_AMOUNT} LINK to CrossChainSender...`);
  const erc20Abi = ["function transfer(address to, uint256 amount) external returns (bool)"];
  const linkToken = await hre.ethers.getContractAt(erc20Abi, AMOY_LINK_TOKEN, deployer);
  await (await linkToken.transfer(senderAddr, hre.ethers.parseEther(FUND_LINK_AMOUNT))).wait();
  log("   LINK funded.");

  // 8. Renounce deployer roles from pool (hub timelock retains TIMELOCK_ROLE)
  log("8. Renouncing deployer roles from pool...");
  const POOL_TIMELOCK = await pool.TIMELOCK_ROLE();
  await (await pool.renounceRole(POOL_TIMELOCK, deployer.address)).wait();
  log("   Pool: deployer TIMELOCK_ROLE renounced.");

  // 9. Renounce deployer roles from CrossChainSender (hub timelock retains TIMELOCK_ROLE)
  log("9. Renouncing deployer roles from CrossChainSender...");
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
