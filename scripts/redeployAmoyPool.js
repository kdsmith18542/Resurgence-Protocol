/**
 * redeployAmoyPool.js
 *
 * Deploys a new CrossChainSender and DeadCoinStakingPool proxy on Amoy,
 * sets the reward rate BEFORE renouncing roles, wires them, funds the sender
 * with 10 LINK, and renounces deployer roles.
 *
 * Usage:
 *   npx hardhat run scripts/redeployAmoyPool.js --network amoy
 */

const hre = require("hardhat");

const AMOY_CCIP_ROUTER    = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
const AMOY_LINK_TOKEN     = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const HUB_CHAIN_SELECTOR  = "3478487238524512106"; // Arbitrum Sepolia
const HUB_RECEIVER        = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";
const HUB_TIMELOCK        = process.env.SPOKE_TIMELOCK_ADDRESS || "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
const SPOKE_RESURGE_TOKEN = "0x5cd4029539fc65b8c1ccd5d0aa544aa94adb48be";
const DCSP_IMPL           = "0xaf7f52ecb9aa4c7c61e0d93c17b75e149d285afc";
const DEAD_COIN           = "0x26a657c4D4112ed78daE8cF40ffA159AD938683c";
const FUND_LINK_AMOUNT    = process.env.FUND_LINK_AMOUNT || "5";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);
  log(`Timelock: ${HUB_TIMELOCK}`);

  // 1. Deploy fresh CrossChainSender
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

  // 2. Deploy pool proxy pointing to the existing implementation
  log("2. Deploying DeadCoinStakingPool proxy...");
  const DCSP = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const initData = DCSP.interface.encodeFunctionData("initialize", [
    DEAD_COIN,
    SPOKE_RESURGE_TOKEN,
    deployer.address, // rewardDistributor stub
    deployer.address, // manager stub (deployer gets TIMELOCK_ROLE for setup)
    HUB_TIMELOCK,     // timelock
    HUB_TIMELOCK,     // treasury
  ]);
  const Proxy = await hre.ethers.getContractFactory("ERC1967Proxy");
  const poolProxy = await Proxy.deploy(DCSP_IMPL, initData);
  await poolProxy.waitForDeployment();
  const poolAddr = await poolProxy.getAddress();
  log(`   DeadCoinStakingPool proxy: ${poolAddr}`);

  const pool = DCSP.attach(poolAddr);

  // 3. Set reward rate BEFORE renouncing roles
  log("3. Setting reward rate to 1 RESURGE/sec...");
  const rateTx = await pool.setRewardRate(hre.ethers.parseEther("1"));
  await rateTx.wait();
  const currentRate = await pool.rewardRatePerSecond();
  log(`   Current reward rate per second: ${hre.ethers.formatEther(currentRate)}`);

  // Spoke pools use a stub rewardDistributor (no local minting), so protocol fee must be disabled.
  // Otherwise bridgeClaim() tries to mint fee locally and reverts.
  log("3b. Setting spoke protocol fee to 0 bps...");
  await (await pool.setProtocolFee(0)).wait();
  log(`   protocolFeeBps: ${(await pool.protocolFeeBps()).toString()}`);

  // 4. Wire pool and sender
  log("4. Setting CrossChainSender on pool...");
  await (await pool.setCrossChainSender(senderAddr)).wait();
  log("5. Authorizing pool as caller on CrossChainSender...");
  await (await sender.authorizeCaller(poolAddr)).wait();

  // 5. Transfer LINK to new sender
  log(`6. Transferring ${FUND_LINK_AMOUNT} LINK to new CrossChainSender...`);
  const erc20Abi = [
    "function balanceOf(address account) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ];
  const linkToken = await hre.ethers.getContractAt(erc20Abi, AMOY_LINK_TOKEN, deployer);
  const linkTx = await linkToken.transfer(senderAddr, hre.ethers.parseEther(FUND_LINK_AMOUNT));
  await linkTx.wait();
  log("   LINK funded.");

  // 6. Renounce roles
  log("7. Renouncing deployer roles from pool...");
  const POOL_TIMELOCK = await pool.TIMELOCK_ROLE();
  await (await pool.renounceRole(POOL_TIMELOCK, deployer.address)).wait();

  log("8. Renouncing deployer roles from CrossChainSender...");
  const SENDER_DEFAULT_ADMIN = await sender.DEFAULT_ADMIN_ROLE();
  const SENDER_TIMELOCK = await sender.TIMELOCK_ROLE();
  await (await sender.renounceRole(SENDER_DEFAULT_ADMIN, deployer.address)).wait();
  await (await sender.renounceRole(SENDER_TIMELOCK, deployer.address)).wait();

  log("\n=== Redeployment Complete ===");
  log(`New CrossChainSender:      ${senderAddr}`);
  log(`New DeadCoinStakingPool:   ${poolAddr}`);
}

main().catch(err => { console.error(err); process.exit(1); });
