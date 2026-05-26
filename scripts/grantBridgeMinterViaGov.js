/**
 * grantBridgeMinterViaGov.js
 *
 * Governance proposal to grant BRIDGE_MINTER role on RewardDistributor
 * to the CrossChainReceiver so that CCIP bridge claims can mint RESURGE.
 *
 * Usage:
 *   npx hardhat run scripts/grantBridgeMinterViaGov.js --network arbitrumSepolia
 */

const hre = require("hardhat");

const GOVERNANCE_ADDRESS  = "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const DISTRIBUTOR_ADDRESS = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const RECEIVER_ADDRESS    = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";

const BRIDGE_MINTER_ROLE  = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("BRIDGE_MINTER"));
const POLL_MS = parseInt(process.env.POLL_INTERVAL_MS || "10000");

const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
const S = { Pending:0, Active:1, Canceled:2, Defeated:3, Succeeded:4, Queued:5, Expired:6, Executed:7 };

function log(msg) { console.log(`[${new Date().toISOString().slice(0,19).replace("T"," ")}] ${msg}`); }
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

  log(`Signer:      ${signer.address}`);
  log(`Distributor: ${DISTRIBUTOR_ADDRESS}`);
  log(`Receiver:    ${RECEIVER_ADDRESS}`);
  log(`BRIDGE_MINTER role: ${BRIDGE_MINTER_ROLE}`);

  const governance  = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const distributor = await hre.ethers.getContractAt("RewardDistributor", DISTRIBUTOR_ADDRESS, signer);

  const token    = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
  const clockNow = await token.clock();
  const votes    = await governance.getVotes(signer.address, clockNow - 1n).catch(() => 0n);
  const thresh   = await governance.proposalThreshold();
  log(`Votes: ${hre.ethers.formatEther(votes)} / threshold ${hre.ethers.formatEther(thresh)} RESURGE`);
  if (votes < thresh) throw new Error("Insufficient votes — delegate RESURGE first");

  const alreadyGranted = await distributor.hasRole(BRIDGE_MINTER_ROLE, RECEIVER_ADDRESS);
  if (alreadyGranted) {
    log("✅ CrossChainReceiver already has BRIDGE_MINTER — nothing to do.");
    return;
  }

  const calldata = distributor.interface.encodeFunctionData("grantRole", [
    BRIDGE_MINTER_ROLE,
    RECEIVER_ADDRESS,
  ]);

  const targets     = [DISTRIBUTOR_ADDRESS];
  const values      = [0n];
  const calldatas   = [calldata];
  const description = [
    "# Grant BRIDGE_MINTER role to CrossChainReceiver on RewardDistributor",
    "",
    "Grants BRIDGE_MINTER on RewardDistributor to the CrossChainReceiver contract",
    "so that CCIP bridge claims from spoke chains can mint RESURGE on the hub.",
    "",
    `RewardDistributor: ${DISTRIBUTOR_ADDRESS}`,
    `CrossChainReceiver: ${RECEIVER_ADDRESS}`,
    `BRIDGE_MINTER role: ${BRIDGE_MINTER_ROLE}`,
  ].join("\n");
  const descHash = hre.ethers.id(description);

  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  if (!proposalId) {
    log("Proposing...");
    const tx = await governance.propose(targets, values, calldatas, description, { gasLimit: 1000000 });
    const receipt = await tx.wait();
    const ev = receipt.logs.map(l => { try { return governance.interface.parseLog(l); } catch {} }).find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated not found");
    proposalId = ev.args[0];
    log(`Proposal ID: ${proposalId}  tx: ${receipt.hash}`);
  } else {
    log(`Resuming proposal: ${proposalId}`);
  }

  let state = Number(await governance.state(proposalId));
  log(`Initial state: ${STATE_NAMES[state]}`);

  if ([S.Canceled, S.Defeated, S.Expired].includes(state))
    throw new Error(`Proposal cannot continue (state=${STATE_NAMES[state]})`);

  if (state === S.Pending) {
    await pollUntil("Active", async () => {
      const s = Number(await governance.state(proposalId));
      log(`  state: ${STATE_NAMES[s]}`);
      if ([S.Canceled, S.Defeated, S.Expired].includes(s))
        throw new Error(`Proposal cannot continue (state=${STATE_NAMES[s]})`);
      return s === S.Active ? true : null;
    }, POLL_MS);
    state = S.Active;
  }

  if (state === S.Active) {
    const alreadyVoted = await governance.hasVoted(proposalId, signer.address);
    if (!alreadyVoted) {
      log("Voting For...");
      const voteTx = await governance.castVoteWithReason(proposalId, 1, "Grant BRIDGE_MINTER to CrossChainReceiver");
      await voteTx.wait();
      log(`Vote tx: ${voteTx.hash}`);
    } else {
      log("Vote already cast; skipping.");
    }

    await pollUntil("Succeeded", async () => {
      const s = Number(await governance.state(proposalId));
      log(`  state: ${STATE_NAMES[s]}`);
      if ([S.Defeated, S.Canceled, S.Expired].includes(s))
        throw new Error(`Proposal cannot continue (state=${STATE_NAMES[s]})`);
      return s === S.Succeeded ? true : null;
    }, POLL_MS);
    state = S.Succeeded;
  }

  if (state === S.Succeeded) {
    log("Queueing...");
    await (await governance.queue(targets, values, calldatas, descHash)).wait();
    log("Queued.");
    state = S.Queued;
  }

  if (state === S.Queued) {
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

  const granted = await distributor.hasRole(BRIDGE_MINTER_ROLE, RECEIVER_ADDRESS);
  if (granted) {
    log("✅ BRIDGE_MINTER granted to CrossChainReceiver successfully.");
  } else {
    log("⚠️  Role not set — verify manually.");
  }
}

main().catch(err => { log(`❌ ${err.message}`); process.exit(1); });
