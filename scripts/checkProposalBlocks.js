const hre = require("hardhat");

async function main() {
  const txHash = "0xbe9b1a0cc67c4503c469cffc728333b7fbe5fa4e710b44ec50afbcb46c3be86c";
  const tx = await hre.ethers.provider.getTransaction(txHash);
  if (!tx) {
    console.log("Transaction not found on chain yet!");
    return;
  }
  const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
  const creationBlock = receipt ? receipt.blockNumber : null;
  const currentBlock = await hre.ethers.provider.getBlockNumber();

  console.log("Proposal creation block:", creationBlock);
  console.log("Current block:", currentBlock);
  if (creationBlock) {
    console.log("Blocks elapsed since creation:", currentBlock - creationBlock);
  }
}

main().catch(console.error);
