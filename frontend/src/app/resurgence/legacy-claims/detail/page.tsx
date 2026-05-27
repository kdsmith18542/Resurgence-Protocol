'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

const CONFIDENCE_BADGES: Record<number, { label: string; color: string; description: string }> = {
  1: { label: 'Tier A — Burn Proof', color: 'bg-red-900/40 text-red-400 border-red-700', description: 'Strongest ownership proof. Irreversible sacrifice.' },
  2: { label: 'Tier B — zkVM Verified', color: 'bg-cyan-900/40 text-cyan-400 border-cyan-700', description: 'Cryptographic dormancy proof via SP1 Groth16.' },
  3: { label: 'Tier C — Full/Light Node', color: 'bg-blue-900/40 text-blue-400 border-blue-700', description: 'Strong ownership and chain evidence.' },
  4: { label: 'Tier D — Public RPC', color: 'bg-yellow-900/40 text-yellow-400 border-yellow-700', description: 'Medium trust via public RPC endpoints.' },
  5: { label: 'Tier E — Explorer', color: 'bg-orange-900/40 text-orange-400 border-orange-700', description: 'Lower trust via official explorer API.' },
  6: { label: 'Tier F — 3rd Party', color: 'bg-gray-800 text-gray-400 border-gray-600', description: 'Third-party explorer evidence.' },
  7: { label: 'Manual Review', color: 'bg-purple-900/40 text-purple-400 border-purple-700', description: 'Requires manual review. No automatic mint.' },
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'text-yellow-400',
  Verified: 'text-blue-400',
  Minted: 'text-green-400',
  Rejected: 'text-red-400',
  Quarantined: 'text-orange-400',
  Expired: 'text-gray-400',
};

const TIMELINE_STEPS = [
  { key: 'submitted', label: 'Address Submitted', icon: '📤' },
  { key: 'ownership', label: 'Ownership Verified', icon: '🔑' },
  { key: 'evidence', label: 'Evidence Scanned', icon: '🔍' },
  { key: 'dormancy', label: 'Dormancy Verified', icon: '⏳' },
  { key: 'proof', label: 'Proof Generated', icon: '📜' },
  { key: 'attestation', label: 'BaaLS Attestation Stored', icon: '🏛️' },
  { key: 'submission', label: 'EVM Submission Sent', icon: '🚀' },
  { key: 'minted', label: 'RESURGE Minted', icon: '💰' },
];

function LegacyClaimDetailContent() {
  const searchParams = useSearchParams();
  const claimId = searchParams.get('id') || '';
  const [loading, setLoading] = useState(true);
  const [timelineStep, setTimelineStep] = useState(6);

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

  const badge = CONFIDENCE_BADGES[3] || { label: 'Unknown', color: 'bg-gray-800 text-gray-400', description: '' };
  const status = 'Minted';

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <Link href="/resurgence/legacy-claims" className="hover:text-white transition-colors">Legacy Claims</Link>
        <span>/</span>
        <span className="text-white font-medium font-mono">{claimId?.slice(0, 12)}...</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Claim Details</h1>
        <p className="text-gray-400 text-sm font-mono">{claimId}</p>
      </div>

      {/* Claim Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Source Chain</div>
          <div className="text-lg font-semibold text-white capitalize">Bitcoin</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Claim Type</div>
          <div className="text-lg font-semibold text-white">{CLAIM_TYPE_LABELS[2]}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Confidence Tier</div>
          <span className={`inline-block px-3 py-1.5 rounded-lg text-sm border ${badge.color}`}>
            {badge.label}
          </span>
          <div className="text-xs text-gray-500 mt-2">{badge.description}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Status</div>
          <div className={`text-lg font-semibold ${STATUS_COLORS[status]}`}>{status}</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Reward Amount</div>
          <div className="text-lg font-semibold text-green-400">5,000 RESURGE</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Dormancy Period</div>
          <div className="text-lg font-semibold text-white">5+ years</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">EVM Wallet</div>
          <div className="text-sm font-mono text-white">0x71C56X91...73a9f</div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="text-xs text-gray-400 mb-1">Source Address Hash</div>
          <div className="text-sm font-mono text-white">0xabc123...def456</div>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-6">Claim Lifecycle</h2>
        <div className="space-y-4">
          {TIMELINE_STEPS.map((step, index) => {
            const isComplete = index < timelineStep;
            const isCurrent = index === timelineStep;
            return (
              <div key={step.key} className="flex items-start gap-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                  isComplete
                    ? 'bg-green-900/60 border border-green-700 text-green-300'
                    : isCurrent
                    ? 'bg-blue-600 border border-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                    : 'bg-gray-800 border border-gray-700 text-gray-500'
                }`}>
                  {isComplete ? '✓' : step.icon}
                </div>
                <div className="pt-1">
                  <div className={`text-sm font-medium ${
                    isComplete ? 'text-green-400' : isCurrent ? 'text-white' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div className="text-xs text-blue-400 mt-1">In progress...</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-4">
        <Link
          href="/resurgence/legacy-claims"
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-5 py-3 rounded-xl font-medium border border-gray-700 transition-colors"
        >
          ← Back to Legacy Claims
        </Link>
        <a
          href={`https://arbiscan.io/tx/0x123`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-3 rounded-xl font-medium transition-colors"
        >
          View on Arbiscan ↗
        </a>
      </div>
    </div>
  );
}

export default function LegacyClaimDetailPage() {
  return (
    <Suspense fallback={
      <div className="animate-pulse space-y-6 py-10 max-w-4xl mx-auto text-left">
        <div className="h-10 bg-gray-800 rounded-xl w-64"></div>
        <div className="h-48 bg-gray-800 rounded-xl"></div>
      </div>
    }>
      <LegacyClaimDetailContent />
    </Suspense>
  );
}
