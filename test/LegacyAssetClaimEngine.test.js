const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Legacy Asset Claim Engine (LACE) Foundation", function () {
  let resurgeToken, rewardDistributor, legacyClaimRegistry, dormancyRewardController;
  let mockSP1DormancyVerifier;
  let owner, timelock, oracle, riskManager, user, user2;

  const INITIAL_MAX_MINT = ethers.parseEther("500000000");
  const BITCOIN_CHAIN = ethers.encodeBytes32String("bitcoin");
  const ADDR1_HASH = ethers.keccak256(ethers.solidityPacked(["address"], [ethers.ZeroAddress])); // dummy source address hash

  beforeEach(async function () {
    [owner, timelock, oracle, riskManager, user, user2] = await ethers.getSigners();

    // Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    resurgeToken = await upgrades.deployProxy(ResurgeToken, [timelock.address, ethers.parseEther("1000000000")], { kind: 'uups' });
    await resurgeToken.waitForDeployment();

    // Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    rewardDistributor = await upgrades.deployProxy(RewardDistributor, [
      await resurgeToken.getAddress(),
      INITIAL_MAX_MINT,
      timelock.address
    ], { kind: 'uups' });
    await rewardDistributor.waitForDeployment();

    // Deploy LegacyClaimRegistry (Proxy)
    const LegacyClaimRegistry = await ethers.getContractFactory("LegacyClaimRegistry");
    legacyClaimRegistry = await upgrades.deployProxy(LegacyClaimRegistry, [timelock.address], { kind: 'uups' });
    await legacyClaimRegistry.waitForDeployment();

    // Deploy DormancyRewardController (Proxy)
    const DormancyRewardController = await ethers.getContractFactory("DormancyRewardController");
    dormancyRewardController = await upgrades.deployProxy(DormancyRewardController, [
      await legacyClaimRegistry.getAddress(),
      await rewardDistributor.getAddress(),
      timelock.address
    ], { kind: 'uups' });
    await dormancyRewardController.waitForDeployment();

    // Deploy Mock SP1 Verifier
    const MockSP1DormancyVerifier = await ethers.getContractFactory("MockSP1DormancyVerifier");
    mockSP1DormancyVerifier = await MockSP1DormancyVerifier.deploy();
    await mockSP1DormancyVerifier.waitForDeployment();

    // Set up distributor mock verifier address
    await rewardDistributor.connect(timelock).setSP1DormancyVerifier(await mockSP1DormancyVerifier.getAddress());

    // Link Registry and Controller
    await legacyClaimRegistry.connect(timelock).setRewardController(await dormancyRewardController.getAddress());

    // Authorize DormancyRewardController as Staking Pool in RewardDistributor
    await rewardDistributor.connect(timelock).authorizeStakingPool(await dormancyRewardController.getAddress());

    // Grant MINTER_ROLE on ResurgeToken to RewardDistributor
    const MINTER_ROLE = await resurgeToken.MINTER_ROLE();
    await resurgeToken.connect(timelock).grantRole(MINTER_ROLE, await rewardDistributor.getAddress());

    // Grant Roles in Registry
    const DORMANCY_ORACLE_ROLE = await legacyClaimRegistry.DORMANCY_ORACLE_ROLE();
    const RISK_MANAGER_ROLE = await legacyClaimRegistry.RISK_MANAGER_ROLE();
    await legacyClaimRegistry.connect(timelock).grantRole(DORMANCY_ORACLE_ROLE, oracle.address);
    await legacyClaimRegistry.connect(timelock).grantRole(RISK_MANAGER_ROLE, riskManager.address);

    // Setup default policies
    const defaultPolicy = {
      enabled: true,
      transferToVaultEnabled: true,
      burnProofEnabled: true,
      lockProofEnabled: true,
      signatureProofEnabled: true,
      rpcEvidenceEnabled: true,
      explorerEvidenceEnabled: true,
      zkProofEnabled: true,
      minDormancySeconds: 100,
      minHistoricalBalance: 0,
      maxRewardPerClaim: ethers.parseEther("10000"),
      maxRewardPerEpoch: ethers.parseEther("100000"),
      minConfidenceTier: 0
    };
    await legacyClaimRegistry.connect(timelock).setDefaultPolicy(defaultPolicy);
  });

  describe("Deployment and Initial Setup", function () {
    it("Should set correct contract references", async function () {
      expect(await legacyClaimRegistry.rewardController()).to.equal(await dormancyRewardController.getAddress());
      expect(await dormancyRewardController.registry()).to.equal(await legacyClaimRegistry.getAddress());
    });
  });

  describe("Oracle Claim Submission (submitLegacyClaim)", function () {
    it("Should allow oracle to submit claim and mint rewards", async function () {
      const claimAmount = ethers.parseEther("100");
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4, // SignatureDormancyProof
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: claimAmount,
        campaignId: 0
      };

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.emit(legacyClaimRegistry, "LegacyClaimSubmitted");

      expect(await resurgeToken.balanceOf(user.address)).to.equal(claimAmount);
      
      const claimId = await legacyClaimRegistry.getClaimId(claim);
      expect(await legacyClaimRegistry.claimStatus(claimId)).to.equal(3); // Minted
    });

    it("Should reject duplicate claims (replay protection)", async function () {
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("100"),
        campaignId: 0
      };

      await legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x");

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "LegacyClaimRegistry_ClaimAlreadyConsumed");
    });
  });

  describe("Policy Enforcement", function () {
    it("Should revert if claim violates policy (insufficient dormancy seconds)", async function () {
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 10,
        dormancySeconds: 50, // default min is 100
        rewardAmount: ethers.parseEther("100"),
        campaignId: 0
      };

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "LegacyClaimRegistry_PolicyValidationFailed");
    });
  });

  describe("Campaign System", function () {
    it("Should revert if campaign is inactive", async function () {
      const campaignId = 1;
      const campaign = {
        id: campaignId,
        active: false,
        startTime: Math.floor(Date.now() / 1000) - 1000,
        endTime: Math.floor(Date.now() / 1000) + 1000,
        maxTotalRewards: ethers.parseEther("1000000"),
        rewardsMinted: 0
      };
      await legacyClaimRegistry.connect(timelock).setCampaign(campaignId, campaign);

      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("100"),
        campaignId: campaignId
      };

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "LegacyClaimRegistry_CampaignInactive");
    });
  });

  describe("Quarantine Flow", function () {
    it("Should auto-quarantine claims exceeding maximum threshold and release/reject manually", async function () {
      const policyWithLowMax = {
        enabled: true,
        transferToVaultEnabled: true,
        burnProofEnabled: true,
        lockProofEnabled: true,
        signatureProofEnabled: true,
        rpcEvidenceEnabled: true,
        explorerEvidenceEnabled: true,
        zkProofEnabled: true,
        minDormancySeconds: 100,
        minHistoricalBalance: 0,
        maxRewardPerClaim: ethers.parseEther("500"), // Low cap
        maxRewardPerEpoch: ethers.parseEther("100000"),
        minConfidenceTier: 0
      };
      await legacyClaimRegistry.connect(timelock).setDefaultPolicy(policyWithLowMax);

      const claimAmount = ethers.parseEther("1000"); // Exceeds maxRewardPerClaim
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: claimAmount,
        campaignId: 0
      };

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.emit(legacyClaimRegistry, "ClaimQuarantined");

      // Verify that NO tokens have been minted yet
      expect(await resurgeToken.balanceOf(user.address)).to.equal(0n);

      const claimId = await legacyClaimRegistry.getClaimId(claim);
      expect(await legacyClaimRegistry.claimStatus(claimId)).to.equal(5); // Quarantined

      // Release the claim
      await expect(legacyClaimRegistry.connect(riskManager).releaseClaim(claimId))
        .to.emit(legacyClaimRegistry, "ClaimReleased");

      expect(await resurgeToken.balanceOf(user.address)).to.equal(claimAmount);
      expect(await legacyClaimRegistry.claimStatus(claimId)).to.equal(3); // Minted
    });
  });

  describe("zkVM Proof Verification (submitZkDormancyClaim)", function () {
    it("Should allow users to submit zkVM proofs directly and receive rewards", async function () {
      const claimAmount = ethers.parseEther("200");
      const walletAddressStr = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"; // Bitcoin genesis address
      const walletAddressHash = ethers.solidityPackedKeccak256(["string"], [walletAddressStr]);

      const dormantSinceBlock = 100000n;
      const currentBlock = 800000n;
      const thresholdBlocks = 50000n;

      // Calculate the expected proof hash
      const proofHash = ethers.solidityPackedKeccak256(
        ["bytes32", "string", "uint64", "uint64", "uint64"],
        [BITCOIN_CHAIN, walletAddressStr, dormantSinceBlock, currentBlock, thresholdBlocks]
      );

      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: walletAddressHash,
        evmWallet: user.address,
        proofHash: proofHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 8, // ZkDormancyProof
        confidenceTier: 4,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 100000,
        dormancySeconds: 500000,
        rewardAmount: claimAmount,
        campaignId: 0
      };

      // Submit zkVM claim
      await expect(legacyClaimRegistry.connect(user).submitZkDormancyClaim(
        "0x1234", // mock proof
        "0x5678", // mock public inputs
        walletAddressStr,
        dormantSinceBlock,
        currentBlock,
        thresholdBlocks,
        claim
      )).to.emit(legacyClaimRegistry, "ClaimMinted");

      expect(await resurgeToken.balanceOf(user.address)).to.equal(claimAmount);
    });
  });

  describe("Epoch Rate Limits", function () {
    it("Should enforce per-wallet maximum limits per epoch and reset properly", async function () {
      // Set low max per wallet per epoch limit (1000 tokens)
      await dormancyRewardController.connect(timelock).setMaxRewardPerWalletPerEpoch(ethers.parseEther("1000"));

      const claim1 = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("800"),
        campaignId: 0
      };

      const claim2 = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ethers.keccak256(ethers.solidityPacked(["address"], [user2.address])),
        evmWallet: user.address, // Same EVM recipient wallet!
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("400"), // Would take total to 1200 > 1000
        campaignId: 0
      };

      // First claim succeeds
      await legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim1, "0x");

      // Second claim fails (UserCapExceeded)
      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim2, "0x"))
        .to.be.revertedWithCustomError(dormancyRewardController, "DormancyRewardController_UserCapExceeded");

      // Fast forward time by 8 days (epoch duration is 7 days)
      await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]);
      await ethers.provider.send("evm_mine");

      // Second claim succeeds now
      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim2, "0x"))
        .to.emit(legacyClaimRegistry, "ClaimMinted");
    });
  });

  describe("Grandfathering Claims and Proofs", function () {
    it("Should allow TIMELOCK to grandfather proofs and prevent duplicate claims using them", async function () {
      const proofHash = ethers.id("some-historical-proof-hash");

      // Verify not consumed yet
      expect(await legacyClaimRegistry.consumedProofs(proofHash)).to.be.false;

      // Grandfather the proof
      await expect(legacyClaimRegistry.connect(timelock).grandfatherProofs([proofHash]))
        .to.emit(legacyClaimRegistry, "ProofGrandfathered")
        .withArgs(proofHash);

      expect(await legacyClaimRegistry.consumedProofs(proofHash)).to.be.true;

      // Now verify that submitting a claim with this proof fails
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: proofHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("100"),
        campaignId: 0
      };

      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "LegacyClaimRegistry_ProofAlreadyConsumed")
        .withArgs(proofHash);
    });

    it("Should allow TIMELOCK to grandfather claims and prevent re-submitting them", async function () {
      const claim = {
        sourceChainId: BITCOIN_CHAIN,
        sourceAddressHash: ADDR1_HASH,
        evmWallet: user.address,
        proofHash: ethers.ZeroHash,
        sourceTxHash: ethers.ZeroHash,
        claimType: 4,
        confidenceTier: 2,
        lastSeenTimestamp: Math.floor(Date.now() / 1000) - 1000,
        dormancySeconds: 1000,
        rewardAmount: ethers.parseEther("100"),
        campaignId: 0
      };

      const claimId = await legacyClaimRegistry.getClaimId(claim);

      // Verify not consumed yet
      expect(await legacyClaimRegistry.consumedClaims(claimId)).to.be.false;

      // Grandfather the claim
      await expect(legacyClaimRegistry.connect(timelock).grandfatherClaims([claimId]))
        .to.emit(legacyClaimRegistry, "ClaimGrandfathered")
        .withArgs(claimId);

      expect(await legacyClaimRegistry.consumedClaims(claimId)).to.be.true;
      expect(await legacyClaimRegistry.claimStatus(claimId)).to.equal(3); // Minted

      // Now verify that submitting this claim fails
      await expect(legacyClaimRegistry.connect(oracle).submitLegacyClaim(claim, "0x"))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "LegacyClaimRegistry_ClaimAlreadyConsumed")
        .withArgs(claimId);
    });

    it("Should revert if non-TIMELOCK tries to grandfather proofs or claims", async function () {
      const proofHash = ethers.id("some-other-proof-hash");
      const claimId = ethers.id("some-claim-id");

      await expect(legacyClaimRegistry.connect(user).grandfatherProofs([proofHash]))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "AccessControlUnauthorizedAccount");

      await expect(legacyClaimRegistry.connect(user).grandfatherClaims([claimId]))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Vault and Burn Registry Configuration", function () {
    it("Should allow TIMELOCK to set vault and burn addresses and emit events", async function () {
      const vaultAddrStr = "tb1qvaultaddressplaceholder";
      const burnAddrStr = "tb1qburnaddressplaceholder";

      await expect(legacyClaimRegistry.connect(timelock).setVaultAddress(BITCOIN_CHAIN, vaultAddrStr))
        .to.emit(legacyClaimRegistry, "VaultAddressUpdated")
        .withArgs(BITCOIN_CHAIN, vaultAddrStr);

      await expect(legacyClaimRegistry.connect(timelock).setBurnAddress(BITCOIN_CHAIN, burnAddrStr))
        .to.emit(legacyClaimRegistry, "BurnAddressUpdated")
        .withArgs(BITCOIN_CHAIN, burnAddrStr);

      expect(await legacyClaimRegistry.vaultAddresses(BITCOIN_CHAIN)).to.equal(vaultAddrStr);
      expect(await legacyClaimRegistry.burnAddresses(BITCOIN_CHAIN)).to.equal(burnAddrStr);
    });

    it("Should revert if non-TIMELOCK tries to set vault or burn addresses", async function () {
      const vaultAddrStr = "tb1qvaultaddressplaceholder";
      const burnAddrStr = "tb1qburnaddressplaceholder";

      await expect(legacyClaimRegistry.connect(user).setVaultAddress(BITCOIN_CHAIN, vaultAddrStr))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "AccessControlUnauthorizedAccount");

      await expect(legacyClaimRegistry.connect(user).setBurnAddress(BITCOIN_CHAIN, burnAddrStr))
        .to.be.revertedWithCustomError(legacyClaimRegistry, "AccessControlUnauthorizedAccount");
    });
  });
});
