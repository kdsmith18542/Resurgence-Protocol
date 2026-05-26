'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Voter {
  voter: string;
  support: boolean;
  weight: number;
}

export function ClientPage() {
  const params = useParams();
  const proposalId = params?.proposalId as string || '1';

  const [loading, setLoading] = useState(true);
  const [proposer, setProposer] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [forVotes, setForVotes] = useState(0);
  const [againstVotes, setAgainstVotes] = useState(0);
  const [status, setStatus] = useState<'Active' | 'Succeeded' | 'Executed'>('Active');
  const [voters, setVoters] = useState<Voter[]>([]);

  // Deterministic mock generation based on proposalId
  const idNum = parseInt(proposalId, 10) || 1;

  useEffect(() => {
    setTimeout(() => {
      setProposer(`0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f`);
      setTitle(idNum === 4 ? "Adjust Reward Emission Rate Per Second" : idNum === 5 ? "Enable Direct Dormancy Proof Submission Role" : `Proposal #${idNum}: Governance Parameter Optimization`);
      setDescription("This proposal updates the staking parameters across all deployed pools to prioritize long-term stakers, while configuring role permissions for the Arbitrum hub oracle integrations.");
      
      const deterministicFor = 1500000 + (idNum * 243500) % 800000;
      const deterministicAgainst = 450000 + (idNum * 123800) % 300000;
      
      setForVotes(deterministicFor);
      setAgainstVotes(deterministicAgainst);
      setStatus(idNum < 4 ? 'Executed' : idNum === 4 ? 'Succeeded' : 'Active');

      setVoters([
        { voter: "0x99655C3B1b8F1041BC71C56X917088d3745f3F4F", support: true, weight: deterministicFor * 0.4 },
        { voter: "0x6b7280f59e0b8b5cf63b82f671c56x917088d374", support: true, weight: deterministicFor * 0.6 },
        { voter: "0x8b5cf63b82f671c56x917088d3745f3F4F19C8b8", support: false, weight: deterministicAgainst }
      ]);
      setLoading(false);
    }, 600);
  }, [proposalId, idNum]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10 max-w-4xl mx-auto text-left">
        <div className="h-10 bg-gray-800 rounded-xl w-80"></div>
        <div className="h-32 bg-gray-800 rounded-xl"></div>
        <div className="h-64 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  const totalVotes = forVotes + againstVotes;
  const forPercent = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 0;
  const againstPercent = totalVotes > 0 ? (againstVotes / totalVotes) * 100 : 0;

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence/pools" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Proposal #{proposalId}</span>
      </div>

      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Proposal #{proposalId}</span>
          <h1 className="text-3xl font-bold text-white mt-1">{title}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Proposed by: <Link href={`/resurgence/users/${proposer}`} className="font-mono text-blue-400 hover:underline">{proposer}</Link>
          </p>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${status === 'Executed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : status === 'Succeeded' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
          {status}
        </span>
      </div>

      {/* Description */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Proposal Description</h2>
        <p className="text-gray-300 text-sm leading-relaxed">{description}</p>
      </div>

      {/* Voting Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Voting Power Stats</h2>
          <div className="space-y-4">
            {/* For Progress */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-white mb-1.5">
                <span className="text-green-400">For</span>
                <span>{forVotes.toLocaleString()} votes ({forPercent.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-3.5 border border-gray-700/50">
                <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${forPercent}%` }} />
              </div>
            </div>

            {/* Against Progress */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-white mb-1.5">
                <span className="text-red-400">Against</span>
                <span>{againstVotes.toLocaleString()} votes ({againstPercent.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-3.5 border border-gray-700/50">
                <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${againstPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Execution details */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-3">Execution Calldata</h2>
          <p className="text-gray-400 text-xs leading-relaxed mb-4">
            This executable transaction is queued inside the Timelock controller and runs automatically after approval quorum.
          </p>
          <div className="bg-gray-950 p-4 rounded-xl border border-gray-700 font-mono text-xs text-green-400 break-all space-y-2">
            <div><span className="text-gray-500">target:</span> 0xD41086DA2acCcD4EFfd47FA69ED3E6f71d9da5C6</div>
            <div><span className="text-gray-500">value:</span> 0</div>
            <div><span className="text-gray-500">calldata:</span> 0xa9059cbb00000000000000000000000071c56x917088d3745f3f4f19c8b8f1041bc73a9f00000000000000000000000000000000000000000000000000000000000003e8</div>
          </div>
        </div>
      </div>

      {/* Voters List */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-white">Recent Votes Cast</h2>
        <div className="space-y-3">
          {voters.map((v) => (
            <div key={v.voter} className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/40 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs text-gray-500">Voter Account</span>
                <p className="text-sm font-semibold text-white font-mono">{v.voter}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.support ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {v.support ? 'FOR' : 'AGAINST'}
                </span>
                <p className="text-xs text-gray-400 mt-1">{v.weight.toLocaleString()} votes</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
