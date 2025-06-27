const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Test", function () {
  it("should pass a simple test", async function () {
    console.log("Running simple test...");
    expect(true).to.be.true;
  });
});
