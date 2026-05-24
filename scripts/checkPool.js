const hre = require("hardhat");

const POOL_PROXY_ADDRESS = process.env.POOL || "0xbc3f08b905e8cf6d2a5329867d77477c5bb6b808";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", POOL_PROXY_ADDRESS, deployer);

  const rewardRate = await pool.rewardRatePerSecond();
  const totalStaked = await pool.totalStakedSupply();
  const sender = await pool.crossChainSender();
  const deadCoin = await pool.deadCoin();
  const earned = await pool.earned(deployer.address);
  const paused = await pool.paused();

  console.log("Pool:", POOL_PROXY_ADDRESS);
  console.log("crossChainSender:", sender);
  console.log("deadCoin:", deadCoin);
  console.log("rewardRatePerSecond:", hre.ethers.formatEther(rewardRate), "RESURGE/sec");
  console.log("totalStakedSupply:", hre.ethers.formatEther(totalStaked));
  console.log("earned (deployer):", hre.ethers.formatEther(earned));
  console.log("paused:", paused);
}

main().catch(console.error);
