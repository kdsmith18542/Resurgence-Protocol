/**
 * deploySpoke.js
 *
 * Deploys the spoke-chain contract set on any EVM target chain:
 *   - DeadCoinStakingPool implementation (logic contract)
 *   - StakingPoolManager (UUPS proxy)
 *   - CrossChainSender (sends reward claims to the Arbitrum hub via CCIP)
 *
 * Required env vars:
 *   PRIVATE_KEY                  - Deployer EOA
 *   TIMELOCK_ADDRESS             - Hub TimelockController address (governs spoke too)
 *   HUB_CHAIN_SELECTOR           - CCIP chain selector for Arbitrum hub
 *   HUB_RECEIVER_ADDRESS         - CrossChainReceiver address on Arbitrum hub
 *   CCIP_ROUTER_ADDRESS          - CCIP router on THIS spoke chain
 *   LINK_TOKEN_ADDRESS           - LINK token on THIS spoke chain
 *
 * Optional:
 *   MAX_LINK_FEE                 - Safety cap in wei (default 1e18 = 1 LINK)
 *   CCIP_GAS_LIMIT               - Execution gas on hub (default 200000)
 *
 * CCIP Router addresses (from plan.md):
 *   Polygon mainnet:  0x849c5ED5a80F5B408Dd4969b78c2C8fea3249B4f
 *   Amoy testnet:     0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2
 *   BSC mainnet:      0x34B03Cb9086d7D758AC55af71584F81A598759FE
 *   BSC testnet:      0xE1053aE1857476f36A3C62580FF9b016E8EE8F6f
 *   Base mainnet:     0x881e3A65B4d4a04dD529061dd0071cf975F58bCD
 *   Base Sepolia:     0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93
 *   Ethereum mainnet: 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D
 *   Sepolia:          0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
 *   Optimism:         0x3206695CaE29952f4b0c22a169725a865bc8Ce0F
 *   Optimism Sepolia: 0x114A20A10b43D4115e5aeef7345a1A71d2a60C57
 *   Avalanche:        0xF4c7E640EdA248ef95972845a62bdC74237805dB
 *   Avalanche Fuji:   0xF694E193200268f9a4868e4Aa017A0118C9a8177
 *
 * CCIP Hub chain selectors:
 *   Arbitrum One:     4949039107694359620
 *   Arbitrum Sepolia: 3478487238524512106
 *
 * Usage:
 *   npx hardhat run scripts/deploySpoke.js --network bscTestnet
 *   npx hardhat run scripts/deploySpoke.js --network amoy
 *   npx hardhat run scripts/deploySpoke.js --network baseSepolia
 */

const hre = require("hardhat");
const { upgrades } = require("hardhat");

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`\nDeploying Resurgence Protocol spoke on: ${network}`);
  console.log(`Deployer: ${deployer.address}\n`);

  const timelockAddress    = required("TIMELOCK_ADDRESS");
  const hubChainSelector   = BigInt(required("HUB_CHAIN_SELECTOR"));
  const hubReceiverAddress = required("HUB_RECEIVER_ADDRESS");
  const ccipRouter         = required("CCIP_ROUTER_ADDRESS");
  const linkToken          = required("LINK_TOKEN_ADDRESS");

  // 1. Deploy DeadCoinStakingPool implementation
  console.log("1. Deploying DeadCoinStakingPool implementation...");
  const DeadCoinStakingPool = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const stakingPoolImpl = await DeadCoinStakingPool.deploy();
  await stakingPoolImpl.waitForDeployment();
  console.log(`   Implementation: ${await stakingPoolImpl.getAddress()}`);
  console.log();

  // 2. Deploy StakingPoolManager (UUPS proxy)
  // Note: on spokes, StakingPoolManager does NOT hold a RewardDistributor reference.
  // Reward minting happens on the hub. We pass a zero address placeholder for rewardDistributor.
  // The spoke manager is governed by the hub Timelock via cross-chain governance (Phase 10.2+).
  // For Phase 10.0 simplicity, deployer temporarily holds TIMELOCK_ROLE for initial pool setup.
  console.log("2. Deploying StakingPoolManager (UUPS proxy)...");
  const StakingPoolManager = await hre.ethers.getContractFactory("StakingPoolManager");
  // Spoke manager uses a mock/zero reward distributor — pools on spokes don't mint locally.
  // The addStakingPool call on spokes should use a stub RewardDistributor that no-ops on authorizeStakingPool.
  // For now, deployer address is used as a stub; governance will wire properly via upgrade.
  const stakingPoolManager = await upgrades.deployProxy(StakingPoolManager, [
    hre.ethers.ZeroAddress,          // resurgenceToken — not needed on spoke
    deployer.address,                // rewardDistributorAddress — stub, no minting on spoke
    await stakingPoolImpl.getAddress(),
    timelockAddress,
  ], { kind: "uups" });
  await stakingPoolManager.waitForDeployment();
  console.log(`   StakingPoolManager proxy: ${await stakingPoolManager.getAddress()}`);
  console.log();

  // 3. Deploy CrossChainSender
  console.log("3. Deploying CrossChainSender...");
  const CrossChainSender = await hre.ethers.getContractFactory("CrossChainSender");
  const crossChainSender = await CrossChainSender.deploy(
    ccipRouter,
    linkToken,
    hubChainSelector,
    hubReceiverAddress,
    timelockAddress,
  );
  await crossChainSender.waitForDeployment();
  console.log(`   CrossChainSender: ${await crossChainSender.getAddress()}`);
  console.log();

  // 4. Renounce deployer's temporary roles
  console.log("4. Renouncing deployer roles...");
  const DEFAULT_ADMIN_ROLE = await stakingPoolManager.DEFAULT_ADMIN_ROLE();
  const TIMELOCK_ROLE = await stakingPoolManager.TIMELOCK_ROLE();
  await stakingPoolManager.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  await stakingPoolManager.renounceRole(TIMELOCK_ROLE, deployer.address);

  const senderDefaultAdmin = await crossChainSender.DEFAULT_ADMIN_ROLE();
  const senderTimelockRole = await crossChainSender.TIMELOCK_ROLE();
  await crossChainSender.renounceRole(senderDefaultAdmin, deployer.address);
  await crossChainSender.renounceRole(senderTimelockRole, deployer.address);
  console.log("   Done — timelock governs all spoke contracts");
  console.log();

  console.log("=== Spoke Deployment Complete ===");
  console.log(`Network:                  ${network}`);
  console.log(`DeadCoinStakingPool impl: ${await stakingPoolImpl.getAddress()}`);
  console.log(`StakingPoolManager:       ${await stakingPoolManager.getAddress()}`);
  console.log(`CrossChainSender:         ${await crossChainSender.getAddress()}`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Fund CrossChainSender with LINK for CCIP fees");
  console.log("  2. On hub: call CrossChainReceiver.setAuthorizedSource(thisChainSelector, abi.encode(CrossChainSender))");
  console.log("  3. Via governance on spoke: authorizeCaller(deadCoinPoolAddress) for each deployed pool");
  console.log("  4. Via governance on spoke: setCrossChainSender(CrossChainSender) on each DeadCoinStakingPool");
}

main().catch((err) => { console.error(err); process.exit(1); });
