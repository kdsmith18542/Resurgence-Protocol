const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
  const REGISTRY_ADDRESS = "0xa7FacCdA878b7C25e445f239d44411E33dDf2D3F";

  const RewardDistributor = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);
  const LegacyClaimRegistry = await hre.ethers.getContractAt("LegacyClaimRegistry", REGISTRY_ADDRESS, signer);

  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const START_BLOCK = 270600000;
  const CHUNK_SIZE = 50000;

  async function getEventsInChunks(filter) {
    let allEvents = [];
    for (let from = START_BLOCK; from <= currentBlock; from += CHUNK_SIZE) {
      const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
      const events = await RewardDistributor.queryFilter(filter, from, to);
      allEvents = allEvents.concat(events);
    }
    return allEvents;
  }

  console.log("Querying events...");
  const filterDormancy = RewardDistributor.filters.DormancyProofProcessed();
  const eventsDormancy = await getEventsInChunks(filterDormancy);
  console.log(`Found ${eventsDormancy.length} DormancyProofProcessed events.`);

  const filterSp1 = RewardDistributor.filters.SP1DormancyProofProcessed();
  const eventsSp1 = await getEventsInChunks(filterSp1);
  console.log(`Found ${eventsSp1.length} SP1DormancyProofProcessed events.`);

  // Collect unique proof hashes
  const proofHashesSet = new Set();
  for (const event of eventsDormancy) {
    if (event.args && event.args.proofHash) proofHashesSet.add(event.args.proofHash);
  }
  for (const event of eventsSp1) {
    if (event.args && event.args.proofHash) proofHashesSet.add(event.args.proofHash);
  }
  const proofHashes = Array.from(proofHashesSet);
  console.log("\nProof Hashes:");
  console.log(proofHashes);

  // Compute claim IDs
  const claimIdsSet = new Set();
  const CLAIM_TYPE_SIGNATURE_DORMANCY = 4;
  const GENESIS_CAMPAIGN_ID = 0;

  for (const event of eventsDormancy) {
    if (event.args) {
      const { proofHash, chainId, dormantWallet } = event.args;
      const sourceAddressHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["address"], [dormantWallet])
      );
      const claimId = hre.ethers.keccak256(
        hre.ethers.solidityPacked(
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
      const sourceAddressHash = hre.ethers.keccak256(
        hre.ethers.solidityPacked(["string"], [walletAddress])
      );
      const claimId = hre.ethers.keccak256(
        hre.ethers.solidityPacked(
          ["bytes32", "bytes32", "address", "uint8", "bytes32", "uint256"],
          [chainId, sourceAddressHash, hre.ethers.ZeroAddress, CLAIM_TYPE_SIGNATURE_DORMANCY, proofHash, GENESIS_CAMPAIGN_ID]
        )
      );
      claimIdsSet.add(claimId);
    }
  }
  const claimIds = Array.from(claimIdsSet);
  console.log("\nComputed Claim IDs:");
  console.log(claimIds);
}

main().catch(console.error);
