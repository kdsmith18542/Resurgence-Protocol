const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const REGISTRY_ADDRESS = "0xa7FacCdA878b7C25e445f239d44411E33dDf2D3F";
  const TIMELOCK = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";

  console.log("Registry Address:", REGISTRY_ADDRESS);
  console.log("Signer:", signer.address);

  const registry = await hre.ethers.getContractAt("LegacyClaimRegistry", REGISTRY_ADDRESS, signer);

  const TIMELOCK_ROLE = await registry.TIMELOCK_ROLE();
  const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();

  const signerHasTimelock = await registry.hasRole(TIMELOCK_ROLE, signer.address);
  const signerHasAdmin = await registry.hasRole(DEFAULT_ADMIN_ROLE, signer.address);

  const tlHasTimelock = await registry.hasRole(TIMELOCK_ROLE, TIMELOCK);
  const tlHasAdmin = await registry.hasRole(DEFAULT_ADMIN_ROLE, TIMELOCK);

  console.log("Signer has TIMELOCK_ROLE:", signerHasTimelock);
  console.log("Signer has DEFAULT_ADMIN_ROLE:", signerHasAdmin);
  console.log("Timelock has TIMELOCK_ROLE:", tlHasTimelock);
  console.log("Timelock has DEFAULT_ADMIN_ROLE:", tlHasAdmin);
}

main().catch(console.error);
