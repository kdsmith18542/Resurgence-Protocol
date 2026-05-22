'use client';
import { useEffect, useState } from 'react';
import { fetchProtocolMetrics, fetchResurgeToken, fetchPools, SubgraphPool } from '@/lib/graphql';
import { useResurgePrice } from '@/hooks/useTokenData';
import { useChainId } from 'wagmi';
import { getContractAddress } from '@/lib/contracts';
import { formatTokenAmount, formatUSD, truncateAddress } from '@/lib/utils';
import { LoadingSpinner } from '@/components/StateComponents';

function BarFill({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const chainId = useChainId();
  const tokenAddress = getContractAddress(chainId, 'ResurgeToken');
  const { price: resurgePrice } = useResurgePrice(tokenAddress);

  const [metrics, setMetrics] = useState<any>(null);
  const [tokenData, setTokenData] = useState<any>(null);
  const [pools, setPools] = useState<SubgraphPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [m, t, p] = await Promise.all([
        fetchProtocolMetrics(),
        fetchResurgeToken(),
        fetchPools(),
      ]);
      setMetrics(m);
      setTokenData(t);
      setPools(p);
      setLoading(false);
    })();
  }, []);

  const totalTVL = BigInt(metrics?.totalValueLocked || '0');
  const totalDistributed = BigInt(tokenData?.totalRewardsDistributed || '0');
  const totalSupply = BigInt(tokenData?.totalSupply || '0');
  const cap = 1_000_000_000n * 10n ** 18n;

  const totalPoolTVL = pools.reduce((sum, p) => sum + BigInt(p.totalStaked || '0'), 0n);

  const sortedPools = [...pools].sort((a, b) =>
    BigInt(b.totalStaked || '0') > BigInt(a.totalStaked || '0') ? 1 : -1
  );

  const totalEmissionPerDay = pools.reduce(
    (sum, p) => sum + BigInt(p.rewardRatePerSecond || '0') * 86400n,
    0n
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Protocol Analytics</h1>
        <LoadingSpinner label="Loading analytics..." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Protocol Analytics</h1>
        <p className="text-gray-400 text-sm">Live protocol metrics from on-chain subgraph data.</p>
      </div>

      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Total Value Locked',
            value: formatUSD(Number(totalTVL) / 1e18),
            sub: 'across all pools',
          },
          {
            label: 'RESURGE Price',
            value: resurgePrice != null ? `$${resurgePrice.toFixed(4)}` : 'Pre-market',
            sub: resurgePrice != null ? 'via CoinGecko' : 'not yet listed',
            accent: 'text-yellow-400',
          },
          {
            label: 'Total Distributed',
            value: formatTokenAmount(totalDistributed),
            sub: 'RESURGE emitted',
          },
          {
            label: 'Total Stakers',
            value: metrics?.totalStakers ?? '0',
            sub: 'unique addresses',
          },
          {
            label: 'Active Pools',
            value: metrics?.totalPools ?? pools.length.toString(),
            sub: 'dead coin pools',
          },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1 leading-tight">{label}</p>
            <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* TVL by pool */}
      <section>
        <h2 className="text-xl font-semibold mb-4">TVL Breakdown by Pool</h2>
        {sortedPools.length === 0 ? (
          <p className="text-gray-400 text-sm">No pools found. Data will appear after pools are created.</p>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3">Pool (dead coin)</th>
                  <th className="text-right px-4 py-3">Stakers</th>
                  <th className="text-right px-4 py-3">TVL</th>
                  <th className="text-right px-4 py-3">Share</th>
                  <th className="text-left px-4 py-3 w-32">Distribution</th>
                  <th className="text-right px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedPools.map((pool) => {
                  const staked = BigInt(pool.totalStaked || '0');
                  const sharePct =
                    totalPoolTVL > 0n
                      ? (Number(staked * 10000n / totalPoolTVL) / 100)
                      : 0;
                  return (
                    <tr key={pool.id} className="border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-mono text-white text-xs">{truncateAddress(pool.deadCoinToken)}</p>
                        <p className="text-gray-500 text-xs mt-0.5">Pool: {truncateAddress(pool.poolAddress)}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">{pool.stakerCount}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">{formatTokenAmount(staked)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{sharePct.toFixed(1)}%</td>
                      <td className="px-4 py-3 w-32">
                        <BarFill pct={sharePct} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {pool.paused ? (
                          <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">Paused</span>
                        ) : (
                          <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Emission schedule */}
      <section>
        <h2 className="text-xl font-semibold mb-1">Emission Schedule</h2>
        <p className="text-gray-400 text-sm mb-4">
          Reward rates are set by governance and can be adjusted at any time.
          Total protocol emission: <strong className="text-white">{formatTokenAmount(totalEmissionPerDay)} RESURGE / day</strong>.
        </p>
        {sortedPools.length === 0 ? (
          <p className="text-gray-400 text-sm">No pools found.</p>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3">Pool</th>
                  <th className="text-right px-4 py-3">Rate / sec</th>
                  <th className="text-right px-4 py-3">Rate / day</th>
                  <th className="text-right px-4 py-3">Rate / year</th>
                  <th className="text-right px-4 py-3">% of Emissions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPools.map((pool) => {
                  const rps = BigInt(pool.rewardRatePerSecond || '0');
                  const rDay = rps * 86400n;
                  const rYear = rps * 86400n * 365n;
                  const emissionShare =
                    totalEmissionPerDay > 0n
                      ? (Number(rDay * 10000n / totalEmissionPerDay) / 100)
                      : 0;
                  return (
                    <tr key={pool.id} className="border-b border-gray-700/50 last:border-0 hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">{truncateAddress(pool.deadCoinToken)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatTokenAmount(rps)}</td>
                      <td className="px-4 py-3 text-right text-white">{formatTokenAmount(rDay)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{formatTokenAmount(rYear)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{emissionShare.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Token supply */}
      <section>
        <h2 className="text-xl font-semibold mb-4">RESURGE Token Supply</h2>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400 text-sm">Circulating Supply</span>
            <span className="text-white font-medium">{formatTokenAmount(totalSupply)} RESURGE</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>0</span>
              <span>Hard Cap: 1,000,000,000</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-3 rounded-full transition-all duration-700"
                style={{ width: `${cap > 0n ? Math.min(Number(totalSupply * 10000n / cap) / 100, 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {cap > 0n ? (Number(totalSupply * 10000n / cap) / 100).toFixed(4) : '0.0000'}% of max supply minted
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
            <div>
              <p className="text-xs text-gray-400">Total Distributed (claimed)</p>
              <p className="text-white font-medium">{formatTokenAmount(totalDistributed)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Currently Staked (RESURGE pool)</p>
              <p className="text-white font-medium">{formatTokenAmount(BigInt(tokenData?.totalStakedAllPools || '0'))}</p>
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs text-gray-600 pb-4">
        Data sourced from The Graph subgraph. Refresh the page to update. Price sourced from CoinGecko API.
      </p>
    </div>
  );
}
