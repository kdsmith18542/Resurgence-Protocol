'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Proposal {
  id: string;
  title: string;
  proposer: string;
  status: 'Active' | 'Passed' | 'Executed' | 'Defeated';
  forVotes: number;
  againstVotes: number;
  endTime: string;
}

export default function GovernanceProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProposals([
      {
        id: "1",
        title: "RIP-1: Add Dogecoin watched address threshold to Hub distributor",
        proposer: "0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f",
        status: "Executed",
        forVotes: 1248000,
        againstVotes: 15000,
        endTime: "2026-05-20"
      },
      {
        id: "2",
        title: "RIP-2: Increase reward emission multiplier to 1.5x",
        proposer: "0x201624cBa366250D08bCdA95e6eF64151687A447",
        status: "Active",
        forVotes: 954000,
        againstVotes: 180000,
        endTime: "2026-05-29"
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
        <span className="text-white font-medium">Governance</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Governance Proposals</h1>
        <p className="text-gray-400 text-sm">
          Browse and inspect community-driven proposals and parameters modifications.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {proposals.map((p) => (
          <div key={p.id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-500 transition-colors">
            <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
              <Link href={`/resurgence/governance/${p.id}`} className="text-lg font-semibold text-white hover:text-blue-400">
                {p.title}
              </Link>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${p.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                {p.status}
              </span>
            </div>
            
            <p className="text-xs text-gray-500 font-mono mb-4">Proposer: {p.proposer}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-gray-400 border-t border-gray-700/60 pt-4">
              <div>
                <span>For Votes</span>
                <p className="text-white font-semibold font-mono mt-1">{p.forVotes.toLocaleString()}</p>
              </div>
              <div>
                <span>Against Votes</span>
                <p className="text-white font-semibold font-mono mt-1">{p.againstVotes.toLocaleString()}</p>
              </div>
              <div>
                <span>End Date</span>
                <p className="text-white font-semibold mt-1">{p.endTime}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
