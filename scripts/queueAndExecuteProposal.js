/**
 * queueAndExecuteProposal.js
 *
 * Queues a succeeded proposal into the Timelock, waits for the delay, then executes.
 * Run after voting period ends with a successful outcome.
 *
 * Env vars:
 *   GOVERNANCE_ADDRESS  - ResurgenceGovernance proxy address
 *   PROPOSAL_ID         - Proposal ID
 *   PROPOSAL_TARGETS    - JSON array of target addresses  (must match original proposal)
 *   PROPOSAL_VALUES     - JSON array of ETH values        (usually all zeros)
 *   PROPOSAL_CALLDATAS  - JSON array of hex calldatas
 *   PROPOSAL_DESC_HASH  - keccak256 of proposal description (or set PROPOSAL_DESCRIPTION)
 *   PROPOSAL_DESCRIPTION - Full description string (used if DESC_HASH not set)
 *   SKIP_EXECUTE        - Set to "true" to queue only without waiting to execute
 */

const hre = require("hardhat");

const GOVERNANCE_ABI = [
  "function queue(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
  "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalEta(uint256 proposalId) view returns (uint256)",
];

const STATE_LABELS = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const [caller] = await hre.ethers.getSigners();

  const governanceAddress = requiredEnv("GOVERNANCE_ADDRESS");
  const proposalId        = requiredEnv("PROPOSAL_ID");
  const targets           = JSON.parse(requiredEnv("PROPOSAL_TARGETS"));
  const values            = JSON.parse(requiredEnv("PROPOSAL_VALUES")).map(BigInt);
  const calldatas         = JSON.parse(requiredEnv("PROPOSAL_CALLDATAS"));

  let descriptionHash;
  if (process.env.PROPOSAL_DESC_HASH) {
    descriptionHash = process.env.PROPOSAL_DESC_HASH;
  } else {
    const desc = requiredEnv("PROPOSAL_DESCRIPTION");
    descriptionHash = hre.ethers.id(desc);
  }

  const governance = new hre.ethers.Contract(governanceAddress, GOVERNANCE_ABI, caller);

  const state = await governance.state(proposalId);
  console.log(`Proposal state: ${STATE_LABELS[state] ?? state}`);

  if (state === 4) {
    console.log("\nQueuing proposal...");
    const tx = await governance.queue(targets, values, calldatas, descriptionHash);
    await tx.wait();
    console.log(`✅ Queued. Tx: ${tx.hash}`);
  } else if (state !== 5) {
    console.error(`Cannot queue/execute — state is ${STATE_LABELS[state] ?? state}`);
    process.exit(1);
  }

  if (process.env.SKIP_EXECUTE === "true") {
    const eta = await governance.proposalEta(proposalId);
    console.log(`\nTimelock ETA: ${new Date(Number(eta) * 1000).toISOString()}`);
    console.log("Run again without SKIP_EXECUTE=true after the delay.");
    return;
  }

  const eta = await governance.proposalEta(proposalId);
  const now = Math.floor(Date.now() / 1000);
  const waitMs = (Number(eta) - now + 5) * 1000;

  if (waitMs > 0) {
    console.log(`\nWaiting ${Math.ceil(waitMs / 1000)}s for Timelock delay (ETA: ${new Date(Number(eta) * 1000).toISOString()})...`);
    await new Promise(r => setTimeout(r, waitMs));
  }

  console.log("\nExecuting proposal...");
  const execTx = await governance.execute(targets, values, calldatas, descriptionHash);
  await execTx.wait();
  console.log(`\n✅ Proposal executed! Tx: ${execTx.hash}`);
}

main().catch(err => { console.error(err); process.exit(1); });
