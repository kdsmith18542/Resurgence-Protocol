/**
 * grantDormancyOracle.js
 *
 * Governance proposal to grant DORMANCY_ORACLE_ROLE on RewardDistributor
 * to the ChronoNode operator address. This allows ChronoNode to call
 * submitDormancyProof() and trigger RESURGE minting for dormant-address stakers.
 *
 * Required env vars:
 *   GOVERNANCE_ADDRESS          - ResurgenceGovernance proxy
 *   REWARD_DISTRIBUTOR_ADDRESS  - RewardDistributor proxy
 *   TIMELOCK_ADDRESS            - TimelockController
 *   ORACLE_ADDRESS              - ChronoNode operator address to grant role to
 *
 * Optional:
 *   PROPOSAL_ID                 - Resume from existing proposal (skip propose step)
 *   POLL_INTERVAL_MS            - Poll interval in ms (default: 30000)
 *
 * Usage:
 *   npx hardhat run scripts/grantDormancyOracle.js --network arbitrumSepolia
 */

const hre = require("hardhat");

const GOVERNANCE_ADDRESS        = process.env.GOVERNANCE_ADDRESS        || "0x7E38270a3077F1652D4bBdA5f0D5d2C986Ab00c3";
const REWARD_DISTRIBUTOR_ADDRESS= process.env.REWARD_DISTRIBUTOR_ADDRESS|| "0x9769038aCbD727C41cF29102BB012Ee735BD2cdd";
const TIMELOCK_ADDRESS          = process.env.TIMELOCK_ADDRESS          || "0x9e0141B004Cc140EC9C3243c75cF0029152E95e5";
// ChronoNode operator address derived from private key 76cf1b0bff9468e5d60b78b4f341dd1934868447975e4af057781dea14a01c04
const ORACLE_ADDRESS            = process.env.ORACLE_ADDRESS            || "0x201624cBa366250D08bCdA95e6eF64151687A447";
const POLL_MS                   = parseInt(process.env.POLL_INTERVAL_MS || "30000");

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
const STATE = { Pending:0, Active:1, Canceled:2, Defeated:3, Succeeded:4, Queued:5, Expired:6, Executed:7 };

