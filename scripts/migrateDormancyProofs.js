const { ethers } = require("hardhat");

async function main() {
  // Get addresses from environment or deployment logs
  const DISTRIBUTOR_ADDRESS = process.env.REWARD_DISTRIBUTOR_ADDRESS;
  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS;

  if (!DISTRIBUTOR_ADDRESS || !REGISTRY_ADDRESS) {
    console.error("Error: Please set REWARD_DISTRIBUTOR_ADDRESS and REGISTRY_ADDRESS environment variables.");
    process.exit(1);
  }

  console.log(`Connecting to RewardDistributor at: ${DISTRIBUTOR_ADDRESS}`);
  console.log(`Connecting to LegacyClaimRegistry at: ${REGISTRY_ADDRESS}`);

  const RewardDistributor = await ethers.getContractAt("RewardDistributor", DISTRIBUTOR_ADDRESS);
  const LegacyClaimRegistry = await ethers.getContractAt("LegacyClaimRegistry", REGISTRY_ADDRESS);

  // Get current block to restrict queries
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Current block height: ${currentBlock}`);

  // Query events from RewardDistributor in chunks of 50,000 blocks
  // 1. DormancyProofProcessed(bytes32 indexed proofHash, ...)
  // 2. SP1DormancyProofProcessed(bytes32 indexed proofHash, ...)
  console.log("Querying historical processed proof events from RewardDistributor...");

  const START_BLOCK = 270600000; // Deployment was around 270686351
  const CHUNK_SIZE = 50000;

  async function getEventsInChunks(filter) {
    let allEvents = [];
    for (let from = START_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
      const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
      console.log(`  Querying blocks ${from} to ${to}...`);
      const events = await RewardDistributor.queryFilter(filter, from, to);
      allEvents = allEvents.concat(events);
    }
    return allEvents;
  }

  const filterDormancy = RewardDistributor.filters.DormancyProofProcessed();
  const eventsDormancy = await getEventsInChunks(filterDormancy);
  console.log(`Found ${eventsDormancy.length} total DormancyProofProcessed events.`);

  const filterSp1 = RewardDistributor.filters.SP1DormancyProofProcessed();
  const eventsSp1 = await getEventsInChunks(filterSp1);
  console.log(`Found ${eventsSp1.length} total SP1DormancyProofProcessed events.`);

  // Collect unique proof hashes
  const proofHashesSet = new Set();
  
  for (const event of eventsDormancy) {
    if (event.args && event.args.proofHash) {
      proofHashesSet.add(event.args.proofHash);
    }
  }

  for (const event of eventsSp1) {
    if (event.args && event.args.proofHash) {
      proofHashesSet.add(event.args.proofHash);
    }
  }

  const proofHashes = Array.from(proofHashesSet);
  console.log(`Collected ${proofHashes.length} unique proof hashes for migration.`);

  if (proofHashes.length === 0) {
    console.log("No proof hashes found to migrate. Exiting.");
    return;
  }

  // Filter out already consumed proofs in the new registry
  console.log("Checking which proof hashes are already consumed in LegacyClaimRegistry...");
  const proofHashesToMigrate = [];
  for (const hash of proofHashes) {
    const isConsumed = await LegacyClaimRegistry.consumedProofs(hash);
    if (!isConsumed) {
      proofHashesToMigrate.add ? proofHashesToMigrate.push(hash) : proofHashesToMigrate.push(hash);
    }
  }

  console.log(`${proofHashesToMigrate.length} proof hashes need to be migrated.`);

  if (proofHashesToMigrate.length === 0) {
    console.log("All collected proof hashes are already migrated/consumed. Exiting.");
    return;
  }

  // Submit to grandfatherProofs
  // Note: Caller must have TIMELOCK_ROLE in LegacyClaimRegistry
  console.log("Submitting grandfathering transaction to LegacyClaimRegistry...");
  const tx = await LegacyClaimRegistry.grandfatherProofs(proofHashesToMigrate);
  console.log(`Transaction submitted: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}. Migration complete!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
