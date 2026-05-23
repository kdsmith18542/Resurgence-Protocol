'use client';
import { useSimulateContract, useGasPrice } from 'wagmi';
import { useClaimRewards, useBridgeClaim } from '@/hooks/useStakingActions';
import { formatTokenAmount } from '@/lib/utils';
import { ABIS } from '@/lib/abis';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: `0x${string}`;
  pendingRewards: bigint;
  isBridgeClaim?: boolean;
}

export default function ClaimModal({ isOpen, onClose, poolAddress, pendingRewards, isBridgeClaim }: ClaimModalProps) {
  const { claimRewards, isPending: isClaimPending } = useClaimRewards(poolAddress);
  const { bridgeClaim, isPending: isBridgePending } = useBridgeClaim(poolAddress);
  const isPending = isBridgeClaim ? isBridgePending : isClaimPending;

  const { data: simulation } = useSimulateContract({
    abi: ABIS.DeadCoinStakingPool,
    address: poolAddress,
    functionName: isBridgeClaim ? 'bridgeClaim' : 'claimRewards',
    query: { enabled: pendingRewards > 0n },
  });
  const { data: gasPrice } = useGasPrice();
  const estimatedCost = simulation?.request?.gas && gasPrice
    ? (Number(simulation.request.gas * gasPrice) / 1e18).toFixed(6)
    : null;

  if (!isOpen) return null;

  const handleClaim = async () => {
    if (isBridgeClaim) {
      await bridgeClaim();
    } else {
      await claimRewards();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">
          {isBridgeClaim ? 'Bridge Claim Rewards' : 'Claim Rewards'}
        </h2>

        {isBridgeClaim && (
          <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3 mb-4 text-sm text-purple-300">
            Rewards bridge to Arbitrum via CCIP. RESURGE is minted on the hub and sent to your address.
          </div>
        )}

        <div className="bg-gray-900 rounded-lg p-4 mb-4 text-center">
          <p className="text-gray-400 text-sm mb-1">Pending RESURGE Rewards</p>
          <p className="text-3xl font-bold text-yellow-400">{formatTokenAmount(pendingRewards)}</p>
        </div>

        {estimatedCost && (
          <div className="flex justify-between text-xs text-gray-400 mb-3 px-1">
            <span>Estimated Gas</span>
            <span>{estimatedCost} native</span>
          </div>
        )}

        <button
          onClick={handleClaim}
          disabled={pendingRewards === 0n || isPending}
          className={`w-full disabled:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed ${
            isBridgeClaim ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isPending ? 'Confirming...' : pendingRewards === 0n ? 'No Rewards' : isBridgeClaim ? 'Bridge Claim' : 'Claim Rewards'}
        </button>

        <button onClick={onClose} className="w-full text-gray-400 hover:text-white py-2 mt-2 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
