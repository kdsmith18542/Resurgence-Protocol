'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useAccount, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import WalletConnectModal from './WalletConnectModal';
import DelegateVotes from './DelegateVotes';
import EmergencyControls from './EmergencyControls';
import { truncateAddress } from '@/lib/utils';
import { CHAIN_NAMES } from '@/lib/contracts';

const HUB_CHAINS = [
  { id: 42161,  name: 'Arbitrum One',     badge: 'HUB' },
  { id: 421614, name: 'Arbitrum Sepolia', badge: 'HUB' },
];

const SPOKE_CHAINS = [
  { id: 137,   name: 'Polygon',      badge: 'SPOKE' },
  { id: 80002, name: 'Amoy',         badge: 'SPOKE' },
  { id: 56,    name: 'BNB Chain',    badge: 'SPOKE' },
  { id: 97,    name: 'BSC Testnet',  badge: 'SPOKE' },
  { id: 8453,  name: 'Base',         badge: 'SPOKE' },
  { id: 84532, name: 'Base Sepolia', badge: 'SPOKE' },
];

const ALL_CHAINS = [...HUB_CHAINS, ...SPOKE_CHAINS];

function chainName(id: number): string {
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

function isHubChain(id: number): boolean {
  return HUB_CHAINS.some(c => c.id === id);
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
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${isHubChain(chainId) ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'}`}>
                      {isHubChain(chainId) ? 'HUB' : 'SPOKE'}
                    </span>
                    {chainName(chainId)}
                    <span className="text-gray-500">▾</span>
                  </button>
                  {isNetworkOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-blue-400 uppercase tracking-wider border-b border-gray-700">
                        Hub (Arbitrum)
                      </div>
                      {HUB_CHAINS.map(chain => (
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
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-purple-400 uppercase tracking-wider border-b border-t border-gray-700">
                        Spoke Chains
                      </div>
                      {SPOKE_CHAINS.map(chain => (
                        <button
                          key={chain.id}
                          onClick={() => { switchChain({ chainId: chain.id }); setIsNetworkOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            chain.id === chainId ? 'text-purple-400 bg-gray-700' : 'text-gray-300 hover:bg-gray-700'
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
