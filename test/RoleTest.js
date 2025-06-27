const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Role Test", function () {
  let token, distributor, timelock, admin, user;
  let MINTER_ROLE, DEFAULT_ADMIN_ROLE;

  before(async function () {
    console.log("\n=== Setting up test environment ===");
    [admin, user] = await ethers.getSigners();
    
    console.log("\n=== Deploying ResurgenceProtocol ===");
    const ResurgenceProtocol = await ethers.getContractFactory("ResurgenceProtocol");
    console.log("Deploying token with admin:", admin.address);
    token = await ResurgenceProtocol.deploy(admin.address, ethers.parseEther("1000000"));
    await token.waitForDeployment();
    
    console.log("\n=== Deploying RewardDistributor ===");
    const RewardDistributor = await ethers.getContractFactory("RewardDistributor");
    const tokenAddress = await token.getAddress();
    console.log("Token address:", tokenAddress);
    
    distributor = await RewardDistributor.deploy(
      tokenAddress,
      ethers.parseEther("1000000"),
      admin.address
    );
    await distributor.waitForDeployment();
    
    // Get role hashes
    MINTER_ROLE = await token.MINTER_ROLE();
    DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    
    console.log("\n=== Contract Addresses ===");
    console.log("Token address:", await token.getAddress());
    console.log("Distributor address:", await distributor.getAddress());
    console.log("\n=== Role Hashes ===");
    console.log("MINTER_ROLE:", MINTER_ROLE);
    console.log("DEFAULT_ADMIN_ROLE:", DEFAULT_ADMIN_ROLE);
    
    // Log initial admin roles
    const adminHasAdminRole = await token.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    console.log("\n=== Initial Role Check ===");
    console.log(`Admin (${admin.address}) has DEFAULT_ADMIN_ROLE: ${adminHasAdminRole}`);
    
    const currentMinterRoleAdmin = await token.getRoleAdmin(MINTER_ROLE);
    console.log(`MINTER_ROLE admin: ${currentMinterRoleAdmin}`);
    
    const distributorHasMinterRole = await token.hasRole(MINTER_ROLE, await distributor.getAddress());
    console.log(`Distributor has MINTER_ROLE: ${distributorHasMinterRole}`);
  });

  it("should grant MINTER_ROLE to distributor", async function () {
    // Check current MINTER_ROLE admin
    const minterRoleAdmin = await token.getRoleAdmin(MINTER_ROLE);
    console.log("MINTER_ROLE admin:", minterRoleAdmin);
    
    // Check if admin has DEFAULT_ADMIN_ROLE
    const adminHasAdminRole = await token.hasRole(DEFAULT_ADMIN_ROLE, admin.address);
    console.log("Admin has DEFAULT_ADMIN_ROLE:", adminHasAdminRole);
    
    // Check current MINTER_ROLE status
    const hasMinterRoleBefore = await token.hasRole(MINTER_ROLE, await distributor.getAddress());
    console.log("Distributor has MINTER_ROLE before grant:", hasMinterRoleBefore);
    
    // Grant MINTER_ROLE
    console.log("Granting MINTER_ROLE...");
    const grantTx = await token.connect(admin).grantRole(
      MINTER_ROLE,
      await distributor.getAddress()
    );
    await grantTx.wait();
    
    // Verify the role was granted
    const hasMinterRoleAfter = await token.hasRole(MINTER_ROLE, await distributor.getAddress());
    console.log("Distributor has MINTER_ROLE after grant:", hasMinterRoleAfter);
    
    expect(hasMinterRoleAfter).to.be.true;
    
    // Verify the distributor can mint tokens
    const mintAmount = ethers.parseEther("100");
    console.log("\nAttempting to mint tokens through distributor...");
    
    const mintTx = await distributor.mintAndDistribute(user.address, mintAmount);
    const receipt = await mintTx.wait();
    console.log("Mint transaction hash:", receipt.hash);
    
    // Check if tokens were minted
    const userBalance = await token.balanceOf(user.address);
    console.log("User balance after mint:", ethers.formatEther(userBalance), "RESURGE");
    
    expect(userBalance).to.equal(mintAmount);
  });
});
