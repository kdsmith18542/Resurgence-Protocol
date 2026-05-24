const hre = require("hardhat");

const GOVERNANCE = "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228";
const RECEIVER   = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";
const AMOY_SEL   = 16281711391670634445n;
const AMOY_ADDR  = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
const POLL       = 15000;

const NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
function log(m) { console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov  = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE, signer);
  const recv = await hre.ethers.getContractAt("CrossChainReceiver",   RECEIVER,   signer);

  const encodedSender = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [AMOY_ADDR]);
  const calldata = recv.interface.encodeFunctionData("setAuthorizedSource", [AMOY_SEL, encodedSender]);
  const targets = [RECEIVER];
  const values  = [0n];
  const datas   = [calldata];
  const desc    = "# Authorize Amoy spoke\n\nCCIP auth.\n\nChainSel: 16281711391670634445\nSender: " + AMOY_ADDR;
  const descHash = hre.ethers.id(desc);

  // Already authorized?
  const existing = await recv.authorizedSources(AMOY_SEL);
  if (existing && existing !== "0x" && existing.toLowerCase() === encodedSender.toLowerCase()) {
    log("✅ Already authorized — done."); return;
  }

  // Check for existing proposal
  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;

  if (!proposalId) {
    log("Proposing...");
    const tx = await gov.propose(targets, values, datas, desc, { gasLimit: 500000 });
    const receipt = await tx.wait();
    const ev = receipt.logs.map(l => { try { return gov.interface.parseLog(l); } catch {} }).find(e => e?.name === "ProposalCreated");
    if (!ev) throw new Error("ProposalCreated not found in logs");
    proposalId = ev.args[0];
    log(`Proposal ${proposalId}  tx: ${receipt.hash}`);
  } else {
    log(`Resuming proposal ${proposalId}`);
  }

  // Wait for Active
  log("Waiting for Active...");
  while (true) {
    const s = Number(await gov.state(proposalId));
    log(`  ${NAMES[s]}`);
    if (s === 1) break;
    if (s > 4) throw new Error("Unexpected state: " + NAMES[s]);
    await sleep(POLL);
  }

  log("Voting For...");
  await (await gov.castVoteWithReason(proposalId, 1, "Authorize Amoy")).wait();
  log("Voted.");

  // Wait for Succeeded
  log("Waiting for Succeeded...");
  while (true) {
    const s = Number(await gov.state(proposalId));
    log(`  ${NAMES[s]}`);
    if (s === 4) break;
    if (s === 3) throw new Error("Defeated");
    await sleep(POLL);
  }

  log("Queueing...");
  await (await gov.queue(targets, values, datas, descHash)).wait();
  log("Queued.");

  // Wait then execute
  log("Waiting for timelock (60s)...");
  while (true) {
    const s = Number(await gov.state(proposalId));
    log(`  ${NAMES[s]}`);
    if (s === 7) { log("Already executed."); break; }
    if (s !== 5) { await sleep(POLL); continue; }
    try {
      await (await gov.execute(targets, values, datas, descHash)).wait();
      log("✅ Executed!");
      break;
    } catch(e) {
      log(`  Not ready: ${e.shortMessage || e.message.slice(0,60)}`);
      await sleep(POLL);
    }
  }

  const result = await recv.authorizedSources(AMOY_SEL);
  log(`authorizedSources[Amoy]: ${result}`);
  log(`Expected:                ${encodedSender}`);
  log(result.toLowerCase() === encodedSender.toLowerCase() ? "✅ Success!" : "⚠️ Mismatch");
}
main().catch(e => { log("❌ " + e.message); process.exit(1); });
