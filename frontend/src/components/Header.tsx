'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import WalletConnectModal from './WalletConnectModal';
import DelegateVotes from './DelegateVotes';
import { truncateAddress } from '@/lib/utils';

export default function Header() {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();

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
        </nav>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              {chainId && (
                <span className="text-xs text-gray-500 hidden sm:block">
                  {chainId === 137 ? 'Polygon' : chainId === 80001 ? 'Mumbai' : chainId === 31337 ? 'Local' : `Chain ${chainId}`}
                </span>
              )}
              <button onClick={() => setIsDelegateModalOpen(true)} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
                Delegate
              </button>
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

      <nav className="md:hidden flex gap-4 px-4 pb-3">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">Dashboard</Link>
        <Link href="/pools" className="text-sm text-gray-400 hover:text-white">Pools</Link>
        <Link href="/governance" className="text-sm text-gray-400 hover:text-white">Governance</Link>
      </nav>

      <WalletConnectModal isOpen={isWalletModalOpen} onClose={() => setIsWalletModalOpen(false)} />
      <DelegateVotes isOpen={isDelegateModalOpen} onClose={() => setIsDelegateModalOpen(false)} />
    </header>
  );
}
