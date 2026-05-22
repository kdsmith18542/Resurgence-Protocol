'use client';
import { useWriteContract, useSimulateContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function useStake(poolAddress: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const stake = async (amount: bigint) => {
    writeContract({ abi: ABIS.DeadCoinStakingPool, address: poolAddress, functionName: 'stake', args: [amount] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { stake, isPending: isPending || isConfirming, isSuccess, hash };
}

export function useUnstake(poolAddress: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const unstake = async (amount: bigint) => {
    writeContract({ abi: ABIS.DeadCoinStakingPool, address: poolAddress, functionName: 'unstake', args: [amount] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { unstake, isPending: isPending || isConfirming, isSuccess, hash };
}

export function useClaimRewards(poolAddress: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const claimRewards = async () => {
    writeContract({ abi: ABIS.DeadCoinStakingPool, address: poolAddress, functionName: 'claimRewards' });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { claimRewards, isPending: isPending || isConfirming, isSuccess, hash };
}

export function useApproveToken(tokenAddress: `0x${string}`, spender: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const approve = async (amount: bigint) => {
    writeContract({ abi: ABIS.ResurgeToken, address: tokenAddress, functionName: 'approve', args: [spender, amount] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { approve, isPending: isPending || isConfirming, isSuccess, hash };
}

export function useDelegate() {
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId, 'ResurgeToken') as `0x${string}`;
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const delegate = async (delegatee: `0x${string}`) => {
    writeContract({ abi: ABIS.ResurgeToken, address: tokenAddress, functionName: 'delegate', args: [delegatee] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { delegate, isPending: isPending || isConfirming, isSuccess, hash };
}

export function useCastVote(governanceAddress: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const castVote = async (proposalId: bigint, support: 0 | 1 | 2) => {
    writeContract({ abi: ABIS.ResurgenceGovernance, address: governanceAddress, functionName: 'castVote', args: [proposalId, support] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { castVote, isPending: isPending || isConfirming, isSuccess, hash };
}

export function usePropose(governanceAddress: `0x${string}`) {
  const queryClient = useQueryClient();
  const { data: hash, isPending, writeContract } = useWriteContract();

  const propose = async (targets: `0x${string}`[], values: bigint[], calldatas: `0x${string}`[], description: string) => {
    writeContract({ abi: ABIS.ResurgenceGovernance, address: governanceAddress, functionName: 'propose', args: [targets, values, calldatas, description] });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash, query: { enabled: !!hash } });

  if (isSuccess) queryClient.invalidateQueries();

  return { propose, isPending: isPending || isConfirming, isSuccess, hash };
}
