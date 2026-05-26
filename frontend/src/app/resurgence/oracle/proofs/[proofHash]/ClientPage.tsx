'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export function ClientPage() {
  const params = useParams();
  const proofHash = (params?.proofHash as string) ?? '';

  const [loading, setLoading] = useState(true);
  
  // Deterministic mock generation based on proofHash characters
  let sum = 0;
  for (let i = 0; i < proofHash.length; i++) {
    sum += proofHash.charCodeAt(i);
  }
  const isConfirmed = sum % 3 !== 0;
  const blockHeight = 14200 + (sum % 2000);
  const evmWallet = `0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f`;
  const hubTxHash = `0xfc0663584d610bad57026bbabe97c6a477d9ebee9b52ea26c2f9a47b988d3112`;
  const nonEvmAddress = `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa`;
  const rewardAmount = 1000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [proofHash]);

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
        <span className="text-white font-medium">Oracle Proofs</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <span className="text-xs font-semibold text-purple-400 uppercase tracking-widest">Dormancy Proof Details</span>
          <h1 className="text-2xl font-bold text-white mt-1 break-all bg-gray-950 p-3 rounded-lg border border-gray-800 font-mono">
            {proofHash || "0x9f81041bc73a9f06b6d410b981f59e0b8b5cf63b82f671c56a"}
          </h1>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${isConfirmed ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
          {isConfirmed ? 'Attestation Confirmed' : 'Pending Attestation'}
        </span>
      </div>

      {/* Details Card */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Dormancy Claims State</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Target EVM Wallet</span>
            <Link href={`/resurgence/users/${evmWallet}`} className="text-white font-mono hover:text-blue-400 transition-colors">
              {evmWallet.slice(0, 10)}...{evmWallet.slice(-8)}
            </Link>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Dormant Wallet Address</span>
            <span className="text-white font-mono">{nonEvmAddress.slice(0, 12)}...</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Attested Block Height</span>
            <span className="text-white font-mono">#{blockHeight.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-700/60">
            <span>Reward Minted</span>
            <span className="text-green-400 font-bold">{rewardAmount.toLocaleString()} RESURGE</span>
          </div>
        </div>

        {isConfirmed && (
          <div className="pt-4 flex flex-col gap-2">
            <span className="text-xs uppercase text-gray-500 font-mono">Arbitrum Sepolia Hub Mint Transaction</span>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-950 p-4 rounded-xl border border-gray-700">
              <span className="text-xs text-white font-mono break-all">{hubTxHash}</span>
              <a href={`https://sepolia.arbiscan.io/tx/${hubTxHash}`} target="_blank" rel="noopener noreferrer" className="glow-btn text-xs font-semibold py-1.5 px-3 whitespace-nowrap self-end sm:self-auto">
                Arbiscan Link ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Trust signatures */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-3">Validator Attestation Signatures</h2>
        <p className="text-gray-400 text-xs leading-relaxed mb-4">
          This proof has been trustlessly signed by the decentralized oracle network (BaaLS + ChronoNode validators) before hub submission.
        </p>
        <div className="space-y-4">
          {/* ChronoNode */}
          <div className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/40">
            <div className="flex justify-between items-center mb-1">
              <a href="https://chrono.baals.network/proofs" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white hover:text-blue-400 transition-colors">ChronoNode Validator Attestation ↗</a>
              <span className="text-xs text-green-400 font-semibold">Verified ✓</span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono break-all">
              PUBKEY: 0a82b7b0d6be0cde841d31fda2a0c9ceff7636c81332bc2ed9cc981f5f537abc
            </div>
          </div>

          {/* BaaLS */}
          <div className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/40">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-white">BaaLS Oracle Attestation</span>
              <span className="text-xs text-green-400 font-semibold">Verified ✓</span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono break-all">
              PUBKEY: 002ec12b009aa6ba1790599675d066d0125c40683741d843eb43a0979678aaf1
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
