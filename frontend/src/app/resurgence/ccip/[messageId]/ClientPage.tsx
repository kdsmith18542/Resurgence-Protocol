'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ClientPage() {
  const params = useParams();
  const messageId = (params?.messageId as string) ?? '';

  const [loading, setLoading] = useState(true);

  // Deterministic mock generation based on messageId characters
  let sum = 0;
  for (let i = 0; i < messageId.length; i++) {
    sum += messageId.charCodeAt(i);
  }
  const isConfirmed = sum % 3 !== 0;
  const gasLimit = 200000 + (sum % 50000);
  const gasPrice = 25 + (sum % 10);
  const claimAmount = 500 + (sum % 2500);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [messageId]);

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
      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence/pools" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">CCIP Message Details</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Chainlink CCIP Cross-Chain Message</span>
          <h1 className="text-xl font-bold text-white mt-1 break-all bg-gray-950 px-3 py-2 rounded-lg border border-gray-800 font-mono">
            {messageId || "0x558bb38488bc7a05b68a4107faa8db831f13f6fcc028f86e8ab009a"}
          </h1>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${isConfirmed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
          {isConfirmed ? 'Success' : 'In Progress'}
        </span>
      </div>

      {/* Details Card */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Cross-Chain Execution Log</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Source Chain</span>
            <span className="text-white font-semibold">Amoy Testnet (Polygon)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Destination Chain</span>
            <span className="text-white font-semibold">Arbitrum Sepolia (Hub)</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Transfer Amount</span>
            <span className="text-green-400 font-bold">{claimAmount.toLocaleString()} RESURGE</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Relayed Fee Token</span>
            <span className="text-white font-mono">LINK</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>CCIP Gas Limit</span>
            <span className="text-white font-mono">{gasLimit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Execution Gas Price</span>
            <span className="text-white font-mono">{gasPrice} Gwei</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-2">
          <span className="text-xs uppercase text-gray-500 font-mono">Chainlink CCIP Explorer</span>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-950 p-4 rounded-xl border border-gray-700">
            <span className="text-xs text-gray-400">Trace this message dynamically on the public CCIP Explorer network:</span>
            <a href={`https://ccip.chain.link/msg/${messageId}`} target="_blank" rel="noopener noreferrer" className="glow-btn text-xs font-semibold py-1.5 px-4 whitespace-nowrap self-end sm:self-auto">
              Open CCIP Explorer ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
