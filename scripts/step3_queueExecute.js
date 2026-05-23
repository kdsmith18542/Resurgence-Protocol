const hre = require("hardhat");
const PROPOSAL_ID = 60581147904759678974165330535425369601586576134270921547175942771044307328283n;
const RECEIVER = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";
const AMOY_SEL = 16281711391670634445n;
const AMOY_ADDR = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
const NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov  = await hre.ethers.getContractAt("ResurgenceGovernance", "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228", signer);
  const recv = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER, signer);
  const encodedSender = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [AMOY_ADDR]);
  const calldata  = recv.interface.encodeFunctionData("setAuthorizedSource", [AMOY_SEL, encodedSender]);
  const targets   = [RECEIVER];
  const values    = [0n];
  const datas     = [calldata];
  const desc      = "# Authorize Amoy spoke\n\nCCIP auth.\n\nChainSel: 16281711391670634445\nSender: " + AMOY_ADDR;
  const descHash  = hre.ethers.id(desc);

  // Poll for Succeeded (max 20 polls, 15s each = 5 minutes max)
  let state;
  for (let i = 0; i < 20; i++) {
    state = Number(await gov.state(PROPOSAL_ID));
    console.log(`[${new Date().toISOString().slice(11,19)}] state: ${NAMES[state]}`);
    if (state === 4) break; // Succeeded
    if (state > 4 && state !== 5) throw new Error("Unexpected: " + NAMES[state]);
    if (state === 5) break; // Already queued somehow
    await sleep(15000);
  }

  if (state === 4) {
    console.log("Queueing...");
    const qtx = await gov.queue(targets, values, datas, descHash);
    await qtx.wait();
    console.log("Queued. Tx:", qtx.hash);
    state = 5;
  }

  if (state === 5) {
    // Try execute (60s timelock), retry up to 8 times
    for (let i = 0; i < 8; i++) {
      try {
        const etx = await gov.execute(targets, values, datas, descHash);
        await etx.wait();
        console.log("Executed! Tx:", etx.hash);
        break;
      } catch(err) {
        const msg = err.shortMessage || err.message;
        if (msg.includes("too early") || msg.includes("TimelockController") || msg.includes("revert")) {
          console.log(`Not ready yet, waiting 15s... (${msg.slice(0,50)})`);
          await sleep(15000);
        } else throw err;
      }
    }
  }

  const result = await recv.authorizedSources(AMOY_SEL);
  console.log("authorizedSources[Amoy]:", result);
  console.log(result.toLowerCase() === encodedSender.toLowerCase() ? "✅ Done!" : "⚠️  Mismatch");
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
