/**
 * deployBaseSepoliaPool.js
 *
 * Deploys a dead coin staking pool on Base Sepolia.
 *
 * The existing CrossChainSender (0xd85Af3...) has deployer roles renounced —
 * authorizeCaller() can no longer be called without cross-chain governance.
 * This script deploys a new sender, wires the pool, then triggers a hub governance
 * proposal to update CrossChainReceiver to recognize the new sender.
 *
 * Prerequisites:
 *   - ~5 LINK on Base Sepolia in deployer wallet (Chainlink faucet: faucets.chain.link)
 *   - ~0.001 ETH in deployer wallet for gas
 *
 * Usage:
 *   BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com \
 *   npx hardhat run scripts/deployBaseSepoliaPool.js --network baseSepolia
 */

const hre = require("hardhat");

const BASE_SEP_CCIP_ROUTER = "0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93";
const BASE_SEP_LINK_TOKEN  = "0xE4aB69C077896252FAFBD49EFD26B5D171A32410";
const HUB_CHAIN_SELECTOR   = "3478487238524512106"; // Arbitrum Sepolia
const HUB_RECEIVER         = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";
const HUB_TIMELOCK         = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
const STUB_RESURGE_TOKEN   = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
const DCSP_IMPL            = "0xBC6d675069C57a1c039A4F0BE0979Cb6E6727a9b";
const FUND_LINK_AMOUNT     = process.env.FUND_LINK_AMOUNT || "5";

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);

  // 1. Deploy fresh CrossChainSender (deployer keeps TIMELOCK_ROLE for wiring)
  log("1. Deploying fresh CrossChainSender...");
  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  const sender = await CrossChainSender.deploy(
    BASE_SEP_CCIP_ROUTER, BASE_SEP_LINK_TOKEN,
    BigInt(HUB_CHAIN_SELECTOR), HUB_RECEIVER, HUB_TIMELOCK,
  );
  await sender.waitForDeployment();
  const senderAddr = await sender.getAddress();
  log(`   CrossChainSender: ${senderAddr}`);

  // 2. Deploy mock dead coin
  log("2. Deploying mock dead coin (DEADTEST)...");
  const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
  const deadCoin = await ERC20Mock.deploy("Dead Test Token", "DEADTEST", 0);
  await deadCoin.waitForDeployment();
  const deadCoinAddr = await deadCoin.getAddress();
  log(`   DeadCoin: ${deadCoinAddr}`);

  // 3. Deploy DeadCoinStakingPool proxy
  //    Pass deployer as stakingPoolManagerAddress → deployer gets TIMELOCK_ROLE for setup.
  log("3. Deploying DeadCoinStakingPool proxy...");
  const DCSP = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const initData = DCSP.interface.encodeFunctionData("initialize", [
    deadCoinAddr,
    STUB_RESURGE_TOKEN,
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

  // 4. Set reward rate and disable protocol fee (spoke: no local minting)
  log("4. Setting reward rate (1 RESURGE/sec) and protocol fee (0 bps)...");
  await (await pool.setRewardRate(hre.ethers.parseEther("1"))).wait();
  await (await pool.setProtocolFee(0)).wait();
  log(`   rewardRate: ${hre.ethers.formatEther(await pool.rewardRatePerSecond())} RESURGE/sec`);
  log(`   protocolFeeBps: ${(await pool.protocolFeeBps()).toString()}`);

  // 5. Wire CrossChainSender on pool
  log("5. Setting CrossChainSender on pool...");
  await (await pool.setCrossChainSender(senderAddr)).wait();
  log(`   crossChainSender: ${await pool.crossChainSender()}`);

  // 6. Authorize pool as caller on new CrossChainSender
  log("6. Authorizing pool as caller on CrossChainSender...");
  await (await sender.authorizeCaller(poolAddr)).wait();
  log(`   authorizedCallers[pool]: ${await sender.authorizedCallers(poolAddr)}`);

  // 7. Fund new CrossChainSender with LINK
  log(`7. Transferring ${FUND_LINK_AMOUNT} LINK to CrossChainSender...`);
  const erc20Abi = ["function transfer(address to, uint256 amount) external returns (bool)"];
  const linkToken = await hre.ethers.getContractAt(erc20Abi, BASE_SEP_LINK_TOKEN, deployer);
  await (await linkToken.transfer(senderAddr, hre.ethers.parseEther(FUND_LINK_AMOUNT))).wait();
  log("   LINK funded.");

  // 8. Renounce deployer roles from pool
  log("8. Renouncing deployer roles from pool...");
  await (await pool.renounceRole(await pool.TIMELOCK_ROLE(), deployer.address)).wait();
  log("   Pool deployer TIMELOCK_ROLE renounced.");

  // 9. Renounce deployer roles from new CrossChainSender
  log("9. Renouncing deployer roles from CrossChainSender...");
  await (await sender.renounceRole(await sender.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await sender.renounceRole(await sender.TIMELOCK_ROLE(), deployer.address)).wait();
  log("   Sender deployer roles renounced.");

  log("\n=== Base Sepolia Pool Deployment Complete ===");
  log(`New CrossChainSender: ${senderAddr}`);
  log(`DeadCoinStakingPool:  ${poolAddr}`);
  log(`Dead coin (DEADTEST): ${deadCoinAddr}`);
  log(`\nNEXT: authorize new CrossChainSender on hub CrossChainReceiver:`);
  log(`  NEW_SENDER=${senderAddr} npx hardhat run scripts/authorizeBaseSepoliaViaGov.js --network arbitrumSepolia`);
  log(`\nUpdate .env.local:`);
  log(`  NEXT_PUBLIC_BASE_SEPOLIA_CROSS_CHAIN_SENDER_ADDRESS=${senderAddr}`);
}

main().catch(err => { console.error(err); process.exit(1); });
