'use client';
import { useParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { ProposalState } from '@/types';
import { formatTokenAmount, proposalStateLabel } from '@/lib/utils';
import { fetchProposal, SUBGRAPH_URL, type SubgraphProposal } from '@/lib/graphql';
import { useCastVote } from '@/hooks/useStakingActions';
import { getContractAddress } from '@/lib/contracts';
import { useChainId } from 'wagmi';

export default function ProposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [proposal, setProposal] = useState<SubgraphProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const govAddress = getContractAddress(chainId, 'ResurgenceGovernance');
  const { castVote } = useCastVote(govAddress as `0x${string}`);

  useEffect(() => {
    if (!SUBGRAPH_URL) { setLoading(false); return; }
    (async () => {
      const data = await fetchProposal(id);
      setProposal(data);
      setLoading(false);
    })();
  }, [id]);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Proposal Details</h1>
        <p className="text-gray-400">Connect your wallet to view proposal details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-3xl">
        <div className="h-8 bg-gray-800 rounded-xl w-48"></div>
        <div className="h-16 bg-gray-800 rounded-xl"></div>
        <div className="h-32 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Proposal Not Found</h1>
        <p className="text-gray-400">The proposal with ID {id?.slice(0, 18)}... could not be found.</p>
      </div>
    );
  }

  const totalVotes = BigInt(proposal.forVotes) + BigInt(proposal.againstVotes) + BigInt(proposal.abstainVotes);
  const forPct = totalVotes > 0n ? Number(BigInt(proposal.forVotes) * 100n / totalVotes) : 0;

  let state = ProposalState.Pending;
  if (proposal.executed) state = ProposalState.Executed;
  else if (proposal.canceled) state = ProposalState.Canceled;
  else state = ProposalState.Active;

  const handleVote = async (support: 0 | 1 | 2) => {
    try {
      setVoting(true);
      await castVote(BigInt(proposal.proposalId), support);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${state === ProposalState.Active ? 'bg-green-900 text-green-400' : state === ProposalState.Executed ? 'bg-blue-900 text-blue-400' : 'bg-gray-700 text-gray-300'}`}>
          {proposalStateLabel(state)}
        </span>
        <span className="text-sm text-gray-400 font-mono">ID: {id?.slice(0, 18)}...</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">{proposal.description}</h1>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 mb-6">
        <h2 className="text-lg font-semibold mb-4">Votes</h2>
        <div className="h-4 bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${forPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-400">{formatTokenAmount(BigInt(proposal.forVotes))}</p>
            <p className="text-sm text-gray-400">For</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{formatTokenAmount(BigInt(proposal.againstVotes))}</p>
            <p className="text-sm text-gray-400">Against</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-400">{formatTokenAmount(BigInt(proposal.abstainVotes))}</p>
            <p className="text-sm text-gray-400">Abstain</p>
          </div>
        </div>

        {state === ProposalState.Active && (
          <div className="flex gap-3 mt-6">
            <button onClick={() => handleVote(1)} disabled={voting} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded-xl font-medium transition-colors">
              Vote For
            </button>
            <button onClick={() => handleVote(0)} disabled={voting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-xl font-medium transition-colors">
              Vote Against
            </button>
            <button onClick={() => handleVote(2)} disabled={voting} className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white py-2 rounded-xl font-medium transition-colors">
              Abstain
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-3">Details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-400">
            <span>Proposer</span>
            <span className="text-white font-mono">{proposal.proposer}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Start Block</span>
            <span className="text-white">{proposal.startBlock}</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>End Block</span>
            <span className="text-white">{proposal.endBlock}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
