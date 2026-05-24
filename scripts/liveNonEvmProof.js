/**
 * liveNonEvmProof.js — Register a BTC wallet and submit a live dormancy proof
 * against the deployed NonEvmStakingPool + RewardDistributor on Arbitrum Sepolia.
 *
 * Required env vars:
 *   NON_EVM_POOL_ADDRESS  — deployed NonEvmStakingPool proxy address
 *   ORACLE_PRIVATE_KEY    — private key of address holding DORMANCY_ORACLE_ROLE
 *                           (BaaLS EVMSubmitter key = BAALS_EVM_PRIVATE_KEY from baalsd.service)
 *
 * Optional:
 *   STAKER_ADDRESS        — EVM address to receive RESURGE (defaults to deployer wallet)
 *   BTC_WALLET            — BTC address to register (defaults to genesis block address)
 *
 * Usage:
 *   NON_EVM_POOL_ADDRESS=0x... ORACLE_PRIVATE_KEY=0x... \
 *     npx hardhat run scripts/liveNonEvmProof.js --network arbitrumSepolia
 */
const hre = require("hardhat");

const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const CHAIN_BTC = hre.ethers.id("bitcoin").slice(0, 66); // keccak256("bitcoin") as bytes32

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const poolAddr = process.env.NON_EVM_POOL_ADDRESS;
  if (!poolAddr) throw new Error("NON_EVM_POOL_ADDRESS env var required");

  const oracleKey = process.env.ORACLE_PRIVATE_KEY;
  if (!oracleKey) throw new Error("ORACLE_PRIVATE_KEY env var required");

  const oracle = new hre.ethers.Wallet(
    oracleKey.startsWith("0x") ? oracleKey : "0x" + oracleKey,
    hre.ethers.provider
  );

  const stakerAddr = process.env.STAKER_ADDRESS || deployer.address;
  const btcWallet = process.env.BTC_WALLET || "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

  console.log("Network:            ", hre.network.name);
  console.log("NonEvmStakingPool:  ", poolAddr);
  console.log("RewardDistributor:  ", REWARD_DISTRIBUTOR);
  console.log("Oracle address:     ", oracle.address);
  console.log("Staker (registrant):", stakerAddr);
  console.log("BTC wallet:         ", btcWallet);
  console.log("");

  const pool = await hre.ethers.getContractAt("NonEvmStakingPool", poolAddr, deployer);
  const distributor = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, oracle);

  // Verify oracle has DORMANCY_ORACLE_ROLE
  const DORMANCY_ORACLE_ROLE = await distributor.DORMANCY_ORACLE_ROLE();
  const hasRole = await distributor.hasRole(DORMANCY_ORACLE_ROLE, oracle.address);
  if (!hasRole) throw new Error(`Oracle ${oracle.address} does not have DORMANCY_ORACLE_ROLE on RewardDistributor`);
  console.log("✅ DORMANCY_ORACLE_ROLE confirmed on oracle");

  // Check nonEvmRewardAmount
  const rewardAmt = await distributor.nonEvmRewardAmount();
  console.log("nonEvmRewardAmount: ", hre.ethers.formatEther(rewardAmt), "RESURGE");
  if (rewardAmt === 0n) throw new Error("nonEvmRewardAmount is 0 — set it via governance first");
  console.log("");

  // 1. Register BTC wallet → staker's EVM address
  const btcBytes32 = hre.ethers.id("bitcoin");
  const existing = await pool.getStaker(btcBytes32, btcWallet);
  if (existing !== hre.ethers.ZeroAddress) {
    console.log(`BTC wallet already registered to: ${existing}`);
    if (existing.toLowerCase() !== stakerAddr.toLowerCase()) {
      console.log("WARNING: registered staker differs from STAKER_ADDRESS, using registered staker");
    }
  } else {
    console.log("Registering BTC wallet...");
    // Registration tx must come from the staker's address
    const stakerWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, hre.ethers.provider);
    const tx = await pool.connect(stakerWallet).registerWallet(btcBytes32, btcWallet);
    const receipt = await tx.wait();
    console.log("Registered. Tx:", receipt.hash);
  }

  const resolvedStaker = await pool.getStaker(btcBytes32, btcWallet);
  console.log("Resolved staker:", resolvedStaker);
  console.log("");

  // Check RESURGE balance before
  const resurgeToken = await hre.ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    await distributor.resurgenceToken()
  );
  const balBefore = await resurgeToken.balanceOf(resolvedStaker);
  console.log("RESURGE balance before:", hre.ethers.formatEther(balBefore));

  // 2. Submit dormancy proof via oracle
  console.log("Submitting dormancy proof via oracle...");
  const tx = await distributor.connect(oracle).submitDormancyProof(
    btcBytes32,        // chainType
    resolvedStaker,    // staker EVM address
    800000,            // dormantSinceBlock (BTC block — example)
    890000,            // currentBlock (BTC block — example)
    90000,             // thresholdBlocks (dormancy threshold)
    hre.ethers.ZeroHash, // signerPubkey (no ed25519 verification yet)
    "0x"               // signature (no ed25519 verification yet)
  );
  const receipt = await tx.wait();
  console.log("Proof submitted. Tx:", receipt.hash);
  console.log("");

  const balAfter = await resurgeToken.balanceOf(resolvedStaker);
  console.log("RESURGE balance after:  ", hre.ethers.formatEther(balAfter));
  console.log("RESURGE minted:         ", hre.ethers.formatEther(balAfter - balBefore));

  if (balAfter > balBefore) {
    console.log("\n✅ Live non-EVM proof submission PASSED");
    console.log(`   ${hre.ethers.formatEther(balAfter - balBefore)} RESURGE minted to ${resolvedStaker}`);
  } else {
    console.log("\n❌ No RESURGE minted — check RewardDistributor state");
  }

  // 3. Verify replay protection
  console.log("\nTesting replay protection...");
  try {
    await distributor.connect(oracle).submitDormancyProof(
      btcBytes32, resolvedStaker, 800000, 890000, 90000, hre.ethers.ZeroHash, "0x"
    );
    console.log("❌ Replay NOT rejected — replay protection broken!");
  } catch (e) {
    console.log("✅ Replay rejected:", e.shortMessage || e.reason || e.message.slice(0, 80));
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
