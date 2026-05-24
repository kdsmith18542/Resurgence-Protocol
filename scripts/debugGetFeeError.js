const hre = require('hardhat');
const { ethers } = hre;

const AMOY_ROUTER = '0x9C32fCB86BF0f4a1A8921a9Fe46de3198bb884B2';
const AMOY_LINK   = '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904';
const HUB_SEL     = 3478487238524512106n;
const HUB_RECV    = '0x8c2068d7bB1A897C1451806D3576bD7864e3e1aB';

const abi = [
  // IMPORTANT: For Router 1.2.0+, EVM2AnyMessage field order is feeToken before extraArgs.
  'function getFee(uint64 destChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256)'
];

function v1(gasLimit) {
  return ethers.concat(['0x97a657c9', ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [gasLimit])]);
}

function v2(gasLimit, allowOOO) {
  return ethers.concat([
    '0x181dcf10',
    ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bool'], [gasLimit, allowOOO])
  ]);
}

async function tryGetFee(router, feeToken, extraArgs, label) {
  const message = {
    receiver: ethers.AbiCoder.defaultAbiCoder().encode(['address'], [HUB_RECV]),
    data: ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [HUB_RECV, ethers.parseEther('1')]),
    tokenAmounts: [],
    feeToken,
    extraArgs,
  };

  try {
    const fee = await router.getFee(HUB_SEL, message);
    console.log(`✅ ${label} -> fee ${fee.toString()}`);
  } catch (e) {
    const infoData = e?.info?.error?.data;
    const directData = e?.data;
    const maybeData = infoData || directData;
    console.log(`❌ ${label}`);
    console.log('  shortMessage:', e?.shortMessage || 'n/a');
    console.log('  message:', (e?.message || 'n/a').slice(0, 300));
    console.log('  data:', maybeData || 'none');
    if (maybeData && maybeData.length >= 10) {
      console.log('  selector:', maybeData.slice(0, 10));
    }
  }
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const router = await hre.ethers.getContractAt(abi, AMOY_ROUTER, signer);

  await tryGetFee(router, AMOY_LINK, v1(200000n), 'LINK + V1(200k)');
  await tryGetFee(router, AMOY_LINK, v2(200000n, false), 'LINK + V2(200k,false)');
  await tryGetFee(router, ethers.ZeroAddress, v2(200000n, false), 'Native + V2(200k,false)');
  await tryGetFee(router, AMOY_LINK, '0x', 'LINK + empty extraArgs');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
