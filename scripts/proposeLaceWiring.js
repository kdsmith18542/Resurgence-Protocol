const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B"; // Governor
const REWARD_DISTRIBUTOR  = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed"; // RewardDistributor Proxy

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  const proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  const CONTROLLER_ADDRESS = process.env.CONTROLLER_ADDRESS;
  const VERIFIER_ADDRESS = process.env.VERIFIER_ADDRESS;

  if (!CONTROLLER_ADDRESS || !VERIFIER_ADDRESS) {
    throw new Error("Must set CONTROLLER_ADDRESS and VERIFIER_ADDRESS env vars.");
  }

  log(`Signer: ${signer.address}  Step: ${step}`);
  log(`Controller: ${CONTROLLER_ADDRESS}`);
  log(`Verifier: ${VERIFIER_ADDRESS}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  // Encode both configuration steps
  const calldata1 = rd.interface.encodeFunctionData("authorizeStakingPool", [CONTROLLER_ADDRESS]);
  const calldata2 = rd.interface.encodeFunctionData("setSP1DormancyVerifier", [VERIFIER_ADDRESS]);

  const targets = [REWARD_DISTRIBUTOR, REWARD_DISTRIBUTOR];
  const values = [0n, 0n];
  const calldatas = [calldata1, calldata2];
  const description = "Authorize DormancyRewardController and set SP1DormancyVerifier (Phase 15 LACE)";
  const descHash = hre.ethers.id(description);

  if (step === 1) {
    const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
    const clock = await token.clock();
    const votes = await governance.getVotes(signer.address, clock - 1n).catch(() => 0n);
    const thresh = await governance.proposalThreshold();
    log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)}`);
    if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

    // Pre-checks
    const isPoolAuth = await rd.authorizedStakingPools(CONTROLLER_ADDRESS);
    const currentVerifier = await rd.sp1DormancyVerifier();
    if (isPoolAuth && currentVerifier === VERIFIER_ADDRESS) {
      log("BaaLS LACE Controller already authorized and verifier set — nothing to do");
      return;
    }

    log("Proposing authorizeStakingPool() + setSP1DormancyVerifier()...");
    const estimatedGas = await governance.propose.estimateGas(targets, values, calldatas, description).catch(e => {
      log(`Gas estimation failed: ${e.message}`);
      return 1000000n;
    });
    log(`Estimated gas: ${estimatedGas.toString()}`);
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: (estimatedGas * 12n) / 10n });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map(l => { try { return governance.interface.parseLog(l); } catch {} })
      .find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated event not found");
    log(`Proposal ID: ${ev.args[0]}`);
    log(`Tx: ${receipt.hash}`);
    log(`\nWait for Active (~2 blocks), then run:`);
    log(`  STEP=2 PROPOSAL_ID=${ev.args[0]} CONTROLLER_ADDRESS=${CONTROLLER_ADDRESS} VERIFIER_ADDRESS=${VERIFIER_ADDRESS} npx hardhat run scripts/proposeLaceWiring.js --network arbitrumSepolia`);

  } else if (step === 2) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]} (${s})`);
    if (s !== 1) { log("Not Active yet — wait and retry"); return; }
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (hasVoted) { log("Already voted — run STEP=3 after voting period ends (~50 blocks)"); return; }
    log("Casting vote For...");
    const tx = await governance.castVoteWithReason(proposalId, 1, "Authorize LACE controller and set verifier");
    const receipt = await tx.wait();
    log(`Vote tx: ${receipt.hash}`);
    log(`\nWait for Succeeded (~50 blocks), then run:`);
    log(`  STEP=3 PROPOSAL_ID=${proposalId} CONTROLLER_ADDRESS=${CONTROLLER_ADDRESS} VERIFIER_ADDRESS=${VERIFIER_ADDRESS} npx hardhat run scripts/proposeLaceWiring.js --network arbitrumSepolia`);

  } else if (step === 3) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]} (${s})`);

    if (s === 4) { // Succeeded → queue
      log("Queueing in timelock...");
      await (await governance.queue(targets, values, calldatas, descHash)).wait();
      log("Queued. Timelock delay: 3600s (1 hour). Come back in an hour to execute.");
      return;
    }
    if (s === 5) { // Queued → try execute
      log("Executing...");
      const tx = await governance.execute(targets, values, calldatas, descHash);
      const receipt = await tx.wait();
      log(`Executed! tx: ${receipt.hash}`);
      const isPoolAuth = await rd.authorizedStakingPools(CONTROLLER_ADDRESS);
      const currentVerifier = await rd.sp1DormancyVerifier();
      log(`Staking pool authorized: ${isPoolAuth}`);
      log(`SP1 Verifier: ${currentVerifier}`);
      if (isPoolAuth && currentVerifier === VERIFIER_ADDRESS) {
        log("✅ LACE contracts successfully wired to RewardDistributor!");
      }
      return;
    }
    if (s === 7) { log("Already executed."); return; }
    log(`State ${STATE_NAMES[s]} — not ready (need Succeeded=4 to queue, or Queued=5 to execute)`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
