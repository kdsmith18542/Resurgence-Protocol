const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov  = await hre.ethers.getContractAt("ResurgenceGovernance", "0x2E3817C70Dc07e1Aa4239dCFfD62af28632b1228", signer);
  const recv = await hre.ethers.getContractAt("CrossChainReceiver",   "0xF1384305959ebBC11838304127e619Ff3b1E36B4", signer);

  const AMOY_CHAIN_SEL = 16281711391670634445n;
  const AMOY_SENDER    = "0xB19BaeF4995A5DD6d50797928053789D20008B46";
  const encodedSender  = hre.ethers.AbiCoder.defaultAbiCoder().encode(["address"], [AMOY_SENDER]);
  const calldata = recv.interface.encodeFunctionData("setAuthorizedSource", [AMOY_CHAIN_SEL, encodedSender]);
  console.log("calldata:", calldata);

  const tokenAddr = await gov.token();
  const token = await hre.ethers.getContractAt("ResurgeToken", tokenAddr, signer);
  const clk = await token.clock();
  const votes = await gov.getVotes(signer.address, clk - 1n);
  console.log("clock:", clk.toString(), "votes:", hre.ethers.formatEther(votes));

  const description = "# Authorize Amoy spoke\n\nCCIP auth.\n\nChainSel: 16281711391670634445\nSender: " + AMOY_SENDER;

  try {
    const r = await gov.propose.staticCall(
      ["0xF1384305959ebBC11838304127e619Ff3b1E36B4"],
      [0n], [calldata], description
    );
    console.log("Static propose OK:", r.toString());
  } catch(e) {
    console.log("REVERT:", e.reason || e.shortMessage || e.message.slice(0, 400));
    if (e.data) console.log("data:", e.data);
  }
}
main().catch(console.error);
