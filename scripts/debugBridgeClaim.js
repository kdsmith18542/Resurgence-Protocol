const hre = require("hardhat");
const { ethers } = hre;

const AMOY_ROUTER = "0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2";
const AMOY_LINK   = "0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904";
const HUB_SEL     = 3478487238524512106n;
const HUB_RECV    = "0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB";

const routerAbi = [
  // IMPORTANT: For Router 1.2.0+, EVM2AnyMessage field order is feeToken before extraArgs.
  "function getFee(uint64 destChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256)",
  "function isChainSupported(uint64 chainSelector) view returns (bool)",
  "function getOnRamp(uint64 destChainSelector) view returns (address)"
];

async function tryGetFee(router, sel, recv, feeToken, extraArgs, label) {
  const msg = {
    receiver: ethers.AbiCoder.defaultAbiCoder().encode(["address"], [recv]),
    data: ethers.AbiCoder.defaultAbiCoder().encode(["address","uint256"], [recv, ethers.parseEther("1")]),
    tokenAmounts: [],
    feeToken,
    extraArgs,
  };
  try {
    const fee = await router.getFee(sel, msg);
    console.log(`✅ ${label}: fee = ${ethers.formatEther(fee)} LINK/ETH`);
    return fee;
  } catch(e) {
    console.log(`❌ ${label}: ${e.message?.slice(0,100)}`);
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const router = await hre.ethers.getContractAt(routerAbi, AMOY_ROUTER, signer);

  console.log("isChainSupported(ArbitrumSepolia):", await router.isChainSupported(HUB_SEL));
  console.log("onRamp(ArbitrumSepolia):", await router.getOnRamp(HUB_SEL));

  // EVMExtraArgsV1: tag 0x97a657c9 + abi.encode(gasLimit)
  const v1Args = ethers.concat(["0x97a657c9", ethers.AbiCoder.defaultAbiCoder().encode(["uint256"],[200000])]);
  // EVMExtraArgsV2: tag 0x181dcf10 + abi.encode(gasLimit, allowOutOfOrderExecution)
  const v2Args = ethers.concat(["0x181dcf10", ethers.AbiCoder.defaultAbiCoder().encode(["uint256","bool"],[200000,false])]);

  await tryGetFee(router, HUB_SEL, HUB_RECV, AMOY_LINK,    v1Args,   "LINK  + ExtraArgsV1");
  await tryGetFee(router, HUB_SEL, HUB_RECV, AMOY_LINK,    v2Args,   "LINK  + ExtraArgsV2");
  await tryGetFee(router, HUB_SEL, HUB_RECV, ethers.ZeroAddress, v1Args, "Native + ExtraArgsV1");
  await tryGetFee(router, HUB_SEL, HUB_RECV, ethers.ZeroAddress, v2Args, "Native + ExtraArgsV2");
  await tryGetFee(router, HUB_SEL, HUB_RECV, AMOY_LINK,    "0x",     "LINK  + empty extraArgs");
}
main().catch(console.error);
