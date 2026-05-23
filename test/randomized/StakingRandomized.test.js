const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Staking Randomized Invariant Testing", function () {
  let resurgeToken, distributor, manager, poolImpl, deadCoin;
  let timelock, owner, users;
  let poolAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000");
  const MAX_MINT = ethers.parseEther("500000000");
  const REWARD_RATE = ethers.parseEther("1");

  before(async function () {
    [owner, ...users] = await ethers.getSigners();
    // Limit to 5 users for speed
    users = users.slice(0, 5);

    // Deploy core
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [owner.address, INITIAL_SUPPLY], { kind: 'uups' });

    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    distributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      MAX_MINT,
      owner.address
    ], { kind: 'uups' });

    const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
    poolImpl = await PoolImpl.deploy();

    const Manager = await ethers.getContractFactory("StakingPoolManager");
    manager = await upgrades.deployProxy(Manager, [
      await resurgeToken.getAddress(),
      await distributor.getAddress(),
      await poolImpl.getAddress(),
      owner.address
    ], { kind: 'uups' });

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await ERC20Mock.deploy("DeadCoin", "DEAD", INITIAL_SUPPLY);

    // Setup roles
    await resurgeToken.grantRole(await resurgeToken.MINTER_ROLE(), await distributor.getAddress());
    await distributor.grantRole(await distributor.TIMELOCK_ROLE(), await manager.getAddress());
    await distributor.authorizeStakingPool(owner.address); // For testing
    
    // Add pool
    const tx = await manager.addStakingPool(await deadCoin.getAddress(), REWARD_RATE, owner.address, owner.address);
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment && l.fragment.name === 'StakingPoolAdded');
    poolAddress = event.args.poolAddress;

    // Fund users
    for (let user of users) {
      await deadCoin.mint(user.address, ethers.parseEther("1000000"));
      await deadCoin.connect(user).approve(poolAddress, ethers.MaxUint256);
    }
  });

  it("Should maintain invariants over 100 random operations", async function () {
    const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
    const numOps = 100;
    
    for (let i = 0; i < numOps; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const op = Math.floor(Math.random() * 3); // 0: stake, 1: unstake, 2: claim, 3: warp

      if (op === 0) {
        // Stake
        const amount = ethers.parseEther((Math.random() * 1000 + 1).toFixed(4));
        await pool.connect(user).stake(amount);
      } else if (op === 1) {
        // Unstake
        const staked = await pool.userStakedAmount(user.address);
        if (staked > 0n) {
          const amount = staked / 2n + 1n;
          const finalAmount = amount > staked ? staked : amount;
          await pool.connect(user).unstake(finalAmount);
        }
      } else if (op === 2) {
        // Claim
        await pool.connect(user).claimRewards();
      }

      // Random time warp (up to 1 day)
      const seconds = Math.floor(Math.random() * 86400);
      await ethers.provider.send("evm_increaseTime", [seconds]);
      await ethers.provider.send("evm_mine");

      // Verify Invariants
      const totalStaked = await pool.totalStakedSupply();
      let sumUserStaked = 0n;
      for (let u of users) {
        sumUserStaked += await pool.userStakedAmount(u.address);
        const earned = await pool.earned(u.address);
        expect(earned).to.be.at.least(0n, `User ${u.address} earned negative rewards`);
      }
      expect(totalStaked).to.equal(sumUserStaked, "Invariant: totalStakedSupply != sum(userStakedAmount)");

      const totalMinted = await distributor.totalResurgeMinted();
      expect(totalMinted).to.be.at.most(MAX_MINT, "Invariant: totalResurgeMinted > maxMintSupply");
    }
  });
});
