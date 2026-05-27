const { ethers } = require("hardhat");

/**
 * Migration script to grandfather existing claim IDs into LegacyClaimRegistry.
 * 
 * This script queries historical DormancyProofProcessed and SP1DormancyProofProcessed
 * events from the RewardDistributor contract, computes the corresponding claim IDs,
 * and submits them to the LegacyClaimRegistry for grandfathering.
 * 
 * Usage:
 *   npx hardhat run scripts/migrateClaimIds.js --network arbitrumSepolia
 * 
 * Environment variables:
 *   DISTRIBUTOR_ADDRESS - RewardDistributor contract address
 *   REGISTRY_ADDRESS - LegacyClaimRegistry contract address
 */

async function main() {
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

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`Current block height: ${currentBlock}`);

  // Query historical events
  console.log("Querying historical processed proof events from RewardDistributor...");

  const filterDormancy = RewardDistributor.filters.DormancyProofProcessed();
  const eventsDormancy = await RewardDistributor.queryFilter(filterDormancy, 0, currentBlock);
  console.log(`Found ${eventsDormancy.length} DormancyProofProcessed events.`);

  const filterSp1 = RewardDistributor.filters.SP1DormancyProofProcessed();
  const eventsSp1 = await RewardDistributor.queryFilter(filterSp1, 0, currentBlock);
  console.log(`Found ${eventsSp1.length} SP1DormancyProofProcessed events.`);

  // Compute claim IDs from events
  // claim_id = keccak256(source_chain_id, source_address_hash, evm_wallet, claim_type, proof_hash, campaign_id)
  // For migration: claim_type = SignatureDormancyProof (4), campaign_id = 0 (genesis)
  const claimIdsSet = new Set();
  
  const CLAIM_TYPE_SIGNATURE_DORMANCY = 4; // SignatureDormancyProof enum value
  const GENESIS_CAMPAIGN_ID = 0;

  for (const event of eventsDormancy) {
    if (event.args) {
      const { proofHash, chainId, dormantWallet } = event.args;
      // source_address_hash = keccak256(abi.encodePacked(dormantWallet))
      const sourceAddressHash = ethers.keccak256(
        ethers.solidityPacked(["address"], [dormantWallet])
      );
      
      const claimId = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "bytes32", "address", "uint8", "bytes32", "uint256"],
          [chainId, sourceAddressHash, dormantWallet, CLAIM_TYPE_SIGNATURE_DORMANCY, proofHash, GENESIS_CAMPAIGN_ID]
        )
      );
      claimIdsSet.add(claimId);
    }
  }

  for (const event of eventsSp1) {
    if (event.args) {
      const { proofHash, chainId, walletAddress } = event.args;
      // For SP1 proofs, walletAddress is a string
      const sourceAddressHash = ethers.keccak256(
        ethers.solidityPacked(["string"], [walletAddress])
      );
      
      // Use ZeroAddress as placeholder for evm_wallet since SP1 proofs don't track it in the event
      const claimId = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "bytes32", "address", "uint8", "bytes32", "uint256"],
          [chainId, sourceAddressHash, ethers.ZeroAddress, CLAIM_TYPE_SIGNATURE_DORMANCY, proofHash, GENESIS_CAMPAIGN_ID]
        )
      );
      claimIdsSet.add(claimId);
    }
  }

  const claimIds = Array.from(claimIdsSet);
  console.log(`Computed ${claimIds.length} unique claim IDs for migration.`);

  if (claimIds.length === 0) {
    console.log("No claim IDs found to migrate. Exiting.");
    return;
  }

  // Filter out already consumed claims
  console.log("Checking which claim IDs are already consumed in LegacyClaimRegistry...");
  const claimIdsToMigrate = [];
  for (const claimId of claimIds) {
    const isConsumed = await LegacyClaimRegistry.consumedClaims(claimId);
    if (!isConsumed) {
      claimIdsToMigrate.push(claimId);
    }
  }

  console.log(`${claimIdsToMigrate.length} claim IDs need to be migrated.`);

  if (claimIdsToMigrate.length === 0) {
    console.log("All computed claim IDs are already migrated/consumed. Exiting.");
    return;
  }

  // Batch migration in chunks to avoid gas limits
  const BATCH_SIZE = 50;
  let migrated = 0;
  
  for (let i = 0; i < claimIdsToMigrate.length; i += BATCH_SIZE) {
    const batch = claimIdsToMigrate.slice(i, i + BATCH_SIZE);
    console.log(`Submitting batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} claims)...`);
    
    const tx = await LegacyClaimRegistry.grandfatherClaims(batch);
    const receipt = await tx.wait();
    migrated += batch.length;
    console.log(`Batch confirmed in block ${receipt.blockNumber}. Gas used: ${receipt.gasUsed.toString()}`);
  }

  console.log(`Migration complete! ${migrated} claim IDs grandfathered.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
