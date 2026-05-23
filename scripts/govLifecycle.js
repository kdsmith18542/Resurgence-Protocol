/**
 * govLifecycle.js
 *
 * Full end-to-end governance lifecycle for adding a dead coin staking pool:
 *   1. Deploy ERC20Mock as the dead coin (or use DEAD_COIN_ADDRESS if set)
 *   2. Submit governance proposal (addStakingPool)
 *   3. Poll until voting delay passes → cast vote
 *   4. Poll until voting period passes → queue in Timelock
 *   5. Poll until Timelock delay expires → execute
 *   6. Verify pool was deployed
 *
 * Required env vars:
 *   GOVERNANCE_ADDRESS          - ResurgenceGovernance
 *   STAKING_MANAGER_ADDRESS     - StakingPoolManager proxy
 *   TIMELOCK_ADDRESS            - TimelockController
 *
 * Optional:
 *   DEAD_COIN_ADDRESS           - Use existing ERC-20 instead of deploying mock
 *   DEAD_COIN_NAME              - Name for mock (default: "Dead Doge")
 *   DEAD_COIN_SYMBOL            - Symbol for mock (default: "DDOGE")
 *   REWARD_RATE                 - wei/sec (default: 1e15 ≈ 86.4 RESURGE/day)
 *   POLL_INTERVAL_MS            - How often to poll (default: 30000 = 30s)
 *
 * Usage:
 *   npx hardhat run scripts/govLifecycle.js --network arbitrumSepolia
 */

const hre = require("hardhat");

const GOVERNANCE_ADDRESS   = process.env.GOVERNANCE_ADDRESS   || "0x7E38270a3077F1652D4bBdA5f0D5d2C986Ab00c3";
const MANAGER_ADDRESS      = process.env.STAKING_MANAGER_ADDRESS || "0xFFA58b5f40C74D08AeF9182b4cdF6b87F0FB3da7";
const TIMELOCK_ADDRESS     = process.env.TIMELOCK_ADDRESS     || "0x9e0141B004Cc140EC9C3243c75cF0029152E95e5";
const REWARD_RATE          = BigInt(process.env.REWARD_RATE   || "1000000000000000"); // 1e15 wei/sec
const POLL_MS              = parseInt(process.env.POLL_INTERVAL_MS || "30000");

