const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
  const REWARD_DISTRIBUTOR  = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
  const CONTROLLER_ADDRESS = "0x7fC5c1266C77BF1Dfe5E7561805b7323C3CbD25F";
  const VERIFIER_ADDRESS = "0x4853F9E4c88e4F76c90Ee60FaDF12bc8475E1AAA";

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  const calldata1 = rd.interface.encodeFunctionData("authorizeStakingPool", [CONTROLLER_ADDRESS]);
  const calldata2 = rd.interface.encodeFunctionData("setSP1DormancyVerifier", [VERIFIER_ADDRESS]);

  const targets = [REWARD_DISTRIBUTOR, REWARD_DISTRIBUTOR];
  const values = [0n, 0n];
  const calldatas = [calldata1, calldata2];
  const description = "Authorize DormancyRewardController and set SP1DormancyVerifier (Phase 15 LACE)";

  console.log("1. Running staticCall...");
  try {
    const proposalId = await governance.propose.staticCall(targets, values, calldatas, description);
    console.log("Static call succeeded! proposalId:", proposalId.toString());
  } catch (e) {
    console.error("Static call failed:", e);
    return;
  }

  console.log("2. Running estimateGas...");
  try {
    const gas = await governance.propose.estimateGas(targets, values, calldatas, description);
    console.log("EstimateGas succeeded! Gas:", gas.toString());
  } catch (e) {
    console.error("EstimateGas failed:", e);
  }

  console.log("3. Sending transaction (propose)...");
  try {
    const tx = await governance.propose(targets, values, calldatas, description);
    console.log("Transaction sent! Hash:", tx.hash);
    console.log("Waiting for receipt...");
    const receipt = await tx.wait();
    console.log("Transaction mined! Gas used:", receipt.gasUsed.toString());
  } catch (e) {
    console.error("Transaction failed:", e);
  }
}

main().catch(console.error);
