'use client';
import { useReadContract, useReadContracts } from 'wagmi';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';
import { useChainId } from 'wagmi';

export function useGovernance() {
  const chainId = useChainId();
  const govAddress = getContractAddress(chainId, 'ResurgenceGovernance') as `0x${string}`;

  const contracts = [
    { abi: ABIS.ResurgenceGovernance, address: govAddress, functionName: 'votingDelay' },
    { abi: ABIS.ResurgenceGovernance, address: govAddress, functionName: 'votingPeriod' },
    { abi: ABIS.ResurgenceGovernance, address: govAddress, functionName: 'proposalThreshold' },
  ] as const;

  const { data } = useReadContracts({ contracts, query: { enabled: !!govAddress } });

  return {
    govAddress,
    votingDelay: data?.[0]?.result,
    votingPeriod: data?.[1]?.result,
    proposalThreshold: data?.[2]?.result,
  };
}

export function useProposal(proposalId: bigint) {
  const chainId = useChainId();
  const govAddress = getContractAddress(chainId, 'ResurgenceGovernance') as `0x${string}`;

  const { data: state } = useReadContract({
    abi: ABIS.ResurgenceGovernance,
    address: govAddress,
    functionName: 'state',
    args: [proposalId],
    query: { enabled: !!govAddress },
  });

  const { data: votes } = useReadContract({
    abi: ABIS.ResurgenceGovernance,
    address: govAddress,
    functionName: 'proposalVotes',
    args: [proposalId],
    query: { enabled: !!govAddress },
  });

  const { data: proposer } = useReadContract({
    abi: ABIS.ResurgenceGovernance,
    address: govAddress,
    functionName: 'proposalProposer',
    args: [proposalId],
    query: { enabled: !!govAddress },
  });

  const { data: snapshot } = useReadContract({
    abi: ABIS.ResurgenceGovernance,
    address: govAddress,
    functionName: 'proposalSnapshot',
    args: [proposalId],
    query: { enabled: !!govAddress },
  });

  const { data: deadline } = useReadContract({
    abi: ABIS.ResurgenceGovernance,
    address: govAddress,
    functionName: 'proposalDeadline',
    args: [proposalId],
    query: { enabled: !!govAddress },
  });

  return { state, votes, proposer, snapshot, deadline };
}
