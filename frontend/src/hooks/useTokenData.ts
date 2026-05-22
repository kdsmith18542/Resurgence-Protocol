'use client';
import { useState, useEffect } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useAccount, useChainId } from 'wagmi';
import { formatTokenAmount } from '@/lib/utils';

export function useErc20Balance(tokenAddress?: `0x${string}`, userAddress?: `0x${string}`) {
  return useReadContract({
    abi: ABIS.Erc20,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!tokenAddress && !!userAddress },
  });
}

export function useErc20Symbol(tokenAddress?: `0x${string}`) {
  return useReadContract({
    abi: ABIS.Erc20,
    address: tokenAddress,
    functionName: 'symbol',
    query: { enabled: !!tokenAddress },
  });
}

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

export function useResurgePrice(tokenAddress?: string): { price: number | null; loading: boolean } {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenAddress) { setLoading(false); return; }
    const ctrl = new AbortController();
    fetch(
      `https://api.coingecko.com/api/v3/simple/token_price/polygon-pos?contract_addresses=${tokenAddress}&vs_currencies=usd`,
      { signal: ctrl.signal }
    )
      .then(r => r.json())
      .then(data => {
        const p = data?.[tokenAddress.toLowerCase()]?.usd;
        setPrice(typeof p === 'number' ? p : null);
      })
      .catch(() => setPrice(null))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [tokenAddress]);

  return { price, loading };
}

export function useTokenAllowance(owner: `0x${string}`, spender: `0x${string}`) {
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId, 'ResurgeToken');
  return useReadContract({ abi: ABIS.ResurgeToken, address: tokenAddress as `0x${string}`, functionName: 'allowance', args: [owner, spender], query: { enabled: !!owner && !!spender } });
}
