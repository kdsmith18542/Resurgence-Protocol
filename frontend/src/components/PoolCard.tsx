'use client';
import { PoolInfo } from '@/types';
import { formatTokenAmount, formatAPR } from '@/lib/utils';
import Link from 'next/link';

interface PoolCardProps {
  pool: PoolInfo;
  onStake?: () => void;
  onUnstake?: () => void;
  onClaim?: () => void;
}

export default function PoolCard({ pool, onStake, onUnstake, onClaim }: PoolCardProps) {
  const apr = formatAPR(pool.rewardRate, pool.totalStaked);

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-500 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href={`/pools/${pool.address}`} className="text-lg font-semibold text-white hover:text-blue-400">
            {pool.deadCoinName || pool.deadCoinSymbol || 'Unknown Pool'}
          </Link>
          <p className="text-sm text-gray-400 font-mono">{pool.deadCoinSymbol}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{apr.toFixed(2)}%</p>
          <p className="text-xs text-gray-400">APR</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400">Total Staked</p>
          <p className="text-sm text-white font-medium">{formatTokenAmount(pool.totalStaked)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Your Stake</p>
          <p className="text-sm text-white font-medium">{formatTokenAmount(pool.stakedAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Pending Rewards</p>
          <p className="text-sm text-yellow-400 font-medium">{formatTokenAmount(pool.userRewards)} RESURGE</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">TVL</p>
          <p className="text-sm text-white font-medium">${pool.tvl.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={onStake} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
          Stake
        </button>
        <button onClick={onUnstake} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
          Unstake
        </button>
        <button onClick={onClaim} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
          Claim
        </button>
      </div>
    </div>
  );
}