function log(msg) {
  const ts = new Date().toISOString().replace("T"," ").slice(0,19);
  console.log(`[${ts}] ${msg}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function pollUntil(label, checkFn, intervalMs) {
  log(`Waiting for: ${label} (polling every ${intervalMs/1000}s)`);
  while (true) {
    const result = await checkFn();
    if (result) return result;
    await sleep(intervalMs);
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  log(`Signer:              ${signer.address}`);
  log(`Network:             ${hre.network.name}`);
  log(`Governance:          ${GOVERNANCE_ADDRESS}`);
  log(`RewardDistributor:   ${REWARD_DISTRIBUTOR_ADDRESS}`);
  log(`Timelock:            ${TIMELOCK_ADDRESS}`);
  log(`Oracle (ChronoNode): ${ORACLE_ADDRESS}`);
  log("");

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const distributor = await hre.ethers.getContractAt("RewardDistributor",   REWARD_DISTRIBUTOR_ADDRESS, signer);

  // Verify voting power
  const token    = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
  const clockNow = await token.clock();
  const votes    = await governance.getVotes(signer.address, clockNow - 1n).catch(() => 0n);
  const threshold= await governance.proposalThreshold();
  log(`Token clock() = ${clockNow} (L1 block)`);
  log(`Voting power:       ${hre.ethers.formatEther(votes)} RESURGE`);
  log(`Proposal threshold: ${hre.ethers.formatEther(threshold)} RESURGE`);
  if (BigInt(votes) < BigInt(threshold)) {
    throw new Error("Insufficient voting power — delegate RESURGE first.");
  }
  log("");

  // Verify oracle doesn't already have the role
  const DORMANCY_ORACLE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DORMANCY_ORACLE_ROLE"));
  log(`DORMANCY_ORACLE_ROLE: ${DORMANCY_ORACLE_ROLE}`);
  const alreadyGranted = await distributor.hasRole(DORMANCY_ORACLE_ROLE, ORACLE_ADDRESS);
  if (alreadyGranted) {
    log(`✅ ${ORACLE_ADDRESS} already has DORMANCY_ORACLE_ROLE — nothing to do.`);
    return;
  }
  log(`Role not yet granted. Proceeding with governance proposal.`);
  log("");

  // Build calldata: AccessControl.grantRole(DORMANCY_ORACLE_ROLE, oracle)
  const grantCalldata = distributor.interface.encodeFunctionData("grantRole", [
    DORMANCY_ORACLE_ROLE,
    ORACLE_ADDRESS,
  ]);
  const targets     = [REWARD_DISTRIBUTOR_ADDRESS];
  const values      = [0n];
  const calldatas   = [grantCalldata];
  const description = [
    "# Grant DORMANCY_ORACLE_ROLE to ChronoNode Operator",
    "",
    `Grant \`DORMANCY_ORACLE_ROLE\` on RewardDistributor to ChronoNode oracle:`,
    `\`${ORACLE_ADDRESS}\``,
    "",
    "ChronoNode monitors dormant BTC/DOGE/ETH addresses and submits signed",
    "DormancyProofs on-chain. This role allows it to call submitDormancyProof()",
    "which triggers RESURGE minting for eligible stakers.",
    "",
    `RewardDistributor: \`${REWARD_DISTRIBUTOR_ADDRESS}\``,
  ].join("\n");
  const descHash = hre.ethers.id(description);

  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  if (proposalId) {
    log(`Resuming with existing proposal ID: ${proposalId}`);
    log("");
  } else {
    log("Submitting governance proposal...");
    const tx = await governance.propose(targets, values, calldatas, description);
    const receipt = await tx.wait();
    log(`Proposal tx: ${receipt.hash}`);
    const createdLog = receipt.logs.find(l => {
      try { return governance.interface.parseLog(l)?.name === "ProposalCreated"; } catch { return false; }
    });
    if (!createdLog) throw new Error("ProposalCreated event not found");
    proposalId = governance.interface.parseLog(createdLog).args[0];
    log(`Proposal ID: ${proposalId}`);
    log("");
  }

  // Wait for Active
  await pollUntil("proposal Active (voting delay passed)", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    return state === STATE.Active ? true : null;
  }, POLL_MS);

  log("Casting vote For (support=1)...");
  const voteTx = await governance.castVoteWithReason(proposalId, 1, "Grant ChronoNode oracle role");
  await voteTx.wait();
  log(`Vote cast. Tx: ${voteTx.hash}`);
  log("");

  // Wait for Succeeded
  await pollUntil("proposal Succeeded (voting period passed)", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    if (state === STATE.Defeated) throw new Error("Proposal was defeated");
    if (state === STATE.Canceled) throw new Error("Proposal was cancelled");
    return state === STATE.Succeeded ? true : null;
  }, POLL_MS);

  log("Queueing in Timelock...");
  const queueTx = await governance.queue(targets, values, calldatas, descHash);
  await queueTx.wait();
  log(`Queued. Tx: ${queueTx.hash}`);
  log("");

  // Wait for Timelock delay, then execute
  await pollUntil("Timelock delay expired", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    if (state === STATE.Queued) return "attempt";
    if (state === STATE.Executed) return "already_executed";
    return null;
  }, POLL_MS);

  log("Executing proposal...");
  while (true) {
    try {
      const executeTx = await governance.execute(targets, values, calldatas, descHash);
      await executeTx.wait();
      log(`Executed! Tx: ${executeTx.hash}`);
      break;
    } catch (err) {
      if (err.message?.includes("TimelockController") || err.message?.includes("too early") ||
          err.message?.includes("revert")) {
        log(`  Not ready (${err.message.slice(0, 80)}), retrying in ${POLL_MS/1000}s...`);
        await sleep(POLL_MS);
      } else {
        throw err;
      }
    }
  }
  log("");

  // Verify
  const granted = await distributor.hasRole(DORMANCY_ORACLE_ROLE, ORACLE_ADDRESS);
  if (!granted) throw new Error("Role grant failed — check execution");
  log(`✅ DORMANCY_ORACLE_ROLE granted to ChronoNode operator: ${ORACLE_ADDRESS}`);
  log("");
  log("=== ChronoNode integration complete ===");
  log(`Oracle address:     ${ORACLE_ADDRESS}`);
  log(`RewardDistributor:  ${REWARD_DISTRIBUTOR_ADDRESS}`);
  log(`Next step: configure ChronoNode with private key for this operator address`);
  log(`           and set evm_contract_address = ${REWARD_DISTRIBUTOR_ADDRESS}`);
}

main().catch(err => {
  log(`\n❌ FAILED: ${err.message}`);
  console.error(err);
  process.exit(1);
});
