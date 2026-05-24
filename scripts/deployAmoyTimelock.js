/**
 * deployAmoyTimelock.js
 *
 * Deploy a dedicated TimelockController on Polygon Amoy for spoke admin roles.
 *
 * Usage:
 *   npx hardhat run scripts/deployAmoyTimelock.js --network amoy
 *
 * Optional env:
 *   TIMELOCK_DELAY_SECONDS   default: 3600
 *   EXTRA_PROPOSER           optional extra proposer address
 *   EXTRA_EXECUTOR           optional extra executor address
 */

const hre = require("hardhat");

function uniq(addresses) {
  const seen = new Set();
  const out = [];
  for (const a of addresses) {
    const k = a.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const delay = Number(process.env.TIMELOCK_DELAY_SECONDS || "3600");
  if (!Number.isFinite(delay) || delay < 0) throw new Error("Invalid TIMELOCK_DELAY_SECONDS");

  const proposers = [deployer.address];
  const executors = [deployer.address];
  if (process.env.EXTRA_PROPOSER) proposers.push(process.env.EXTRA_PROPOSER);
  if (process.env.EXTRA_EXECUTOR) executors.push(process.env.EXTRA_EXECUTOR);

  const Timelock = await hre.ethers.getContractFactory("ResurgenceTimelockController");
  const tl = await Timelock.deploy(delay, uniq(proposers), uniq(executors), deployer.address);
  await tl.waitForDeployment();

  const addr = await tl.getAddress();
  console.log("Amoy Timelock deployed:");
  console.log(`  address: ${addr}`);
  console.log(`  delay:   ${delay}s`);
  console.log(`  proposer(s): ${uniq(proposers).join(", ")}`);
  console.log(`  executor(s): ${uniq(executors).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

