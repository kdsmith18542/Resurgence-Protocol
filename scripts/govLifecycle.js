/**
 * govLifecycle.js — single-shot governance lifecycle with tight timing
 * Usage: CALLDATA=0x... TARGET=0x... DESCRIPTION="..." npx hardhat run scripts/govLifecycle.js --network arbitrumSepolia
 * Or to resume: PROPOSAL_ID=<id> ... same flags
 */
const hre = require("hardhat");

const GOVERNANCE = process.env.GOVERNANCE_ADDRESS || "0xfb6dD507a5a8e49b49C15CB851A488DB957c269B";
const STATE = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitState(gov, pid, target, ms=3000) {
  while(true) {
    const s = Number(await gov.state(pid));
    log(`state: ${STATE[s]}`);
    if(s === target) return s;
    if(s === 2 || s === 3 || s === 6) throw new Error(`Terminal: ${STATE[s]}`);
    await sleep(ms);
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);

  const targets   = [process.env.TARGET];
  const values    = [0n];
  const calldatas = [process.env.CALLDATA];
  const desc      = process.env.DESCRIPTION || "governance action";
  const descHash  = hre.ethers.id(desc);

  let pid = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;

  if (!pid) {
    const tx = await gov.propose(targets, values, calldatas, desc, { gasLimit: 1000000 });
    const r  = await tx.wait();
    const ev = r.logs.map(l => { try { return gov.interface.parseLog(l); } catch {} }).find(e => e?.name === "ProposalCreated");
    pid = ev.args[0];
    log(`Proposed: ${pid}  tx: ${r.hash}`);
  } else {
    log(`Resuming proposal: ${pid}`);
  }

  const s0 = Number(await gov.state(pid));
  log(`Current state: ${STATE[s0]}`);

  // Vote if still active or pending
  if (s0 === 0 || s0 === 1) {
    if (s0 === 0) await waitState(gov, pid, 1, 2000); // wait Active
    log("Casting vote FOR...");
    const vtx = await gov.castVoteWithReason(pid, 1, "Authorize Amoy spoke", { gasLimit: 500000 });
    await vtx.wait();
    log(`Voted. tx: ${vtx.hash}`);
  }

  if (s0 < 4) await waitState(gov, pid, 4, 3000); // Succeeded
  log("Queueing...");
  await (await gov.queue(targets, values, calldatas, descHash)).wait();
  log("Queued.");

  await waitState(gov, pid, 5, 5000); // Queued

  log("Waiting for timelock delay (polling execute)...");
  while(true) {
    try {
      const tx = await gov.execute(targets, values, calldatas, descHash, { gasLimit: 500000 });
      await tx.wait();
      log(`Executed! tx: ${tx.hash}`);
      break;
    } catch(e) {
      log(`Not ready: ${e.message.slice(0,80)} — retrying in 30s`);
      await sleep(30000);
    }
  }
  log("Done.");
}
main().catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
