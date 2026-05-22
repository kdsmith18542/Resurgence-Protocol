'use client';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useDelegate } from '@/hooks/useStakingActions';
import { useResurgeToken } from '@/hooks/useTokenData';
import { formatTokenAmount, truncateAddress } from '@/lib/utils';

interface DelegateVotesProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DelegateVotes({ isOpen, onClose }: DelegateVotesProps) {
  const [delegateeAddress, setDelegateeAddress] = useState('');
  const [delegateToSelf, setDelegateToSelf] = useState(false);
  const { address } = useAccount();
  const { votes, delegatedTo } = useResurgeToken();
  const { delegate, isPending } = useDelegate();

  if (!isOpen) return null;

  const handleDelegate = async () => {
    const target = delegateToSelf ? (address as `0x${string}`) : (delegateeAddress as `0x${string}`);
    if (!target) return;
    await delegate(target);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Delegate Voting Power</h2>

        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-400">Current Voting Power: <span className="text-white font-medium">{formatTokenAmount(votes || 0n)} RESURGE</span></p>
          {delegatedTo && delegatedTo !== '0x0000000000000000000000000000000000000000' && (
            <p className="text-sm text-gray-400 mt-1">Delegated To: <span className="text-white font-mono">{truncateAddress(delegatedTo)}</span></p>
          )}
        </div>

        <label className="flex items-center gap-2 text-white text-sm mb-4 cursor-pointer">
          <input type="checkbox" checked={delegateToSelf} onChange={e => { setDelegateToSelf(e.target.checked); setDelegateeAddress(''); }} className="rounded" />
          Delegate to myself
        </label>

        {!delegateToSelf && (
          <div className="mb-4">
            <label className="text-sm text-gray-400 block mb-1">Delegatee Address</label>
            <input
              value={delegateeAddress}
              onChange={e => setDelegateeAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
            />
          </div>
        )}

        <button
          onClick={handleDelegate}
          disabled={(!delegateToSelf && !delegateeAddress) || isPending}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirming...' : 'Delegate'}
        </button>

        <button onClick={onClose} className="w-full text-gray-400 hover:text-white py-2 mt-2 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
