'use client';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';
import { ProposalInfo, ProposalState } from '@/types';
import ProposalCard from '@/components/ProposalCard';
import CreateProposalForm from '@/components/CreateProposalForm';
import StatCard from '@/components/StatCard';
import { useGovernance } from '@/hooks/useGovernance';
import { fetchProposals, SUBGRAPH_URL, type SubgraphProposal } from '@/lib/graphql';

function mapSubgraphProposal(p: SubgraphProposal): ProposalInfo {
  let state = ProposalState.Pending;
  if (p.executed) state = ProposalState.Executed;
  else if (p.canceled) state = ProposalState.Canceled;
  else state = ProposalState.Active;

  return {
    id: p.id,
    description: p.description,
    state,
    forVotes: BigInt(p.forVotes),
    againstVotes: BigInt(p.againstVotes),
    abstainVotes: BigInt(p.abstainVotes),
    startBlock: BigInt(p.startBlock),
    endBlock: BigInt(p.endBlock),
    proposer: p.proposer,
  };
}

export default function GovernancePage() {
  const { isConnected } = useAccount();
  const [showCreate, setShowCreate] = useState(false);
  const { votingDelay, votingPeriod, proposalThreshold } = useGovernance();
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUBGRAPH_URL) { setLoading(false); return; }
    (async () => {
      const data = await fetchProposals();
      if (data) setProposals(data.map(mapSubgraphProposal));
      setLoading(false);
    })();
  }, []);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Governance</h1>
        <p className="text-gray-400">Connect your wallet to view and vote on proposals.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Governance</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const activeProposals = proposals.filter(p => p.state === ProposalState.Active);
  const pendingProposals = proposals.filter(p => p.state === ProposalState.Pending);
  const executableProposals = proposals.filter(p => p.state === ProposalState.Succeeded || p.state === ProposalState.Queued);
  const historicalProposals = proposals.filter(p => [ProposalState.Executed, ProposalState.Defeated, ProposalState.Canceled].includes(p.state));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Governance</h1>
        <button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Create Proposal
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Voting Delay" value={votingDelay?.toString() || '-'} sub="blocks" />
        <StatCard label="Voting Period" value={votingPeriod?.toString() || '-'} sub="blocks" />
        <StatCard label="Active Proposals" value={activeProposals.length.toString()} />
      </div>

      {activeProposals.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Active Proposals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
          </div>
        </section>
      )}

      {pendingProposals.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Pending Proposals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
          </div>
        </section>
      )}

      {executableProposals.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Ready to Execute</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {executableProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
          </div>
        </section>
      )}

      {proposals.length === 0 && (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400">No proposals yet.</p>
          <p className="text-gray-500 text-sm mt-2">Proposals will appear here once created and indexed by the subgraph.</p>
        </div>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">History</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {historicalProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
        </div>
      </section>

      <CreateProposalForm isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
