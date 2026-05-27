const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const REWARD_DISTRIBUTOR = "0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed";

  console.log("Querying earliest transaction or block timestamp...");
  
  // We can query the block number and find one that corresponds to ~ May 24 2026.
  // 1 block/sec average on Arbitrum.
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);
  
  // Search binary to find block timestamp around 2026-05-24 (approx 1779600000 timestamp)
  let low = 260000000;
  let high = currentBlock;
  let targetTime = 1779600000; // May 24 2026
  
  let targetBlock = low;
  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    let block = await hre.ethers.provider.getBlock(mid);
    if (!block) {
      high = mid - 1;
      continue;
    }
    if (block.timestamp >= targetTime) {
      targetBlock = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  
  console.log(`Block around May 24 2026: ${targetBlock}`);
}

main().catch(console.error);
