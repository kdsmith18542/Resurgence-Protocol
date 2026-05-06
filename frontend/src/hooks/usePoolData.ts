'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useAccount, useChainId } from 'wagmi';
import { PoolInfo } from '@/types';
import { formatAPR } from '@/lib/utils';

const STAKING_POOL_MANAGER_ABI = ABIS.StakingPoolManager;
const DEAD_COIN_POOL_ABI = ABIS.DeadCoinStakingPool;

export function useStakingPoolManager() {
  const chainId = useChainId();
  const managerAddress = getContractAddress(chainId, 'StakingPoolManager') as `0x${string}`;

  const { data: deadCoinCount } = useReadContract({
    abi: STAKING_POOL_MANAGER_ABI,
    address: managerAddress,
    functionName: 'supportedDeadCoins',
    args: [0n],
  });

  return { managerAddress, deadCoinCount };
}

export function usePoolAddress(deadCoinAddress?: `0x${string}`) {
  const chainId = useChainId();
  const managerAddress = getContractAddress(chainId, 'StakingPoolManager') as `0x${string}`;

  return useReadContract({
    abi: STAKING_POOL_MANAGER_ABI,
    address: managerAddress,
    functionName: 'deadCoinToPoolAddress',
    args: deadCoinAddress ? [deadCoinAddress] : undefined,
    query: { enabled: !!deadCoinAddress },
  });
}

export function usePoolData(poolAddress?: `0x${string}`) {
  const { address } = useAccount();

  const contracts = [
    { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'totalStakedSupply' },
    { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'rewardRatePerSecond' },
    { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'rewardPerTokenStored' },
    { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'lastUpdateTime' },
    { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'paused' },
    ...(address ? [
      { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'userStakedAmount', args: [address] },
      { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'earned', args: [address] },
      { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'userRewardPerTokenPaid', args: [address] },
      { abi: DEAD_COIN_POOL_ABI, address: poolAddress, functionName: 'userRewards', args: [address] },
    ] : []),
  ] as const;

  const result = useReadContracts({ contracts, query: { enabled: !!poolAddress } });
  return result;
}

export function useAllPools(poolAddresses: `0x${string}`[]) {
  const { address } = useAccount();
  const chainId = useChainId();

  const contracts = poolAddresses.flatMap((poolAddr) => [
    { abi: DEAD_COIN_POOL_ABI, address: poolAddr, functionName: 'totalStakedSupply' },
    { abi: DEAD_COIN_POOL_ABI, address: poolAddr, functionName: 'rewardRatePerSecond' },
    ...(address ? [
      { abi: DEAD_COIN_POOL_ABI, address: poolAddr, functionName: 'userStakedAmount', args: [address] },
      { abi: DEAD_COIN_POOL_ABI, address: poolAddr, functionName: 'earned', args: [address] },
    ] : []),
  ]);

  return useReadContracts({ contracts, query: { enabled: poolAddresses.length > 0 } });
}
