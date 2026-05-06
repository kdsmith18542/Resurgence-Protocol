'use client';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { PoolInfo } from '@/types';
import PoolCard from '@/components/PoolCard';
import StakeModal from '@/components/StakeModal';
import UnstakeModal from '@/components/UnstakeModal';
import ClaimModal from '@/components/ClaimModal';
import { fetchPoolsWithUserPosition, SUBGRAPH_URL, type SubgraphPool } from '@/lib/graphql';

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const [stakePool, setStakePool] = useState<PoolInfo | null>(null);
  const [unstakePool, setUnstakePool] = useState<PoolInfo | null>(null);
  const [claimPool, setClaimPool] = useState<PoolInfo | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUBGRAPH_URL) {
      setLoading(false);
      return;
    }
    (async () => {
      const subgraphData = await fetchPoolsWithUserPosition(address || '');
      if (subgraphData) {
        setPools(subgraphData.map(p => ({
          address: p.poolAddress,
          deadCoinAddress: p.deadCoinToken,
          deadCoinName: p.deadCoinToken.slice(0, 10),
          deadCoinSymbol: '???',
          stakedAmount: BigInt(p.position?.stakedAmount || '0'),
          totalStaked: BigInt(p.totalStaked),
          rewardRate: BigInt(p.rewardRatePerSecond),
          userRewards: BigInt(p.position?.unclaimedRewards || '0'),
          tvl: Number(BigInt(p.totalStaked) / BigInt(1e18)),
          apr: Number(BigInt(p.rewardRatePerSecond) * 365n * 86400n) / Number(BigInt(p.totalStaked || 1n)) * 100,
        })));
      }
      setLoading(false);
    })();
  }, [address]);

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
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Staking Pools</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-800 rounded-xl"></div>
          <div className="h-24 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const displayPools = pools.length > 0 ? pools : [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Staking Pools</h1>
      <p className="text-gray-400 mb-8">Stake abandoned ERC-20 tokens and earn RESURGE rewards.</p>

      {displayPools.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400">No staking pools available yet.</p>
          <p className="text-gray-500 text-sm mt-2">Pools will appear here once deployed and indexed by the subgraph.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayPools.map((pool) => (
            <PoolCard
              key={pool.address}
              pool={pool}
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
          userBalance={100000n * 10n ** 18n}
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
        />
      )}
    </div>
  );
}
