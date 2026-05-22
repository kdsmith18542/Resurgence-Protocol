/**
 * Resurgence Protocol — Forta Detection Bot
 *
 * Monitors for suspicious or critical on-chain activity:
 *  - Reentrancy attack signatures (failed txs with reentrancy revert)
 *  - Unauthorized upgrade attempts
 *  - Abnormally large single-block reward claims
 *  - Admin role changes not originating from the Timelock
 *
 * Deploy via Forta CLI: forta run  (local)  or  forta publish  (mainnet bot)
 * Docs: https://docs.forta.network/en/latest/quickstart/
 */

const { Finding, FindingSeverity, FindingType, ethers } = require("forta-agent");

const REENTRANCY_ERROR = "0x3ee5aeb5"; // keccak256("ReentrancyGuardReentrantCall()")[:4]
const UPGRADED_TOPIC   = ethers.id("Upgraded(address)");
const ROLE_GRANTED_TOPIC = ethers.id("RoleGranted(bytes32,address,address)");
const REWARDS_CLAIMED_TOPIC = ethers.id("RewardsClaimed(address,uint256)");

const LARGE_CLAIM_THRESHOLD = ethers.parseEther("100000"); // 100k RESURGE in one claim

const MONITORED_CONTRACTS = new Set(
  (process.env.MONITORED_ADDRESSES || "")
    .split(",")
    .map(a => a.trim().toLowerCase())
    .filter(Boolean)
);

const TIMELOCK_ADDRESS = (process.env.TIMELOCK_ADDRESS || "").toLowerCase();

function isMonitored(address) {
  return MONITORED_CONTRACTS.size === 0 || MONITORED_CONTRACTS.has(address.toLowerCase());
}

async function handleTransaction(txEvent) {
  const findings = [];

  // 1. Reentrancy attempt — failed tx with reentrancy revert
  if (!txEvent.status && txEvent.transaction.data.startsWith("0x")) {
    const receipt = txEvent.receipt;
    if (receipt && receipt.revertReason && receipt.revertReason.includes(REENTRANCY_ERROR)) {
      findings.push(
        Finding.fromObject({
          name: "Reentrancy Attack Attempt",
          description: `Transaction ${txEvent.hash} reverted with ReentrancyGuardReentrantCall`,
          alertId: "RESURGE-REENTRANCY-1",
          severity: FindingSeverity.Critical,
          type: FindingType.Exploit,
          metadata: {
            txHash: txEvent.hash,
            from: txEvent.from,
            to: txEvent.to,
          },
        })
      );
    }
  }

  // 2. Contract upgrade
  for (const log of txEvent.logs) {
    if (!isMonitored(log.address)) continue;

    if (log.topics[0] === UPGRADED_TOPIC) {
      const newImpl = ethers.getAddress("0x" + log.topics[1].slice(26));
      findings.push(
        Finding.fromObject({
          name: "Contract Upgraded",
          description: `Proxy at ${log.address} upgraded to implementation ${newImpl}`,
          alertId: "RESURGE-UPGRADE-1",
          severity: FindingSeverity.High,
          type: FindingType.Info,
          metadata: {
            proxy: log.address,
            newImplementation: newImpl,
            txHash: txEvent.hash,
          },
        })
      );
    }

    // 3. Role granted not by Timelock
    if (log.topics[0] === ROLE_GRANTED_TOPIC) {
      const sender = txEvent.from.toLowerCase();
      if (TIMELOCK_ADDRESS && sender !== TIMELOCK_ADDRESS) {
        const grantee = ethers.getAddress("0x" + log.topics[2].slice(26));
        findings.push(
          Finding.fromObject({
            name: "Unexpected Role Grant",
            description: `Role granted on ${log.address} to ${grantee} by ${txEvent.from} (not Timelock)`,
            alertId: "RESURGE-ROLE-1",
            severity: FindingSeverity.High,
            type: FindingType.Suspicious,
            metadata: {
              contract: log.address,
              grantee,
              grantor: txEvent.from,
              txHash: txEvent.hash,
            },
          })
        );
      }
    }

    // 4. Abnormally large claim
    if (log.topics[0] === REWARDS_CLAIMED_TOPIC) {
      const amount = BigInt(log.data);
      if (amount >= LARGE_CLAIM_THRESHOLD) {
        const claimer = ethers.getAddress("0x" + log.topics[1].slice(26));
        findings.push(
          Finding.fromObject({
            name: "Large Reward Claim",
            description: `${ethers.formatEther(amount)} RESURGE claimed in single tx by ${claimer}`,
            alertId: "RESURGE-LARGE-CLAIM-1",
            severity: FindingSeverity.Medium,
            type: FindingType.Suspicious,
            metadata: {
              pool: log.address,
              claimer,
              amount: amount.toString(),
              txHash: txEvent.hash,
            },
          })
        );
      }
    }
  }

  return findings;
}

module.exports = { handleTransaction };
