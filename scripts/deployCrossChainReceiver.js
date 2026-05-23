/**
 * deployCrossChainReceiver.js
 *
 * Deploys CrossChainReceiver on the Arbitrum hub and wires it into RewardDistributor.
 *
 * Required env vars:
 *   PRIVATE_KEY                      - Deployer EOA
 *   REWARD_DISTRIBUTOR_ADDRESS       - Hub RewardDistributor proxy address
 *   TIMELOCK_ADDRESS                 - Hub TimelockController address
 *   CCIP_ROUTER_ADDRESS              - CCIP router on Arbitrum (hub)
 *
 * Optional (set after spoke deployments):
 *   SPOKE_<CHAIN>_SELECTOR           - CCIP chain selector for each spoke
 *   SPOKE_<CHAIN>_SENDER             - CrossChainSender address on that spoke
 *
 * CCIP Arbitrum Hub Router addresses:
 *   Arbitrum One:    0x141fa059441E0ca23ce184B6A78bafD2A517DdE8
 *   Arbitrum Sepolia: 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165
 *
 * Usage:
 *   npx hardhat run scripts/deployCrossChainReceiver.js --network arbitrumSepolia
 *   npx hardhat run scripts/deployCrossChainReceiver.js --network arbitrum
 */

const hre = require("hardhat");

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

// Known CCIP chain selectors for authorizing spoke sources
const CCIP_CHAIN_SELECTORS = {
  // Testnets
  arbitrumSepolia:  3478487238524512106n,
  amoy:             16281711391670634445n,
  bscTestnet:       13264668187771770619n,
  baseSepolia:      10344971235874465080n,
  sepolia:          16015286601757825753n,
  optimismSepolia:  5224473277236331295n,
  avalancheFuji:    14767482510784806043n,
  // Mainnets
  arbitrum:         4949039107694359620n,
  polygon:          4051577828743386545n,
  bsc:              11344663589394136015n,
  base:             15971525489660198786n,
  mainnet:          5009297550715157269n,
  optimism:         3734403246176062136n,
  avalanche:        6433500567565415381n,
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`\nDeploying CrossChainReceiver on: ${network}`);
  console.log(`Deployer: ${deployer.address}\n`);

  const rewardDistributorAddress = required("REWARD_DISTRIBUTOR_ADDRESS");
  const timelockAddress          = required("TIMELOCK_ADDRESS");
  const ccipRouter               = required("CCIP_ROUTER_ADDRESS");

  // 1. Deploy CrossChainReceiver
  console.log("1. Deploying CrossChainReceiver...");
  const CrossChainReceiver = await hre.ethers.getContractFactory("CrossChainReceiver");
  const receiver = await CrossChainReceiver.deploy(
    ccipRouter,
    rewardDistributorAddress,
    timelockAddress,
  );
  await receiver.waitForDeployment();
  const receiverAddress = await receiver.getAddress();
  console.log(`   CrossChainReceiver: ${receiverAddress}`);
  console.log();

  // 2. Authorize CrossChainReceiver in RewardDistributor
  console.log("2. Authorizing CrossChainReceiver in RewardDistributor...");
  const RewardDistributor = await hre.ethers.getContractAt("RewardDistributor", rewardDistributorAddress);
  await RewardDistributor.authorizeBridge(receiverAddress);
  console.log("   Done");
  console.log();

  // 3. Wire any spoke sources passed via env vars
  const spokeEnvPrefix = "SPOKE_";
  const spokeEntries = Object.entries(process.env)
    .filter(([k]) => k.startsWith(spokeEnvPrefix) && k.endsWith("_SENDER"))
    .map(([k, senderAddress]) => {
      const chainName = k.slice(spokeEnvPrefix.length, -"_SENDER".length).toLowerCase();
      const chainSelector = CCIP_CHAIN_SELECTORS[chainName];
      return { chainName, chainSelector, senderAddress };
    })
    .filter(e => e.chainSelector !== undefined);

  if (spokeEntries.length > 0) {
    console.log("3. Authorizing spoke sources...");
    for (const { chainName, chainSelector, senderAddress } of spokeEntries) {
      const senderBytes = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [senderAddress]);
      await receiver.setAuthorizedSource(chainSelector, senderBytes);
      console.log(`   Authorized ${chainName} (${chainSelector}): ${senderAddress}`);
    }
    console.log();
  }

  // 4. Renounce deployer roles (timelock governs from here)
  console.log("4. Renouncing deployer roles...");
  const DEFAULT_ADMIN_ROLE = await receiver.DEFAULT_ADMIN_ROLE();
  const TIMELOCK_ROLE = await receiver.TIMELOCK_ROLE();
  await receiver.renounceRole(TIMELOCK_ROLE, deployer.address);
  await receiver.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
  console.log("   Done");
  console.log();

  console.log("=== CrossChainReceiver Deployment Complete ===");
  console.log(`Network:              ${network}`);
  console.log(`CrossChainReceiver:   ${receiverAddress}`);
  console.log(`RewardDistributor:    ${rewardDistributorAddress}`);
  console.log();
  console.log("Next steps:");
  console.log("  1. On each spoke: setAuthorizedSource call is done above if env vars set.");
  console.log("     Otherwise: receiver.setAuthorizedSource(spokeChainSelector, abi.encode(CrossChainSender))");
  console.log("  2. Fund CrossChainSenders on each spoke with LINK");
  console.log("  3. On each deployed DeadCoinStakingPool: setCrossChainSender(CrossChainSender)");
}

main().catch((err) => { console.error(err); process.exit(1); });
