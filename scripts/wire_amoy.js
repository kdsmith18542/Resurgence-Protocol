const hre = require("hardhat");
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const LINK      = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
  const SENDER    = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
  const LINK_AMOUNT = hre.ethers.parseEther("5"); // 5 LINK for CCIP fees

  const link = await hre.ethers.getContractAt(
    ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"],
    LINK, signer
  );

  const bal = await link.balanceOf(signer.address);
  console.log("LINK balance:", hre.ethers.formatEther(bal));

  console.log(`Funding CrossChainSender with 5 LINK...`);
  const tx = await link.transfer(SENDER, LINK_AMOUNT);
  await tx.wait();
  console.log("Funded. Tx:", tx.hash);

  const senderBal = await link.balanceOf(SENDER);
  console.log("CrossChainSender LINK balance:", hre.ethers.formatEther(senderBal));
}
main().catch(console.error);
