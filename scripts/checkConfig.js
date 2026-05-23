const hre = require("hardhat");
async function main() {
  const chains = hre.config.networks.hardhat.chains;
  const targetChain = chains.get(11155111);
  if (targetChain && targetChain.hardforkHistory) {
    console.log("11155111 hardforkHistory entries:");
    for (const [fork, block] of targetChain.hardforkHistory.entries()) {
      console.log(`  ${fork}: ${block}`);
    }
  } else {
    console.log("No 11155111 hardforkHistory!");
  }
}
main().catch(console.error);
