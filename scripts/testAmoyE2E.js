const hre = require("hardhat");

const DEAD_COIN_ADDRESS = "0x59624e0f5F0F76bb35107808d038Ed8eA24AAFFD"; // v4
const POOL_PROXY_ADDRESS = "0xbc3f08b905e8cf6d2a5329867d77477c5bb6b808"; // v4

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester Address:", deployer.address);

  const deadCoin = await hre.ethers.getContractAt("ERC20Mock", DEAD_COIN_ADDRESS, deployer);
  const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", POOL_PROXY_ADDRESS, deployer);

  // 1. Check/Mint Mock DeadCoin balance
  let balance = await deadCoin.balanceOf(deployer.address);
  console.log(`Current DEADTEST Balance: ${hre.ethers.formatEther(balance)}`);

  if (balance === 0n) {
    console.log("Minting 1000 DEADTEST...");
    const tx = await deadCoin.mint(deployer.address, hre.ethers.parseEther("1000"));
    await tx.wait();
    balance = await deadCoin.balanceOf(deployer.address);
    console.log(`New DEADTEST Balance: ${hre.ethers.formatEther(balance)}`);
  }

  // 2. Approve pool to spend DeadCoin
  const stakeAmount = hre.ethers.parseEther("100");
  console.log(`Approving pool to spend ${hre.ethers.formatEther(stakeAmount)} DEADTEST...`);
  const approveTx = await deadCoin.approve(POOL_PROXY_ADDRESS, stakeAmount);
  await approveTx.wait();
  console.log("Approval confirmed.");

  // 3. Stake DeadCoin
  console.log(`Staking ${hre.ethers.formatEther(stakeAmount)} DEADTEST...`);
  const stakeTx = await pool.stake(stakeAmount);
  await stakeTx.wait();
  console.log("Staking complete!");

  // Check position
  const stakedBalance = await pool.userStakedAmount(deployer.address);
  console.log(`Staked Balance: ${hre.ethers.formatEther(stakedBalance)}`);

  // 4. Wait for rewards to accrue
  console.log("Waiting 15 seconds for rewards to accrue...");
  await sleep(15000);

  let pending = await pool.earned(deployer.address);
  console.log(`Pending RESURGE Rewards: ${hre.ethers.formatEther(pending)}`);

  if (pending === 0n) {
    console.log("No rewards accrued yet, waiting another 15 seconds...");
    await sleep(15000);
    pending = await pool.earned(deployer.address);
    console.log(`Pending RESURGE Rewards: ${hre.ethers.formatEther(pending)}`);
  }

  // 5. Call bridgeClaim()
  console.log("Calling bridgeClaim() to send rewards to Arbitrum Sepolia...");
  const claimTx = await pool.bridgeClaim();
  const receipt = await claimTx.wait();
  console.log(`bridgeClaim() transaction sent! Hash: ${receipt.hash}`);
  console.log("Check Chainlink CCIP Explorer (https://ccip.chain.link) with this transaction hash to monitor cross-chain execution.");
}

main().catch(console.error);
