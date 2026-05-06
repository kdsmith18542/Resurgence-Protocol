'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useAccount, useChainId } from 'wagmi';
import { formatTokenAmount } from '@/lib/utils';

export function useResurgeToken() {
  const chainId = useChainId();
  const { address } = useAccount();
  const tokenAddress = getContractAddress(chainId, 'ResurgeToken');

  const { data: name } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'name' });
  const { data: symbol } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'symbol' });
  const { data: totalSupply } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'totalSupply' });
  const { data: cap } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'cap' });
  const { data: balance } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!address } });
  const { data: votes } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'getVotes', args: [address as `0x${string}`], query: { enabled: !!address } });
  const { data: delegatedTo } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'delegates', args: [address as `0x${string}`], query: { enabled: !!address } });
  const { data: allowance } = useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'allowance', args: [address as `0x${string}`, tokenAddress as `0x${string}`], query: { enabled: !!address } });

  return { tokenAddress, name, symbol, totalSupply, cap, balance, votes, delegatedTo, allowance };
}

export function useTokenAllowance(owner: `0x${string}`, spender: `0x${string}`) {
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId, 'ResurgeToken');
  return useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'allowance', args: [owner, spender], query: { enabled: !!owner && !!spender } });
}
