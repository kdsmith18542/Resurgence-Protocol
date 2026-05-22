/**
 * voteProposal.js  — Cast a vote on an active governance proposal.
 *
 * Env vars:
 *   GOVERNANCE_ADDRESS  - ResurgenceGovernance proxy address
 *   PROPOSAL_ID         - Proposal ID to vote on
 *   VOTE_SUPPORT        - 0=Against, 1=For, 2=Abstain  (default: 1)
 *   VOTE_REASON         - Optional reason string
 */

const hre = require("hardhat");

const GOVERNANCE_ABI = [
  "function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function getVotes(address account, uint256 timepoint) view returns (uint256)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
];

const STATE_LABELS = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];

async function main() {
  const [voter] = await hre.ethers.getSigners();

  const governanceAddress = process.env.GOVERNANCE_ADDRESS;
  const proposalId        = process.env.PROPOSAL_ID;
  const support           = Number(process.env.VOTE_SUPPORT ?? 1);
  const reason            = process.env.VOTE_REASON ?? "";

  if (!governanceAddress) throw new Error("Missing GOVERNANCE_ADDRESS");
  if (!proposalId)        throw new Error("Missing PROPOSAL_ID");
  if (![0, 1, 2].includes(support)) throw new Error("VOTE_SUPPORT must be 0, 1, or 2");

  const governance = new hre.ethers.Contract(governanceAddress, GOVERNANCE_ABI, voter);

  const state = await governance.state(proposalId);
  console.log(`Proposal state: ${STATE_LABELS[state] ?? state}`);
  if (state !== 1) {
    console.error("Proposal is not Active — cannot vote.");
    process.exit(1);
  }

  const snapshot = await governance.proposalSnapshot(proposalId);
  const votes = await governance.getVotes(voter.address, snapshot);
  console.log(`Voter: ${voter.address}`);
  console.log(`Voting power at snapshot: ${hre.ethers.formatEther(votes)} RESURGE`);
  console.log(`Vote: ${["Against", "For", "Abstain"][support]}`);
  if (reason) console.log(`Reason: ${reason}`);

  const tx = await governance.castVoteWithReason(proposalId, support, reason);
  await tx.wait();
  console.log(`\n✅ Vote cast. Tx: ${tx.hash}`);
}

main().catch(err => { console.error(err); process.exit(1); });