// Proposal states (OZ Governor)
const STATE = { Pending:0, Active:1, Canceled:2, Defeated:3, Succeeded:4, Queued:5, Expired:6, Executed:7 };
const STATE_NAMES = ["Pending","Active","Canceled","Defeated","Succeeded","Queued","Expired","Executed"];

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
  log(`Signer: ${signer.address}`);
  log(`Network: ${hre.network.name}`);
  log(`Governance: ${GOVERNANCE_ADDRESS}`);
  log(`StakingPoolManager: ${MANAGER_ADDRESS}`);
  log(`Timelock: ${TIMELOCK_ADDRESS}`);
  log("");

  // --- Load contracts ---
  const governance = await hre.ethers.getContractAt("ResurgenceGovernance", GOVERNANCE_ADDRESS, signer);
  const manager    = await hre.ethers.getContractAt("StakingPoolManager",   MANAGER_ADDRESS,    signer);

  // --- Verify voting power ---
  // On Arbitrum, block.number in Solidity = L1 (Ethereum Sepolia) block number, ~10M not ~270M.
  // OZ v5 ERC20Votes clock() returns this L1 block number. We must query one unit behind the clock.
  const token     = await hre.ethers.getContractAt("ResurgeToken", await governance.token());
  const clockNow  = await token.clock();
  const votes     = await governance.getVotes(signer.address, clockNow - 1n).catch(() => 0n);
  const threshold = await governance.proposalThreshold();
  log(`Token clock() = ${clockNow} (L1 block number)`);
  log(`Voting power:       ${hre.ethers.formatEther(votes)} RESURGE`);
  log(`Proposal threshold: ${hre.ethers.formatEther(threshold)} RESURGE`);
  if (BigInt(votes) < BigInt(threshold)) {
    throw new Error("Insufficient voting power — delegate RESURGE to your address first.");
  }
  log("");

  // --- Step 1: Deploy or load dead coin ---
  let deadCoinAddress = process.env.DEAD_COIN_ADDRESS;
  if (!deadCoinAddress) {
    const name   = process.env.DEAD_COIN_NAME   || "Dead Doge";
    const symbol = process.env.DEAD_COIN_SYMBOL || "DDOGE";
    const supply = hre.ethers.parseUnits("1000000000", 18); // 1 billion
    log(`Deploying ERC20Mock dead coin: ${name} (${symbol})...`);
    const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock", signer);
    const mock = await ERC20Mock.deploy(name, symbol, supply);
    await mock.waitForDeployment();
    deadCoinAddress = await mock.getAddress();
    log(`Dead coin deployed: ${deadCoinAddress}`);
  } else {
    log(`Using existing dead coin: ${deadCoinAddress}`);
  }
  log("");

  // --- Step 2: Build proposal calldata (needed for queue/execute even when resuming) ---
  const addPoolCalldata = manager.interface.encodeFunctionData("addStakingPool", [
    deadCoinAddress,
    REWARD_RATE,
    TIMELOCK_ADDRESS,
    TIMELOCK_ADDRESS,
  ]);
  const targets     = [MANAGER_ADDRESS];
  const values      = [0n];
  const calldatas   = [addPoolCalldata];
  const description = [
    "# Register Dead Coin Staking Pool",
    "",
    `Dead coin: \`${deadCoinAddress}\``,
    `Reward rate: ${REWARD_RATE} wei/sec (~${REWARD_RATE * 86400n / 10n**18n} RESURGE/day)`,
    `Treasury: \`${TIMELOCK_ADDRESS}\``,
    "",
    "Deploys a new DeadCoinStakingPool proxy via StakingPoolManager and authorizes",
    "it in RewardDistributor so stakers can earn RESURGE.",
  ].join("\n");
  const descHash = hre.ethers.id(description);

  // Resume from existing proposal if PROPOSAL_ID is set
  let proposalId = process.env.PROPOSAL_ID ? BigInt(process.env.PROPOSAL_ID) : null;
  if (proposalId) {
    log(`Resuming with existing proposal ID: ${proposalId}`);
    log("");
  } else {
    log("Submitting governance proposal...");
    const proposeTx = await governance.propose(targets, values, calldatas, description);
    const proposeReceipt = await proposeTx.wait();
    log(`Proposal tx: ${proposeReceipt.hash}`);
    const createdLog = proposeReceipt.logs.find(l => {
      try { return governance.interface.parseLog(l)?.name === "ProposalCreated"; } catch { return false; }
    });
    if (!createdLog) throw new Error("ProposalCreated event not found in receipt");
    proposalId = governance.interface.parseLog(createdLog).args[0];
    log(`Proposal ID: ${proposalId}`);
    log("");
  }

  // --- Step 3: Wait for Active, then vote ---
  await pollUntil("proposal Active (voting delay passed)", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    return state === STATE.Active ? true : null;
  }, POLL_MS);

  log("Casting vote For (support=1)...");
  const voteTx = await governance.castVoteWithReason(proposalId, 1, "Register dead coin pool");
  await voteTx.wait();
  log(`Vote cast. Tx: ${voteTx.hash}`);
  log("");

  // --- Step 4: Wait for Succeeded, then queue ---
  await pollUntil("proposal Succeeded (voting period passed)", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    if (state === STATE.Defeated) throw new Error("Proposal was defeated");
    if (state === STATE.Canceled) throw new Error("Proposal was cancelled");
    return state === STATE.Succeeded ? true : null;
  }, POLL_MS);

  log("Queueing proposal in Timelock...");
  const queueTx = await governance.queue(targets, values, calldatas, descHash);
  await queueTx.wait();
  log(`Queued. Tx: ${queueTx.hash}`);
  log("");

  // --- Step 5: Wait for Timelock delay, then execute ---
  await pollUntil("Timelock delay expired (proposal ready to execute)", async () => {
    const state = Number(await governance.state(proposalId));
    log(`  Proposal state: ${STATE_NAMES[state]}`);
    // Queued → can execute once timelock elapses; state stays Queued until executed
    if (state === STATE.Queued) {
      // Try to estimate: check if enough time has passed
      const block = await hre.ethers.provider.getBlock("latest");
      const timelockContract = await hre.ethers.getContractAt(
        ["function getMinDelay() view returns (uint256)"],
        TIMELOCK_ADDRESS
      );
      const minDelay = await timelockContract.getMinDelay();
      log(`  Current block time: ${block.timestamp}, minDelay: ${minDelay}s`);
      // We don't know the exact eta without reading the timelock operationId,
      // so just attempt execute and catch if too early
      return "attempt";
    }
    if (state === STATE.Executed) return "already_executed";
    return null;
  }, POLL_MS);

  log("Executing proposal...");
  let executeTx;
  while (true) {
    try {
      executeTx = await governance.execute(targets, values, calldatas, descHash);
      await executeTx.wait();
      break;
    } catch (err) {
      if (err.message?.includes("TimelockController") || err.message?.includes("too early") ||
          err.message?.includes("ALREADY_DONE") || err.message?.includes("revert")) {
        log(`  Not ready yet (${err.message.slice(0, 80)}), retrying in ${POLL_MS/1000}s...`);
        await sleep(POLL_MS);
      } else {
        throw err;
      }
    }
  }
  log(`Executed! Tx: ${executeTx.hash}`);
  log("");

  // --- Step 6: Verify ---
  log("Verifying pool deployment...");
  const poolAddress = await manager.deadCoinToPoolAddress(deadCoinAddress);
  if (poolAddress === hre.ethers.ZeroAddress) throw new Error("Pool not deployed — execution may have failed silently");
  log(`✅ Dead coin staking pool live at: ${poolAddress}`);
  log("");
  log("=== Governance lifecycle complete ===");
  log(`Dead coin:   ${deadCoinAddress}`);
  log(`Pool proxy:  ${poolAddress}`);
  log(`Timelock:    ${TIMELOCK_ADDRESS}`);
}

main().catch(err => {
  log(`\n❌ FAILED: ${err.message}`);
  console.error(err);
  process.exit(1);
});
