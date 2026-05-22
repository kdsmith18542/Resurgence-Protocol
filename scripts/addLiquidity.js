/**
 * addLiquidity.js — Seed initial RESURGE/MATIC liquidity on Quickswap V3 (Polygon mainnet)
 *
 * Usage:
 *   RESURGE_ADDRESS=0x... LIQUIDITY_MATIC=1000 LIQUIDITY_RESURGE=100000 \
 *   npx hardhat run scripts/addLiquidity.js --network polygon
 *
 * Required env vars:
 *   RESURGE_TOKEN_ADDRESS — deployed RESURGE proxy address
 *   LIQUIDITY_MATIC       — MATIC to seed (e.g. "1000")
 *   LIQUIDITY_RESURGE     — RESURGE to seed (e.g. "100000")
 *
 * Optional:
 *   QUICKSWAP_ROUTER      — Quickswap V3 SwapRouter address (default: Polygon mainnet)
 *   QUICKSWAP_FACTORY     — Quickswap V3 factory address
 *   WMATIC_ADDRESS        — Wrapped MATIC (default: Polygon mainnet)
 *   POOL_FEE              — Uniswap V3 fee tier in bps*100, e.g. 3000 = 0.3% (default: 3000)
 */

const hre = require("hardhat");
const { ethers } = hre;

// Polygon mainnet defaults
const DEFAULTS = {
  quickswapRouter: "0xf5b509bB0909a69B1c207E495f687a596C168E12", // Quickswap V3 SwapRouter
  quickswapFactory: "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28", // Quickswap V3 Factory
  quickswapPositionManager: "0x8eF88E4c7CfbbaC1C163f7eddd4B578792201de6", // NonfungiblePositionManager
  wmatic: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC on Polygon
  poolFee: 3000, // 0.3%
};

// Minimal ABI fragments for the contracts we interact with
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const WMATIC_ABI = [
  ...ERC20_ABI,
  "function deposit() external payable",
];

// Quickswap V3 NonfungiblePositionManager (same interface as Uniswap V3)
const POSITION_MANAGER_ABI = [
  "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
  "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
];

// Quickswap V3 Factory
const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

function encodeSqrtRatioX96(amount0, amount1) {
  // sqrtPriceX96 = sqrt(amount1/amount0) * 2^96
  // Using BigInt math to avoid precision loss
  const numerator = BigInt(amount1.toString()) * (2n ** 192n);
  const denominator = BigInt(amount0.toString());
  const ratioX192 = numerator / denominator;
  // Integer square root approximation
  let x = ratioX192;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + ratioX192 / x) / 2n;
  }
  return x;
}

// Min/max ticks for the full range at 0.3% fee (tick spacing = 60)
const MIN_TICK = -887220;
const MAX_TICK = 887220;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding liquidity with:", deployer.address);
  const maticBalance = await ethers.provider.getBalance(deployer.address);
  console.log("MATIC balance:", ethers.formatEther(maticBalance), "MATIC\n");

  const resurgeAddress = process.env.RESURGE_TOKEN_ADDRESS;
  if (!resurgeAddress) throw new Error("RESURGE_TOKEN_ADDRESS env var required");

  const liquidityMatic = ethers.parseEther(process.env.LIQUIDITY_MATIC || "100");
  const liquidityResurge = ethers.parseEther(process.env.LIQUIDITY_RESURGE || "10000");
  const poolFee = parseInt(process.env.POOL_FEE || DEFAULTS.poolFee);
  const wmaticAddress = process.env.WMATIC_ADDRESS || DEFAULTS.wmatic;
  const positionManagerAddress = process.env.QUICKSWAP_POSITION_MANAGER || DEFAULTS.quickswapPositionManager;
  const factoryAddress = process.env.QUICKSWAP_FACTORY || DEFAULTS.quickswapFactory;

  console.log("Config:");
  console.log("  RESURGE:", resurgeAddress);
  console.log("  WMATIC:", wmaticAddress);
  console.log("  MATIC to seed:", ethers.formatEther(liquidityMatic));
  console.log("  RESURGE to seed:", ethers.formatEther(liquidityResurge));
  console.log("  Pool fee:", poolFee / 10000, "%\n");

  // 1. Wrap MATIC → WMATIC
  console.log("1. Wrapping MATIC...");
  const wmatic = await ethers.getContractAt(WMATIC_ABI, wmaticAddress);
  const wrapTx = await wmatic.deposit({ value: liquidityMatic });
  await wrapTx.wait();
  console.log("   Wrapped", ethers.formatEther(liquidityMatic), "MATIC → WMATIC");

  // 2. Approve position manager for both tokens
  console.log("\n2. Approving position manager...");
  const resurge = await ethers.getContractAt(ERC20_ABI, resurgeAddress);
  await (await resurge.approve(positionManagerAddress, liquidityResurge)).wait();
  await (await wmatic.approve(positionManagerAddress, liquidityMatic)).wait();
  console.log("   Approvals done");

  // 3. Determine token order (Uniswap V3 requires token0 < token1 by address)
  const [token0, token1, amount0Desired, amount1Desired] =
    resurgeAddress.toLowerCase() < wmaticAddress.toLowerCase()
      ? [resurgeAddress, wmaticAddress, liquidityResurge, liquidityMatic]
      : [wmaticAddress, resurgeAddress, liquidityMatic, liquidityResurge];

  console.log("\n3. Token order:");
  console.log("   token0:", token0);
  console.log("   token1:", token1);

  // 4. Create/initialize pool if it doesn't exist
  console.log("\n4. Initializing pool...");
  const factory = await ethers.getContractAt(FACTORY_ABI, factoryAddress);
  const existingPool = await factory.getPool(token0, token1, poolFee);

  const positionManager = await ethers.getContractAt(POSITION_MANAGER_ABI, positionManagerAddress);

  if (existingPool === ethers.ZeroAddress) {
    // Calculate initial price: amount1/amount0 ratio
    const sqrtPriceX96 = encodeSqrtRatioX96(amount0Desired, amount1Desired);
    console.log("   Pool does not exist — creating and initializing...");
    const initTx = await positionManager.createAndInitializePoolIfNecessary(
      token0, token1, poolFee, sqrtPriceX96
    );
    await initTx.wait();
    console.log("   Pool created");
  } else {
    console.log("   Pool exists at:", existingPool);
  }

  // 5. Add liquidity (full range)
  console.log("\n5. Adding liquidity (full range)...");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const mintTx = await positionManager.mint({
    token0,
    token1,
    fee: poolFee,
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    amount0Desired,
    amount1Desired,
    amount0Min: 0n,
    amount1Min: 0n,
    recipient: deployer.address,
    deadline,
  });
  const receipt = await mintTx.wait();
  console.log("   Liquidity added! Tx:", receipt.hash);

  console.log("\n========== LIQUIDITY SEEDING COMPLETE ==========");
  console.log("RESURGE/WMATIC pool on Quickswap V3");
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  console.log("Fee tier:", poolFee / 10000, "%");
  console.log("=================================================\n");
  console.log("Next steps:");
  console.log("  1. Verify the pool on Quickswap: https://quickswap.exchange/#/pool");
  console.log("  2. Set NEXT_PUBLIC_POOL_ADDRESS in frontend .env");
  console.log("  3. Consider concentrating liquidity near current price for better LP returns");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
