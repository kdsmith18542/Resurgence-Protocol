const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Role Test (Upgradeable)", function () {
  let token, distributor, admin, user;
  let MINTER_ROLE, DEFAULT_ADMIN_ROLE;

  before(async function () {
    [admin, user] = await ethers.getSigners();
    
    // Deploy ResurgeToken (Proxy)
    const ResurgeToken = await ethers.getContractFactory("ResurgeToken");
    token = await upgrades.deployProxy(ResurgeToken, [admin.address, ethers.parseEther("1000000")], { kind: 'uups' });
    await token.waitForDeployment();
    
    // Deploy RewardDistributor (Proxy)
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    distributor = await upgrades.deployProxy(RewardDistributor, [
      await token.getAddress(),
      ethers.parseEther("1000000"),
      admin.address
    ], { kind: 'uups' });
    await distributor.waitForDeployment();
    
    // Get role hashes
    MINTER_ROLE = await token.MINTER_ROLE();
    DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
  });

  it("should grant MINTER_ROLE to distributor", async function () {
    // Grant MINTER_ROLE
    await token.connect(admin).grantRole(
      MINTER_ROLE,
      await distributor.getAddress()
    );
    
    // Verify the role was granted
    expect(await token.hasRole(MINTER_ROLE, await distributor.getAddress())).to.be.true;
    
    // Verify the distributor can mint tokens
    const mintAmount = ethers.parseEther("100");
    const TIMELOCK_ROLE = await distributor.TIMELOCK_ROLE();
    await distributor.grantRole(TIMELOCK_ROLE, admin.address);
    await distributor.authorizeStakingPool(admin.address);
    
    await distributor.mintAndDistribute(user.address, mintAmount);
    expect(await token.balanceOf(user.address)).to.equal(mintAmount);
  });
});
