const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
  const CONTROLLER_ADDRESS = "0x7fC5c1266C77BF1Dfe5E7561805b7323C3CbD25F";
  const VERIFIER_ADDRESS = "0x4853F9E4c88e4F76c90Ee60FaDF12bc8475E1AAA";
  const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const PROPOSAL_ID = 46846360571993993484613822599224421765116954802032087859303082758844643291359n;

  console.log("=== LACE Diagnostic ===");
  console.log("Signer:", signer.address);

  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);
  const tl = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK, signer);
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);

  // Check roles on RewardDistributor
  const TIMELOCK_ROLE = await rd.TIMELOCK_ROLE();
  const DEFAULT_ADMIN_ROLE = await rd.DEFAULT_ADMIN_ROLE();

  const tlHasTimelockRole = await rd.hasRole(TIMELOCK_ROLE, TIMELOCK);
  const tlHasAdminRole = await rd.hasRole(DEFAULT_ADMIN_ROLE, TIMELOCK);
  const signerHasTimelockRole = await rd.hasRole(TIMELOCK_ROLE, signer.address);
  const signerHasAdminRole = await rd.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  console.log("\n--- Roles on RewardDistributor ---");
  console.log(`Timelock (${TIMELOCK}) has TIMELOCK_ROLE:`, tlHasTimelockRole);
  console.log(`Timelock (${TIMELOCK}) has DEFAULT_ADMIN_ROLE:`, tlHasAdminRole);
  console.log(`Signer (${signer.address}) has TIMELOCK_ROLE:`, signerHasTimelockRole);
  console.log(`Signer (${signer.address}) has DEFAULT_ADMIN_ROLE:`, signerHasAdminRole);

  // Simulating calls directly to RewardDistributor from Signer
  console.log("\n--- Direct Call Dry Runs on RewardDistributor from Signer ---");
  try {
    await rd.authorizeStakingPool.staticCall(CONTROLLER_ADDRESS);
    console.log("Signer can authorize pool (staticCall succeeded!)");
  } catch (e) {
    console.log("Signer authorize pool failed:", e.message);
  }

  try {
    await rd.setSP1DormancyVerifier.staticCall(VERIFIER_ADDRESS);
    console.log("Signer can set verifier (staticCall succeeded!)");
  } catch (e) {
    console.log("Signer set verifier failed:", e.message);
  }

  // Check timelock operation hash
  console.log("\n--- Timelock Operation Status ---");
  const calldata1 = rd.interface.encodeFunctionData("authorizeStakingPool", [CONTROLLER_ADDRESS]);
  const calldata2 = rd.interface.encodeFunctionData("setSP1DormancyVerifier", [VERIFIER_ADDRESS]);

  const targets = [REWARD_DISTRIBUTOR, REWARD_DISTRIBUTOR];
  const values = [0n, 0n];
  const calldatas = [calldata1, calldata2];
  const description = "Authorize DormancyRewardController and set SP1DormancyVerifier (Phase 15 LACE)";
  const descHash = hre.ethers.id(description);

  // Reconstruct timelock operation ID/salt
  // Note: OpenZeppelin Governor queues operations in timelock using a specific salt.
  // In OZ GovernorTimelockControl:
  // salt = descriptionHash
  // predecessor = bytes32(0)
  const salt = descHash;
  const predecessor = hre.ethers.ZeroHash;

  const opId = await tl.hashOperationBatch(targets, values, calldatas, predecessor, salt);
  console.log("Computed Operation ID:", opId);

  const isPending = await tl.isOperationPending(opId);
  const isReady = await tl.isOperationReady(opId);
  const isDone = await tl.isOperationDone(opId);
  const isOp = await tl.isOperation(opId);

  console.log("isOperation:", isOp);
  console.log("isOperationPending:", isPending);
  console.log("isOperationReady:", isReady);
  console.log("isOperationDone:", isDone);
}

main().catch(console.error);
