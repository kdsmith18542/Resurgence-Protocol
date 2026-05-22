const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("ResurgeToken", function () {
  const CAP = ethers.parseEther("1000000000"); // 1 billion

  async function deployTokenFixture() {
    const [admin, minter, pauser, user1, user2] = await ethers.getSigners();
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    const token = await upgrades.deployProxy(ResurgeToken, [admin.address, CAP], { kind: "uups" });
    await token.waitForDeployment();

    const MINTER_ROLE = await token.MINTER_ROLE();
    const PAUSER_ROLE = await token.PAUSER_ROLE();
    await token.grantRole(MINTER_ROLE, minter.address);
    await token.grantRole(PAUSER_ROLE, pauser.address);

    return { token, admin, minter, pauser, user1, user2, MINTER_ROLE, PAUSER_ROLE };
  }

  describe("Deployment", function () {
    it("has correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.name()).to.equal("Resurgence Protocol");
      expect(await token.symbol()).to.equal("RESURGE");
    });

    it("has correct cap", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.cap()).to.equal(CAP);
    });

    it("starts with zero total supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      expect(await token.totalSupply()).to.equal(0n);
    });

    it("assigns roles to admin", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    });

    it("disables initializer in implementation", async function () {
      const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
      const impl = await ResurgeToken.deploy();
      await expect(impl.initialize(ethers.ZeroAddress, CAP))
        .to.be.revertedWithCustomError(impl, "InvalidInitialization");
    });
  });

  describe("Minting", function () {
    it("MINTER_ROLE can mint", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("non-minter cannot mint", async function () {
      const { token, user1, user2, MINTER_ROLE } = await loadFixture(deployTokenFixture);
      await expect(token.connect(user1).mint(user2.address, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, MINTER_ROLE);
    });

    it("cannot mint beyond cap", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await expect(token.connect(minter).mint(user1.address, CAP + 1n))
        .to.be.revertedWithCustomError(token, "ERC20ExceededCap");
    });

    it("can mint exactly up to cap", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, CAP);
      expect(await token.totalSupply()).to.equal(CAP);
    });

    it("emits Transfer event on mint", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await expect(token.connect(minter).mint(user1.address, ethers.parseEther("500")))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, ethers.parseEther("500"));
    });
  });

  describe("Burning", function () {
    it("token holder can burn own tokens", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).burn(ethers.parseEther("400"));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("600"));
    });

    it("burn reduces total supply", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).burn(ethers.parseEther("1000"));
      expect(await token.totalSupply()).to.equal(0n);
    });

    it("cannot burn more than balance", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));
      await expect(token.connect(user1).burn(ethers.parseEther("101")))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("allows burning via burnFrom with allowance", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).approve(user2.address, ethers.parseEther("500"));
      await token.connect(user2).burnFrom(user1.address, ethers.parseEther("500"));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
    });
  });

  describe("ERC20 Standard", function () {
    it("transfer between accounts works", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));
      await token.connect(user1).transfer(user2.address, ethers.parseEther("40"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("40"));
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("60"));
    });

    it("approve and transferFrom work", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));
      await token.connect(user1).approve(user2.address, ethers.parseEther("50"));
      expect(await token.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("50"));
      await token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("50"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("50"));
    });
  });

  describe("ERC20Votes — Delegation", function () {
    it("tokens have no voting power until delegated", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      expect(await token.getVotes(user1.address)).to.equal(0n);
    });

    it("delegating to self activates voting power", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).delegate(user1.address);
      expect(await token.getVotes(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("delegating to another address transfers voting power", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).delegate(user2.address);
      expect(await token.getVotes(user2.address)).to.equal(ethers.parseEther("1000"));
      expect(await token.getVotes(user1.address)).to.equal(0n);
    });

    it("delegates() returns current delegatee", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));
      await token.connect(user1).delegate(user2.address);
      expect(await token.delegates(user1.address)).to.equal(user2.address);
    });

    it("voting power updates after transfer", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).delegate(user1.address);
      await token.connect(user1).transfer(user2.address, ethers.parseEther("400"));
      expect(await token.getVotes(user1.address)).to.equal(ethers.parseEther("600"));
    });

    it("getPastVotes returns snapshot at past block", async function () {
      const { token, minter, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));
      await token.connect(user1).delegate(user1.address);
      const blockBefore = await ethers.provider.getBlockNumber();
      await token.connect(minter).mint(user1.address, ethers.parseEther("500"));
      expect(await token.getPastVotes(user1.address, blockBefore)).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("ERC20Permit — Gasless Approvals", function () {
    it("permit sets allowance via signature", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("1000"));

      const deadline = (await time.latest()) + 3600;
      const nonce = await token.nonces(user1.address);
      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const value = { owner: user1.address, spender: user2.address, value: ethers.parseEther("250"), nonce, deadline };
      const sig = await user1.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      await token.permit(user1.address, user2.address, ethers.parseEther("250"), deadline, v, r, s);
      expect(await token.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("250"));
    });

    it("permit increments nonce after use", async function () {
      const { token, minter, user1, user2 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));

      const nonceBefore = await token.nonces(user1.address);
      const deadline = (await time.latest()) + 3600;
      const domain = {
        name: await token.name(), version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };
      const types = { Permit: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }, { name: "value", type: "uint256" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] };
      const value = { owner: user1.address, spender: user2.address, value: ethers.parseEther("10"), nonce: nonceBefore, deadline };
      const sig = await user1.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);
      await token.permit(user1.address, user2.address, ethers.parseEther("10"), deadline, v, r, s);
      expect(await token.nonces(user1.address)).to.equal(nonceBefore + 1n);
    });
  });

  describe("Pausable", function () {
    it("PAUSER_ROLE can pause and unpause", async function () {
      const { token, minter, pauser, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(minter).mint(user1.address, ethers.parseEther("100"));
      await token.connect(pauser).pause();
      await expect(token.connect(user1).transfer(pauser.address, ethers.parseEther("10")))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
      await token.connect(pauser).unpause();
      await expect(token.connect(user1).transfer(pauser.address, ethers.parseEther("10"))).to.not.be.reverted;
    });

    it("non-pauser cannot pause", async function () {
      const { token, user1, PAUSER_ROLE } = await loadFixture(deployTokenFixture);
      await expect(token.connect(user1).pause())
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(user1.address, PAUSER_ROLE);
    });

    it("minting blocked when paused", async function () {
      const { token, minter, pauser, user1 } = await loadFixture(deployTokenFixture);
      await token.connect(pauser).pause();
      await expect(token.connect(minter).mint(user1.address, ethers.parseEther("1")))
        .to.be.revertedWithCustomError(token, "EnforcedPause");
    });
  });

  describe("UUPS Upgradeability", function () {
    it("admin can upgrade the proxy", async function () {
      const { token, admin } = await loadFixture(deployTokenFixture);
      const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
      const newImpl = await ResurgeToken.deploy();
      await expect(
        token.connect(admin).upgradeToAndCall(await newImpl.getAddress(), "0x")
      ).to.not.be.reverted;
    });

    it("non-admin cannot upgrade", async function () {
      const { token, user1 } = await loadFixture(deployTokenFixture);
      const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
      const newImpl = await ResurgeToken.deploy();
      await expect(token.connect(user1).upgradeToAndCall(await newImpl.getAddress(), "0x"))
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });
});
