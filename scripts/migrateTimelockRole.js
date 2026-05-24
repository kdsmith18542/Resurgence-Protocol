/**
 * migrateTimelockRole.js
 *
 * Governance proposal (via OLD governance + OLD timelock) to hand off
 * RewardDistributor TIMELOCK_ROLE and DEFAULT_ADMIN_ROLE from the old
 * timelock to the new v4 timelock.
 *
 * Why old governance: only the old timelock (0x65ddC4...) holds
 * DEFAULT_ADMIN_ROLE on RewardDistributor, and only the old governance
 * (0x2E3817...) has PROPOSER_ROLE on that timelock.
 *
 * Batch calls executed by old timelock → RewardDistributor:
 *   1. grantRole(TIMELOCK_ROLE,    NEW_TIMELOCK)
 *   2. revokeRole(TIMELOCK_ROLE,   OLD_TIMELOCK)
 *   3. grantRole(DEFAULT_ADMIN_ROLE, NEW_TIMELOCK)
 *   4. revokeRole(DEFAULT_ADMIN_ROLE, OLD_TIMELOCK)
 *
 * Optional env:
 *   PROPOSAL_ID          resume an existing proposal (skip propose step)
 *   STOP_AFTER_QUEUE     true → exit before execute (inspect ETA first)
 *   POLL_INTERVAL_MS     default: 15000
 *
 * Usage:
 *   npx hardhat run scripts/migrateTimelockRole.js --network arbitrumSepolia
 */

const hre = require("hardhat");

const OLD_GOVERNANCE  = "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228";
const OLD_TIMELOCK    = "0x65ddC4419c34cCe678a9A6D44E05666af2B1D869";
const NEW_TIMELOCK    = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
const DISTRIBUTOR     = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

const POLL_MS         = parseInt(process.env.POLL_INTERVAL_MS || "15000");
const STOP_AFTER_QUEUE = (process.env.STOP_AFTER_QUEUE || "false").toLowerCase() === "true";

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
const S = { Pending:0, Active:1, Canceled:2, Defeated:3, Succeeded:4, Queued:5, Expired:6, Executed:7 };

