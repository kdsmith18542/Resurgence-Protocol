const hre = require('hardhat');

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const gov = await hre.ethers.getContractAt('ResurgenceGovernance', '0xfb6dD507a5a8e49b49C15CB851A488DB957c269B', signer);
  const rd = await hre.ethers.getContractAt('RewardDistributor', '0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed', signer);

  const NEW_AMOUNT = 1000000000000000000000n;
  const calldata = rd.interface.encodeFunctionData('setNonEvmRewardAmount', [NEW_AMOUNT]);
  const targets = ['0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed'];
  const values = [0n];
  const calldatas = [calldata];
  const description = [
    '# Set nonEvmRewardAmount on RewardDistributor',
    '',
    'Sets RESURGE minted per valid non-EVM dormancy proof.',
    '',
    'RewardDistributor: 0xCDfd46512dA68e2eD555D1d0Ac09aB1Acf38f2Ed',
    'New amount (wei): 1000000000000000000000',
  ].join('\n');
  const descHash = hre.ethers.id(description);

  const pid = 191400011357163417679262741038648239790880299324641926477166506603819235893n;
  const state = await gov.state(pid);
  const eta = await gov.proposalEta(pid);

  console.log('state', state.toString(), 'eta', eta.toString(), 'descHash', descHash);

  try {
    await gov.execute.staticCall(targets, values, calldatas, descHash);
    console.log('staticCall execute OK');
  } catch (e) {
    console.log('shortMessage:', e?.shortMessage || 'n/a');
    console.log('message:', e?.message || 'n/a');
    console.log('data:', e?.data || e?.info?.error?.data || 'none');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
