const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Cross-Chain CCIP (Phase 10.0)", function () {
  let owner, timelock, user, attacker;

  // Hub contracts
  let resurgeToken, rewardDistributor, crossChainReceiver, mockRouter;
  // Spoke contracts
  let deadCoin, stakingPoolManager, deadCoinPool, crossChainSender, mockLink;

  const INITIAL_SUPPLY   = ethers.parseEther("1000000000");
  const REWARD_RATE      = ethers.parseEther("1");
  const STAKE_AMOUNT     = ethers.parseEther("1000");
  const HUB_CHAIN_SEL    = 4949039107694359620n;   // Arbitrum One selector
  const SPOKE_CHAIN_SEL  = 11344663589394136015n;  // BSC mainnet selector

  beforeEach(async function () {
    [owner, timelock, user, attacker] = await ethers.getSigners();

    // ── Hub setup ──────────────────────────────────────────────────────────

    // Deploy ResurgeToken
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, INITIAL_SUPPLY], { kind: "uups" });
    await resurgeToken.waitForDeployment();

    // Deploy RewardDistributor
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_SUPPLY / 2n,
      timelock.address,
    ], { kind: "uups" });
    await rewardDistributor.waitForDeployment();

    // Grant MINTER_ROLE to RewardDistributor
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());

    // Deploy MockCCIPRouter
    const MockCCIPRouter = await ethers.getContractFactory("MockCCIPRouter");
    mockRouter = await MockCCIPRouter.deploy();
    await mockRouter.waitForDeployment();
    await mockRouter.setSupportedChain(HUB_CHAIN_SEL, true);
    await mockRouter.setSupportedChain(SPOKE_CHAIN_SEL, true);

    // Deploy CrossChainReceiver (hub)
    const CrossChainReceiver = await ethers.getContractFactory("CrossChainReceiver");
    crossChainReceiver = await CrossChainReceiver.deploy(
      await mockRouter.getAddress(),
      await rewardDistributor.getAddress(),
      timelock.address,
    );
    await crossChainReceiver.waitForDeployment();

    // Authorize CrossChainReceiver in RewardDistributor
    const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();
    await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);
    await rewardDistributor.authorizeBridge(await crossChainReceiver.getAddress());

    // ── Spoke setup ────────────────────────────────────────────────────────

    // Deploy mock LINK token
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    mockLink = await MockERC20.deploy("Chainlink", "LINK", ethers.parseEther("1000"));
    await mockLink.waitForDeployment();

    // Deploy CrossChainSender (spoke)
    const CrossChainSender = await ethers.getContractFactory("CrossChainSender");
    crossChainSender = await CrossChainSender.deploy(
      await mockRouter.getAddress(),
      await mockLink.getAddress(),
      HUB_CHAIN_SEL,
      await crossChainReceiver.getAddress(),
      timelock.address,
    );
    await crossChainSender.waitForDeployment();

    // Fund CrossChainSender with LINK (covers mock fee of 0.1 LINK per message)
    await mockLink.mint(await crossChainSender.getAddress(), ethers.parseEther("10"));

    // Deploy dead coin + staking pool for spoke
    deadCoin = await MockERC20.deploy("Dead Coin BSC", "DEAD", INITIAL_SUPPLY);
    await deadCoin.waitForDeployment();

    const PoolImpl = await ethers.getContractFactory("DeadCoinStakingPool");
    const poolImpl = await PoolImpl.deploy();
    await poolImpl.waitForDeployment();

    const StakingPoolManager = await ethers.getContractFactory("StakingPoolManager");
    stakingPoolManager = await upgrades.deployProxy(StakingPoolManager, [
      await resurgeToken.getAddress(),
      await rewardDistributor.getAddress(),
      await poolImpl.getAddress(),
      timelock.address,
    ], { kind: "uups" });
    await stakingPoolManager.waitForDeployment();

    const MANAGER_TIMELOCK_ROLE = await stakingPoolManager.TIMELOCK_ROLE();
    await stakingPoolManager.connect(timelock).grantRole(MANAGER_TIMELOCK_ROLE, owner.address);
    await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, await stakingPoolManager.getAddress());

    await stakingPoolManager.addStakingPool(
      await deadCoin.getAddress(),
      REWARD_RATE,
      timelock.address,
      timelock.address,
    );
    const poolAddress = await stakingPoolManager.deadCoinToPoolAddress(await deadCoin.getAddress());
    deadCoinPool = await ethers.getContractAt("DeadCoinStakingPool", poolAddress);

    // Grant TIMELOCK_ROLE on pool to owner for test convenience
    await deadCoinPool.connect(timelock).grantRole(
      await deadCoinPool.TIMELOCK_ROLE(),
      owner.address,
    );

    // Wire CrossChainSender into the pool
    await deadCoinPool.setCrossChainSender(await crossChainSender.getAddress());

    // Authorize the pool in CrossChainSender
    await crossChainSender.connect(timelock).authorizeCaller(poolAddress);

    // Authorize CrossChainSender (spoke) as a trusted source in CrossChainReceiver (hub)
    const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address"], [await crossChainSender.getAddress()]
    );
    await crossChainReceiver.connect(timelock).setAuthorizedSource(SPOKE_CHAIN_SEL, senderBytes);
  });

  // ── Helper ──────────────────────────────────────────────────────────────

  async function stakeAndAccrue(seconds = 100) {
    await deadCoin.mint(user.address, STAKE_AMOUNT);
    await deadCoin.connect(user).approve(await deadCoinPool.getAddress(), STAKE_AMOUNT);
    await deadCoinPool.connect(user).stake(STAKE_AMOUNT);
    await time.increase(seconds);
  }

  // ── CrossChainSender ────────────────────────────────────────────────────

  describe("CrossChainSender", function () {
    it("Should send a reward claim and emit RewardClaimSent", async function () {
      await stakeAndAccrue(10);

      const tx = await deadCoinPool.connect(user).bridgeClaim();
      const receipt = await tx.wait();

      const event = receipt.logs.find(l => l.fragment?.name === "BridgeClaimed");
      expect(event).to.not.be.undefined;
      expect(event.args.user).to.equal(user.address);
      expect(event.args.amount).to.be.gt(0);
    });

    it("Should zero out user rewards after bridgeClaim", async function () {
      await stakeAndAccrue(10);
      expect(await deadCoinPool.earned(user.address)).to.be.gt(0);

      await deadCoinPool.connect(user).bridgeClaim();
      expect(await deadCoinPool.userRewards(user.address)).to.equal(0);
    });

    it("Should revert bridgeClaim if no rewards accrued", async function () {
      // attacker has never staked — userRewards is 0
      await expect(deadCoinPool.connect(attacker).bridgeClaim())
        .to.be.revertedWithCustomError(deadCoinPool, "InvalidAmount");
    });

    it("Should revert bridgeClaim if CrossChainSender not configured", async function () {
      await deadCoinPool.setCrossChainSender(ethers.ZeroAddress);
      await stakeAndAccrue(10);
      await expect(deadCoinPool.connect(user).bridgeClaim())
        .to.be.revertedWithCustomError(deadCoinPool, "BridgeNotConfigured");
    });

    it("Should revert sendRewardClaim from unauthorized caller", async function () {
      await expect(
        crossChainSender.connect(attacker).sendRewardClaim(attacker.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_UnauthorizedCaller");
    });

    it("Should revert if LINK balance is insufficient", async function () {
      // Drain LINK
      await crossChainSender.connect(timelock).withdrawLink(
        owner.address,
        await mockLink.balanceOf(await crossChainSender.getAddress())
      );
      await stakeAndAccrue(10);
      await expect(deadCoinPool.connect(user).bridgeClaim())
        .to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_InsufficientLinkBalance");
    });

    it("Should respect maxLinkFee cap", async function () {
      // Set fee cap to 0 — any fee will exceed it
      await crossChainSender.connect(timelock).setMaxLinkFee(0);
      await stakeAndAccrue(10);
      await expect(deadCoinPool.connect(user).bridgeClaim())
        .to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_FeeTooHigh");
    });

    it("Should allow TIMELOCK_ROLE to withdraw LINK", async function () {
      const balance = await mockLink.balanceOf(await crossChainSender.getAddress());
      await crossChainSender.connect(timelock).withdrawLink(owner.address, balance);
      expect(await mockLink.balanceOf(await crossChainSender.getAddress())).to.equal(0);
    });

    it("Should prevent non-timelock from withdrawing LINK", async function () {
      await expect(
        crossChainSender.connect(attacker).withdrawLink(attacker.address, 1)
      ).to.be.reverted;
    });
  });

  // ── CrossChainReceiver ──────────────────────────────────────────────────

  describe("CrossChainReceiver", function () {
    it("Should mint RESURGE when a valid message is delivered", async function () {
      const amount = ethers.parseEther("500");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, amount]);
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-1"));
      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );

      const balanceBefore = await resurgeToken.balanceOf(user.address);

      await mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId,
        SPOKE_CHAIN_SEL,
        senderBytes,
        payload,
      );

      expect(await resurgeToken.balanceOf(user.address)).to.equal(balanceBefore + amount);
    });

    it("Should emit RewardBridged event", async function () {
      const amount = ethers.parseEther("200");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, amount]);
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-2"));
      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );

      await expect(mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId, SPOKE_CHAIN_SEL, senderBytes, payload,
      ))
        .to.emit(crossChainReceiver, "RewardBridged")
        .withArgs(messageId, SPOKE_CHAIN_SEL, user.address, amount);
    });

    it("Should reject duplicate message IDs (replay guard)", async function () {
      const amount = ethers.parseEther("100");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, amount]);
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-dupe"));
      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );

      await mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId, SPOKE_CHAIN_SEL, senderBytes, payload,
      );

      await expect(mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId, SPOKE_CHAIN_SEL, senderBytes, payload,
      )).to.be.revertedWithCustomError(crossChainReceiver, "CrossChainReceiver_MessageAlreadyProcessed");
    });

    it("Should reject messages from unauthorized source chain", async function () {
      const amount = ethers.parseEther("100");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, amount]);
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-bad-chain"));
      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );
      const unknownChain = 999999n;

      await expect(mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId, unknownChain, senderBytes, payload,
      )).to.be.revertedWithCustomError(crossChainReceiver, "CrossChainReceiver_UnauthorizedSource");
    });

    it("Should reject messages from unauthorized sender address", async function () {
      const amount = ethers.parseEther("100");
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, amount]);
      const messageId = ethers.keccak256(ethers.toUtf8Bytes("test-message-bad-sender"));
      const badSenderBytes = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [attacker.address]);

      await expect(mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        messageId, SPOKE_CHAIN_SEL, badSenderBytes, payload,
      )).to.be.revertedWithCustomError(crossChainReceiver, "CrossChainReceiver_UnauthorizedSource");
    });

    it("Should reject ccipReceive from non-router caller", async function () {
      // Build a minimal message and call ccipReceive directly (not via router)
      const payload = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [user.address, 1n]);
      const fakeMessage = {
        messageId: ethers.keccak256(ethers.toUtf8Bytes("direct")),
        sourceChainSelector: SPOKE_CHAIN_SEL,
        sender: ethers.AbiCoder.defaultAbiCoder().encode(["address"], [await crossChainSender.getAddress()]),
        data: payload,
        destTokenAmounts: [],
      };
      await expect(crossChainReceiver.connect(attacker).ccipReceive(fakeMessage))
        .to.be.revertedWithCustomError(crossChainReceiver, "CrossChainReceiver_OnlyRouter");
    });

    it("Should allow revoking and re-authorizing a source", async function () {
      await crossChainReceiver.connect(timelock).revokeAuthorizedSource(SPOKE_CHAIN_SEL);
      // ethers.js returns empty bytes as "0x"; use dataLength for the byte count
      expect(
        ethers.dataLength(await crossChainReceiver.authorizedSources(SPOKE_CHAIN_SEL))
      ).to.equal(0);

      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );
      await crossChainReceiver.connect(timelock).setAuthorizedSource(SPOKE_CHAIN_SEL, senderBytes);
      expect(
        ethers.dataLength(await crossChainReceiver.authorizedSources(SPOKE_CHAIN_SEL))
      ).to.be.gt(0);
    });
  });

  // ── RewardDistributor bridge extension ─────────────────────────────────

  describe("RewardDistributor.mintForBridge", function () {
    it("Should only be callable by an authorized bridge", async function () {
      await expect(
        rewardDistributor.connect(attacker).mintForBridge(user.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_UnauthorizedPool");
    });

    it("Should enforce the maxMintSupply cap", async function () {
      const maxMint = await rewardDistributor.maxMintSupply();
      const alreadyMinted = await rewardDistributor.totalResurgeMinted();
      const remaining = maxMint - alreadyMinted;

      // Try to mint 1 more than remaining
      const authorizedBridge = await crossChainReceiver.getAddress();
      // Temporarily call directly via authorizeBridge + spoof
      // Use the authorized CrossChainReceiver to simulate
      // We can't easily call mintForBridge as receiver, so we authorize owner directly
      await rewardDistributor.authorizeBridge(owner.address);

      if (remaining > 0n) {
        // Mint exactly remaining — should succeed
        await rewardDistributor.mintForBridge(user.address, remaining);
      }

      // One more should fail
      await expect(
        rewardDistributor.mintForBridge(user.address, 1n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_ExceedsMaxSupply");
    });

    it("Should emit TokensMintedForBridge event", async function () {
      await rewardDistributor.authorizeBridge(owner.address);
      const amount = ethers.parseEther("100");
      await expect(rewardDistributor.mintForBridge(user.address, amount))
        .to.emit(rewardDistributor, "TokensMintedForBridge")
        .withArgs(user.address, amount, owner.address);
    });
  });

  // ── End-to-end flow ─────────────────────────────────────────────────────

  describe("End-to-end: spoke stake → bridgeClaim → hub mint", function () {
    it("Should bridge rewards end-to-end via mock router", async function () {
      await stakeAndAccrue(100);
      const earned = await deadCoinPool.earned(user.address);
      expect(earned).to.be.gt(0);

      // Intercept the CCIP message sent by CrossChainSender
      const tx = await deadCoinPool.connect(user).bridgeClaim();
      const receipt = await tx.wait();

      // Verify local debt is zeroed
      expect(await deadCoinPool.userRewards(user.address)).to.equal(0);

      // Reconstruct what the router received and deliver it to the receiver
      const senderEvent = receipt.logs.find(l => {
        try { return mockRouter.interface.parseLog(l)?.name === "MessageSent"; } catch { return false; }
      });
      expect(senderEvent).to.not.be.undefined;
      const parsed = mockRouter.interface.parseLog(senderEvent);

      const balanceBefore = await resurgeToken.balanceOf(user.address);

      // Simulate CCIP delivery from spoke → hub
      const senderBytes = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address"], [await crossChainSender.getAddress()]
      );
      await mockRouter.deliverMessage(
        await crossChainReceiver.getAddress(),
        parsed.args.messageId,
        SPOKE_CHAIN_SEL,
        senderBytes,
        parsed.args.data,
      );

      const received = await resurgeToken.balanceOf(user.address) - balanceBefore;
      // Should receive approximately 'earned' RESURGE (allow ±2 RESURGE for timing)
      expect(received).to.be.closeTo(earned, ethers.parseEther("2"));
    });
  });
});
