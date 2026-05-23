const hre = require("hardhat");
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const LINK = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
  const NEW_SENDER = "0xf412aD48e83a2537f017b0CbeA5A990CCEA9cE87";
  const link = await hre.ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    LINK, signer
  );
  const bal = await link.balanceOf(signer.address);
  console.log("LINK balance:", hre.ethers.formatEther(bal));
  const tx = await link.transfer(NEW_SENDER, hre.ethers.parseEther("5"));
  await tx.wait();
  console.log("Funded. Tx:", tx.hash);
  console.log("New sender LINK:", hre.ethers.formatEther(await link.balanceOf(NEW_SENDER)));
}
main().catch(console.error);
