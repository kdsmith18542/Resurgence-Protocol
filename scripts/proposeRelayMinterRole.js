/**
 * proposeRelayMinterRole.js
 *
 * Governance proposal to grant RELAY_MINTER_ROLE on RewardDistributor to the
 * BaaLS EVMSubmitter address (0x201624cBa366250D08bCdA95e6eF64151687A447).
 *
 * Steps:
 *   STEP=1  npx hardhat run scripts/proposeRelayMinterRole.js --network arbitrumSepolia  # propose
 *   STEP=2  PROPOSAL_ID=<id> npx hardhat run ...  --network arbitrumSepolia              # vote
 *   STEP=3  PROPOSAL_ID=<id> npx hardhat run ...  --network arbitrumSepolia              # queue+execute
 */
const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B"; // v4
const REWARD_DISTRIBUTOR  = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const BAALS_EVM_SUBMITTER = "0x201624cBa366250D08bCdA95e6eF64151687A447";

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  const proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;

  log(`Signer: ${signer.address}  Step: ${step}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  const RELAY_MINTER_ROLE = hre.ethers.id("RELAY_MINTER_ROLE"); // keccak256("RELAY_MINTER_ROLE")
  log(`RELAY_MINTER_ROLE: ${RELAY_MINTER_ROLE}`);

  const calldata    = rd.interface.encodeFunctionData("grantRole", [RELAY_MINTER_ROLE, BAALS_EVM_SUBMITTER]);
  const targets     = [REWARD_DISTRIBUTOR];
  const values      = [0n];
  const calldatas   = [calldata];
  const description = "Grant RELAY_MINTER_ROLE to BaaLS EVMSubmitter (Phase 13 relay bridge)";
  const descHash    = hre.ethers.id(description);

  if (step === 1) {
    const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
    const clock = await token.clock();
    const votes = await governance.getVotes(signer.address, clock - 1n).catch(() => 0n);
    const thresh = await governance.proposalThreshold();
    log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)}`);
    if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

    // Pre-check: verify role doesn't already exist
    const hasRole = await rd.hasRole(RELAY_MINTER_ROLE, BAALS_EVM_SUBMITTER);
    if (hasRole) { log("BaaLS submitter already has RELAY_MINTER_ROLE — nothing to do"); return; }

    log("Proposing grantRole(RELAY_MINTER_ROLE, BaaLS)...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 500_000 });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map(l => { try { return governance.interface.parseLog(l); } catch {} })
      .find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated event not found");
    log(`Proposal ID: ${ev.args[0]}`);
    log(`Tx: ${receipt.hash}`);
    log(`\nWait for Active (~2 blocks), then run:`);
    log(`  STEP=2 PROPOSAL_ID=${ev.args[0]} npx hardhat run scripts/proposeRelayMinterRole.js --network arbitrumSepolia`);

  } else if (step === 2) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]} (${s})`);
    if (s !== 1) { log("Not Active yet — wait and retry"); return; }
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (hasVoted) { log("Already voted — run STEP=3 after voting period ends"); return; }
    log("Casting vote For...");
    const tx = await governance.castVoteWithReason(proposalId, 1, "Grant RELAY_MINTER_ROLE to BaaLS relay");
    const receipt = await tx.wait();
    log(`Vote tx: ${receipt.hash}`);
    log(`\nWait for Succeeded (~50 blocks), then run:`);
    log(`  STEP=3 PROPOSAL_ID=${proposalId} npx hardhat run scripts/proposeRelayMinterRole.js --network arbitrumSepolia`);

  } else if (step === 3) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]} (${s})`);

    if (s === 4) { // Succeeded → queue
      log("Queueing in timelock...");
      await (await governance.queue(targets, values, calldatas, descHash)).wait();
      log("Queued. Timelock delay: 3600s (1 hour). Come back in an hour for execute.");
      return;
    }
    if (s === 5) { // Queued → try execute
      log("Executing...");
      const tx = await governance.execute(targets, values, calldatas, descHash);
      const receipt = await tx.wait();
      log(`Executed! tx: ${receipt.hash}`);
      const hasRole = await rd.hasRole(hre.ethers.id("RELAY_MINTER_ROLE"), BAALS_EVM_SUBMITTER);
      log(`RELAY_MINTER_ROLE granted to BaaLS: ${hasRole}`);
      if (hasRole) log("✅ Phase 13.4 complete — BaaLS can now call mintForRelay");
      return;
    }
    if (s === 7) { log("Already executed."); return; }
    log(`State ${STATE_NAMES[s]} — not ready (need Succeeded=4 to queue, or Queued=5 to execute)`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
