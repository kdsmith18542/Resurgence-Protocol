'use client';
import { useState } from 'react';
import { useSecurityAdmin } from '@/hooks/useSecurityAdmin';
import { ABIS } from '@/lib/abis';
import { truncateAddress } from '@/lib/utils';

export default function EmergencyControls() {
  const { contracts, isAnyAdmin, executePause, isPending } = useSecurityAdmin();
  const [isOpen, setIsOpen] = useState(false);

  if (!isAnyAdmin) return null;

  const getAbi = (name: string) => {
    if (name === 'RESURGE Token') return ABIS.ResurgeToken;
    if (name === 'Pool Manager') return ABIS.StakingPoolManager;
    return ABIS.RewardDistributor;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors"
        style={{ borderColor: 'rgb(239 68 68 / 0.5)', color: 'rgb(248 113 113)' }}
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        Admin
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setIsOpen(false)}>
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Emergency Controls</h2>
              <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">Admin Only</span>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Pause or unpause protocol contracts. Pausing stops all user actions immediately.
            </p>

            <div className="space-y-3">
              {contracts.map((c) => (
                <div key={c.address} className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{c.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{truncateAddress(c.address)}</p>
                    <p className={`text-xs mt-1 ${c.paused ? 'text-red-400' : 'text-green-400'}`}>
                      {c.paused ? 'Paused' : 'Active'}
                    </p>
                  </div>
                  {c.isAdmin && (
                    <button
                      onClick={() => executePause(c.address, getAbi(c.name) as any, !c.paused)}
                      disabled={isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        c.paused
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-red-600 hover:bg-red-700 text-white'
                      }`}
                    >
                      {c.paused ? 'Unpause' : 'Pause'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => setIsOpen(false)} className="w-full text-gray-400 hover:text-white py-2 mt-4 text-sm transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
