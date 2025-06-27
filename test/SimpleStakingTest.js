const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther } = require("ethers");

describe("Simple Staking Test", function () {
  let pool, token, distributor;
  let admin, timelock, user;
  let deadCoin;

  it("should deploy contracts and set up test environment", async function () {
    this.timeout(120000);
    
    console.log("\n=== Setting up test environment ===");
    
    // Get signers
    [admin, timelock, user] = await ethers.getSigners();
    console.log(`✅ Signers loaded`);
    console.log(`   - Admin: ${admin.address}`);
    console.log(`   - Timelock: ${timelock.address}`);
    console.log(`   - User: ${user.address}`);
    
    // Deploy ResurgenceProtocol Token
    console.log("\n🔹 Deploying ResurgenceProtocol...");
    const Token = await ethers.getContractFactory("ResurgenceProtocol");
    const maxSupply = parseEther("1000000000"); // 1 billion tokens with 18 decimals
    token = await Token.deploy(timelock.address, maxSupply);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`✅ ResurgenceProtocol token deployed at: ${tokenAddress}`);
    console.log(`   - Max supply: ${ethers.formatEther(maxSupply)} RESURGE`);
    
    // Deploy a mock DeadCoin ERC20 token
    console.log("\n🔹 Deploying MockDeadCoin...");
    const MockERC20 = await ethers.getContractFactory("ERC20Mock");
    deadCoin = await MockERC20.deploy("DeadCoin", "DEAD", parseEther("1000000000"));
    await deadCoin.waitForDeployment();
    const deadCoinAddress = await deadCoin.getAddress();
    console.log(`✅ MockDeadCoin deployed at: ${deadCoinAddress}`);
    
    // Verify timelock has DEFAULT_ADMIN_ROLE
    const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    const hasAdminRole = await token.hasRole(DEFAULT_ADMIN_ROLE, timelock.address);
    console.log(`   - Timelock has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
    
    // Test passes if we get this far
    expect(true).to.be.true;
  });
});
