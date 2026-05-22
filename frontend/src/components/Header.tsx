'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { polygon, polygonMumbai, arbitrum, optimism } from 'wagmi/chains';
import WalletConnectModal from './WalletConnectModal';
import DelegateVotes from './DelegateVotes';
import EmergencyControls from './EmergencyControls';
import { truncateAddress } from '@/lib/utils';

const SUPPORTED_CHAINS = [
  { id: polygon.id, name: 'Polygon' },
  { id: polygonMumbai.id, name: 'Mumbai' },
  { id: arbitrum.id, name: 'Arbitrum' },
  { id: optimism.id, name: 'Optimism' },
];

function chainName(id: number): string {
  return SUPPORTED_CHAINS.find(c => c.id === id)?.name ?? `Chain ${id}`;
}

export default function Header() {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition-colors">
          Resurgence Protocol
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/pools" className="text-sm text-gray-300 hover:text-white transition-colors">Staking Pools</Link>
          <Link href="/governance" className="text-sm text-gray-300 hover:text-white transition-colors">Governance</Link>
          <Link href="/analytics" className="text-sm text-gray-300 hover:text-white transition-colors">Analytics</Link>
          <Link href="/docs" className="text-sm text-gray-300 hover:text-white transition-colors">Docs</Link>
        </nav>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              {chainId && (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setIsNetworkOpen(v => !v)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    {chainName(chainId)}
                    <span className="text-gray-500">▾</span>
                  </button>
                  {isNetworkOpen && (
                    <div className="absolute right-0 mt-1 w-36 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
                      {SUPPORTED_CHAINS.map(chain => (
                        <button
                          key={chain.id}
                          onClick={() => { switchChain({ chainId: chain.id }); setIsNetworkOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            chain.id === chainId ? 'text-blue-400 bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {chain.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => setIsDelegateModalOpen(true)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                Delegate
              </button>
              <EmergencyControls />
              <span className="text-sm text-gray-300 font-mono">{truncateAddress(address || '')}</span>
              <button onClick={() => disconnect()} className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                Disconnect
              </button>
            </>
          ) : (
            <button onClick={() => setIsWalletModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium">
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <nav className="md:hidden flex gap-4 px-4 pb-3 flex-wrap">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
        <Link href="/pools" className="text-sm text-gray-400 hover:text-white">Pools</Link>
        <Link href="/governance" className="text-sm text-gray-400 hover:text-white">Governance</Link>
        <Link href="/analytics" className="text-sm text-gray-400 hover:text-white">Analytics</Link>
        <Link href="/docs" className="text-sm text-gray-400 hover:text-white">Docs</Link>
      </nav>

      <WalletConnectModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      <DelegateVotes isOpen={isDelegateModalOpen} onClose={() => setIsDelegateModalOpen(false)} />
    </header>
  );
}
