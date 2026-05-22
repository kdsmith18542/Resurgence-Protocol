'use client';
import { useState } from 'react';
import { usePropose } from '@/hooks/useStakingActions';
import { useGovernance } from '@/hooks/useGovernance';
import { parseEther } from 'viem';

interface CreateProposalFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProposalForm({ isOpen, onClose }: CreateProposalFormProps) {
  const [target, setTarget] = useState('');
  const [signature, setSignature] = useState('');
  const [calldata, setCalldata] = useState('');
  const [description, setDescription] = useState('');
  const { govAddress } = useGovernance();
  const { propose, isPending } = usePropose(govAddress);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!target || !description) return;
    await propose([target as `0x${string}`], [0n], [('0x' + calldata.replace('0x', '')) as `0x${string}`], description);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg border border-gray-700 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Create Proposal</h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Target Contract</label>
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="0x..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Calldata (hex)</label>
            <input
              value={calldata}
              onChange={e => setCalldata(e.target.value)}
              placeholder="0x..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your proposal..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!target || !description || isPending}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-medium mt-4 transition-colors disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirming...' : 'Submit Proposal'}
        </button>

        <button onClick={onClose} className="w-full text-gray-400 hover:text-white py-2 mt-2 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
