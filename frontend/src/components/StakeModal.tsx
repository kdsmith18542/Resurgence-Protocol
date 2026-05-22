'use client';
import { useState } from 'react';
import { useAccount, useSimulateContract, useGasPrice } from 'wagmi';
import { useStake, useApproveToken } from '@/hooks/useStakingActions';
import { useTokenAllowance } from '@/hooks/useTokenData';
import { formatTokenAmount } from '@/lib/utils';
import { ABIS } from '@/lib/abis';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolAddress: `0x${string}`;
  deadCoinAddress: `0x${string}`;
  userBalance: bigint;
  userStaked: bigint;
  tokenSymbol?: string;
}

export default function StakeModal({ isOpen, onClose, poolAddress, deadCoinAddress, userBalance, userStaked, tokenSymbol }: StakeModalProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const { address } = useAccount();
  const { stake, isPending: isStaking } = useStake(poolAddress);
  const { approve, isPending: isApproving } = useApproveToken(deadCoinAddress, poolAddress);
  const { data: allowance } = useTokenAllowance(address as `0x${string}`, poolAddress);

  if (!isOpen) return null;

  const parsedAmount = amount ? BigInt(Math.floor(parseFloat(amount) * 1e18)) : 0n;
  const exceedsBalance = parsedAmount > userBalance;
  const needsApproval = parsedAmount > 0n && (allowance === undefined || parsedAmount > (allowance as bigint));
  const isPending = isStaking || isApproving;

  const { data: stakeSimulation } = useSimulateContract({
    abi: ABIS.DeadCoinStakingPool,
    address: poolAddress,
    functionName: 'stake',
    args: [parsedAmount],
    query: { enabled: parsedAmount > 0n && !exceedsBalance && !needsApproval },
  });
  const { data: approveSimulation } = useSimulateContract({
    abi: ABIS.Erc20,
    address: deadCoinAddress,
    functionName: 'approve',
    args: [poolAddress, parsedAmount],
    query: { enabled: parsedAmount > 0n && needsApproval },
  });
  const { data: gasPrice } = useGasPrice();
  const estimatedGas = needsApproval ? approveSimulation?.request?.gas : stakeSimulation?.request?.gas;
  const estimatedCostMatic = estimatedGas && gasPrice
    ? (Number(estimatedGas * gasPrice) / 1e18).toFixed(6)
    : null;

  const handleMax = () => {
    setAmount(formatTokenAmount(userBalance));
    setError('');
  };

  const handleAction = async () => {
    setError('');
    if (parsedAmount === 0n) {
      setError('Enter an amount to stake.');
      return;
    }
    if (exceedsBalance) {
      setError('Amount exceeds your balance.');
      return;
    }
    try {
      if (needsApproval) {
        await approve(parsedAmount);
      } else {
        await stake(parsedAmount);
        onClose();
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Transaction failed.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white mb-4">Stake {tokenSymbol || 'Tokens'}</h2>

        <div className="bg-gray-900 rounded-lg p-4 mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Balance: {formatTokenAmount(userBalance)}</span>
            <span>Staked: {formatTokenAmount(userStaked)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={amount}
              onChange={handleChange}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl text-white font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={handleMax} className="text-sm text-blue-400 hover:text-blue-300 font-medium">MAX</button>
          </div>
          {exceedsBalance && <p className="text-red-400 text-xs mt-1">Amount exceeds your balance.</p>}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {estimatedCostMatic && (
          <div className="flex justify-between text-xs text-gray-400 mb-3 px-1">
            <span>Estimated Gas</span>
            <span>{estimatedCostMatic} MATIC</span>
          </div>
        )}

        <button
          onClick={handleAction}
          disabled={!parsedAmount || exceedsBalance || isPending}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors disabled:cursor-not-allowed"
        >
          {isPending ? 'Confirming...' : needsApproval ? 'Approve' : 'Stake'}
        </button>

        <button onClick={onClose} className="w-full text-gray-400 hover:text-white py-2 mt-2 text-sm transition-colors">Cancel</button>
      </div>
    </div>
  );
}
