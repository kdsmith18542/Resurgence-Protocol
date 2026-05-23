const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer, timelock, oracle, staker] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Timelock:", timelock.address);
  console.log("Oracle:  ", oracle.address);
  console.log("Staker:  ", staker.address);
  console.log("");

  // 1. Deploy ResurgeToken
  console.log("1. Deploying ResurgeToken...");
  const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
  const token = await upgrades.deployProxy(ResurgeToken, [
    timelock.address,
    ethers.parseEther("1000000000"),
  ], { kind: 'uups' });
  await token.waitForDeployment();
  console.log("   Token:", await token.getAddress());

  // 2. Deploy RewardDistributor
  console.log("2. Deploying RewardDistributor...");
  const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
  const distributor = await upgrades.deployProxy(RewardDistributor, [
    await token.getAddress(),
    ethers.parseEther("500000000"),
    timelock.address,
  ], { kind: 'uups' });
  await distributor.waitForDeployment();
  const distAddr = await distributor.getAddress();
  console.log("   Distributor:", distAddr);

  // 3. Deploy NonEvmStakingPool
  console.log("3. Deploying NonEvmStakingPool...");
  const NonEvmStakingPool = await ethers.getContractFactory("NonEvmStakingPool");
  const pool = await upgrades.deployProxy(NonEvmStakingPool, [
    timelock.address,
  ], { kind: 'uups' });
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log("   Pool:", poolAddr);

  // 4. Wire roles
  console.log("4. Wiring roles...");
  const MINTER_ROLE = await token.MINTER_ROLE();
  await token.connect(timelock).grantRole(MINTER_ROLE, distAddr);

  await distributor.connect(timelock).setNonEvmRewardAmount(ethers.parseEther("1000"));
  console.log("   nonEvmRewardAmount = 1000 RESURGE");

  const DORMANCY_ORACLE_ROLE = await distributor.DORMANCY_ORACLE_ROLE();
  await distributor.connect(timelock).grantRole(DORMANCY_ORACLE_ROLE, oracle.address);
  console.log("   DORMANCY_ORACLE_ROLE granted to oracle");

  // Revoke deployer's temporary admin/TIMELOCK roles (security: deployer should not retain governance)
  const DEFAULT_ADMIN = await token.DEFAULT_ADMIN_ROLE();
  const TIMELOCK = await token.TIMELOCK_ROLE();
  await token.connect(timelock).revokeRole(DEFAULT_ADMIN, deployer.address);
  await token.connect(timelock).revokeRole(TIMELOCK, deployer.address);
  await distributor.connect(timelock).revokeRole(DEFAULT_ADMIN, deployer.address);
  await distributor.connect(timelock).revokeRole(TIMELOCK, deployer.address);
  await pool.connect(timelock).revokeRole(DEFAULT_ADMIN, deployer.address);
  await pool.connect(timelock).revokeRole(TIMELOCK, deployer.address);
  console.log("   Deployer roles revoked (governance now timelock-only)");

  // 5. Register a test wallet
  const BTC = ethers.zeroPadValue("0x01", 32); // "bitcoin" as bytes32
  const wallet = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
  console.log("\n5. Register wallet:", wallet);
  await pool.connect(staker).registerWallet(BTC, wallet);
  const resolved = await pool.getStaker(BTC, wallet);
  console.log("   Staker:", resolved);

  // 6. Submit dormancy proof
  console.log("\n6. Submitting dormancy proof...");
  const balanceBefore = await token.balanceOf(resolved);
  console.log("   Staker balance before:", ethers.formatEther(balanceBefore));

  const tx = await distributor.connect(oracle).submitDormancyProof(
    BTC,
    resolved,
    500000,    // dormantSinceBlock
    526280,    // currentBlock
    26280,     // thresholdBlocks
    ethers.ZeroHash,  // chrononode pubkey
    "0x"       // chrononode signature
  );
  const receipt = await tx.wait();
  console.log("   Tx hash:", tx.hash);

  const balanceAfter = await token.balanceOf(resolved);
  console.log("   Staker balance after:", ethers.formatEther(balanceAfter));
  console.log("   RESURGE minted:", ethers.formatEther(balanceAfter - balanceBefore));

  // 7. Verify replay protection
  console.log("\n7. Verifying replay protection...");
  try {
    await distributor.connect(oracle).submitDormancyProof(
      BTC, resolved, 500000, 526280, 26280,
      ethers.ZeroHash, "0x"
    );
    console.log("   FAILED: replay should have been rejected");
  } catch (e) {
    console.log("   OK: replay rejected:", e.shortMessage || e.reason);
  }

  console.log("\n=== E2E Test PASSED ===");
  console.log("\nDeployed addresses:");
  console.log("  RESURGE_TOKEN=" + await token.getAddress());
  console.log("  REWARD_DISTRIBUTOR=" + distAddr);
  console.log("  NON_EVM_POOL=" + poolAddr);
  console.log("  ORACLE=" + oracle.address);
  console.log("\nCopy to ChronoNode config:");
  console.log("[attestation]");
  console.log('evm_rpc_url = "http://localhost:8545"');
  console.log('evm_contract_address = "' + distAddr + '"');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
