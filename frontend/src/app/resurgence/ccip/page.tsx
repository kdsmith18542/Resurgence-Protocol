'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CcipMessage {
  id: string;
  sourceChain: string;
  destChain: string;
  sender: string;
  receiver: string;
  amount: number;
  status: 'Pending' | 'Delivered' | 'Failed';
  timestamp: string;
}

export default function CcipLogsPage() {
  const [messages, setMessages] = useState<CcipMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMessages([
      {
        id: "ccip-msg-10252",
        sourceChain: "Base Sepolia",
        destChain: "Arbitrum Sepolia",
        sender: "0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f",
        receiver: "0x99655C3B1b8F1041BC71C56X917088d3745f3F4F",
        amount: 25000,
        status: "Delivered",
        timestamp: "2026-05-24 16:15"
      },
      {
        id: "ccip-msg-10253",
        sourceChain: "Amoy Polygon",
        destChain: "Arbitrum Sepolia",
        sender: "0x201624cBa366250D08bCdA95e6eF64151687A447",
        receiver: "0x99655C3B1b8F1041BC71C56X917088d3745f3F4F",
        amount: 42000,
        status: "Pending",
        timestamp: "2026-05-25 10:12"
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
        <span className="text-white font-medium">CCIP Messages</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">CCIP cross-chain bridge logs</h1>
        <p className="text-gray-400 text-sm">
          Track cross-chain message passing logs powered by Chainlink CCIP relays.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3">Message ID</th>
              <th className="px-6 py-3">Source → Dest</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className="border-b border-gray-700/60 hover:bg-gray-900/20">
                <td className="px-6 py-4 font-mono text-xs text-blue-400">
                  <Link href={`/resurgence/ccip/${m.id}`} className="hover:underline">
                    {m.id}
                  </Link>
                </td>
                <td className="px-6 py-4 font-semibold text-white">
                  {m.sourceChain} → {m.destChain}
                </td>
                <td className="px-6 py-4 font-mono text-white">{m.amount.toLocaleString()} RESURGE</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${m.status === 'Delivered' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-6 py-4">{m.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
