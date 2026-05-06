'use client';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import StatCard from '@/components/StatCard';
import StakeModal from '@/components/StakeModal';
import UnstakeModal from '@/components/UnstakeModal';
import ClaimModal from '@/components/ClaimModal';
import { formatTokenAmount } from '@/lib/utils';
import { fetchPools, fetchUserPosition, SUBGRAPH_URL } from '@/lib/graphql';

export default function PoolDetailPage() {
  const { address: poolAddress } = useParams<{ address: string }>();
  const { address: userAddress, isConnected } = useAccount();
  const [showStake, setShowStake] = useState(false);
  const [showUnstake, setShowUnstake] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [poolData, setPoolData] = useState<any>(null);
  const [position, setPosition] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUBGRAPH_URL) { setLoading(false); return; }
    (async () => {
      const pools = await fetchPools();
      const match = pools?.find(p => p.poolAddress.toLowerCase() === poolAddress.toLowerCase());
      if (match) setPoolData(match);
      if (userAddress) {
        const pos = await fetchUserPosition(userAddress, poolAddress);
        setPosition(pos);
      }
      setLoading(false);
    })();
  }, [poolAddress, userAddress]);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Pool Details</h1>
        <p className="text-gray-400">Connect your wallet to view pool details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-gray-800 rounded-xl w-64"></div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-800 rounded-xl"></div>)}
        </div>
      </div>
    );
  }

  const totalStaked = poolData ? BigInt(poolData.totalStaked) : 0n;
  const rewardRate = poolData ? BigInt(poolData.rewardRatePerSecond) : 0n;
  const userStaked = position ? BigInt(position.stakedAmount) : 0n;
  const userRewards = position ? BigInt(position.unclaimedRewards) : 0n;
  const symbol = 'DEAD';
  const name = poolData?.deadCoinToken?.slice(0, 10) || 'Pool';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{`${name} Pool`}</h1>
          <p className="text-gray-400 font-mono text-sm">{symbol} · {poolAddress?.slice(0, 10)}...</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-green-400">
            {totalStaked > 0n ? (Number(rewardRate * 365n * 86400n) / Number(totalStaked) * 100).toFixed(1) : '0'}%
          </p>
          <p className="text-sm text-gray-400">APR</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Staked" value={formatTokenAmount(totalStaked)} sub={symbol} />
        <StatCard label="Your Stake" value={formatTokenAmount(userStaked)} sub={symbol} />
        <StatCard label="Pending Rewards" value={formatTokenAmount(userRewards)} sub="RESURGE" />
        <StatCard label="TVL" value={`$${(Number(totalStaked / BigInt(1e18))).toLocaleString()}`} />
      </div>

      <div className="flex gap-3 mb-8">
        <button onClick={() => setShowStake(true)} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
          Stake
        </button>
        <button onClick={() => setShowUnstake(true)} className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
          Unstake
        </button>
        <button onClick={() => setShowClaim(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
          Claim Rewards
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Pool Information</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <div className="flex justify-between"><span>Pool Address</span><span className="text-white font-mono">{poolAddress}</span></div>
          <div className="flex justify-between"><span>Reward Rate</span><span className="text-white">{formatTokenAmount(rewardRate)} RESURGE/s</span></div>
          <div className="flex justify-between"><span>Total Staked</span><span className="text-white">{formatTokenAmount(totalStaked)} {symbol}</span></div>
        </div>
      </div>

      <StakeModal isOpen={showStake} onClose={() => setShowStake(false)} poolAddress={poolAddress as `0x${string}`} deadCoinAddress={poolData?.deadCoinToken as `0x${string}`} userBalance={10000n * 10n ** 18n} userStaked={userStaked} tokenSymbol={symbol} />
      <UnstakeModal isOpen={showUnstake} onClose={() => setShowUnstake(false)} poolAddress={poolAddress as `0x${string}`} stakedAmount={userStaked} tokenSymbol={symbol} />
      <ClaimModal isOpen={showClaim} onClose={() => setShowClaim(false)} poolAddress={poolAddress as `0x${string}`} pendingRewards={userRewards} />
    </div>
  );
}
