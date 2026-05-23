'use client';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState, useEffect } from 'react';
import { useResurgeToken, useResurgePrice } from '@/hooks/useTokenData';
import { formatTokenAmount, truncateAddress, formatUSD } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import { LoadingSpinner } from '@/components/StateComponents';
import Link from 'next/link';
import { fetchUser, fetchUserStakingHistory, fetchProtocolMetrics, fetchResurgeToken } from '@/lib/graphql';
import { ABIS } from '@/lib/abis';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { symbol, balance, votes, tokenAddress } = useResurgeToken();
  const { price: resurgePrice } = useResurgePrice(tokenAddress);
  const { writeContract, data: claimHash } = useWriteContract();
  const { isLoading: isClaimingAll } = useWaitForTransactionReceipt({ hash: claimHash, query: { enabled: !!claimHash } });
  const [userData, setUserData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [protocolMetrics, setProtocolMetrics] = useState<any>(null);
  const [resurgeTokenData, setResurgeTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    (async () => {
      setLoading(true);
      const [user, history, metrics, tokenData] = await Promise.all([
        fetchUser(address),
        fetchUserStakingHistory(address, 8),
        fetchProtocolMetrics(),
        fetchResurgeToken(),
      ]);
      setUserData(user);
      setRecentActivity(history || []);
      setProtocolMetrics(metrics);
      setResurgeTokenData(tokenData);
      setLoading(false);
    })();
  }, [address]);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-400">Connect your wallet to view your dashboard.</p>
      </div>
    );
  }

  const handleClaimAll = async () => {
    if (!userData?.stakingPositions?.length) return;
    for (const pos of userData.stakingPositions) {
      if (BigInt(pos.unclaimedRewards || '0') > 0n) {
        writeContract({
          abi: ABIS.DeadCoinStakingPool,
          address: pos.pool.poolAddress as `0x${string}`,
          functionName: 'claimRewards',
        });
      }
    }
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <LoadingSpinner label="Loading your portfolio..." />
      </div>
    );
  }

  const eventLabel = (type: string) => {
    switch (type) {
      case 'Stake': return 'Staked';
      case 'Unstake': return 'Unstaked';
      case 'ClaimRewards': return 'Claimed';
      default: return type;
    }
  };

  const eventColor = (type: string) => {
    switch (type) {
      case 'Stake': return 'text-green-400';
      case 'Unstake': return 'text-yellow-400';
      case 'ClaimRewards': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
        <p className="text-sm text-gray-400">Wallet</p>
        <p className="text-white font-mono">{truncateAddress(address || '')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="RESURGE Balance" value={formatTokenAmount(balance || 0n)} sub={symbol as string} />
        <StatCard label="Voting Power" value={formatTokenAmount(votes || 0n)} sub="RESURGE" />
        <StatCard label="Total Staked" value={formatTokenAmount(BigInt(userData?.stakedBalance || '0'))} sub="Across all pools" />
        <StatCard label="Lifetime Earned" value={formatTokenAmount(BigInt(userData?.totalResurgeEarned || '0'))} sub="RESURGE" />
      </div>

      {protocolMetrics && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Protocol Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-2xl font-bold text-white">{formatUSD(Number(BigInt(protocolMetrics.totalValueLocked || '0')) / 1e18)}</p>
              <p className="text-xs text-gray-400 mt-1">Total Value Locked</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-2xl font-bold text-white">{protocolMetrics.totalPools || '0'}</p>
              <p className="text-xs text-gray-400 mt-1">Active Pools</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-2xl font-bold text-white">{protocolMetrics.totalStakers || '0'}</p>
              <p className="text-xs text-gray-400 mt-1">Total Stakers</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-2xl font-bold text-white">{formatTokenAmount(BigInt(resurgeTokenData?.totalRewardsDistributed || '0'))}</p>
              <p className="text-xs text-gray-400 mt-1">Rewards Distributed</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <p className="text-2xl font-bold text-yellow-400">
                {resurgePrice != null ? `$${resurgePrice.toFixed(4)}` : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-1">RESURGE Price</p>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Positions</h2>
            <Link href="/pools" className="text-sm text-blue-400 hover:text-blue-300">View All Pools</Link>
          </div>
          {userData?.stakingPositions?.length > 0 ? (
            userData.stakingPositions.map((pos: any) => (
              <Link key={pos.pool.id} href={`/pools/detail/?address=${pos.pool.poolAddress}`}
                className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0 hover:bg-gray-700/50 px-2 rounded transition-colors">
                <div>
                  <p className="text-white text-sm font-mono">{pos.pool.id.slice(0, 10)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm">{formatTokenAmount(BigInt(pos.stakedAmount))}</p>
                  <p className="text-gray-400 text-xs">{formatTokenAmount(BigInt(pos.unclaimedRewards))} pending</p>
                </div>
              </Link>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No active staking positions.</p>
          )}
        </section>

        <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          {recentActivity.length > 0 ? (
            recentActivity.map((evt: any, i: number) => (
              <div key={evt.id || i} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${eventColor(evt.type)}`}>{eventLabel(evt.type)}</span>
                  {evt.pool && <span className="text-gray-500 text-xs font-mono">{evt.pool.poolAddress?.slice(0, 8)}...</span>}
                </div>
                <span className="text-gray-300 text-sm">{formatTokenAmount(BigInt(evt.amount || '0'))}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No recent activity. Start staking to see your history here.</p>
          )}
        </section>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/pools" className="bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-xl font-medium transition-colors">
          Stake Tokens
        </Link>
        <Link href="/governance" className="bg-purple-600 hover:bg-purple-700 text-white text-center py-3 rounded-xl font-medium transition-colors">
          Governance
        </Link>
        <button
          onClick={handleClaimAll}
          disabled={isClaimingAll || !userData?.stakingPositions?.some((p: any) => BigInt(p.unclaimedRewards || '0') > 0n)}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-center py-3 rounded-xl font-medium transition-colors"
        >
          {isClaimingAll ? 'Claiming...' : 'Claim All Rewards'}
        </button>
      </section>
    </div>
  );
}
