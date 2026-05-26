'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ClaimsLogPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
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
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Claims History</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Claim Events Log</h1>
        <p className="text-gray-400 text-sm">
          Audit trail of historic reward claim transactions from all staking pools.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3">Claimer Address</th>
              <th className="px-6 py-3">Pool</th>
              <th className="px-6 py-3">Claimed Amount</th>
              <th className="px-6 py-3">Tx Hash</th>
              <th className="px-6 py-3">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700/60 hover:bg-gray-900/20">
              <td className="px-6 py-4 font-mono text-xs text-white">0x71C56X91...73a9f</td>
              <td className="px-6 py-4">DeadCoin L1</td>
              <td className="px-6 py-4 font-semibold text-green-400">2,450 RESURGE</td>
              <td className="px-6 py-4 font-mono text-xs text-blue-400">
                <a href="https://arbiscan.io/tx/0x12b909ce63794aecb8f86b93147562dbfd7c4156b0b784020e2d95cfc0663584" target="_blank" rel="noopener noreferrer">0x12b909... ↗</a>
              </td>
              <td className="px-6 py-4 text-xs">12s ago</td>
            </tr>
            <tr className="border-b border-gray-700/60 hover:bg-gray-900/20">
              <td className="px-6 py-4 font-mono text-xs text-white">0x99655C3B...3F4F</td>
              <td className="px-6 py-4">Ethereum L1 Spoke</td>
              <td className="px-6 py-4 font-semibold text-green-400">1,820 RESURGE</td>
              <td className="px-6 py-4 font-mono text-xs text-blue-400">
                <a href="https://arbiscan.io/tx/0xfc0663584d610bad57026bbabe97c6a477d9ebee9b52ea26c2f9a47b988d3112" target="_blank" rel="noopener noreferrer">0xfc0663... ↗</a>
              </td>
              <td className="px-6 py-4 text-xs">5m ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
