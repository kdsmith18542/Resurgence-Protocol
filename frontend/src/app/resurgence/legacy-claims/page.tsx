'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CLAIM_TYPE_LABELS: Record<number, string> = {
  0: 'ERC-20 Stake',
  1: 'Transfer to Vault',
  2: 'Burn Proof',
  3: 'Lock Proof',
  4: 'Signature Dormancy',
  5: 'Public RPC Evidence',
  6: 'Explorer Evidence',
  7: 'Multi-Source Evidence',
  8: 'zkVM Dormancy',
  9: 'Manual Review',
};

const CONFIDENCE_BADGES: Record<number, { label: string; color: string }> = {
  1: { label: 'Strong — Burn', color: 'bg-red-900/40 text-red-400 border-red-700' },
  2: { label: 'Strong — zkVM', color: 'bg-cyan-900/40 text-cyan-400 border-cyan-700' },
  3: { label: 'Medium — Full Node', color: 'bg-blue-900/40 text-blue-400 border-blue-700' },
  4: { label: 'Medium — Public RPC', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-700' },
  5: { label: 'Low — Explorer', color: 'bg-orange-900/40 text-orange-400 border-orange-700' },
  6: { label: 'Low — 3rd Party', color: 'bg-gray-800 text-gray-400 border-gray-600' },
  7: { label: 'Manual', color: 'bg-purple-900/40 text-purple-400 border-purple-700' },
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'text-yellow-400',
  Verified: 'text-blue-400',
  Minted: 'text-green-400',
  Rejected: 'text-red-400',
  Quarantined: 'text-orange-400',
  Expired: 'text-gray-400',
};

interface LegacyClaim {
  id: string;
  sourceChainId: string;
  sourceAddressHash: string;
  evmWallet: string;
  claimType: number;
  confidenceTier: number;
  rewardAmount: string;
  status: string;
  submittedAt: string;
  dormancySeconds: string;
}

export default function LegacyClaimsPage() {
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<LegacyClaim[]>([]);
  const [filterChain, setFilterChain] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const mockClaims: LegacyClaim[] = [
      {
        id: '0x1a2b3c4d',
        sourceChainId: 'bitcoin',
        sourceAddressHash: '0xabc123...def456',
        evmWallet: '0x71C56X91...73a9f',
        claimType: 2,
        confidenceTier: 1,
        rewardAmount: '5,000',
        status: 'Minted',
        submittedAt: '2m ago',
        dormancySeconds: '157,680,000',
      },
      {
        id: '0x5e6f7g8h',
        sourceChainId: 'dogecoin',
        sourceAddressHash: '0x789abc...012def',
        evmWallet: '0x99655C3B...3F4F',
        claimType: 4,
        confidenceTier: 3,
        rewardAmount: '2,500',
        status: 'Pending',
        submittedAt: '15m ago',
        dormancySeconds: '94,608,000',
      },
      {
        id: '0x9i0j1k2l',
        sourceChainId: 'bitcoin',
        sourceAddressHash: '0x345ghi...678jkl',
        evmWallet: '0xabc12345...def67890',
        claimType: 1,
        confidenceTier: 2,
        rewardAmount: '3,200',
        status: 'Quarantined',
        submittedAt: '1h ago',
        dormancySeconds: '252,288,000',
      },
      {
        id: '0x3m4n5o6p',
        sourceChainId: 'litecoin',
        sourceAddressHash: '0x901mno...234pqr',
        evmWallet: '0x1234abcd...5678efgh',
        claimType: 8,
        confidenceTier: 2,
        rewardAmount: '8,100',
        status: 'Minted',
        submittedAt: '3h ago',
        dormancySeconds: '315,360,000',
      },
    ];
    setClaims(mockClaims);
    setLoading(false);
  }, []);

  const filteredClaims = claims.filter((claim) => {
    if (filterChain !== 'all' && claim.sourceChainId !== filterChain) return false;
    if (filterStatus !== 'all' && claim.status !== filterStatus) return false;
    if (filterType !== 'all' && claim.claimType !== parseInt(filterType)) return false;
    return true;
  });

  const chains = ['all', ...Array.from(new Set(claims.map((c) => c.sourceChainId)))];
  const statuses = ['all', ...Array.from(new Set(claims.map((c) => c.status)))];
  const types = ['all', ...Array.from(new Set(claims.map((c) => c.claimType.toString())))];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10 max-w-6xl mx-auto text-left">
        <div className="h-10 bg-gray-800 rounded-xl w-64"></div>
        <div className="h-48 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left max-w-6xl mx-auto py-6">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Legacy Claims</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Legacy Asset Claims</h1>
        <p className="text-gray-400 text-sm">
          Track all legacy asset claims across supported chains. Includes transfer-backed, burn, signature, and zkVM proofs.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Chain</label>
          <select
            value={filterChain}
            onChange={(e) => setFilterChain(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {chains.map((c) => (
              <option key={c} value={c}>{c === 'all' ? 'All Chains' : c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Claim Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {types.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All Types' : CLAIM_TYPE_LABELS[parseInt(t)] || t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400">Total Claims</div>
          <div className="text-2xl font-bold text-white">{claims.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400">Minted</div>
          <div className="text-2xl font-bold text-green-400">{claims.filter((c) => c.status === 'Minted').length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400">Pending</div>
          <div className="text-2xl font-bold text-yellow-400">{claims.filter((c) => c.status === 'Pending').length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400">Quarantined</div>
          <div className="text-2xl font-bold text-orange-400">{claims.filter((c) => c.status === 'Quarantined').length}</div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3">Claim ID</th>
              <th className="px-6 py-3">Chain</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Confidence</th>
              <th className="px-6 py-3">Reward</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Submitted</th>
              <th className="px-6 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredClaims.map((claim) => {
              const badge = CONFIDENCE_BADGES[claim.confidenceTier] || { label: 'Unknown', color: 'bg-gray-800 text-gray-400' };
              return (
                <tr key={claim.id} className="border-b border-gray-700/60 hover:bg-gray-900/20">
                  <td className="px-6 py-4 font-mono text-xs text-white">{claim.id.slice(0, 10)}...</td>
                  <td className="px-6 py-4 capitalize">{claim.sourceChainId}</td>
                  <td className="px-6 py-4 text-xs">{CLAIM_TYPE_LABELS[claim.claimType] || 'Unknown'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-1 rounded-md text-xs border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-green-400">{claim.rewardAmount} RESURGE</td>
                  <td className={`px-6 py-4 font-medium ${STATUS_COLORS[claim.status] || 'text-gray-400'}`}>
                    {claim.status}
                  </td>
                  <td className="px-6 py-4 text-xs">{claim.submittedAt}</td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/resurgence/legacy-claims/${claim.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filteredClaims.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  No claims match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center">
        <Link href="/non-evm-claims" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          → Submit a new legacy claim
        </Link>
        <Link href="/resurgence/claims" className="text-sm text-gray-400 hover:text-white transition-colors">
          View ERC-20 claim history
        </Link>
      </div>
    </div>
  );
}
