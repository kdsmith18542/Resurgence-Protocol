const hre = require("hardhat");

const GOVERNANCE_ADDRESS = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const proposalId = 49477721417476312357250675654378457071214308422610873992703390734065637693576n;
  const newImplAddr = "0x1CAcC32F9D42842d581dD51627ed96513379bFBe";

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token(), signer);

  console.log("=== Automated Vote & Queue ===");
  console.log("Proposal ID:", proposalId.toString());

  // 1. Wait for Active state
  console.log("Waiting for proposal to become Active...");
  while (true) {
    const s = Number(await governance.state(proposalId));
    console.log(`Current state: ${STATE_NAMES[s]} (${s})`);
    if (s === 1) {
      break;
    }
    if (s > 1) {
      console.log("Proposal is already past Active state!");
      break;
    }
    await sleep(4000);
  }

  // 2. Cast vote if in Active state
  let s = Number(await governance.state(proposalId));
  if (s === 1) {
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (!hasVoted) {
      console.log("Casting vote FOR...");
      const tx = await governance.castVoteWithReason(proposalId, 1, "Upgrade RD to Phase 15 LACE");
      console.log("Vote tx sent:", tx.hash);
      await tx.wait();
      console.log("Vote cast successfully!");
    } else {
      console.log("Already voted.");
    }
  }

  // 3. Wait for Succeeded state (wait for blocks)
  console.log("Waiting for voting period to conclude (Succeeded)...");
  const deadline = await governance.proposalDeadline(proposalId);
  console.log("Voting deadline block:", deadline.toString());

  while (true) {
    const currentClock = await token.clock();
    console.log(`Current block: ${currentClock.toString()} / Deadline: ${deadline.toString()}`);
    if (currentClock > deadline) {
      break;
    }
    s = Number(await governance.state(proposalId));
    if (s === 4) {
      break; // Already succeeded
    }
    await sleep(5000);
  }

  // Double check state is Succeeded
  s = Number(await governance.state(proposalId));
  console.log(`Final voting state: ${STATE_NAMES[s]} (${s})`);

  if (s === 4) {
    console.log("Queueing proposal in timelock...");
    const proxy = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);
    const calldata = proxy.interface.encodeFunctionData("upgradeToAndCall", [newImplAddr, "0x"]);
    const targets = [REWARD_DISTRIBUTOR];
    const values = [0n];
    const calldatas = [calldata];
    const description = `Upgrade RewardDistributor to Phase 15 (LACE) impl at ${newImplAddr}`;
    const descHash = hre.ethers.id(description);

    const tx = await governance.queue(targets, values, calldatas, descHash);
    console.log("Queue tx sent:", tx.hash);
    await tx.wait();
    console.log("Proposal successfully QUEUED in timelock!");
    console.log("Timelock delay is 1 hour (3600 seconds).");
    console.log("\nTo execute this upgrade after 1 hour, run:");
    console.log(`  STEP=3 PROPOSAL_ID=${proposalId} NEW_IMPL=${newImplAddr} npx hardhat run scripts/upgradeRewardDistributor.js --network arbitrumSepolia`);
  } else {
    console.log(`Cannot queue. Proposal state is: ${STATE_NAMES[s]}`);
  }
}

main().catch(console.error);
