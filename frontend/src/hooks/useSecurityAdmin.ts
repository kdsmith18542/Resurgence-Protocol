'use client';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useAccount } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';

interface ContractState {
  address: `0x${string}`;
  name: string;
  paused: boolean;
  isAdmin: boolean;
}

export function useSecurityAdmin() {
  const chainId = useChainId();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isConfirming) queryClient.invalidateQueries();

  const tokenAddress = getContractAddress(chainId, 'ResurgeToken') as `0x${string}`;
  const managerAddress = getContractAddress(chainId, 'StakingPoolManager') as `0x${string}`;
  const distributorAddress = getContractAddress(chainId, 'RewardDistributor') as `0x${string}`;

  const pauseRole = '0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a';

  const { data: tokenPaused } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress, functionName: 'paused', query: { enabled: !!tokenAddress } });
  const { data: managerPaused } = useReadContract({ abi: ABIS.StakingPoolManager, address: managerAddress, functionName: 'paused', query: { enabled: !!managerAddress } });
  const { data: distributorPaused } = useReadContract({ abi: ABIS.RewardDistributor, address: distributorAddress, functionName: 'paused', query: { enabled: !!distributorAddress } });

  const { data: isTokenAdmin } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress, functionName: 'hasRole', args: [pauseRole, address as `0x${string}`], query: { enabled: !!address && !!tokenAddress } });
  const { data: isManagerAdmin } = useReadContract({ abi: ABIS.StakingPoolManager, address: managerAddress, functionName: 'hasRole', args: [pauseRole, address as `0x${string}`], query: { enabled: !!address && !!managerAddress } });
  const { data: isDistributorAdmin } = useReadContract({ abi: ABIS.RewardDistributor, address: distributorAddress, functionName: 'hasRole', args: [pauseRole, address as `0x${string}`], query: { enabled: !!address && !!distributorAddress } });

  const isAnyAdmin = !!(isTokenAdmin || isManagerAdmin || isDistributorAdmin);

  const contracts: ContractState[] = [
    { address: tokenAddress, name: 'RESURGE Token', paused: !!tokenPaused, isAdmin: !!isTokenAdmin },
    { address: managerAddress, name: 'Pool Manager', paused: !!managerPaused, isAdmin: !!isManagerAdmin },
    { address: distributorAddress, name: 'Reward Distributor', paused: !!distributorPaused, isAdmin: !!isDistributorAdmin },
  ];

  const executePause = (contractAddress: `0x${string}`, abi: typeof ABIS.StakingPoolManager, pause: boolean) => {
    writeContract({ abi, address: contractAddress, functionName: pause ? 'pause' : 'unpause' });
  };

  return { contracts, isAnyAdmin, executePause, isPending };
}
