const hre = require("hardhat");

const RD_ADDRESS     = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";
const ORACLE_ADDRESS = "0x201624cBa366250D08bCdA95e6eF64151687A447";

async function main() {
  const rd = await hre.ethers.getContractAt("RewardDistributor", RD_ADDRESS);
  const DORMANCY_ORACLE_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("DORMANCY_ORACLE_ROLE"));
  const has = await rd.hasRole(DORMANCY_ORACLE_ROLE, ORACLE_ADDRESS);
  console.log("RewardDistributor:", RD_ADDRESS);
  console.log("Oracle (ChronoNode):", ORACLE_ADDRESS);
  console.log("DORMANCY_ORACLE_ROLE:", DORMANCY_ORACLE_ROLE);
  console.log("Has role:", has);
  if (has) console.log("✅ Role already granted — K.4 done.");
  else      console.log("❌ Role not yet granted — run governance proposal.");
}
main().catch(console.error);
