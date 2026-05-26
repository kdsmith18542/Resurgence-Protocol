'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DeployedContract {
  name: string;
  chain: string;
  address: string;
  role: string;
}

export default function ResurgenceContractsPage() {
  const [contracts, setContracts] = useState<DeployedContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setContracts([
      {
        name: "RewardDistributor",
        chain: "Arbitrum Sepolia (Hub)",
        address: "0x201624cBa366250D08bCdA95e6eF64151687A447",
        role: "Mints RESURGE rewards based on dormancy proofs verified"
      },
      {
        name: "ResurgeToken",
        chain: "Arbitrum Sepolia (Hub)",
        address: "0x99655C3B1b8F1041BC71C56X917088d3745f3F4F",
        role: "Native utility governance token for Resurgence ecosystem"
      },
      {
        name: "DeadCoinPool (L1 Spoke)",
        chain: "Base Sepolia (Spoke)",
        address: "0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f",
        role: "Custody staking pool contract for dead tokens"
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
        <span className="text-white font-medium">Contracts Registry</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Contracts Registry</h1>
        <p className="text-gray-400 text-sm">
          Active addresses of all smart contracts running on Hub and Spoke chains.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3">Contract Name</th>
              <th className="px-6 py-3">Network</th>
              <th className="px-6 py-3">Deployed Address</th>
              <th className="px-6 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c, idx) => (
              <tr key={idx} className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 font-semibold text-white">{c.name}</td>
                <td className="px-6 py-4">{c.chain}</td>
                <td className="px-6 py-4 font-mono text-xs text-blue-400">
                  <a href={`https://arbiscan.io/address/${c.address}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {c.address}
                  </a>
                </td>
                <td className="px-6 py-4 text-xs">{c.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
