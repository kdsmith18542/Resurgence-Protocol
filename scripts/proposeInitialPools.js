/**
 * proposeInitialPools.js
 *
 * Creates a governance proposal to deploy 3 initial dead coin staking pools.
 * The proposal encodes calls to StakingPoolManager.addStakingPool() for each dead coin.
 *
 * Required env vars:
 *   GOVERNANCE_ADDRESS        - ResurgenceGovernance proxy address
 *   STAKING_MANAGER_ADDRESS   - StakingPoolManager proxy address
 *   TIMELOCK_ADDRESS          - TimelockController address
 *   DEAD_COIN_1               - Address of first dead coin token
 *   DEAD_COIN_2               - (optional) Address of second dead coin token
 *   DEAD_COIN_3               - (optional) Address of third dead coin token
 *   REWARD_RATE_1             - RESURGE wei/sec for pool 1 (default 1e15 = ~86 RESURGE/day)
 *   REWARD_RATE_2             - (optional) Rate for pool 2
 *   REWARD_RATE_3             - (optional) Rate for pool 3
 *
 * Usage:
 *   npx hardhat run scripts/proposeInitialPools.js --network polygon
 */

const hre = require("hardhat");

const GOVERNANCE_ABI = [
  "function propose(address[] targets, uint256[] values, bytes[] calldatas, string description) returns (uint256)",
  "function proposalThreshold() view returns (uint256)",
  "function getVotes(address account, uint256 timepoint) view returns (uint256)",
];

const MANAGER_ABI = [
  "function addStakingPool(address _deadCoinAddress, uint256 _initialRewardRatePerSecond, address _timelock, address _treasury) returns (address)",
];

const DEFAULT_RATE = (10n ** 15n).toString(); // 1e15 wei/sec ≈ 86.4 RESURGE/day

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const [proposer] = await hre.ethers.getSigners();

  const governanceAddress = requiredEnv("GOVERNANCE_ADDRESS");
  const managerAddress    = requiredEnv("STAKING_MANAGER_ADDRESS");
  const timelockAddress   = requiredEnv("TIMELOCK_ADDRESS");
  const deadCoin1         = requiredEnv("DEAD_COIN_1");

  const deadCoins = [deadCoin1];
  const rates     = [process.env.REWARD_RATE_1 || DEFAULT_RATE];

  if (process.env.DEAD_COIN_2) {
    deadCoins.push(process.env.DEAD_COIN_2);
    rates.push(process.env.REWARD_RATE_2 || DEFAULT_RATE);
  }
  if (process.env.DEAD_COIN_3) {
    deadCoins.push(process.env.DEAD_COIN_3);
    rates.push(process.env.REWARD_RATE_3 || DEFAULT_RATE);
  }

  console.log(`\nProposer: ${proposer.address}`);
  console.log(`Governance: ${governanceAddress}`);
  console.log(`StakingPoolManager: ${managerAddress}`);
  console.log(`Timelock: ${timelockAddress}`);
  console.log(`\nPools to create: ${deadCoins.length}`);
  deadCoins.forEach((coin, i) => {
    const ratePerDay = (BigInt(rates[i]) * 86400n * 1000n / 10n ** 18n);
    console.log(`  [${i + 1}] ${coin}  rate: ${rates[i]} wei/sec (~${ratePerDay}m RESURGE/day)`);
  });

  const governance = new hre.ethers.Contract(governanceAddress, GOVERNANCE_ABI, proposer);
  const manager    = new hre.ethers.Contract(managerAddress, MANAGER_ABI, proposer);

  // Check voting power
  const block = await hre.ethers.provider.getBlockNumber();
  const votes = await governance.getVotes(proposer.address, block - 1).catch(() => 0n);
  const threshold = await governance.proposalThreshold();
  console.log(`\nYour voting power: ${hre.ethers.formatEther(votes)} RESURGE`);
  console.log(`Proposal threshold: ${hre.ethers.formatEther(threshold)} RESURGE`);
  if (BigInt(votes) < BigInt(threshold)) {
    console.warn("\nWARNING: Insufficient voting power to propose. Delegate or acquire RESURGE first.");
  }

  // Encode calldata for each addStakingPool call
  const iface = manager.interface;
  const targets   = deadCoins.map(() => managerAddress);
  const values    = deadCoins.map(() => 0n);
  const calldatas = deadCoins.map((coin, i) =>
    iface.encodeFunctionData("addStakingPool", [coin, rates[i], timelockAddress, timelockAddress])
  );

  const description = [
    "# Deploy Initial Dead Coin Staking Pools",
    "",
    "This proposal deploys the first " + deadCoins.length + " dead coin staking pool(s) via StakingPoolManager.",
    "",
    "## Pools",
    ...deadCoins.map((coin, i) => `- Pool ${i + 1}: \`${coin}\`  reward rate: ${rates[i]} wei/sec`),
    "",
    "## Notes",
    "- All pools are authorized in RewardDistributor automatically.",
    "- Reward rates can be adjusted by future governance proposals.",
    "- Execution is subject to the 1-hour Timelock delay.",
  ].join("\n");

  console.log("\nSubmitting proposal...");
  const tx = await governance.propose(targets, values, calldatas, description);
  const receipt = await tx.wait();

  const proposalCreatedLog = receipt.logs.find(log => {
    try { return governance.interface.parseLog(log)?.name === "ProposalCreated"; } catch { return false; }
  });
  const proposalId = proposalCreatedLog
    ? governance.interface.parseLog(proposalCreatedLog).args[0]
    : "(check tx logs)";

  console.log(`\n✅ Proposal submitted!`);
  console.log(`   Proposal ID: ${proposalId}`);
  console.log(`   Tx hash:     ${receipt.hash}`);
  console.log("\nNext steps:");
  console.log("  1. Wait for voting delay (~1 block)");
  console.log("  2. Vote: npx hardhat run scripts/voteProposal.js --network polygon");
  console.log("  3. Wait for voting period (~7 days / 50,400 blocks)");
  console.log("  4. Queue: npx hardhat run scripts/queueProposal.js --network polygon");
  console.log("  5. Wait 1 hour (Timelock delay)");
  console.log("  6. Execute: npx hardhat run scripts/executeProposal.js --network polygon");
  console.log(`\n  Set PROPOSAL_ID=${proposalId} for the vote/queue/execute scripts.`);
}

main().catch(err => { console.error(err); process.exit(1); });
