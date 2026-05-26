/**
 * upgradeRewardDistributor.js
 *
 * Deploys a new RewardDistributor implementation (Phase 13: mintForRelay + RELAY_MINTER_ROLE)
 * and proposes a UUPS upgrade via governance.
 *
 * Steps:
 *   STEP=1  npx hardhat run scripts/upgradeRewardDistributor.js --network arbitrumSepolia  # deploy impl + propose
 *   STEP=2  PROPOSAL_ID=<id> npx hardhat run ...                                           # vote
 *   STEP=3  PROPOSAL_ID=<id> npx hardhat run ...                                           # queue+execute
 */
const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B"; // v4
const REWARD_DISTRIBUTOR  = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed"; // proxy

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  const proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  const newImplAddr = process.env.NEW_IMPL;

  log(`Signer: ${signer.address}  Step: ${step}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const proxy = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  if (step === 1) {
    // 1a. Deploy new implementation
    log("Deploying new RewardDistributor implementation...");
    const RD = await hre.ethers.getContractFactory("RewardDistributor");
    const impl = await RD.deploy();
    await impl.waitForDeployment();
    const implAddr = await impl.getAddress();
    log(`New implementation: ${implAddr}`);

    // 1b. Encode upgradeToAndCall(newImpl, "") calldata on the proxy
    const calldata  = proxy.interface.encodeFunctionData("upgradeToAndCall", [implAddr, "0x"]);
    const targets   = [REWARD_DISTRIBUTOR];
    const values    = [0n];
    const calldatas = [calldata];
    const description = `Upgrade RewardDistributor to Phase 13 impl (mintForRelay) at ${implAddr}`;
    const descHash  = hre.ethers.id(description);

    // 1c. Check voting power
    const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
    const clock = await token.clock();
    const votes = await governance.getVotes(signer.address, clock - 1n).catch(() => 0n);
    const thresh = await governance.proposalThreshold();
    log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)}`);
    if (votes < thresh) throw new Error("Insufficient votes");

    log("Proposing upgrade...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 500_000 });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map(l => { try { return governance.interface.parseLog(l); } catch {} })
      .find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated not found");
    log(`Proposal ID: ${ev.args[0]}`);
    log(`Tx: ${receipt.hash}`);
    log(`\nRun next (set NEW_IMPL for step 3):`);
    log(`  STEP=2 PROPOSAL_ID=${ev.args[0]} NEW_IMPL=${implAddr} npx hardhat run scripts/upgradeRewardDistributor.js --network arbitrumSepolia`);

  } else if (step === 2) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]}`);
    if (s !== 1) { log("Not Active — wait and retry"); return; }
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (hasVoted) { log("Already voted — run STEP=3"); return; }
    log("Voting For...");
    await (await governance.castVoteWithReason(proposalId, 1, "Upgrade RD to Phase 13")).wait();
    log(`\nRun next:\n  STEP=3 PROPOSAL_ID=${proposalId} NEW_IMPL=${newImplAddr} npx hardhat run scripts/upgradeRewardDistributor.js --network arbitrumSepolia`);

  } else if (step === 3) {
    if (!proposalId || !newImplAddr) throw new Error("Set PROPOSAL_ID and NEW_IMPL");
    const calldata  = proxy.interface.encodeFunctionData("upgradeToAndCall", [newImplAddr, "0x"]);
    const targets   = [REWARD_DISTRIBUTOR];
    const values    = [0n];
    const calldatas = [calldata];
    const description = `Upgrade RewardDistributor to Phase 13 impl (mintForRelay) at ${newImplAddr}`;
    const descHash  = hre.ethers.id(description);

    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]}`);

    if (s === 4) {
      log("Queueing...");
      await (await governance.queue(targets, values, calldatas, descHash)).wait();
      log("Queued. Timelock: 3600s. Return in 1 hour to execute.");
      return;
    }
    if (s === 5) {
      log("Executing upgrade...");
      const tx = await governance.execute(targets, values, calldatas, descHash);
      const receipt = await tx.wait();
      log(`Executed! tx: ${receipt.hash}`);

      // Verify
      const upgraded = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);
      const role = await upgraded.RELAY_MINTER_ROLE();
      log(`RELAY_MINTER_ROLE constant: ${role}`);
      log("✅ RewardDistributor upgraded to Phase 13 — mintForRelay is live");
      return;
    }
    if (s === 7) { log("Already executed."); return; }
    log(`State ${STATE_NAMES[s]} — not ready`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