function log(msg) {
  console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pollUntil(label, fn, ms) {
  log(`Waiting: ${label}`);
  while (true) {
    const r = await fn();
    if (r != null) return r;
    await sleep(ms);
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  log(`Signer:       ${signer.address}`);
  log(`Old gov:      ${OLD_GOVERNANCE}`);
  log(`Old timelock: ${OLD_TIMELOCK}`);
  log(`New timelock: ${NEW_TIMELOCK}`);
  log(`Distributor:  ${DISTRIBUTOR}`);

  const governance   = await hre.ethers.getContractAt("ResurgenceGovernance", OLD_GOVERNANCE,  signer);
  const distributor  = await hre.ethers.getContractAt("RewardDistributor",    DISTRIBUTOR,     signer);

  // Check voting power
  const token    = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
  const clockNow = await token.clock();
  const votes    = await governance.getVotes(signer.address, clockNow - 1n).catch(() => 0n);
  const thresh   = await governance.proposalThreshold();
  log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)} RESURGE`);
  if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

  // Pre-flight: check current role state
  const TIMELOCK_ROLE     = await distributor.TIMELOCK_ROLE();
  const DEFAULT_ADMIN_ROLE = hre.ethers.ZeroHash;

  const oldHasTR  = await distributor.hasRole(TIMELOCK_ROLE,     OLD_TIMELOCK);
  const newHasTR  = await distributor.hasRole(TIMELOCK_ROLE,     NEW_TIMELOCK);
  const oldHasDA  = await distributor.hasRole(DEFAULT_ADMIN_ROLE, OLD_TIMELOCK);
  const newHasDA  = await distributor.hasRole(DEFAULT_ADMIN_ROLE, NEW_TIMELOCK);

  log(`RewardDistributor roles:`);
  log(`  TIMELOCK_ROLE    → old_tl:${oldHasTR}  new_tl:${newHasTR}`);
  log(`  DEFAULT_ADMIN    → old_tl:${oldHasDA}  new_tl:${newHasDA}`);

  if (newHasTR && newHasDA && !oldHasTR && !oldHasDA) {
    log("✅ Migration already complete — nothing to do.");
    return;
  }

  // Build batch calldata for the 4 role operations
  const iface = distributor.interface;

  const targets   = [DISTRIBUTOR, DISTRIBUTOR, DISTRIBUTOR, DISTRIBUTOR];
  const values    = [0n, 0n, 0n, 0n];
  const calldatas = [
    iface.encodeFunctionData("grantRole",  [TIMELOCK_ROLE,      NEW_TIMELOCK]),
    iface.encodeFunctionData("revokeRole", [TIMELOCK_ROLE,      OLD_TIMELOCK]),
    iface.encodeFunctionData("grantRole",  [DEFAULT_ADMIN_ROLE, NEW_TIMELOCK]),
    iface.encodeFunctionData("revokeRole", [DEFAULT_ADMIN_ROLE, OLD_TIMELOCK]),
  ];

  const description = [
    "# Migrate RewardDistributor TIMELOCK_ROLE to v4 timelock",
    "",
    "Transfers TIMELOCK_ROLE and DEFAULT_ADMIN_ROLE on RewardDistributor",
    "from the legacy timelock to the active v4 timelock, eliminating",
    "split-governance operational risk.",
    "",
    `RewardDistributor:  ${DISTRIBUTOR}`,
    `Old timelock (src): ${OLD_TIMELOCK}`,
    `New timelock (dst): ${NEW_TIMELOCK}`,
    "",
    "Calls (batch):",
    "  1. grantRole(TIMELOCK_ROLE, newTimelock)",
    "  2. revokeRole(TIMELOCK_ROLE, oldTimelock)",
    "  3. grantRole(DEFAULT_ADMIN_ROLE, newTimelock)",
    "  4. revokeRole(DEFAULT_ADMIN_ROLE, oldTimelock)",
  ].join("\n");
  const descHash = hre.ethers.id(description);

  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  if (!proposalId) {
    log("Proposing...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 800000 });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map(l => { try { return governance.interface.parseLog(l); } catch { return null; } })
      .find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated event not found in receipt");
    proposalId = ev.args[0];
    log(`Proposal ID: ${proposalId}  tx: ${receipt.hash}`);
  } else {
    log(`Resuming proposal: ${proposalId}`);
  }

  let state = Number(await governance.state(proposalId));
  log(`Initial state: ${STATE_NAMES[state]}`);

  if ([S.Canceled, S.Defeated, S.Expired].includes(state)) {
    throw new Error(`Proposal in terminal state: ${STATE_NAMES[state]}`);
  }

  if (state === S.Pending) {
    await pollUntil("Active", async () => {
      const s = Number(await governance.state(proposalId));
      log(`  state: ${STATE_NAMES[s]}`);
      if ([S.Canceled, S.Defeated, S.Expired].includes(s)) throw new Error(`Terminal: ${STATE_NAMES[s]}`);
      return s === S.Active ? true : null;
    }, POLL_MS);
    state = S.Active;
  }

  if (state === S.Active) {
    const alreadyVoted = await governance.hasVoted(proposalId, signer.address);
    if (alreadyVoted) {
      log("Vote already cast — skipping.");
    } else {
      log("Voting For...");
      const vtx = await governance.castVoteWithReason(proposalId, 1, "Migrate TIMELOCK_ROLE to v4 timelock");
      await vtx.wait();
      log(`Vote tx: ${vtx.hash}`);
    }

    await pollUntil("Succeeded", async () => {
      const s = Number(await governance.state(proposalId));
      log(`  state: ${STATE_NAMES[s]}`);
      if ([S.Canceled, S.Defeated, S.Expired].includes(s)) throw new Error(`Terminal: ${STATE_NAMES[s]}`);
      return s === S.Succeeded ? true : null;
    }, POLL_MS);
    state = S.Succeeded;
  }

  if (state === S.Succeeded) {
    log("Queueing...");
    const qtx = await governance.queue(targets, values, calldatas, descHash);
    const qrcpt = await qtx.wait();
    log(`Queued tx: ${qrcpt.hash}`);
    state = S.Queued;
  }

  if (state === S.Queued) {
    const eta = await governance.proposalEta(proposalId);
    log(`ETA unix: ${eta.toString()} (${new Date(Number(eta) * 1000).toISOString()})`);
    if (STOP_AFTER_QUEUE) {
      log("🛑 STOP_AFTER_QUEUE=true — exiting before execute.");
      return;
    }

    log("Executing...");
    while (true) {
      try {
        const tx = await governance.execute(targets, values, calldatas, descHash, { gasLimit: 500000 });
        await tx.wait();
        log(`Executed! tx: ${tx.hash}`);
        break;
      } catch (err) {
        const msg = err?.message || "";
        if (msg.includes("TimelockController") || msg.includes("too early") || msg.includes("revert")) {
          log(`  Not ready (${msg.slice(0, 80)}), retrying in ${POLL_MS / 1000}s...`);
          await sleep(POLL_MS);
        } else {
          throw err;
        }
      }
    }
  } else if (state === S.Executed) {
    log("Proposal already executed.");
  }

  // Verify final state
  const f_newTR = await distributor.hasRole(TIMELOCK_ROLE,      NEW_TIMELOCK);
  const f_oldTR = await distributor.hasRole(TIMELOCK_ROLE,      OLD_TIMELOCK);
  const f_newDA = await distributor.hasRole(DEFAULT_ADMIN_ROLE, NEW_TIMELOCK);
  const f_oldDA = await distributor.hasRole(DEFAULT_ADMIN_ROLE, OLD_TIMELOCK);

  log("Final role state on RewardDistributor:");
  log(`  TIMELOCK_ROLE    → old_tl:${f_oldTR}  new_tl:${f_newTR}`);
  log(`  DEFAULT_ADMIN    → old_tl:${f_oldDA}  new_tl:${f_newDA}`);

  const ok = f_newTR && f_newDA && !f_oldTR && !f_oldDA;
  if (ok) {
    log("✅ TIMELOCK_ROLE + DEFAULT_ADMIN_ROLE fully migrated to new timelock.");
  } else {
    log("⚠️  Role state unexpected — verify manually.");
  }
}

main().catch(err => { log(`❌ ${err.message}`); process.exit(1); });
