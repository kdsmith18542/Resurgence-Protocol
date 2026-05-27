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

  console.log("Simulating proposal...");

  try {
    const proposalId = await governance.propose.staticCall(
      targets,
      values,
      calldatas,
      description
    );
    console.log("Static call succeeded! Proposal ID would be:", proposalId.toString());
  } catch (e) {
    console.log("REVERT ERROR:");
    console.log("Reason:", e.reason || "None");
    console.log("Short Message:", e.shortMessage || "None");
    console.log("Message:", e.message);
    if (e.data) console.log("Revert Data:", e.data);
  }
}

main().catch(console.error);
