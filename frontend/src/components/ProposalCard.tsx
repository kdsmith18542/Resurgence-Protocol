'use client';
import { ProposalInfo, ProposalState } from '@/types';
import { formatTokenAmount, proposalStateLabel, shortenProposalId } from '@/lib/utils';
import Link from 'next/link';

interface ProposalCardProps {
  proposal: ProposalInfo;
  onVote?: (support: 0 | 1 | 2) => void;
  voting?: boolean;
}

const STATE_COLORS: Record<number, string> = {
  [ProposalState.Pending]: 'text-yellow-400',
  [ProposalState.Active]: 'text-green-400',
  [ProposalState.Canceled]: 'text-red-400',
  [ProposalState.Defeated]: 'text-red-400',
  [ProposalState.Succeeded]: 'text-green-400',
  [ProposalState.Queued]: 'text-blue-400',
  [ProposalState.Expired]: 'text-gray-400',
  [ProposalState.Executed]: 'text-purple-400',
};

export default function ProposalCard({ proposal, onVote, voting }: ProposalCardProps) {
  const stateColor = STATE_COLORS[proposal.state] || 'text-gray-400';
  const propId = shortenProposalId(proposal.id);
  const totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
  const forPct = totalVotes > 0n ? Number(proposal.forVotes * 100n / totalVotes) : 0;

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <Link href={`/governance/${proposal.id}`} className="text-sm font-mono text-blue-400 hover:text-blue-300">
          #{propId}
        </Link>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-gray-700 ${stateColor}`}>
          {proposalStateLabel(proposal.state)}
        </span>
      </div>

      <p className="text-white text-sm mb-3 line-clamp-2">{proposal.description}</p>

      <div className="h-2 bg-gray-700 rounded-full mb-3 overflow-hidden">
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${forPct}%` }} />
      </div>

      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>For: {formatTokenAmount(proposal.forVotes)}</span>
        <span>Against: {formatTokenAmount(proposal.againstVotes)}</span>
      </div>

      {proposal.state === ProposalState.Active && onVote && (
        <div className="flex gap-2">
          <button onClick={() => onVote(1)} disabled={voting} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors">
            For
          </button>
          <button onClick={() => onVote(0)} disabled={voting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors">
            Against
          </button>
          <button onClick={() => onVote(2)} disabled={voting} className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-600 text-white py-1.5 rounded-lg text-xs font-medium transition-colors">
            Abstain
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">Proposer: {proposal.proposer?.slice(0, 10)}...</p>
    </div>
  );
}
