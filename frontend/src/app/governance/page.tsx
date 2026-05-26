'use client';
import { useAccount, useBlockNumber } from 'wagmi';
import { useState, useEffect, useMemo } from 'react';
import { ProposalInfo, ProposalState } from '@/types';
import ProposalCard from '@/components/ProposalCard';
import CreateProposalForm from '@/components/CreateProposalForm';
import StatCard from '@/components/StatCard';
import { LoadingSpinner, EmptyState } from '@/components/StateComponents';
import { useGovernance } from '@/hooks/useGovernance';
import { formatTokenAmount } from '@/lib/utils';
import { fetchProposals, type SubgraphProposal } from '@/lib/graphql';

function mapSubgraphProposal(p: SubgraphProposal, currentBlock?: bigint): ProposalInfo {
  let state: ProposalState;
  if (p.executed) {
    state = ProposalState.Executed;
  } else if (p.canceled) {
    state = ProposalState.Canceled;
  } else if (currentBlock !== undefined) {
    const start = BigInt(p.startBlock);
    const end = BigInt(p.endBlock);
    if (currentBlock < start) {
      state = ProposalState.Pending;
    } else if (currentBlock <= end) {
      state = ProposalState.Active;
    } else {
      state = ProposalState.Defeated;
    }
  } else {
    state = ProposalState.Active;
  }

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
  const { votingDelay, votingPeriod } = useGovernance();
  const [rawProposals, setRawProposals] = useState<SubgraphProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: currentBlock } = useBlockNumber({ watch: false, chainId: 421614 });

  const proposals = useMemo(
    () => rawProposals.map(p => mapSubgraphProposal(p, currentBlock)),
    [rawProposals, currentBlock],
  );

  useEffect(() => {
    (async () => {
      const data = await fetchProposals();
      if (data) setRawProposals(data);
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
      <div>
        <h1 className="text-3xl font-bold mb-6">Governance</h1>
        <LoadingSpinner label="Loading proposals..." />
      </div>
    );
  }

  const activeProposals = proposals.filter(p => p.state === ProposalState.Active);
  const pendingProposals = proposals.filter(p => p.state === ProposalState.Pending);
  const executableProposals = proposals.filter(p => p.state === ProposalState.Succeeded || p.state === ProposalState.Queued);
  const historicalProposals = proposals.filter(p => [ProposalState.Executed, ProposalState.Defeated, ProposalState.Canceled].includes(p.state));
  const passedProposals = proposals.filter(p => p.state === ProposalState.Executed);
  const totalVotes = proposals.reduce((sum, p) => sum + p.forVotes + p.againstVotes + p.abstainVotes, 0n);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Governance</h1>
        <button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Create Proposal
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Voting Delay" value={votingDelay?.toString() || '-'} sub="blocks" />
        <StatCard label="Voting Period" value={votingPeriod?.toString() || '-'} sub="blocks" />
        <StatCard label="Active" value={activeProposals.length.toString()} sub="proposals" />
        <StatCard label="Passed" value={passedProposals.length.toString()} sub="proposals" />
        <StatCard label="Total Votes" value={formatTokenAmount(totalVotes)} sub="cast" />
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="No proposals yet." description="Proposals will appear here once created and indexed by the subgraph." />
      ) : (
        <>
          {activeProposals.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Active Proposals
                <span className="text-sm font-normal text-green-400 bg-green-900/50 px-2 py-0.5 rounded-full">{activeProposals.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}

          {pendingProposals.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Pending
                <span className="text-sm font-normal text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded-full">{pendingProposals.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}

          {executableProposals.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                Ready to Execute
                <span className="text-sm font-normal text-blue-400 bg-blue-900/50 px-2 py-0.5 rounded-full">{executableProposals.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {executableProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-4">History</h2>
            {historicalProposals.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historicalProposals.map(p => <ProposalCard key={p.id} proposal={p} />)}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No historical proposals.</p>
            )}
          </section>
        </>
      )}

      <CreateProposalForm isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
