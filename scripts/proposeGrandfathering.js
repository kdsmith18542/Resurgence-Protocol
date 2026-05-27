const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const REGISTRY_ADDRESS = "0xa7FacCdA878b7C25e445f239d44411E33dDf2D3F";

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

const PROOF_HASHES = [
  "0xe4d2e8ffcc23842a8dc44456624f4bf697d63d206e66f797acfc942ba4588a89",
  "0xd2a79a792d66b089af7e8d7b799a7765512357c0872bae18074ded1b792b1ef1",
  "0x5b3e501c4d0325059349ab0d664e33bebecbe466d801ad9d571b404b7cfe6b37",
  "0x360b1a5877cd618cd58eac6630ea81775c64df4b39117263ace12cc7fce6a6d2"
];

const CLAIM_IDS = [
  "0x1600449354667a1f938fbd7d678fc00aa877718bc997ba0983fe0ac3c0b0ca20",
  "0x49c2e906196eda9940d4341a3c98d8c7e197137b052e27e7bc172caf18538408",
  "0xdb312401ada50590f6e049ffb30fdb9ec3149de7501ed0a66e830ecaa4adf6ba",
  "0x3a3e602b6ae796ebb1e98825ab4857a2e5a409e4b118677760189e913f036505"
];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  const proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;

  log(`Signer: ${signer.address}  Step: ${step}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const registry = await hre.ethers.getContractAt("LegacyClaimRegistry", REGISTRY_ADDRESS, signer);

  // Encode both grandfathering actions
  const calldata1 = registry.interface.encodeFunctionData("grandfatherProofs", [PROOF_HASHES]);
  const calldata2 = registry.interface.encodeFunctionData("grandfatherClaims", [CLAIM_IDS]);

  const targets = [REGISTRY_ADDRESS, REGISTRY_ADDRESS];
  const values = [0n, 0n];
  const calldatas = [calldata1, calldata2];
  const description = "Grandfather legacy proof hashes and claim IDs into LegacyClaimRegistry (Phase 15 LACE)";
  const descHash = hre.ethers.id(description);

  if (step === 1) {
    const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
    const clock = await token.clock();
    const votes = await governance.getVotes(signer.address, clock - 1n).catch(() => 0n);
    const thresh = await governance.proposalThreshold();
    log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)}`);
    if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

    log("Proposing grandfathering of legacy proofs and claims...");
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
    log(`  STEP=2 PROPOSAL_ID=${ev.args[0]} npx hardhat run scripts/proposeGrandfathering.js --network arbitrumSepolia`);

  } else if (step === 2) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]} (${s})`);
    if (s !== 1) { log("Not Active yet — wait and retry"); return; }
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (hasVoted) { log("Already voted — run STEP=3 after voting period ends (~50 blocks)"); return; }
    log("Casting vote For...");
    const tx = await governance.castVoteWithReason(proposalId, 1, "Grandfather legacy proofs and claims");
    const receipt = await tx.wait();
    log(`Vote tx: ${receipt.hash}`);
    log(`\nWait for Succeeded (~50 blocks), then run:`);
    log(`  STEP=3 PROPOSAL_ID=${proposalId} npx hardhat run scripts/proposeGrandfathering.js --network arbitrumSepolia`);

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
      
      // Verify
      const p0 = await registry.consumedProofs(PROOF_HASHES[0]);
      const c0 = await registry.consumedClaims(CLAIM_IDS[0]);
      log(`Proof 0 consumed: ${p0}`);
      log(`Claim 0 consumed: ${c0}`);
      if (p0 && c0) {
        log("✅ Grandfathering successfully verified!");
      }
      return;
    }
    if (s === 7) { log("Already executed."); return; }
    log(`State ${STATE_NAMES[s]} — not ready (need Succeeded=4 to queue, or Queued=5 to execute)`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
