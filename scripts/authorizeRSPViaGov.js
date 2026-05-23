/**
 * authorizeRSPViaGov.js
 *
 * Governance proposal to authorize ResurgeStakingPool v3 in RewardDistributor.
 *
 * Run each step separately (set STEP env var):
 *   STEP=1 npx hardhat run scripts/authorizeRSPViaGov.js --network arbitrumSepolia   # propose
 *   STEP=2 PROPOSAL_ID=<id> npx hardhat run ... --network arbitrumSepolia             # vote
 *   STEP=3 PROPOSAL_ID=<id> npx hardhat run ... --network arbitrumSepolia             # queue+execute
 */

const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228";
const REWARD_DISTRIBUTOR  = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const RSP_ADDRESS         = "0xC4e5fC1207c74554837E7259a2F410E33567afAD";

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const step = parseInt(process.env.STEP || "1");
  const proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;

  log(`Signer: ${signer.address}  Step: ${step}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const rd = await hre.ethers.getContractAt("RewardDistributor", REWARD_DISTRIBUTOR, signer);

  const calldata = rd.interface.encodeFunctionData("authorizeStakingPool", [RSP_ADDRESS]);
  const targets  = [REWARD_DISTRIBUTOR];
  const values   = [0n];
  const calldatas = [calldata];
  const description = "Authorize ResurgeStakingPool v3 in RewardDistributor";
  const descHash = hre.ethers.id(description);

  if (step === 1) {
    const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
    const clock = await token.clock();
    const votes = await governance.getVotes(signer.address, clock - 1n).catch(() => 0n);
    const thresh = await governance.proposalThreshold();
    log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)}`);
    if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

    log("Proposing...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 500000 });
    const receipt = await tx.wait();
    const ev = receipt.logs.map(l => { try { return governance.interface.parseLog(l); } catch {} }).find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated not found");
    log(`Proposal ID: ${ev.args[0]}`);
    log(`Tx: ${receipt.hash}`);
    log("Wait for Active, then run: STEP=2 PROPOSAL_ID=<id> ...");

  } else if (step === 2) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]}`);
    if (s !== 1) { log("Not Active yet — wait and retry"); return; }
    const hasVoted = await governance.hasVoted(proposalId, signer.address);
    if (hasVoted) { log("Already voted — run STEP=3"); return; }
    log("Voting For...");
    const tx = await governance.castVoteWithReason(proposalId, 1, "Authorize RSP v3");
    await tx.wait();
    log(`Vote tx: ${tx.hash}`);
    log("Wait for Succeeded, then run: STEP=3 PROPOSAL_ID=<id> ...");

  } else if (step === 3) {
    if (!proposalId) throw new Error("Set PROPOSAL_ID env var");
    const s = Number(await governance.state(proposalId));
    log(`State: ${STATE_NAMES[s]}`);
    if (s === 4) { // Succeeded
      log("Queueing...");
      await (await governance.queue(targets, values, calldatas, descHash)).wait();
      log("Queued. Waiting for timelock...");
    }
    const s2 = Number(await governance.state(proposalId));
    if (s2 !== 5 && s2 !== 7) { log(`State is ${STATE_NAMES[s2]} — not ready to execute`); return; }
    if (s2 === 7) { log("Already executed."); return; }
    log("Executing...");
    const tx = await governance.execute(targets, values, calldatas, descHash);
    await tx.wait();
    log(`Executed! tx: ${tx.hash}`);
    const auth = await rd.authorizedStakingPools(RSP_ADDRESS);
    log(`authorizedStakingPools[RSP]: ${auth}`);
  }
}

main().catch(err => { log(`ERROR: ${err.message}`); process.exit(1); });
