/**
 * testBaseSepoliaE2E.js
 *
 * End-to-end test for Base Sepolia spoke: stake DEADTEST → bridgeClaim() → CCIP → hub.
 *
 * Run AFTER deployBaseSepoliaPool.js and hub authorization via governance.
 *
 * Usage:
 *   DEAD_COIN_ADDRESS=0x... POOL_PROXY_ADDRESS=0x... \
 *   BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com \
 *   npx hardhat run scripts/testBaseSepoliaE2E.js --network baseSepolia
 */

const hre = require("hardhat");

const DEAD_COIN_ADDRESS  = process.env.DEAD_COIN_ADDRESS  || "";
const POOL_PROXY_ADDRESS = process.env.POOL_PROXY_ADDRESS || "";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  if (!DEAD_COIN_ADDRESS || !POOL_PROXY_ADDRESS)
    throw new Error("Set DEAD_COIN_ADDRESS and POOL_PROXY_ADDRESS env vars");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Tester:  ", deployer.address);
  console.log("Pool:    ", POOL_PROXY_ADDRESS);
  console.log("DeadCoin:", DEAD_COIN_ADDRESS);

  const deadCoin = await hre.ethers.getContractAt("ERC20Mock", DEAD_COIN_ADDRESS, deployer);
  const pool     = await hre.ethers.getContractAt("DeadCoinStakingPool", POOL_PROXY_ADDRESS, deployer);

  // Preflight
  const feeBps = await pool.protocolFeeBps();
  const sender  = await pool.crossChainSender();
  console.log(`\nprotocolFeeBps: ${feeBps} (must be 0 for spoke)`);
  console.log(`crossChainSender: ${sender}`);
  if (feeBps > 0n) throw new Error("protocolFeeBps > 0 — spoke pool misconfigured");
  if (sender === hre.ethers.ZeroAddress) throw new Error("crossChainSender not set");

  // Check CrossChainSender has LINK
  const erc20Abi = ["function balanceOf(address) external view returns (uint256)"];
  const link = await hre.ethers.getContractAt(erc20Abi, "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", deployer);
  const senderLink = await link.balanceOf(sender);
  console.log(`CrossChainSender LINK balance: ${hre.ethers.formatEther(senderLink)}`);
  if (senderLink === 0n) throw new Error("CrossChainSender has no LINK — fund it first");

  // 1. Mint DEADTEST if needed
  let balance = await deadCoin.balanceOf(deployer.address);
  console.log(`\nDEADTEST balance: ${hre.ethers.formatEther(balance)}`);
  if (balance === 0n) {
    console.log("Minting 1000 DEADTEST...");
    await (await deadCoin.mint(deployer.address, hre.ethers.parseEther("1000"))).wait();
    balance = await deadCoin.balanceOf(deployer.address);
    console.log(`New balance: ${hre.ethers.formatEther(balance)}`);
  }

  // 2. Approve + stake
  const stakeAmount = hre.ethers.parseEther("100");
  console.log(`\nApproving pool for ${hre.ethers.formatEther(stakeAmount)} DEADTEST...`);
  await (await deadCoin.approve(POOL_PROXY_ADDRESS, stakeAmount)).wait();

  console.log("Staking...");
  await (await pool.stake(stakeAmount)).wait();
  console.log(`Staked: ${hre.ethers.formatEther(await pool.userStakedAmount(deployer.address))} DEADTEST`);

  // 3. Wait for rewards
  console.log("\nWaiting 15s for rewards to accrue...");
  await sleep(15000);
  let pending = await pool.earned(deployer.address);
  console.log(`Pending rewards: ${hre.ethers.formatEther(pending)} RESURGE`);
  if (pending === 0n) {
    console.log("Waiting another 15s...");
    await sleep(15000);
    pending = await pool.earned(deployer.address);
    console.log(`Pending rewards: ${hre.ethers.formatEther(pending)} RESURGE`);
  }

  // 4. bridgeClaim
  console.log("\nCalling bridgeClaim()...");
  const tx = await pool.bridgeClaim();
  const receipt = await tx.wait();
  console.log(`✅ bridgeClaim tx: ${receipt.hash}`);
  console.log("Monitor on CCIP Explorer: https://ccip.chain.link");
  console.log("Hub CrossChainReceiver: 0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB (Arbitrum Sepolia)");
}

main().catch(err => { console.error(err); process.exit(1); });
