const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const GOVERNANCE = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";

  const tl = await hre.ethers.getContractAt("ResurgenceTimelockController", TIMELOCK, signer);

  const ADMIN_ROLE = await tl.DEFAULT_ADMIN_ROLE();
  const PROPOSER_ROLE = await tl.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await tl.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await tl.CANCELLER_ROLE();

  console.log("=== Timelock Roles ===");
  console.log("Timelock:", TIMELOCK);
  console.log("Signer (Deployer EOA):", signer.address);
  console.log("Governance:", GOVERNANCE);

  console.log("\n--- Admin Role ---");
  console.log("  Timelock itself has Admin:", await tl.hasRole(ADMIN_ROLE, TIMELOCK));
  console.log("  Signer has Admin:", await tl.hasRole(ADMIN_ROLE, signer.address));
  console.log("  Governance has Admin:", await tl.hasRole(ADMIN_ROLE, GOVERNANCE));

  console.log("\n--- Proposer Role ---");
  console.log("  Signer has Proposer:", await tl.hasRole(PROPOSER_ROLE, signer.address));
  console.log("  Governance has Proposer:", await tl.hasRole(PROPOSER_ROLE, GOVERNANCE));

  console.log("\n--- Executor Role ---");
  console.log("  Signer has Executor:", await tl.hasRole(EXECUTOR_ROLE, signer.address));
  console.log("  Governance has Executor:", await tl.hasRole(EXECUTOR_ROLE, GOVERNANCE));
  console.log("  Address Zero has Executor (open execution):", await tl.hasRole(EXECUTOR_ROLE, hre.ethers.ZeroAddress));

  console.log("\n--- Canceller Role ---");
  console.log("  Signer has Canceller:", await tl.hasRole(CANCELLER_ROLE, signer.address));
  console.log("  Governance has Canceller:", await tl.hasRole(CANCELLER_ROLE, GOVERNANCE));
}

main().catch(console.error);
