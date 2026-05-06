const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, mine, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ResurgenceGovernance", function () {
  async function deployGovernanceFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();
    
    // Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    const resurgeToken = await upgrades.deployProxy(ResurgeToken, [owner.address, ethers.parseEther("1000000000")], { kind: 'uups' });
    await resurgeToken.waitForDeployment();
    
    // Deploy TimelockController
    const ResurgenceTimelockController = await ethers.getContractFactory("ResurgenceTimelockController");
    const minDelay = 3600; // 1 hour
    const proposers = [];
    const executors = [];
    const admin = owner.address;
    
    const timelockController = await ResurgenceTimelockController.deploy(minDelay, proposers, executors, admin);
    
    // Deploy ResurgenceGovernance
    const ResurgenceGovernance = await ethers.getContractFactory("ResurgenceGovernance");
    const votingDelay = 1;
    const votingPeriod = 50400;
    const quorumPercentage = 4;
    const proposalThreshold = ethers.parseEther("1000");
    
    const governance = await ResurgenceGovernance.deploy(
      await resurgeToken.getAddress(),
      await timelockController.getAddress(),
      votingDelay,
      votingPeriod,
      quorumPercentage,
      proposalThreshold
    );
    
    // Grant roles to governance contract
    const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
    await timelockController.grantRole(PROPOSER_ROLE, await governance.getAddress());
    await timelockController.grantRole(EXECUTOR_ROLE, await governance.getAddress());
    
    // Grant MINTER_ROLE of token to Timelock
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.grantRole(MINTER_ROLE, await timelockController.getAddress());
    
    // Setup roles for setup
    await timelockController.grantRole(PROPOSER_ROLE, owner.address);
    
    // Mint and delegate
    const mintAmount = ethers.parseEther("100000");
    await resurgeToken.mint(owner.address, mintAmount);
    await resurgeToken.mint(addr1.address, mintAmount);
    await resurgeToken.connect(owner).delegate(owner.address);
    await resurgeToken.connect(addr1).delegate(addr1.address);
    
    return {
      governance,
      resurgeToken,
      timelockController,
      owner,
      addr1,
      addr2,
      addr3,
      votingDelay,
      votingPeriod,
      quorumPercentage
    };
  }

  describe("Proposal Execution", function () {
    async function createAndPassProposalFixture() {
      const fixture = await deployGovernanceFixture();
      const { governance, resurgeToken, addr1, owner } = fixture;
      
      const targets = [await resurgeToken.getAddress()];
      const values = [0];
      const calldatas = [resurgeToken.interface.encodeFunctionData("mint", [addr1.address, ethers.parseEther("1000")])];
      const description = "Mint 1000 tokens to addr1";
      
      const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(log => log.fragment?.name === "ProposalCreated")?.args?.proposalId;
      
      await mine(2);
      await governance.connect(owner).castVote(proposalId, 1);
      await governance.connect(addr1).castVote(proposalId, 1);
      await mine(50401);
      
      return { ...fixture, proposalId, targets, values, calldatas, description };
    }
    
    it("Should execute queued proposals after timelock delay", async function () {
      const { governance, resurgeToken, addr1, targets, values, calldatas, description } = await createAndPassProposalFixture();
      await governance.queue(targets, values, calldatas, ethers.id(description));
      await time.increase(3601);
      
      const balanceBefore = await resurgeToken.balanceOf(addr1.address);
      await governance.execute(targets, values, calldatas, ethers.id(description));
      const balanceAfter = await resurgeToken.balanceOf(addr1.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Real-World Governance Scenarios", function () {
    it("Should successfully add a new staking pool via governance", async function () {
      const { governance, timelockController, resurgeToken, owner, addr1 } = await deployGovernanceFixture();
      
      // Setup Infrastructure
      const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
      const newDeadCoin = await ERC20Mock.deploy("New Dead Coin", "NDC", ethers.parseEther("1000000"));
      
      const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
      const distributor = await upgrades.deployProxy(RewardDistributor, [
        await resurgeToken.getAddress(),
        ethers.parseEther("500000000"),
        await timelockController.getAddress()
      ], { kind: 'uups' });
      
      const DeadCoinStakingPool = await ethers.getContractFactory("DeadCoinStakingPool");
      const poolImpl = await DeadCoinStakingPool.deploy();
      
      const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
      const manager = await upgrades.deployProxy(StakingPoolManager, [
        await resurgeToken.getAddress(),
        await distributor.getAddress(),
        await poolImpl.getAddress(),
        await timelockController.getAddress()
      ], { kind: 'uups' });
      
      // Setup Roles
      await distributor.grantRole(await distributor.TIMELOCK_ROLE(), await manager.getAddress());
      await distributor.grantRole(await distributor.TIMELOCK_ROLE(), await timelockController.getAddress());
      await manager.grantRole(await manager.TIMELOCK_ROLE(), await timelockController.getAddress());
      await resurgeToken.grantRole(await resurgeToken.MINTER_ROLE(), await distributor.getAddress());

      // Propose adding a new pool
      const targets = [await manager.getAddress()];
      const values = [0];
      const calldatas = [manager.interface.encodeFunctionData("addStakingPool", [
        await newDeadCoin.getAddress(),
        ethers.parseEther("1"),
        await timelockController.getAddress()
      ])];
      const description = "Proposal #1: Add New Dead Coin (NDC) Staking Pool";
      
      const tx = await governance.connect(addr1).propose(targets, values, calldatas, description);
      const receipt = await tx.wait();
      const proposalId = receipt.logs.find(log => log.fragment?.name === "ProposalCreated")?.args?.proposalId;
      
      await mine(2);
      await governance.connect(owner).castVote(proposalId, 1);
      await governance.connect(addr1).castVote(proposalId, 1);
      await mine(50401);
      
      await governance.queue(targets, values, calldatas, ethers.id(description));
      await time.increase(3601);
      
      // Execute
      await governance.execute(targets, values, calldatas, ethers.id(description));
      
      // Verify
      const poolAddress = await manager.deadCoinToPoolAddress(await newDeadCoin.getAddress());
      expect(poolAddress).to.not.equal(ethers.ZeroAddress);
      
      const pool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);
      expect(await pool.rewardRatePerSecond()).to.equal(ethers.parseEther("1"));
    });
  });
});