const hre = require("hardhat");

const NEW_RECEIVER = "0x5B807951Ea4B0443b98867E49A2D5d188f1B1A5F";
const AMOY_CHAIN_SELECTOR = 16281711391670634445n;
const AMOY_SENDER = "0x3F1E0400fb8f19FeFA8aA6B8d23468949E73a7B5";
const BASE_SEP_CHAIN_SELECTOR = 10344971235874465080n;
const BASE_SEP_SENDER = "0xafA9aF72d455dd6c2669306D99956E6444C5c181";

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log("Signer:", signer.address);

  const receiver = await hre.ethers.getContractAt("CrossChainReceiver", NEW_RECEIVER, signer);

  const encodeAddr = (addr) => hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [addr]);

  // Authorize Amoy
  console.log("Authorizing Amoy source...");
  let tx = await receiver.setAuthorizedSource(AMOY_CHAIN_SELECTOR, encodeAddr(AMOY_SENDER));
  await tx.wait();
  console.log("  Amoy authorized. tx:", tx.hash);

  // Authorize Base Sepolia
  console.log("Authorizing Base Sepolia source...");
  tx = await receiver.setAuthorizedSource(BASE_SEP_CHAIN_SELECTOR, encodeAddr(BASE_SEP_SENDER));
  await tx.wait();
  console.log("  Base Sepolia authorized. tx:", tx.hash);

  // Verify
  const amoyAuth = await receiver.authorizedSources(AMOY_CHAIN_SELECTOR);
  const baseAuth = await receiver.authorizedSources(BASE_SEP_CHAIN_SELECTOR);
  console.log("Amoy authorized source:", amoyAuth);
  console.log("Base Sepolia authorized source:", baseAuth);
}

main().catch(e => { console.error(e.message); process.exit(1); });
