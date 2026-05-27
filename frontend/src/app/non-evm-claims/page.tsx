'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { pad, stringToHex } from 'viem';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';

type Step = 1 | 2 | 3 | 4 | 5;
type ClaimMode = 'transfer' | 'burn' | 'signature' | 'staking' | 'zkvm' | 'lock';
type LegacyChain = 'btc' | 'doge';
type ClaimStatus = 'idle' | 'ingesting' | 'attesting' | 'minting' | 'completed';

function getConfidenceBadge(claimMode: ClaimMode | null, confidenceScore: number | null): { label: string; color: string } {
  if (!claimMode || confidenceScore === null) return { label: 'Pending', color: 'bg-gray-800 border-gray-700 text-gray-400' };
  
  if (claimMode === 'transfer' || claimMode === 'burn' || claimMode === 'lock') {
    return { label: 'Strong — transfer/burn/lock backed', color: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400' };
  }
  if (claimMode === 'zkvm') {
    return { label: 'Strong — zkVM verified', color: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400' };
  }
  if (claimMode === 'signature') {
    if (confidenceScore >= 70) {
      return { label: 'Medium — signature + full/light node', color: 'bg-amber-950/80 border-amber-800/80 text-amber-400' };
    }
    return { label: 'Medium — signature + public RPC', color: 'bg-amber-950/80 border-amber-800/80 text-amber-400' };
  }
  if (confidenceScore < 50) {
    return { label: 'Low — explorer evidence', color: 'bg-red-950/80 border-red-800/80 text-red-400' };
  }
  return { label: 'Manual — not eligible for automatic mint', color: 'bg-gray-950/80 border-gray-800/80 text-gray-400' };
}

export default function NonEvmClaimsPage() {
  const { address: evmWallet, isConnected } = useAccount();
  const chainId = useChainId();

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [claimMode, setClaimMode] = useState<ClaimMode | null>(null);
  const [selectedChain, setSelectedChain] = useState<LegacyChain | null>(null);
  const [txHash, setTxHash] = useState('');
  const [sigChallenge, setSigChallenge] = useState('');
  const [sigChallengeResponse, setSigChallengeResponse] = useState('');
  const [legacyAddress, setLegacyAddress] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);

  // Auto-connect step routing
  useEffect(() => {
    if (isConnected && step === 1) {
      setStep(2);
    } else if (!isConnected && step > 1) {
      setStep(1);
    }
  }, [isConnected, step]);

  // Generate unique challenge if signature mode is chosen
  useEffect(() => {
    if (claimMode === 'signature') {
      setSigChallenge(`LACE-CHALLENGE-${Math.floor(Math.random() * 1000000)}`);
    }
  }, [claimMode]);

  // Contract Read for configured vault/burn addresses
  const registryAddress = getContractAddress(chainId, 'LegacyClaimRegistry') as `0x${string}`;

  const btcChainBytes32 = pad(stringToHex('bitcoin'), { size: 32 });
  const dogeChainBytes32 = pad(stringToHex('dogecoin'), { size: 32 });
  const currentChainBytes32 = selectedChain === 'btc' ? btcChainBytes32 : dogeChainBytes32;

  const { data: contractVaultAddress } = useReadContract({
    abi: ABIS.LegacyClaimRegistry,
    address: registryAddress,
    functionName: 'vaultAddresses',
    args: [currentChainBytes32],
    query: { enabled: !!registryAddress && !!selectedChain },
  });

  const { data: contractBurnAddress } = useReadContract({
    abi: ABIS.LegacyClaimRegistry,
    address: registryAddress,
    functionName: 'burnAddresses',
    args: [currentChainBytes32],
    query: { enabled: !!registryAddress && !!selectedChain },
  });

  // Mock Fallbacks if contract not deployed or returns empty
  const getDestinationAddress = () => {
    if (claimMode === 'transfer') {
      if (contractVaultAddress && contractVaultAddress !== '') return contractVaultAddress as string;
      return selectedChain === 'btc'
        ? 'tb1qj80x5fspw34d28px8szx7d0spw34d28p999999'
        : 'ndogeVaultAddressPlaceholder999999';
    } else if (claimMode === 'burn') {
      if (contractBurnAddress && contractBurnAddress !== '') return contractBurnAddress as string;
      return selectedChain === 'btc'
        ? '1111111111111111111114oLvT2'
        : 'D111111111111111111111111111115zD4T';
    }
    return '';
  };

  // Submit flow simulation
  const handleSubmitClaim = () => {
    setStep(5);
    setClaimStatus('ingesting');

    setTimeout(() => {
      setClaimStatus('attesting');
      setConfidenceScore(parseFloat((95 + Math.random() * 4.9).toFixed(2))); // 95% - 99.9%
      
      setTimeout(() => {
        setClaimStatus('minting');
        
        setTimeout(() => {
          setClaimStatus('completed');
        }, 2000);
      }, 2500);
    }, 1500);
  };

  // Reset wizard
  const handleReset = () => {
    setClaimMode(null);
    setSelectedChain(null);
    setTxHash('');
    setSigChallengeResponse('');
    setLegacyAddress('');
    setClaimStatus('idle');
    setConfidenceScore(null);
    setStep(2);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Premium Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent">
          LACE Non-EVM Claim Wizard
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
          Claim RESURGE rewards for your legacy coins (BTC/DOGE) via transfer-to-vault, burn proofs, or signature dormancy verification.
        </p>
      </div>

      {/* Progress Stepper */}
      {step < 5 && (
        <div className="flex items-center justify-between mb-8 max-w-lg mx-auto">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs border ${
                step === s
                  ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                  : step > s
                  ? 'bg-green-900/60 border-green-700 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 4 && (
                <div className={`h-[2px] flex-1 mx-2 ${
                  step > s ? 'bg-green-700' : 'bg-gray-800'
                }`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Glassmorphic Wizard Container */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        
        {/* Step 1: Connect EVM Wallet */}
        {step === 1 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400 text-2xl">
              🔑
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect EVM Wallet</h2>
            <p className="text-gray-400 mb-6 text-sm max-w-md mx-auto">
              You must connect your EVM wallet first. This wallet will receive the RESURGE mint rewards once your claim is attested.
            </p>
            <div className="text-gray-500 text-xs italic bg-gray-900/40 p-3 rounded-xl border border-gray-800 max-w-xs mx-auto">
              Please use the connect wallet button in the navigation header.
            </div>
          </div>
        )}

        {/* Step 2: Select Claim Mode */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-white">Select Claim Mode</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => { setClaimMode('transfer'); setStep(3); }}
                className="bg-gray-900/40 hover:bg-blue-950/20 border border-gray-700 hover:border-blue-500/60 rounded-2xl p-5 text-left transition-all group"
              >
                <div className="text-2xl mb-3">📥</div>
                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Transfer to Vault</div>
                <div className="text-xs text-gray-400 mt-1">Send legacy coins to a secure, chain-level multisig vault address.</div>
              </button>

              <button
                onClick={() => { setClaimMode('burn'); setStep(3); }}
                className="bg-gray-900/40 hover:bg-purple-950/20 border border-gray-700 hover:border-purple-500/60 rounded-2xl p-5 text-left transition-all group"
              >
                <div className="text-2xl mb-3">🔥</div>
                <div className="font-semibold text-white group-hover:text-purple-400 transition-colors">Burn Proof</div>
                <div className="text-xs text-gray-400 mt-1">Permanently burn legacy coins by sending them to a verifiable burn address.</div>
              </button>

              <button
                onClick={() => { setClaimMode('signature'); setStep(3); }}
                className="bg-gray-900/40 hover:bg-orange-950/20 border border-gray-700 hover:border-orange-500/60 rounded-2xl p-5 text-left transition-all group col-span-1 sm:col-span-2"
              >
                <div className="text-2xl mb-3">✍️</div>
                <div className="font-semibold text-white group-hover:text-orange-400 transition-colors">Signature Dormancy Proof</div>
                <div className="text-xs text-gray-400 mt-1">Provide off-chain signature challenge response proving ownership of a dormant legacy address. No transaction fee required.</div>
              </button>

              <button
                onClick={() => { setClaimMode('zkvm'); setStep(3); }}
                className="bg-gray-900/40 hover:bg-cyan-950/20 border border-gray-700 hover:border-cyan-500/60 rounded-2xl p-5 text-left transition-all group"
              >
                <div className="text-2xl mb-3">🔐</div>
                <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">zkVM Dormancy Proof</div>
                <div className="text-xs text-gray-400 mt-1">Generate a cryptographic SP1 zkVM proof of dormancy. Trustless verification with highest confidence tier.</div>
              </button>

              <button
                onClick={() => { setClaimMode('lock'); setStep(3); }}
                className="bg-gray-900/40 hover:bg-emerald-950/20 border border-gray-700 hover:border-emerald-500/60 rounded-2xl p-5 text-left transition-all group"
              >
                <div className="text-2xl mb-3">🔒</div>
                <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Lock Proof</div>
                <div className="text-xs text-gray-400 mt-1">Lock legacy coins in a timelock, multisig, or non-spendable script. Verifiable lock condition required.</div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Select Chain */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-white">Select Legacy Blockchain</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => { setSelectedChain('btc'); setStep(4); }}
                className="bg-gray-900/40 hover:bg-yellow-950/20 border border-gray-700 hover:border-yellow-500/60 rounded-2xl p-6 text-left transition-all group flex items-center gap-4"
              >
                <span className="text-3xl">🪙</span>
                <div>
                  <div className="font-semibold text-white group-hover:text-yellow-400">Bitcoin (BTC)</div>
                  <div className="text-xs text-gray-400">Claim from legacy Bitcoin network</div>
                </div>
              </button>

              <button
                onClick={() => { setSelectedChain('doge'); setStep(4); }}
                className="bg-gray-900/40 hover:bg-yellow-800/10 border border-gray-700 hover:border-yellow-600/60 rounded-2xl p-6 text-left transition-all group flex items-center gap-4"
              >
                <span className="text-3xl">🐕</span>
                <div>
                  <div className="font-semibold text-white group-hover:text-yellow-500 font-sans">Dogecoin (DOGE)</div>
                  <div className="text-xs text-gray-400 font-sans">Claim from legacy Dogecoin network</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Claim Mode
            </button>
          </div>
        )}

        {/* Step 4: Vault/Burn Info or Signature collection */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">
              {claimMode === 'signature' ? 'Challenge Response Details' :
               claimMode === 'zkvm' ? 'zkVM Proof Generation' :
               claimMode === 'lock' ? 'Lock Proof Details' :
               'Verify and Submit Claim'}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {claimMode === 'signature'
                ? 'Sign the challenge message using your legacy private key.'
                : claimMode === 'zkvm'
                ? 'ChronoNode will generate an SP1 Groth16 proof verifying your dormancy. This may take several minutes.'
                : claimMode === 'lock'
                ? 'Provide the lock transaction hash and lock script details.'
                : 'Send your legacy coins and enter the transaction hash below.'}
            </p>

            {/* Deposit address display for Transfer / Burn */}
            {(claimMode === 'transfer' || claimMode === 'burn') && (
              <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-700 mb-6">
                <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">
                  Destination {claimMode === 'transfer' ? 'Vault' : 'Burn'} Address
                </div>
                <div className="flex items-center justify-between gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-sm font-mono text-white break-all">{getDestinationAddress()}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(getDestinationAddress())}
                    className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-2.5 py-1.5 rounded-lg shrink-0 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                  * Verify this destination matches the configured address in the registry contract on chain.
                </div>
              </div>
            )}

            {/* Lock proof address display */}
            {claimMode === 'lock' && (
              <div className="bg-gray-900/50 rounded-2xl p-5 border border-gray-700 mb-6">
                <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">
                  Lock Script Requirements
                </div>
                <div className="text-sm text-gray-300 space-y-2">
                  <p>Lock your legacy coins in one of the following:</p>
                  <ul className="list-disc list-inside text-xs text-gray-400 space-y-1">
                    <li>Timelock script (OP_CHECKLOCKTIMEVERIFY)</li>
                    <li>Multisig (2-of-3 or higher)</li>
                    <li>Provably unspendable script</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
              {claimMode === 'signature' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Challenge Message</label>
                    <div className="bg-gray-900/40 p-3 rounded-xl border border-gray-700 text-sm font-mono text-gray-300 break-all select-all">
                      {sigChallenge}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Signature Response</label>
                    <textarea
                      placeholder="Paste challenge signature in hex or base64 format"
                      value={sigChallengeResponse}
                      onChange={(e) => setSigChallengeResponse(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none resize-none"
                    />
                  </div>
                </>
              ) : claimMode === 'zkvm' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-cyan-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-4">
                    <div className="text-xs text-cyan-400 font-semibold mb-1">zkVM Proof Info</div>
                    <div className="text-xs text-gray-400">
                      Proof generation uses SP1 Groth16 and may take 5-30 minutes depending on chain size.
                      The proof will be verified trustlessly on-chain.
                    </div>
                  </div>
                </>
              ) : claimMode === 'lock' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lock Transaction Hash</label>
                    <input
                      type="text"
                      placeholder="Paste the lock transaction hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lock Type</label>
                    <select className="w-full bg-gray-900/40 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm text-white focus:outline-none">
                      <option value="timelock">Timelock (CLTV)</option>
                      <option value="multisig">Multisig</option>
                      <option value="unspendable">Unspendable Script</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Transaction Hash (TXID)</label>
                    <input
                      type="text"
                      placeholder="Paste your legacy transaction hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full bg-gray-900/40 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep(3)}
                className="bg-gray-800 hover:bg-gray-700 text-white text-sm px-5 py-3 rounded-xl font-medium border border-gray-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmitClaim}
                disabled={
                  claimMode === 'signature'
                    ? !legacyAddress || !sigChallengeResponse
                    : !txHash
                }
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                Submit Evidence
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Submission Status Timeline & Confidence Badge */}
        {step === 5 && (
          <div className="py-4">
            <h2 className="text-2xl font-bold mb-6 text-center text-white">Processing Claim</h2>

            {/* Status Timeline */}
            <div className="max-w-md mx-auto space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-700">
              {['Address submitted', 'Ownership verified', 'Evidence scanned', 'Dormancy verified', 'ChronoNode proof generated', 'BaaLS attestation stored', 'EVM submission sent', 'RESURGE minted'].map((label, i) => {
                const stepNum = i + 1;
                const isComplete = claimStatus === 'completed' || 
                  (claimStatus === 'minting' && i < 7) ||
                  (claimStatus === 'attesting' && i < 5) ||
                  (claimStatus === 'ingesting' && i < 1);
                const isActive = 
                  (claimStatus === 'ingesting' && i === 0) ||
                  (claimStatus === 'attesting' && i >= 1 && i < 5) ||
                  (claimStatus === 'minting' && i >= 5 && i < 7) ||
                  (claimStatus === 'completed' && i === 7);
                
                return (
                  <div key={label} className="flex gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border z-10 ${
                      isActive
                        ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
                        : isComplete
                        ? 'bg-green-950 border-green-800 text-green-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}>
                      {isComplete ? '✓' : isActive ? '●' : stepNum}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm sm:text-base">{stepNum}. {label}</h4>
                      {i === 4 && confidenceScore && (
                        <span className={`${getConfidenceBadge(claimMode, confidenceScore).color} text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block`}>
                          {getConfidenceBadge(claimMode, confidenceScore).label}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completion Screen */}
            {claimStatus === 'completed' && (
              <div className="mt-8 pt-8 border-t border-gray-700/60 text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400 text-2xl">
                  🎉
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Claim Success</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                  Your claim has been attested with {confidenceScore}% confidence. Rewards have been successfully minted and sent to your wallet.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2.5 rounded-xl font-semibold transition-colors"
                  >
                    Submit Another Claim
                  </button>
                  <Link
                    href="/dashboard"
                    className="bg-gray-900/60 hover:bg-gray-800 text-gray-300 text-sm px-6 py-2.5 rounded-xl font-semibold border border-gray-700 transition-colors"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
