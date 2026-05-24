/**
 * setNonEvmRewardViaGov.js
 *
 * Governance proposal to set RewardDistributor.nonEvmRewardAmount on hub.
 *
 * Required:
 *   PRIVATE_KEY in .env (governance voter/proposer)
 *
 * Optional env:
 *   NEW_AMOUNT             amount in wei (default: 1000e18)
 *   PROPOSAL_ID            resume existing proposal
 *   STOP_AFTER_QUEUE       true/false (default: false)
 *   POLL_INTERVAL_MS       default: 10000
 *
 * Usage:
 *   NEW_AMOUNT=1000000000000000000000 STOP_AFTER_QUEUE=true \
 *   npx hardhat run scripts/setNonEvmRewardViaGov.js --network arbitrumSepolia
 */

const hre = require("hardhat");

const GOVERNANCE_ADDRESS = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const DISTRIBUTOR_ADDRESS = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS || "10000");
const STOP_AFTER_QUEUE = (process.env.STOP_AFTER_QUEUE || "false").toLowerCase() === "true";
const NEW_AMOUNT = BigInt(process.env.NEW_AMOUNT || "1000000000000000000000"); // 1000e18

const STATE_NAMES = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
const S = { Pending: 0, Active: 1, Canceled: 2, Defeated: 3, Succeeded: 4, Queued: 5, Expired: 6, Executed: 7 };

function log(msg) {
  console.log(`[${new Date().toISOString().slice(0, 19).replace("T", " ")}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntil(label, fn, ms) {
  log(`Waiting: ${label}`);
  while (true) {
    const r = await fn();
    if (r != null) return r;
    await sleep(ms);
  }
}

function formatAmount(wei) {
  return `${hre.ethers.formatEther(wei)} RESURGE (${wei.toString()} wei)`;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  log(`Signer:      ${signer.address}`);
  log(`Governance:  ${GOVERNANCE_ADDRESS}`);
  log(`Distributor: ${DISTRIBUTOR_ADDRESS}`);
  log(`New amount:  ${formatAmount(NEW_AMOUNT)}`);
  log(`Stop queued: ${STOP_AFTER_QUEUE}`);

  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const distributor = await hre.ethers.getContractAt("RewardDistributor", DISTRIBUTOR_ADDRESS, signer);

  // Check proposer voting power
  const token = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
  const clockNow = await token.clock();
  const votes = await governance.getVotes(signer.address, clockNow - 1n).catch(() => 0n);
  const threshold = await governance.proposalThreshold();
  log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(threshold)} RESURGE`);
  if (votes < threshold) throw new Error("Insufficient votes — delegate RESURGE first");

  const currentAmount = await distributor.nonEvmRewardAmount();
  log(`Current nonEvmRewardAmount: ${formatAmount(currentAmount)}`);
  if (currentAmount === NEW_AMOUNT) {
    log("✅ nonEvmRewardAmount already set — nothing to do.");
    return;
  }

  const calldata = distributor.interface.encodeFunctionData("setNonEvmRewardAmount", [NEW_AMOUNT]);
  const targets = [DISTRIBUTOR_ADDRESS];
  const values = [0n];
  const calldatas = [calldata];
  const description = [
    "# Set nonEvmRewardAmount on RewardDistributor",
    "",
    "Sets RESURGE minted per valid non-EVM dormancy proof.",
    "",
    `RewardDistributor: ${DISTRIBUTOR_ADDRESS}`,
    `New amount (wei): ${NEW_AMOUNT.toString()}`,
  ].join("\n");
  const descHash = hre.ethers.id(description);

  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  if (!proposalId) {
    log("Proposing...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 1000000 });
    const receipt = await tx.wait();
    const ev = receipt.logs
      .map((l) => {
        try {
          return governance.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated not found");
    proposalId = ev.args[0];
    log(`Proposal ID: ${proposalId} tx: ${receipt.hash}`);
  } else {
    log(`Resuming proposal: ${proposalId}`);
  }

  let state = Number(await governance.state(proposalId));
  log(`Initial state: ${STATE_NAMES[state]}`);

  if (state === S.Canceled || state === S.Defeated || state === S.Expired) {
    throw new Error(`Proposal cannot continue (state=${STATE_NAMES[state]})`);
  }

  if (state === S.Pending) {
    await pollUntil(
      "Active",
      async () => {
        const s = Number(await governance.state(proposalId));
        log(`  state: ${STATE_NAMES[s]}`);
        if (s === S.Canceled || s === S.Defeated || s === S.Expired) {
          throw new Error(`Proposal cannot continue (state=${STATE_NAMES[s]})`);
        }
        return s === S.Active ? true : null;
      },
      POLL_MS
    );
    state = S.Active;
  }

  if (state === S.Active) {
    const alreadyVoted = await governance.hasVoted(proposalId, signer.address);
    if (alreadyVoted) {
      log("Vote already cast by signer; skipping vote.");
    } else {
      log("Voting For...");
      const voteTx = await governance.castVoteWithReason(proposalId, 1, "Enable non-EVM reward amount");
      await voteTx.wait();
      log(`Vote tx: ${voteTx.hash}`);
    }

    await pollUntil(
      "Succeeded",
      async () => {
        const s = Number(await governance.state(proposalId));
        log(`  state: ${STATE_NAMES[s]}`);
        if (s === S.Canceled || s === S.Defeated || s === S.Expired) {
          throw new Error(`Proposal cannot continue (state=${STATE_NAMES[s]})`);
        }
        return s === S.Succeeded ? true : null;
      },
      POLL_MS
    );
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
    log(`ETA unix: ${eta.toString()}`);
    if (STOP_AFTER_QUEUE) {
      log("🛑 STOP_AFTER_QUEUE=true — exiting before execute.");
      return;
    }

    log("Executing...");
    while (true) {
      try {
        const tx = await governance.execute(targets, values, calldatas, descHash);
        await tx.wait();
        log(`Executed! tx: ${tx.hash}`);
        break;
      } catch (err) {
        const msg = err?.message || "";
        if (msg.includes("TimelockController") || msg.includes("too early") || msg.includes("revert")) {
          log(`  Not ready (${msg.slice(0, 60)}), retrying in ${POLL_MS / 1000}s...`);
          await sleep(POLL_MS);
        } else {
          throw err;
        }
      }
    }
  } else if (state === S.Executed) {
    log("Proposal already executed.");
  }

  const finalAmount = await distributor.nonEvmRewardAmount();
  log(`Final nonEvmRewardAmount: ${formatAmount(finalAmount)}`);
}

main().catch((err) => {
  log(`❌ ${err.message}`);
  process.exit(1);
});

