const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

  console.log("Checking RewardDistributor at:", REWARD_DISTRIBUTOR);

  // Query implementation slot
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implRaw = await hre.ethers.provider.getStorage(REWARD_DISTRIBUTOR, implSlot);
  const implAddress = hre.ethers.getAddress(hre.ethers.dataSlice(implRaw, 12));
  console.log("Implementation Address (ERC-1967 slot):", implAddress);

  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  console.log("\nAttempting to query public state variables/functions:");
  
  try {
    const token = await rd.resurgenceToken();
    console.log("  resurgenceToken:", token);
  } catch (e) {
    console.log("  resurgenceToken query failed:", e.message);
  }

  try {
    const maxSupply = await rd.maxMintSupply();
    console.log("  maxMintSupply:", maxSupply.toString());
  } catch (e) {
    console.log("  maxMintSupply query failed:", e.message);
  }

  try {
    const verifier = await rd.sp1DormancyVerifier();
    console.log("  sp1DormancyVerifier:", verifier);
  } catch (e) {
    console.log("  sp1DormancyVerifier query failed:", e.message);
  }

  try {
    const sp1Reward = await rd.sp1RewardAmount();
    console.log("  sp1RewardAmount:", sp1Reward.toString());
  } catch (e) {
    console.log("  sp1RewardAmount query failed:", e.message);
  }

  try {
    const isPool = await rd.authorizedStakingPools("0x7fC5c1266C77BF1Dfe5E7561805b7323C3CbD25F");
    console.log("  authorizedStakingPools(0x7fC5c1266C77BF1Dfe5E7561805b7323C3CbD25F):", isPool);
  } catch (e) {
    console.log("  authorizedStakingPools query failed:", e.message);
  }
}

main().catch(console.error);
