const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BaaLS Relay Bridge Path (Phase 13)", function () {
  let owner, timelock, relayer, user, pool, attacker;
  let resurgeToken, rewardDistributor, crossChainSender, mockRouter, mockLink;

  const INITIAL_SUPPLY = ethers.parseEther("1000000000");
  const HUB_CHAIN_SEL = 4949039107694359620n;
  const CLAIM_AMOUNT = ethers.parseEther("500");

  beforeEach(async function () {
    [owner, timelock, relayer, user, pool, attacker] = await ethers.getSigners();

    // ── Hub ────────────────────────────────────────────────────────────────
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, INITIAL_SUPPLY], { kind: "uups" });

    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_SUPPLY / 2n,
      timelock.address,
    ], { kind: "uups" });

    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());

    // Grant TIMELOCK_ROLE to owner for test convenience
    const TIMELOCK_ROLE = await rewardDistributor.TIMELOCK_ROLE();
    await rewardDistributor.connect(timelock).grantRole(TIMELOCK_ROLE, owner.address);

    // Grant RELAY_MINTER_ROLE to relayer
    const RELAY_MINTER_ROLE = await rewardDistributor.RELAY_MINTER_ROLE();
    await rewardDistributor.connect(timelock).grantRole(RELAY_MINTER_ROLE, relayer.address);

    // ── Spoke ──────────────────────────────────────────────────────────────
    const MockLink = await ethers.getContractFactory("ERC20Mock");
    mockLink = await MockLink.deploy("Chainlink", "LINK", ethers.parseEther("1000"));

    const MockRouter = await ethers.getContractFactory("MockCCIPRouter");
    mockRouter = await MockRouter.deploy();
    await mockRouter.setSupportedChain(HUB_CHAIN_SEL, true);

    const CrossChainSender = await ethers.getContractFactory("CrossChainSender");
    crossChainSender = await CrossChainSender.deploy(
      await mockRouter.getAddress(),
      await mockLink.getAddress(),
      HUB_CHAIN_SEL,
      ethers.Wallet.createRandom().address, // hubReceiver (not used for relay path)
      timelock.address,
    );

    // Authorize pool as caller on CrossChainSender
    const SENDER_TIMELOCK_ROLE = await crossChainSender.TIMELOCK_ROLE();
    await crossChainSender.connect(timelock).grantRole(SENDER_TIMELOCK_ROLE, owner.address);
    await crossChainSender.authorizeCaller(pool.address);
  });

  // ── CrossChainSender.bridgeClaimRelay ──────────────────────────────────

  describe("CrossChainSender.bridgeClaimRelay", function () {
    it("emits BridgeClaimRequested with correct args and nonce=0 on first call", async function () {
      await expect(crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT))
        .to.emit(crossChainSender, "BridgeClaimRequested")
        .withArgs(user.address, CLAIM_AMOUNT, 0n);
    });

    it("increments nonce on each call", async function () {
      await crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT);
      await expect(crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT))
        .to.emit(crossChainSender, "BridgeClaimRequested")
        .withArgs(user.address, CLAIM_AMOUNT, 1n);
      expect(await crossChainSender.relayNonce()).to.equal(2n);
    });

    it("reverts if caller is not authorized", async function () {
      await expect(crossChainSender.connect(attacker).bridgeClaimRelay(user.address, CLAIM_AMOUNT))
        .to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_UnauthorizedCaller");
    });

    it("reverts if relay is disabled", async function () {
      await crossChainSender.setRelayEnabled(false);
      await expect(crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT))
        .to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_RelayDisabled");
    });

    it("emits RelayEnabledSet when governance toggles relay", async function () {
      await expect(crossChainSender.setRelayEnabled(false))
        .to.emit(crossChainSender, "RelayEnabledSet")
        .withArgs(false);
    });

    it("reverts setRelayEnabled if not TIMELOCK_ROLE", async function () {
      await expect(crossChainSender.connect(attacker).setRelayEnabled(false))
        .to.be.revertedWithCustomError(crossChainSender, "AccessControlUnauthorizedAccount");
    });

    it("ccipEnabled defaults true; reverts sendRewardClaim if disabled", async function () {
      expect(await crossChainSender.ccipEnabled()).to.be.true;
      await crossChainSender.setCCIPEnabled(false);
      await mockLink.transfer(await crossChainSender.getAddress(), ethers.parseEther("10"));
      await expect(crossChainSender.connect(pool).sendRewardClaim(user.address, CLAIM_AMOUNT))
        .to.be.revertedWithCustomError(crossChainSender, "CrossChainSender_CCIPDisabled");
    });

    it("relay path works even when CCIP is disabled", async function () {
      await crossChainSender.setCCIPEnabled(false);
      await expect(crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT))
        .to.emit(crossChainSender, "BridgeClaimRequested");
    });
  });

  // ── RewardDistributor.mintForRelay ────────────────────────────────────

  describe("RewardDistributor.mintForRelay", function () {
    let senderAddress;
    beforeEach(async function () {
      senderAddress = await crossChainSender.getAddress();
    });

    it("mints RESURGE to user and emits events", async function () {
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n)
      )
        .to.emit(rewardDistributor, "TokensMintedForRelay")
        .withArgs(user.address, CLAIM_AMOUNT, senderAddress, 0n)
        .and.to.emit(rewardDistributor, "TokensMintedAndDistributed")
        .withArgs(user.address, CLAIM_AMOUNT);

      expect(await resurgeToken.balanceOf(user.address)).to.equal(CLAIM_AMOUNT);
    });

    it("marks relay key as processed", async function () {
      await rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n);
      const key = ethers.solidityPackedKeccak256(["address", "uint256"], [senderAddress, 0n]);
      expect(await rewardDistributor.processedRelays(key)).to.be.true;
    });

    it("reverts on replay (same sender + nonce)", async function () {
      await rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n);
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_RelayAlreadyProcessed");
    });

    it("different nonce with same sender succeeds", async function () {
      await rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n);
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 1n)
      ).to.emit(rewardDistributor, "TokensMintedForRelay");
    });

    it("same nonce with different sender succeeds (cross-spoke isolation)", async function () {
      const otherSender = ethers.Wallet.createRandom().address;
      await rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n);
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, otherSender, 0n)
      ).to.emit(rewardDistributor, "TokensMintedForRelay");
    });

    it("reverts if caller lacks RELAY_MINTER_ROLE", async function () {
      await expect(
        rewardDistributor.connect(attacker).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_UnauthorizedRelayer");
    });

    it("reverts if user is zero address", async function () {
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(ethers.ZeroAddress, CLAIM_AMOUNT, senderAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_InvalidAddress");
    });

    it("reverts if crossChainSender is zero address", async function () {
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, ethers.ZeroAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_InvalidAddress");
    });

    it("reverts if amount exceeds max supply", async function () {
      const maxSupply = await rewardDistributor.maxMintSupply();
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, maxSupply + 1n, senderAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_ExceedsMaxSupply");
    });

    it("respects whenNotPaused", async function () {
      const EMERGENCY_PAUSER = await rewardDistributor.EMERGENCY_PAUSER();
      await rewardDistributor.connect(timelock).grantRole(EMERGENCY_PAUSER, owner.address);
      await rewardDistributor.pause();
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(user.address, CLAIM_AMOUNT, senderAddress, 0n)
      ).to.be.revertedWithCustomError(rewardDistributor, "EnforcedPause");
    });
  });

  // ── Integration: full relay flow ──────────────────────────────────────

  describe("Integration: full BaaLS relay flow", function () {
    it("spoke emits BridgeClaimRequested → hub mints RESURGE to user", async function () {
      // Step 1: spoke pool triggers relay
      const tx = await crossChainSender.connect(pool).bridgeClaimRelay(user.address, CLAIM_AMOUNT);
      const receipt = await tx.wait();
      const iface = crossChainSender.interface;
      const ev = receipt.logs.map(l => { try { return iface.parseLog(l); } catch {} }).find(e => e?.name === "BridgeClaimRequested");
      expect(ev).to.not.be.undefined;
      const { staker, amount, nonce } = ev.args;

      // Step 2: BaaLS EVMSubmitter calls mintForRelay on hub
      await rewardDistributor.connect(relayer).mintForRelay(
        staker, amount, await crossChainSender.getAddress(), nonce
      );

      // Verify RESURGE minted
      expect(await resurgeToken.balanceOf(user.address)).to.equal(CLAIM_AMOUNT);

      // Verify replay blocked
      await expect(
        rewardDistributor.connect(relayer).mintForRelay(
          staker, amount, await crossChainSender.getAddress(), nonce
        )
      ).to.be.revertedWithCustomError(rewardDistributor, "RewardDistributor_RelayAlreadyProcessed");
    });
  });
});
