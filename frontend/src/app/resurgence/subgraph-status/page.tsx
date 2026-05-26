'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SubgraphStatusPage() {
  const [loading, setLoading] = useState(true);
  const [subgraphs, setSubgraphs] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSubgraphs([
        {
          name: "Resurgence Hub (Arbitrum Sepolia)",
          url: "https://api.studio.thegraph.com/query/hub-subgraph",
          syncedBlock: 12480150,
          latestBlock: 12480152,
          lag: 2,
          status: "Healthy",
          queryTimeMs: 42
        },
        {
          name: "Resurgence Spoke (Amoy)",
          url: "https://api.studio.thegraph.com/query/amoy-subgraph",
          syncedBlock: 39007798,
          latestBlock: 39007800,
          lag: 2,
          status: "Healthy",
          queryTimeMs: 65
        },
        {
          name: "Resurgence Spoke (Base Sepolia)",
          url: "https://api.studio.thegraph.com/query/base-subgraph",
          syncedBlock: 41986980,
          latestBlock: 41986985,
          lag: 5,
          status: "Synced",
          queryTimeMs: 82
        }
      ]);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10 max-w-4xl mx-auto text-left">
        <div className="h-10 bg-gray-800 rounded-xl w-64"></div>
        <div className="h-48 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Subgraph Status</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Subgraph Health Index</h1>
        <p className="text-gray-400 text-sm">
          Monitor the indexing sync statuses and block lags of all deployed The Graph subgraphs.
        </p>
      </div>

      {/* Indexer grid */}
      <div className="space-y-4">
        {subgraphs.map((sub, idx) => (
          <div key={idx} className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-white">{sub.name}</h2>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${sub.status === 'Healthy' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                {sub.status}
              </span>
            </div>

            <div className="text-xs text-gray-500 font-mono break-all bg-gray-950 p-2.5 rounded-lg border border-gray-700/60">
              ENDPOINT: {sub.url}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-400 pt-2">
              <div>
                <span className="text-xs text-gray-500">Synced Block</span>
                <p className="text-white font-mono font-semibold mt-1">#{sub.syncedBlock.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Latest Head</span>
                <p className="text-white font-mono font-semibold mt-1">#{sub.latestBlock.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Sync Block Lag</span>
                <p className={`font-mono font-bold mt-1 ${sub.lag > 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {sub.lag} blocks
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Response Speed</span>
                <p className="text-white font-mono font-semibold mt-1">{sub.queryTimeMs} ms</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
