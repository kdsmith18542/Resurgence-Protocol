'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserStake {
  poolAddress: string;
  tokenName: string;
  stakedAmount: number;
  unclaimedRewards: number;
  apr: number;
}

interface VoteRecord {
  proposalId: number;
  title: string;
  support: boolean;
  weight: number;
  timestamp: number;
}

interface BridgeRelay {
  messageId: string;
  sourceChain: string;
  amount: number;
  status: 'relayed' | 'pending' | 'failed';
  timestamp: number;
}

export function ClientPage() {
  const params = useParams();
  const address = (params?.address as string) ?? '';

  const [loading, setLoading] = useState(true);
  const [stakes, setStakes] = useState<UserStake[]>([]);
  const [votes, setVotes] = useState<VoteRecord[]>([]);
  const [relays, setRelays] = useState<BridgeRelay[]>([]);

  // Generate deterministic details based on the address
  let sum = 0;
  for (let i = 0; i < address.length; i++) {
    sum += address.charCodeAt(i);
  }

  useEffect(() => {
    setTimeout(() => {
      // Mock Stakes
      setStakes([
        {
          poolAddress: "0xD41086DA2acCcD4EFfd47FA69ED3E6f71d9da5C6",
          tokenName: "DEADCOIN-A",
          stakedAmount: 1500 + (sum % 500),
          unclaimedRewards: 12.45 + (sum % 20) / 10,
          apr: 24.5
        },
        {
          poolAddress: "0xF38940C9Eb607521ba657AE1bd86328AD09712ea",
          tokenName: "DEADCOIN-B",
          stakedAmount: 4200 + (sum % 1000),
          unclaimedRewards: 45.82 + (sum % 50) / 10,
          apr: 18.2
        }
      ]);

      // Mock Votes
      setVotes([
        {
          proposalId: 4,
          title: "Adjust Reward Emission Rate Per Second",
          support: true,
          weight: 120000 + (sum % 10000),
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 3
        },
        {
          proposalId: 5,
          title: "Enable Direct Dormancy Proof Submission Role",
          support: false,
          weight: 120000 + (sum % 10000),
          timestamp: Math.floor(Date.now() / 1000) - 86400 * 7
        }
      ]);

      // Mock CCIP Relays
      setRelays([
        {
          messageId: `0x558bb38488bc7a05b68a4107faa8db831f13f6fcc028f86e8a${sum.toString(16)}b009a`,
          sourceChain: "Amoy Testnet",
          amount: 500,
          status: "relayed",
          timestamp: Math.floor(Date.now() / 1000) - 3600 * 4
        },
        {
          messageId: `0x831f13f6fcc028f86e8a2c028f86e8a2c02ec12b009aa6ba17905996${sum.toString(16)}0`,
          sourceChain: "Base Sepolia",
          amount: 1000,
          status: "pending",
          timestamp: Math.floor(Date.now() / 1000) - 600
        }
      ]);

      setLoading(false);
    }, 600);
  }, [address, sum]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10">
        <div className="h-10 bg-gray-800 rounded-xl w-64"></div>
        <div className="h-32 bg-gray-800 rounded-xl"></div>
        <div className="h-64 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  const totalRewards = stakes.reduce((acc, s) => acc + s.unclaimedRewards, 0);

  return (
    <div className="space-y-8 text-left max-w-6xl mx-auto py-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Profile</h1>
        <p className="text-gray-400 font-mono text-sm break-all bg-gray-900/40 p-3 rounded-lg border border-gray-700/40">
          {address}
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Active Stakes</p>
          <p className="text-2xl font-bold text-white mt-1">{stakes.length} Pools</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Total Unclaimed Rewards</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{totalRewards.toFixed(2)} RESURGE</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Proposals Voted</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{votes.length} Votes</p>
        </div>
      </div>

      {/* Active Stakes List */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-white">Active Staking Positions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-400">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3">Pool</th>
                <th className="px-6 py-3">Staked Balance</th>
                <th className="px-6 py-3">Unclaimed Rewards</th>
                <th className="px-6 py-3">APR</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stakes.map((s) => (
                <tr key={s.poolAddress} className="border-b border-gray-700/60 hover:bg-gray-900/20">
                  <td className="px-6 py-4 font-semibold text-white">
                    <Link href={`/resurgence/pools/${s.poolAddress}`} className="hover:text-blue-400 transition-colors">
                      {s.tokenName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-white">{s.stakedAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 font-mono text-green-400">+{s.unclaimedRewards.toFixed(4)} RESURGE</td>
                  <td className="px-6 py-4 text-green-500 font-bold">{s.apr}%</td>
                  <td className="px-6 py-4">
                    <Link href={`/resurgence/pools/${s.poolAddress}`} className="text-blue-400 hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Governance & Relays Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voting History */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-white">Governance Voting History</h2>
          <div className="space-y-4">
            {votes.map((v) => (
              <div key={v.proposalId} className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/40">
                <div className="flex justify-between items-start mb-2">
                  <Link href={`/resurgence/governance/${v.proposalId}`} className="text-sm font-semibold text-white hover:text-blue-400">
                    Prop #{v.proposalId}: {v.title}
                  </Link>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${v.support ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {v.support ? 'FOR' : 'AGAINST'}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Weight: {v.weight.toLocaleString()} votes</span>
                  <span>{new Date(v.timestamp * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CCIP Bridge Relays */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold mb-4 text-white">CCIP Cross-Chain Relays</h2>
          <div className="space-y-4">
            {relays.map((r) => (
              <div key={r.messageId} className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/40">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500">Source Chain</span>
                    <p className="text-sm font-semibold text-white">{r.sourceChain}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${r.status === 'relayed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-700/40">
                  <span className="text-[10px] uppercase text-gray-500 font-mono">CCIP Message ID</span>
                  <div className="flex justify-between items-center gap-2 mt-1">
                    <Link href={`/resurgence/ccip/${r.messageId}`} className="text-xs text-blue-400 font-mono truncate max-w-[200px] hover:underline">
                      {r.messageId}
                    </Link>
                    <span className="text-xs text-green-400 font-bold">{r.amount} RESURGE</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
