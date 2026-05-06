'use client';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { useResurgeToken } from '@/hooks/useTokenData';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import Link from 'next/link';
import { fetchUser, fetchUserStakingHistory, SUBGRAPH_URL } from '@/lib/graphql';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { symbol, totalSupply, cap, balance, votes } = useResurgeToken();
  const [userData, setUserData] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!SUBGRAPH_URL || !address) return;
    (async () => {
      const user = await fetchUser(address);
      setUserData(user);
      const history = await fetchUserStakingHistory(address, 5);
      setRecentActivity(history);
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
        <StatCard label="Total Earned" value={formatTokenAmount(BigInt(userData?.totalResurgeEarned || '0'))} sub="Lifetime RESURGE" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <section className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Positions</h2>
            <Link href="/pools" className="text-sm text-blue-400 hover:text-blue-300">View All Pools</Link>
          </div>
          {userData?.stakingPositions?.length > 0 ? (
            userData.stakingPositions.map((pos: any) => (
              <Link key={pos.pool.id} href={`/pools/${pos.pool.poolAddress}`}
                className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0 hover:bg-gray-750 px-2 rounded">
                <div>
                  <p className="text-white text-sm">{pos.pool.id.slice(0, 10)}...</p>
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
            recentActivity.map((evt: any) => (
              <div key={evt.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                <span className="text-white text-sm">{evt.type}</span>
                <span className="text-gray-400 text-xs">{formatTokenAmount(BigInt(evt.amount))}</span>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No recent activity.</p>
          )}
        </section>
      </div>
    </div>
  );
}
