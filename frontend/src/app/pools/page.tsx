'use client';
import { useAccount, useChainId } from 'wagmi';
import { useReadContracts } from 'wagmi';
import { useState, useEffect, useMemo } from 'react';
import { PoolInfo } from '@/types';
import PoolCard from '@/components/PoolCard';
import StakeModal from '@/components/StakeModal';
import UnstakeModal from '@/components/UnstakeModal';
import ClaimModal from '@/components/ClaimModal';
import { LoadingSpinner } from '@/components/StateComponents';
import { useErc20Balance } from '@/hooks/useTokenData';
import { ABIS } from '@/lib/abis';
import { formatUSD } from '@/lib/utils';
import { fetchPoolsWithUserPosition, getSubgraphUrl } from '@/lib/graphql';
import { isSpokeChain, CHAIN_NAMES } from '@/lib/contracts';

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [stakePool, setStakePool] = useState<PoolInfo | null>(null);
  const [unstakePool, setUnstakePool] = useState<PoolInfo | null>(null);
  const [claimPool, setClaimPool] = useState<PoolInfo | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const isSpoke = isSpokeChain(chainId);
  const subgraphAvailable = !!getSubgraphUrl(chainId);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  useEffect(() => {
    setLoading(true);
    setPools([]);
    if (!subgraphAvailable) {
      setLoading(false);
      return;
    }
    (async () => {
      const subgraphData = await fetchPoolsWithUserPosition(address || '', chainId);
      if (subgraphData) {
        setPools(subgraphData.map(p => ({
          address: p.poolAddress,
          deadCoinAddress: p.deadCoinToken,
          deadCoinName: p.deadCoinToken.slice(0, 10),
          deadCoinSymbol: '',
          stakedAmount: BigInt(p.position?.stakedAmount || '0'),
          totalStaked: BigInt(p.totalStaked),
          rewardRate: BigInt(p.rewardRatePerSecond),
          userRewards: BigInt(p.position?.unclaimedRewards || '0'),
          tvl: Number(BigInt(p.totalStaked) / BigInt(1e18)),
          apr: Number(BigInt(p.rewardRatePerSecond) * 365n * 86400n) / Number(BigInt(p.totalStaked || 1n)) * 100,
          stakerCount: Number(p.stakerCount || '0'),
          createdAt: p.createdAt || '',
        })));
      }
      setLoading(false);
    })();
  }, [address, chainId, subgraphAvailable]);

  const deadCoinAddresses = useMemo(
    () => pools.map(p => p.deadCoinAddress as `0x${string}`).filter(Boolean),
    [pools]
  );

  const { data: symbolResults } = useReadContracts({
    contracts: deadCoinAddresses.map(addr => ({
      abi: ABIS.Erc20,
      address: addr,
      functionName: 'symbol',
    })),
    query: { enabled: deadCoinAddresses.length > 0 },
  });

  const poolsWithSymbols = useMemo(() =>
    pools.map((pool, i) => ({
      ...pool,
      deadCoinSymbol: (symbolResults?.[i]?.result as string) || '???',
    })),
    [pools, symbolResults]
  );

  const totalTVL = useMemo(() =>
    poolsWithSymbols.reduce((sum, p) => sum + p.tvl, 0),
    [poolsWithSymbols]
  );

  const selectedDeadCoinAddress = (stakePool || unstakePool)?.deadCoinAddress as `0x${string}` | undefined;
  const { data: selectedBalance } = useErc20Balance(selectedDeadCoinAddress, address as `0x${string}`);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Staking Pools</h1>
        <p className="text-gray-400">Connect your wallet to view and interact with staking pools.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Staking Pools</h1>
        <LoadingSpinner label="Loading pools..." />
      </div>
    );
  }

  const displayPools = poolsWithSymbols.length > 0 ? poolsWithSymbols : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">Staking Pools</h1>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isSpoke ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'}`}>
              {isSpoke ? `SPOKE · ${chainName}` : `HUB · ${chainName}`}
            </span>
          </div>
          <p className="text-gray-400 mt-1">
            {isSpoke
              ? `Stake dead tokens on ${chainName}. Rewards bridge to Arbitrum via CCIP.`
              : 'Stake abandoned ERC-20 tokens and earn RESURGE rewards directly.'
            }
          </p>
        </div>
        {displayPools.length > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">{formatUSD(totalTVL)}</p>
            <p className="text-sm text-gray-400">Total TVL</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-white">{displayPools.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Pools</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-white">{displayPools.reduce((s, p) => s + p.stakerCount, 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Total Stakers</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-green-400">{displayPools.filter(p => p.stakedAmount > 0n).length}</p>
          <p className="text-xs text-gray-400 mt-1">Your Pools</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-blue-400">{displayPools.filter(p => p.apr > 0).length}</p>
          <p className="text-xs text-gray-400 mt-1">Active Rewards</p>
        </div>
      </div>

      {!subgraphAvailable ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-yellow-400 font-medium">Subgraph not yet indexed for {chainName}</p>
          <p className="text-gray-500 text-sm mt-2">
            Spoke deployment pending. Once deployed and the subgraph is synced, pools will appear here.
          </p>
          {isSpoke && (
            <p className="text-gray-600 text-xs mt-3">
              Hub: Arbitrum One / Arbitrum Sepolia &mdash; Rewards mint there after bridge claim.
            </p>
          )}
        </div>
      ) : displayPools.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400">No staking pools available yet on {chainName}.</p>
          <p className="text-gray-500 text-sm mt-2">Pools will appear here once deployed and indexed by the subgraph.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayPools.map((pool) => (
            <PoolCard
              key={pool.address}
              pool={pool}
              isSpoke={isSpoke}
              onStake={() => setStakePool(pool)}
              onUnstake={() => setUnstakePool(pool)}
              onClaim={() => setClaimPool(pool)}
            />
          ))}
        </div>
      )}

      {stakePool && (
        <StakeModal
          isOpen={!!stakePool}
          onClose={() => setStakePool(null)}
          poolAddress={stakePool.address as `0x${string}`}
          deadCoinAddress={stakePool.deadCoinAddress as `0x${string}`}
          userBalance={(selectedBalance as bigint) || 0n}
          userStaked={stakePool.stakedAmount}
          tokenSymbol={stakePool.deadCoinSymbol}
        />
      )}
      {unstakePool && (
        <UnstakeModal
          isOpen={!!unstakePool}
          onClose={() => setUnstakePool(null)}
          poolAddress={unstakePool.address as `0x${string}`}
          stakedAmount={unstakePool.stakedAmount}
          tokenSymbol={unstakePool.deadCoinSymbol}
        />
      )}
      {claimPool && (
        <ClaimModal
          isOpen={!!claimPool}
          onClose={() => setClaimPool(null)}
          poolAddress={claimPool.address as `0x${string}`}
          pendingRewards={claimPool.userRewards}
          isBridgeClaim={isSpoke}
        />
      )}
    </div>
  );
}
