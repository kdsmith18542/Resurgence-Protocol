'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CLAIM_TYPE_LABELS: Record<number, string> = {
  1: 'Transfer to Vault',
  2: 'Burn Proof',
  3: 'Lock Proof',
  4: 'Signature Dormancy',
  8: 'zkVM Dormancy',
};

const CONFIDENCE_BADGES: Record<number, { label: string; color: string }> = {
  0: { label: 'Strong — Transfer', color: 'bg-green-900/40 text-green-400 border-green-700' },
  1: { label: 'Strong — Burn', color: 'bg-red-900/40 text-red-400 border-red-700' },
  2: { label: 'Strong — zkVM', color: 'bg-cyan-900/40 text-cyan-400 border-cyan-700' },
  3: { label: 'Medium — Full Node', color: 'bg-blue-900/40 text-blue-400 border-blue-700' },
  4: { label: 'Medium — Public RPC', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-700' },
  5: { label: 'Low — Explorer', color: 'bg-orange-900/40 text-orange-400 border-orange-700' },
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'text-yellow-400',
  Verified: 'text-blue-400',
  Minted: 'text-green-400',
  Rejected: 'text-red-400',
  Quarantined: 'text-orange-400',
};

interface NonEvmClaim {
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
  sourceTxHash?: string;
}

export default function NonEvmClaimsPage() {
  const [claims, setClaims] = useState<NonEvmClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterChain, setFilterChain] = useState<string | null>(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const query = `
        {
          legacyClaims(
            where: { claimType_in: [1, 2, 3, 4, 8] }
            orderBy: submittedAt
            orderDirection: desc
            first: 100
          ) {
            id
            sourceChainId
            sourceAddressHash
            evmWallet { id }
            claimType
            confidenceTier
            rewardAmount
            status
            submittedAt
            dormancySeconds
            sourceTxHash
          }
        }
      `;
      const res = await fetch(process.env.NEXT_PUBLIC_SUBGRAPH_URL || 'http://localhost:8000/subgraphs/name/resurgence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setClaims(data.data?.legacyClaims || []);
    } catch (err) {
      console.error('Failed to fetch non-EVM claims:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = claims.filter(c => {
    if (filterType !== null && c.claimType !== filterType) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterChain && !c.sourceChainId.toLowerCase().includes(filterChain.toLowerCase())) return false;
    return true;
  });

  const uniqueChains = [...new Set(claims.map(c => c.sourceChainId))];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Non-EVM Claims
            </h1>
            <p className="text-gray-400 mt-1">Transfer, burn, lock, signature, and zkVM claims from legacy chains</p>
          </div>
          <Link
            href="/non-evm-claims"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            + Submit Claim
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-3">
          <select
            value={filterType ?? ''}
            onChange={e => setFilterType(e.target.value ? Number(e.target.value) : null)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All Types</option>
            {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={filterStatus ?? ''}
            onChange={e => setFilterStatus(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_COLORS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterChain ?? ''}
            onChange={e => setFilterChain(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">All Chains</option>
            {uniqueChains.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {(filterType !== null || filterStatus || filterChain) && (
            <button
              onClick={() => { setFilterType(null); setFilterStatus(null); setFilterChain(null); }}
              className="text-gray-400 hover:text-white text-sm px-3 py-2 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Claims Table */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading claims...</div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No non-EVM claims found</div>
        ) : (
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 uppercase text-xs tracking-wider">
                    <th className="text-left px-4 py-3">Claim ID</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Chain</th>
                    <th className="text-left px-4 py-3">Confidence</th>
                    <th className="text-left px-4 py-3">Reward</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.map(claim => {
                    const badge = CONFIDENCE_BADGES[claim.confidenceTier] || { label: 'Unknown', color: 'bg-gray-800 text-gray-400' };
                    return (
                      <tr key={claim.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/resurgence/legacy-claims/detail/?id=${claim.id}`} className="text-blue-400 hover:underline font-mono text-xs">
                            {claim.id.slice(0, 10)}...
                          </Link>
                        </td>
                        <td className="px-4 py-3">{CLAIM_TYPE_LABELS[claim.claimType] || 'Unknown'}</td>
                        <td className="px-4 py-3 font-mono text-xs">{claim.sourceChainId.slice(0, 12)}...</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono">{(Number(claim.rewardAmount) / 1e18).toFixed(0)}</td>
                        <td className={`px-4 py-3 font-semibold ${STATUS_COLORS[claim.status] || 'text-gray-400'}`}>
                          {claim.status}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(Number(claim.submittedAt) * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 text-gray-500 text-sm">
          Showing {filteredClaims.length} of {claims.length} non-EVM claims
        </div>
      </div>
    </div>
  );
}
