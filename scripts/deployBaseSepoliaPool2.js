/**
 * deployBaseSepoliaPool2.js
 *
 * Deploys a fresh DeadCoinStakingPool on Base Sepolia wired to the
 * new CrossChainSender (0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4).
 * Deployer keeps admin roles for testnet operations.
 *
 * Usage: npx hardhat run scripts/deployBaseSepoliaPool2.js --network baseSepolia
 */
const { upgrades } = require("hardhat");
const hre = require("hardhat");

const NEW_SENDER = "0xe88C50BB4CD06f0eF894903E43de9d44F2B90FD4";
const STUB_RESURGE_TOKEN = "0xB19BaeF4995A5DD6d50797928053789D20008B46"; // existing stub on Base Sepolia

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  log(`Deployer: ${deployer.address}`);
  log(`Network:  ${hre.network.name}`);
  log(`CrossChainSender: ${NEW_SENDER}`);

  // 1. Deploy mock dead coin
  log("1. Deploying mock dead coin (DEADTEST2)...");
  const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
  const deadCoin = await ERC20Mock.deploy("Dead Test Token 2", "DEADTEST2", 0);
  await deadCoin.waitForDeployment();
  const deadCoinAddr = await deadCoin.getAddress();
  log(`   DeadCoin: ${deadCoinAddr}`);

  // 2. Deploy DeadCoinStakingPool implementation
  log("2. Deploying DeadCoinStakingPool implementation...");
  const DCSP = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const impl = await DCSP.deploy();
  await impl.waitForDeployment();
  log(`   Impl: ${await impl.getAddress()}`);

  // 3. Deploy StakingPoolManager (UUPS proxy) with deployer as admin
  log("3. Deploying StakingPoolManager...");
  const SPM = await hre.ethers.getContractFactory("StakingPoolManager");
  const spm = await upgrades.deployProxy(SPM, [
    STUB_RESURGE_TOKEN,    // stub token
    deployer.address,      // rewardDistributor stub
    await impl.getAddress(),
    deployer.address,      // deployer as timelock — no renounce
  ], { kind: "uups" });
  await spm.waitForDeployment();
  const spmAddr = await spm.getAddress();
  log(`   StakingPoolManager: ${spmAddr}`);

  // 4. Deploy DeadCoinStakingPool proxy via SPM
  log("4. Deploying DeadCoinStakingPool proxy...");
  const TIMELOCK_ROLE = await spm.TIMELOCK_ROLE();
  const hasRole = await spm.hasRole(TIMELOCK_ROLE, deployer.address);
  log(`   Deployer TIMELOCK_ROLE on SPM: ${hasRole}`);

  const poolTx = await spm.deployPool(
    deadCoinAddr,
    NEW_SENDER,          // crossChainSender
    deployer.address,    // rewardDistributor stub (spoke → no local minting)
    0,                   // protocolFeeBps = 0 (spoke, fees handled on hub)
    hre.ethers.parseEther("1"),  // rewardRatePerSecond (1 RESURGE/sec for testing)
  );
  const receipt = await poolTx.wait();
  // Find the pool address from PoolDeployed event
  const ev = receipt.logs.map(l => { try { return spm.interface.parseLog(l); } catch {} }).find(e => e?.name === "PoolDeployed");
  if (!ev) throw new Error("PoolDeployed event not found");
  const poolAddr = ev.args.pool;
  log(`   Pool: ${poolAddr}`);

  // 5. Authorize pool as caller on CrossChainSender
  log("5. Authorizing pool as caller on CrossChainSender...");
  const sender = await hre.ethers.getContractAt("CrossChainSender", NEW_SENDER, deployer);
  const poolTlRole = await sender.TIMELOCK_ROLE();
  const senderHasRole = await sender.hasRole(poolTlRole, deployer.address);
  log(`   Deployer TIMELOCK_ROLE on sender: ${senderHasRole}`);
  await (await sender.authorizeCaller(poolAddr)).wait();
  log("   Pool authorized as caller on sender.");

  // 6. Wire pool to sender (setCrossChainSender)
  log("6. Wiring pool to CrossChainSender...");
  const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", poolAddr, deployer);
  await (await pool.setCrossChainSender(NEW_SENDER)).wait();
  const wiredSender = await pool.crossChainSender();
  log(`   Pool crossChainSender: ${wiredSender}`);

  log("\n=== Deployment Complete ===");
  log(`DeadCoin (DEADTEST2):  ${deadCoinAddr}`);
  log(`StakingPoolManager:    ${spmAddr}`);
  log(`DeadCoinStakingPool:   ${poolAddr}`);
  log(`CrossChainSender:      ${NEW_SENDER}`);
  log("\nE2E test command:");
  log(`DEAD_COIN_ADDRESS=${deadCoinAddr} POOL_PROXY_ADDRESS=${poolAddr} BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com npx hardhat run scripts/testBaseSepoliaE2E.js --network baseSepolia`);
}
main().catch(e => { log(`❌ ${e.message}`); process.exit(1); });
