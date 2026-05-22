'use client';
import { useSimulateContract, useGasPrice } from 'wagmi';
import { useClaimRewards } from '@/hooks/useStakingActions';
import { formatTokenAmount } from '@/lib/utils';
import { ABIS } from '@/lib/abis';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: `0x${string}`;
  pendingRewards: bigint;
}

export default function ClaimModal({ isOpen, onClose, poolAddress, pendingRewards }: ClaimModalProps) {
  const { claimRewards, isPending } = useClaimRewards(poolAddress);

  const { data: simulation } = useSimulateContract({
    abi: ABIS.DeadCoinStakingPool,
    address: poolAddress,
    functionName: 'claimRewards',
    query: { enabled: pendingRewards > 0n },
  });
  const { data: gasPrice } = useGasPrice();
  const estimatedCostMatic = simulation?.request?.gas && gasPrice
    ? (Number(simulation.request.gas * gasPrice) / 1e18).toFixed(6)
    : null;

  if (!isOpen) return null;

  const handleClaim = async () => {
    await claimRewards();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Claim Rewards</h2>

        <div className="bg-gray-900 rounded-lg p-4 mb-4 text-center">
          <p className="text-gray-400 text-sm mb-1">Pending RESURGE Rewards</p>
          <p className="text-3xl font-bold text-yellow-400">{formatTokenAmount(pendingRewards)}</p>
        </div>

        {estimatedCostMatic && (
          <div className="flex justify-between text-xs text-gray-400 mb-3 px-1">
            <span>Estimated Gas</span>
            <span>{estimatedCostMatic} MATIC</span>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={pendingRewards === 0n || isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirming...' : pendingRewards === 0n ? 'No Rewards' : 'Claim Rewards'}
        </button>

        <button onClick={onClose} className="w-full text-gray-400 hover:text-white py-2 mt-2 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
