'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TreasuryPage() {
  const [loading, setLoading] = useState(true);
  const [operatorFees, setOperatorFees] = useState(0);
  const [treasuryFees, setTreasuryFees] = useState(0);
  const [burnedTokens, setBurnedTokens] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOperatorFees(142050);
      setTreasuryFees(95420);
      setBurnedTokens(1248000);
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
        <Link href="/resurgence/pools" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Treasury & Fees</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Protocol Treasury</h1>
        <p className="text-gray-400 text-sm">
          Track collected staking pool fees and token burns across the Resurgence Protocol.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Burned Tokens</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{burnedTokens.toLocaleString()} RESURGE</p>
          <span className="text-[10px] text-gray-500">Deflationary Supply Offset</span>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Accumulated Operator Fees</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{operatorFees.toLocaleString()} RESURGE</p>
          <span className="text-[10px] text-gray-500">Distributed to Pool Node Hosts</span>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Protocol Treasury Balance</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{treasuryFees.toLocaleString()} RESURGE</p>
          <span className="text-[10px] text-gray-500">Reserved for DAO Governance Allocation</span>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">Historic Treasury Events</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3">Event Type</th>
                <th className="px-6 py-3">Amount</th>
                <th className="px-6 py-3">Block Height</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 font-semibold text-red-400">🔥 Token Burn</td>
                <td className="px-6 py-4 font-mono text-white">500,000 RESURGE</td>
                <td className="px-6 py-4 font-mono text-white">#14,102</td>
                <td className="px-6 py-4">2026-05-24 10:14</td>
              </tr>
              <tr className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 font-semibold text-blue-400">💼 Operator Fee Allocation</td>
                <td className="px-6 py-4 font-mono text-white">45,000 RESURGE</td>
                <td className="px-6 py-4 font-mono text-white">#14,082</td>
                <td className="px-6 py-4">2026-05-23 18:42</td>
              </tr>
              <tr className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 font-semibold text-purple-400">🏦 DAO Treasury Deposit</td>
                <td className="px-6 py-4 font-mono text-white">30,000 RESURGE</td>
                <td className="px-6 py-4 font-mono text-white">#14,020</td>
                <td className="px-6 py-4">2026-05-23 09:15</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
