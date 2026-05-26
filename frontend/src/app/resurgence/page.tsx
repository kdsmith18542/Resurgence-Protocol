'use client';

import Link from 'next/link';

export default function ResurgenceDashboard() {
  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Resurgence Protocol Explorer
        </h1>
        <p className="text-gray-400 text-sm">
          Protocol-specific metrics, staking pools, rewards distribution, and governance tracking dashboard.
        </p>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        <Link href="/resurgence/pools" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Staking Pools</h3>
            <p className="text-sm text-gray-400">Inspect TVL, APR, staker counts, and active pool parameters.</p>
          </div>
          <span className="text-blue-400 text-xs mt-4 font-semibold uppercase tracking-wider">Explore Pools →</span>
        </Link>

        <Link href="/resurgence/rewards" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Reward Emissions</h3>
            <p className="text-sm text-gray-400">Track emission multiplier rates and distribution status.</p>
          </div>
          <span className="text-purple-400 text-xs mt-4 font-semibold uppercase tracking-wider">Inspect Rewards →</span>
        </Link>

        <Link href="/resurgence/claims" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Claims History</h3>
            <p className="text-sm text-gray-400">Inspect reward distribution, claim timelines, and bridge offsets.</p>
          </div>
          <span className="text-green-400 text-xs mt-4 font-semibold uppercase tracking-wider">View Log →</span>
        </Link>

        <Link href="/resurgence/governance" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-yellow-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">DAO Governance</h3>
            <p className="text-sm text-gray-400">Community proposals, voting power, execution, and timelock status.</p>
          </div>
          <span className="text-yellow-400 text-xs mt-4 font-semibold uppercase tracking-wider">View Proposals →</span>
        </Link>

        <Link href="/resurgence/oracle" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-cyan-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Oracle Registries</h3>
            <p className="text-sm text-gray-400">Watched UTXO addresses, registered dormancy proofs, and mint allocations.</p>
          </div>
          <span className="text-cyan-400 text-xs mt-4 font-semibold uppercase tracking-wider">View Registries →</span>
        </Link>

        <Link href="/resurgence/ccip" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-pink-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">CCIP Messages</h3>
            <p className="text-sm text-gray-400">Cross-chain messaging routing logs, CCIP routers, and bridge offsets.</p>
          </div>
          <span className="text-pink-400 text-xs mt-4 font-semibold uppercase tracking-wider">Inspect Bridge →</span>
        </Link>

        <Link href="/resurgence/treasury" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Treasury & Burn</h3>
            <p className="text-sm text-gray-400">Collected operator fees, treasury holdings, and RESURGE supply offset burns.</p>
          </div>
          <span className="text-red-400 text-xs mt-4 font-semibold uppercase tracking-wider">View Treasury →</span>
        </Link>

        <Link href="/resurgence/subgraph-status" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-indigo-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Subgraph Health</h3>
            <p className="text-sm text-gray-400">Check syncing lags and block heights of indexing subgraphs.</p>
          </div>
          <span className="text-indigo-400 text-xs mt-4 font-semibold uppercase tracking-wider">Check Health →</span>
        </Link>

        <Link href="/resurgence/contracts" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-teal-500 transition-all flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Contracts Registry</h3>
            <p className="text-sm text-gray-400">View addresses of deployed hub, spoke, and token contracts.</p>
          </div>
          <span className="text-teal-400 text-xs mt-4 font-semibold uppercase tracking-wider">View Contracts →</span>
        </Link>
      </div>

      {/* Ecosystem cross-links */}
      <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700/50 flex flex-wrap gap-4 items-center justify-center">
        <span className="text-gray-500 text-xs uppercase tracking-wider">Ecosystem:</span>
        <a href="https://chrono.baals.network/proofs" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span> ChronoNode Proof Explorer ↗
        </a>
        <a href="https://baals.network#explorer" target="_blank" rel="noopener noreferrer" className="text-sm text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400"></span> BaaLS Block Explorer ↗
        </a>
      </div>
    </div>
  );
}
