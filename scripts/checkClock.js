const hre = require("hardhat");

const TOKEN_ADDRESS = "0xa95D4aD543BCfCeee94CdF3F4CcFb3826280AfE0";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const token = await hre.ethers.getContractAt("ResurgeToken", TOKEN_ADDRESS, deployer);

  const clock = await token.clock();
  const mode = await token.CLOCK_MODE();

  console.log("Token Clock:", clock.toString());
  console.log("Token Clock Mode:", mode);
}

main().catch(console.error);
