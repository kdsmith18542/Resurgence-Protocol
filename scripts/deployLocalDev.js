const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address, "\n");

  // =====================================================
  // 1. Deploy implementation contracts first
  // =====================================================

  console.log("1. Deploying ResurgeToken implementation...");
  const ResurgeToken = await hre.ethers.getContractFactory("ResurgeToken");
  const tokenImpl = await ResurgeToken.deploy();
  await tokenImpl.waitForDeployment();
  const tokenImplAddr = await tokenImpl.getAddress();
  console.log("   Impl:", tokenImplAddr);

  console.log("\n2. Deploying RewardDistributor implementation...");
  const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
  const rdImpl = await RewardDistributor.deploy();
  await rdImpl.waitForDeployment();
  const rdImplAddr = await rdImpl.getAddress();
  console.log("   Impl:", rdImplAddr);

  console.log("\n3. Deploying DeadCoinStakingPool implementation...");
  const DeadCoinStakingPool = await hre.ethers.getContractFactory("DeadCoinStakingPool");
  const poolImpl = await DeadCoinStakingPool.deploy();
  await poolImpl.waitForDeployment();
  const poolImplAddr = await poolImpl.getAddress();
  console.log("   Impl:", poolImplAddr);

  console.log("\n4. Deploying StakingPoolManager implementation...");
  const StakingPoolManager = await hre.ethers.getContractFactory("StakingPoolManager");
  const mgrImpl = await StakingPoolManager.deploy();
  await mgrImpl.waitForDeployment();
  const mgrImplAddr = await mgrImpl.getAddress();
  console.log("   Impl:", mgrImplAddr);

  console.log("\n5. Deploying ResurgeStakingPool implementation...");
  const ResurgeStakingPool = await hre.ethers.getContractFactory("ResurgeStakingPool");
  const rspImpl = await ResurgeStakingPool.deploy();
  await rspImpl.waitForDeployment();
  const rspImplAddr = await rspImpl.getAddress();
  console.log("   Impl:", rspImplAddr);

  // =====================================================
  // 6. Deploy Proxies with initializers
  // =====================================================

  console.log("\n6. Deploying ERC1967Proxy for ResurgeToken...");
  const maxSupply = 1000000000000000000000000000n;
  const tokenInitData = ResurgeToken.interface.encodeFunctionData("initialize", [deployer.address, maxSupply]);
  const ERC1967Proxy = await hre.ethers.getContractFactory("ERC1967Proxy");
  const tokenProxy = await ERC1967Proxy.deploy(tokenImplAddr, tokenInitData);
  await tokenProxy.waitForDeployment();
  const tokenAddr = await tokenProxy.getAddress();
  console.log("   ResurgeToken proxy:", tokenAddr);

  console.log("\n7. Deploying TimelockController...");
  const ResurgenceTimelockController = await hre.ethers.getContractFactory("ResurgenceTimelockController");
  const timelockController = await ResurgenceTimelockController.deploy(3600, [deployer.address], [deployer.address], deployer.address);
  await timelockController.waitForDeployment();
  const timelockAddr = await timelockController.getAddress();
  console.log("   TimelockController:", timelockAddr);

  console.log("\n8. Deploying ERC1967Proxy for RewardDistributor...");
  const rdInitData = RewardDistributor.interface.encodeFunctionData("initialize", [tokenAddr, 500000000n * 10n**18n, timelockAddr]);
  const rdProxy = await ERC1967Proxy.deploy(rdImplAddr, rdInitData);
  await rdProxy.waitForDeployment();
  const rdAddr = await rdProxy.getAddress();
  console.log("   RewardDistributor proxy:", rdAddr);

  console.log("\n9. Deploying ERC1967Proxy for StakingPoolManager...");
  const mgrInitData = StakingPoolManager.interface.encodeFunctionData("initialize", [tokenAddr, rdAddr, poolImplAddr, timelockAddr]);
  const mgrProxy = await ERC1967Proxy.deploy(mgrImplAddr, mgrInitData);
  await mgrProxy.waitForDeployment();
  const mgrAddr = await mgrProxy.getAddress();
  console.log("   StakingPoolManager proxy:", mgrAddr);

  console.log("\n10. Deploying ERC1967Proxy for ResurgeStakingPool...");
  const rspInitData = ResurgeStakingPool.interface.encodeFunctionData("initialize", [tokenAddr, rdAddr, timelockAddr, 1000000000000000000n]);
  const rspProxy = await ERC1967Proxy.deploy(rspImplAddr, rspInitData);
  await rspProxy.waitForDeployment();
  const rspAddr = await rspProxy.getAddress();
  console.log("   ResurgeStakingPool proxy:", rspAddr);

  // =====================================================
  // 11. Grant roles
  // =====================================================

  console.log("\n11. Granting roles...");
  const token = await hre.ethers.getContractAt("ResurgeToken", tokenAddr, deployer);
  const rd = await hre.ethers.getContractAt("RewardDistributor", rdAddr, deployer);
  const mgr = await hre.ethers.getContractAt("StakingPoolManager", mgrAddr, deployer);

  const MINTER_ROLE = await token.MINTER_ROLE();
  await token.grantRole(MINTER_ROLE, rdAddr);
  console.log("   MINTER_ROLE -> RewardDistributor");

  await rd.authorizeStakingPool(rspAddr);
  console.log("   ResurgeStakingPool authorized");

  // =====================================================
  // 12. Governance
  // =====================================================

  console.log("\n12. Deploying ResurgenceGovernance...");
  const ResurgenceGovernance = await hre.ethers.getContractFactory("ResurgenceGovernance");
  const resurgenceGovernance = await ResurgenceGovernance.deploy(tokenAddr, timelockAddr, 1, 50400, 4, 1000n * 10n**18n);
  await resurgenceGovernance.waitForDeployment();
  const govAddr = await resurgenceGovernance.getAddress();
  console.log("   ResurgenceGovernance:", govAddr);

  const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
  await timelockController.grantRole(PROPOSER_ROLE, govAddr);
  await timelockController.grantRole(EXECUTOR_ROLE, govAddr);
  await timelockController.grantRole(PROPOSER_ROLE, deployer.address);
  await timelockController.grantRole(EXECUTOR_ROLE, deployer.address);
  console.log("   Timelock roles configured");

  // =====================================================
  // 13. Deploy mock ERC20s and create pools
  // =====================================================

  console.log("\n--- Creating Test Staking Pools ---\n");

  const ERC20Mock = await hre.ethers.getContractFactory("ERC20Mock");
  const mockTokens = [
    { name: "Dead Doge", symbol: "DDOGE", supply: 1000000000n * 10n**18n },
    { name: "Zombie Coin", symbol: "ZOMB", supply: 1000000000n * 10n**18n },
    { name: "Ghost Token", symbol: "GHOST", supply: 1000000000n * 10n**18n },
  ];

  const accounts = await hre.ethers.getSigners();
  const poolAddresses = [];
  const deadCoinAddresses = [];

  for (const mt of mockTokens) {
    console.log(`Deploying ${mt.name} (${mt.symbol})...`);
    const mock = await ERC20Mock.deploy(mt.name, mt.symbol, mt.supply);
    await mock.waitForDeployment();
    const mockAddr = await mock.getAddress();
    deadCoinAddresses.push(mockAddr);

    for (let i = 1; i <= 3; i++) {
      await mock.transfer(accounts[i].address, 1000000n * 10n**18n);
    }
    console.log(`   Token: ${mockAddr}`);

    // Manually create pool: deploy proxy with init data
    const poolInitData = DeadCoinStakingPool.interface.encodeFunctionData("initialize", [
      mockAddr, tokenAddr, rdAddr, mgrAddr, timelockAddr, timelockAddr
    ]);
    const poolProxy = await ERC1967Proxy.deploy(poolImplAddr, poolInitData);
    await poolProxy.waitForDeployment();
    const poolAddr = await poolProxy.getAddress();
    console.log(`   Pool:  ${poolAddr}`);

    // Register: deployer has DEFAULT_ADMIN_ROLE + TIMELOCK_ROLE on mgr
    // Need to grant TIMELOCK_ROLE to the pool so it can manage itself
    const pool = await hre.ethers.getContractAt("DeadCoinStakingPool", poolAddr, deployer);
    await pool.grantRole(await pool.TIMELOCK_ROLE(), mgrAddr);

    // Set reward rate (TIMELOCK_ROLE required)
    await mgr['addStakingPool(address,uint256,address,address)'](mockAddr, 1000000000000000000n, timelockAddr, timelockAddr);

    poolAddresses.push(poolAddr);
    console.log(`   Registered in StakingPoolManager`);
  }

  // Print summary
  console.log("\n============================================");
  console.log("  LOCAL DEV DEPLOYMENT COMPLETE");
  console.log("============================================");
  console.log(`ResurgeToken (proxy):         ${tokenAddr}`);
  console.log(`TimelockController:            ${timelockAddr}`);
  console.log(`RewardDistributor (proxy):     ${rdAddr}`);
  console.log(`DeadCoinStakingPool (impl):    ${poolImplAddr}`);
  console.log(`ResurgeStakingPool (proxy):   ${rspAddr}`);
  console.log(`StakingPoolManager (proxy):    ${mgrAddr}`);
  console.log(`ResurgenceGovernance:          ${govAddr}`);
  console.log("");
  for (let i = 0; i < mockTokens.length; i++) {
    console.log(`  ${mockTokens[i].symbol}: Token=${deadCoinAddresses[i]}, Pool=${poolAddresses[i]}`);
  }
  console.log("\nTest accounts with tokens: accounts[1-3] (indices 1-3)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
