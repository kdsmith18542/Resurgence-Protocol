'use client';

import { useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async (connectorId: string) => {
    setIsConnecting(true);
    try {
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        await connect({ connector });
        onClose(); // Close modal on successful connection
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-700 p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-white text-2xl font-bold mb-6 text-center">Connect Wallet</h2>
        <div className="space-y-4">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector.id)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md transition duration-300"
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : `Connect ${connector.name}`}
            </button>
          ))}
          <button
            onClick={onClose}
            className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 rounded-md transition duration-300"
            disabled={isConnecting}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 