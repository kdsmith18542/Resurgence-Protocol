'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NonEvmAccount {
  network: string;
  sourceAddress: string;
  evmAddress: string;
  dormancyProof: string;
  status: 'Dormant' | 'Active';
}

export default function NonEvmPage() {
  const [accounts, setAccounts] = useState<NonEvmAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setAccounts([
      {
        network: "bitcoin",
        sourceAddress: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
        evmAddress: "0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f",
        dormancyProof: "0x8bcda95e6ef64151687a447cba366250d3f4b1041bc73a9f06b6d410b981f59e0",
        status: "Dormant"
      },
      {
        network: "dogecoin",
        sourceAddress: "D7jaS7wEPzE65n7948ia84eaXo99655C3B",
        evmAddress: "0x99655C3B1b8F1041BC71C56X917088d3745f3F4F",
        dormancyProof: "0x9f81041bc73a9f06b6d410b981f59e0b8b5cf63b82f671c56a99655C3B1b8F10",
        status: "Dormant"
      }
    ]);
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
        <Link href="/resurgence/oracle" className="hover:text-white transition-colors">Oracle</Link>
        <span>/</span>
        <span className="text-white font-medium">Non-EVM Registry</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Non-EVM watched wallets</h1>
        <p className="text-gray-400 text-sm">
          Browse verified mapping of non-EVM watched source chains to active EVM reward recipient addresses.
        </p>
        <a href="https://chrono.baals.network/proofs/addresses" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs text-blue-400 hover:text-blue-300 font-medium">
          View addresses in ChronoNode Proof Explorer ↗
        </a>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3">Network</th>
              <th className="px-6 py-3">Source Address</th>
              <th className="px-6 py-3">Registered EVM Address</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Dormancy Proof</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, idx) => (
              <tr key={idx} className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 capitalize font-semibold text-white">{a.network}</td>
                <td className="px-6 py-4 font-mono text-xs text-white">{a.sourceAddress}</td>
                <td className="px-6 py-4 font-mono text-xs text-white">{a.evmAddress}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${a.status === 'Dormant' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-blue-400">
                  <Link href={`/resurgence/oracle/proofs/${a.dormancyProof}`} className="hover:underline">
                    {a.dormancyProof.slice(0, 10)}...
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
