/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

module.exports = {
  solidity: "0.8.20",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./hardhat-cache",
    artifacts: "./artifacts"
  },
  networks: {
    hardhat: {
      // Configuration for the Hardhat Network (local development)
      // You can customize this as needed
    },
  },
};
