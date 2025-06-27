'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import WalletConnectModal from './WalletConnectModal';

export default function Header() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <header className="bg-gray-800 text-white p-4">
      <nav className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          Resurgence Protocol
        </Link>
        <ul className="flex space-x-4">
          <li>
            <Link href="/dashboard" className="hover:text-gray-300">
              Dashboard
            </Link>
          </li>
          <li>
            <Link href="/pools" className="hover:text-gray-300">
              Staking Pools
            </Link>
          </li>
          <li>
            <Link href="/governance" className="hover:text-gray-300">
              Governance
            </Link>
          </li>
        </ul>
        <div>
          {isConnected ? (
            <div className="flex items-center space-x-4">
              <p className="text-gray-300">{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</p>
              <button
                onClick={handleDisconnect}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleOpenModal}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>
      <WalletConnectModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </header>
  );
} 