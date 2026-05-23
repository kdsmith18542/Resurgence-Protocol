const hre = require("hardhat");
async function main() {
  const [signer] = await hre.ethers.getSigners();

  // Polygon Amoy CCIP chain selector
  const AMOY_CHAIN_SELECTOR = "16281711391670634445";
  const AMOY_SENDER         = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
  // v3 CrossChainReceiver (Arbitrum Sepolia hub)
  const RECEIVER            = "0xF1384305959ebBC11838304127e619Ff3b1E36B4";

  console.log("Authorizing Amoy CrossChainSender on hub CrossChainReceiver...");
  console.log("Signer:", signer.address);
  console.log("Receiver:", RECEIVER);
  console.log("Amoy sender:", AMOY_SENDER);

  const receiver = await hre.ethers.getContractAt("CrossChainReceiver", RECEIVER, signer);

  // setAuthorizedSource(uint64 chainSelector, bytes calldata sender)
  // CCIP encodes EVM sender as abi.encode(address) = 32 bytes (left-padded)
  const encodedSender = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [AMOY_SENDER]);
  console.log("Encoded sender (bytes):", encodedSender);

  const tx = await receiver.setAuthorizedSource(AMOY_CHAIN_SELECTOR, encodedSender);
  await tx.wait();
  console.log("Done. Tx:", tx.hash);

  // Verify
  const authorized = await receiver.authorizedSources(AMOY_CHAIN_SELECTOR);
  console.log("Authorized source bytes on Amoy:", authorized);
  console.log("Matches:", authorized.toLowerCase() === encodedSender.toLowerCase());
}
main().catch(console.error);
