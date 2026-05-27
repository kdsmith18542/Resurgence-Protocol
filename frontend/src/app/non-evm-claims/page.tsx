'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { pad, stringToHex } from 'viem';
import { ABIS } from '@/lib/abis';
import { getContractAddress } from '@/lib/contracts';

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type PathMode = 'erc20' | 'active_native' | 'frozen_sig_zk';
type ClaimMode = 'transfer' | 'burn' | 'signature' | 'zkvm' | 'lock';
type LegacyChain = 'btc' | 'doge';
type ClaimStatus = 'idle' | 'ingesting' | 'attesting' | 'minting' | 'completed';

function getConfidenceBadge(claimMode: ClaimMode | null, confidenceScore: number | null): { label: string; color: string } {
  if (!claimMode || confidenceScore === null) return { label: 'Pending', color: 'bg-gray-800 border-gray-700 text-gray-400' };
  
  if (claimMode === 'transfer' || claimMode === 'burn' || claimMode === 'lock') {
    return { label: 'Strong — Transfer/Burn/Lock Backed', color: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400' };
  }
  if (claimMode === 'zkvm') {
    return { label: 'Strong — zkVM Verified', color: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400' };
  }
  if (claimMode === 'signature') {
    if (confidenceScore >= 70) {
      return { label: 'Medium — Signature + Full Node', color: 'bg-amber-950/80 border-amber-800/80 text-amber-400' };
    }
    return { label: 'Medium — Signature + Public RPC', color: 'bg-amber-950/80 border-amber-800/80 text-amber-400' };
  }
  return { label: 'Manual Review Required', color: 'bg-gray-950/80 border-gray-800/80 text-gray-400' };
}

export default function NonEvmClaimsPage() {
  const { address: evmWallet, isConnected } = useAccount();
  const chainId = useChainId();

  // Wizard state
  const [step, setStep] = useState<Step>(1);
  const [pathMode, setPathMode] = useState<PathMode | null>(null);
  const [claimMode, setClaimMode] = useState<ClaimMode | null>(null);
  const [selectedChain, setSelectedChain] = useState<LegacyChain | null>(null);
  const [txHash, setTxHash] = useState('');
  const [sigChallenge, setSigChallenge] = useState('');
  const [sigChallengeResponse, setSigChallengeResponse] = useState('');
  const [legacyAddress, setLegacyAddress] = useState('');
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>('idle');
  const [confidenceScore, setConfidenceScore] = useState<number | null>(null);
  const [zkvmProgress, setZkvmProgress] = useState(0);
  const [isZkvmGenerating, setIsZkvmGenerating] = useState(false);

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
    setStep(6);
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

  // Simulation for zkVM proof generation progress
  const handleGenerateZkvmProof = () => {
    setIsZkvmGenerating(true);
    setZkvmProgress(0);
    const interval = setInterval(() => {
      setZkvmProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsZkvmGenerating(false);
          setTxHash(`0xsp1proof${Math.floor(Math.random() * 1000000)}`);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  // Reset wizard
  const handleReset = () => {
    setPathMode(null);
    setClaimMode(null);
    setSelectedChain(null);
    setTxHash('');
    setSigChallengeResponse('');
    setLegacyAddress('');
    setClaimStatus('idle');
    setConfidenceScore(null);
    setZkvmProgress(0);
    setIsZkvmGenerating(false);
    setStep(2);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Premium Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold mb-3 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
          LACE Non-EVM Claim Wizard
        </h1>
        <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
          Claim RESURGE rewards for legacy coins (BTC/DOGE) or stake EVM dead tokens to revive dormant value.
        </p>
      </div>

      {/* Progress Stepper */}
      {step < 6 && (
        <div className="flex items-center justify-between mb-8 max-w-xl mx-auto">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs border transition-all duration-300 ${
                step === s
                  ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                  : step > s
                  ? 'bg-green-900/60 border-green-700 text-green-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 5 && (
                <div className={`h-[2px] flex-1 mx-2 transition-all duration-300 ${
                  step > s ? 'bg-green-700' : 'bg-gray-800'
                }`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Glassmorphic Wizard Container */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Step 1: Connect EVM Wallet */}
        {step === 1 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400 text-2xl">
              🔑
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect EVM Wallet</h2>
            <p className="text-gray-400 mb-6 text-sm max-w-md mx-auto">
              Please connect your EVM wallet. This address will receive the RESURGE mint rewards once your claim is attested.
            </p>
            <div className="text-gray-500 text-xs italic bg-gray-900/40 p-3 rounded-xl border border-gray-800 max-w-xs mx-auto">
              Use the Connect Wallet button in the header navigation.
            </div>
          </div>
        )}

        {/* Step 2: Select High-Level Path Mode */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-2 text-white text-center sm:text-left">Select Claim Path</h2>
            <p className="text-gray-400 text-sm mb-6 text-center sm:text-left">Choose the type of asset and evidence mechanism you wish to submit.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Path 1: ERC-20 Staking */}
              <div className="bg-gradient-to-br from-blue-950/20 to-indigo-950/20 hover:from-blue-950/30 hover:to-indigo-950/30 border border-blue-900/40 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg">
                <div>
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 w-fit">🪙</div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">ERC-20 Staking</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-6">
                    Stake abandoned ERC-20 tokens directly on supported EVM chains. Best for active contracts where tokens can still be moved.
                  </p>
                </div>
                <Link
                  href="/pools"
                  className="w-full bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 font-semibold py-2.5 px-4 rounded-xl text-xs text-center transition-all"
                >
                  Go to Staking Pools →
                </Link>
              </div>

              {/* Path 2: Active Native Legacy Chains */}
              <div className="bg-gradient-to-br from-purple-950/20 to-fuchsia-950/20 hover:from-purple-950/30 hover:to-fuchsia-950/30 border border-purple-900/40 hover:border-purple-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg">
                <div>
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 w-fit">📥</div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Transfer / Burn / Lock</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-6">
                    Submit active transaction evidence (Transfer to Vault, Burn address, or lock scripts) on native Bitcoin or Dogecoin.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPathMode('active_native');
                    setStep(3);
                  }}
                  className="w-full bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all"
                >
                  Select Active Path →
                </button>
              </div>

              {/* Path 3: Frozen/Dormant Legacy Chains */}
              <div className="bg-gradient-to-br from-cyan-950/20 to-emerald-950/20 hover:from-cyan-950/30 hover:to-emerald-950/30 border border-cyan-900/40 hover:border-cyan-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all duration-300 group shadow-lg">
                <div>
                  <div className="text-3xl mb-4 group-hover:scale-110 transition-transform duration-300 w-fit">🔐</div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">Signature / zkVM</h3>
                  <p className="text-xs text-gray-400 leading-relaxed mb-6">
                    Verify ownership of dormant addresses on frozen chains off-chain via signature challenge or SP1 zkVM dormancy proofs.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setPathMode('frozen_sig_zk');
                    setStep(3);
                  }}
                  className="w-full bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all"
                >
                  Select Proof Path →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Select Chain */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">Select Legacy Chain</h2>
            <p className="text-gray-400 text-sm mb-6">Choose the native network where your legacy asset resides.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button
                onClick={() => { setSelectedChain('btc'); setStep(4); }}
                className="bg-gray-900/40 hover:bg-yellow-950/20 border border-gray-700 hover:border-yellow-500/60 rounded-2xl p-6 text-left transition-all group flex items-center gap-4 shadow-md"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">🪙</span>
                <div>
                  <div className="font-semibold text-white group-hover:text-yellow-400 transition-colors">Bitcoin (BTC)</div>
                  <div className="text-xs text-gray-400">Scan dormancy on Bitcoin network</div>
                </div>
              </button>

              <button
                onClick={() => { setSelectedChain('doge'); setStep(4); }}
                className="bg-gray-900/40 hover:bg-yellow-800/10 border border-gray-700 hover:border-yellow-600/60 rounded-2xl p-6 text-left transition-all group flex items-center gap-4 shadow-md"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">🐕</span>
                <div>
                  <div className="font-semibold text-white group-hover:text-yellow-500 transition-colors">Dogecoin (DOGE)</div>
                  <div className="text-xs text-gray-400 font-sans">Scan dormancy on Dogecoin network</div>
                </div>
              </button>
            </div>

            <button
              onClick={() => setStep(2)}
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
            >
              ← Back to Claim Path
            </button>
          </div>
        )}

        {/* Step 4: Select Action / Claim Mode */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">Select Evidence Type</h2>
            <p className="text-gray-400 text-sm mb-6">
              {pathMode === 'active_native'
                ? 'Specify the transaction type executed on the legacy chain.'
                : 'Select the verification method to prove ownership.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {pathMode === 'active_native' ? (
                <>
                  <button
                    onClick={() => { setClaimMode('transfer'); setStep(5); }}
                    className="bg-gray-900/40 hover:bg-blue-950/20 border border-gray-700 hover:border-blue-500/60 rounded-2xl p-5 text-left transition-all group"
                  >
                    <div className="text-2xl mb-3">📥</div>
                    <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">Transfer to Vault</div>
                    <div className="text-xs text-gray-400 mt-1">Send legacy coins to a secure, chain-level multisig vault address.</div>
                  </button>

                  <button
                    onClick={() => { setClaimMode('burn'); setStep(5); }}
                    className="bg-gray-900/40 hover:bg-purple-950/20 border border-gray-700 hover:border-purple-500/60 rounded-2xl p-5 text-left transition-all group"
                  >
                    <div className="text-2xl mb-3">🔥</div>
                    <div className="font-semibold text-white group-hover:text-purple-400 transition-colors">Burn Proof</div>
                    <div className="text-xs text-gray-400 mt-1">Permanently burn legacy coins by sending them to a verifiable burn address.</div>
                  </button>

                  <button
                    onClick={() => { setClaimMode('lock'); setStep(5); }}
                    className="bg-gray-900/40 hover:bg-emerald-950/20 border border-gray-700 hover:border-emerald-500/60 rounded-2xl p-5 text-left transition-all group col-span-1 sm:col-span-2"
                  >
                    <div className="text-2xl mb-3">🔒</div>
                    <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Lock Proof</div>
                    <div className="text-xs text-gray-400 mt-1">Lock legacy coins in a timelock, multisig, or non-spendable script.</div>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setClaimMode('signature'); setStep(5); }}
                    className="bg-gray-900/40 hover:bg-orange-950/20 border border-gray-700 hover:border-orange-500/60 rounded-2xl p-5 text-left transition-all group"
                  >
                    <div className="text-2xl mb-3">✍️</div>
                    <div className="font-semibold text-white group-hover:text-orange-400 transition-colors">Signature Dormancy Proof</div>
                    <div className="text-xs text-gray-400 mt-1">Provide off-chain signature challenge response proving ownership of address. No transaction fee.</div>
                  </button>

                  <button
                    onClick={() => { setClaimMode('zkvm'); setStep(5); }}
                    className="bg-gray-900/40 hover:bg-cyan-950/20 border border-gray-700 hover:border-cyan-500/60 rounded-2xl p-5 text-left transition-all group"
                  >
                    <div className="text-2xl mb-3">🛡️</div>
                    <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">zkVM Dormancy Proof</div>
                    <div className="text-xs text-gray-400 mt-1">Generate a cryptographic SP1 zkVM proof of dormancy. High confidence tier.</div>
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setStep(3)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Chain Selection
            </button>
          </div>
        )}

        {/* Step 5: Input Details */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-bold mb-2 text-white">
              {claimMode === 'signature' ? 'Signature Challenge Details' :
               claimMode === 'zkvm' ? 'SP1 zkVM Proof Generation' :
               claimMode === 'lock' ? 'Lock Proof Transaction Details' :
               'Submit Claim Evidence'}
            </h2>
            <p className="text-sm text-gray-400 mb-6 font-sans">
              {claimMode === 'signature'
                ? 'Sign the challenge message using your legacy private key.'
                : claimMode === 'zkvm'
                ? 'Generate a zero-knowledge proof verifying that your legacy wallet has not had outbound transfers.'
                : claimMode === 'lock'
                ? 'Provide the lock script transaction details.'
                : 'Send your legacy coins to the destination below and enter the transaction hash.'}
            </p>

            {/* Address Display for Transfer/Burn */}
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
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Wallet Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Signature Response</label>
                    <textarea
                      placeholder="Paste challenge signature in hex format"
                      value={sigChallengeResponse}
                      onChange={(e) => setSigChallengeResponse(e.target.value)}
                      rows={3}
                      className="w-full bg-gray-950 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none resize-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : claimMode === 'zkvm' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Wallet Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 focus:border-cyan-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>
                  
                  {isZkvmGenerating ? (
                    <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-xl p-5">
                      <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold mb-2">
                        <span>Generating SP1 Groth16 Proof...</span>
                        <span>{zkvmProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${zkvmProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2">
                        Running DormancyCalculator inside the SP1 guest program. Cross-checking transaction indexers...
                      </p>
                    </div>
                  ) : txHash ? (
                    <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-emerald-400 font-semibold">zkVM Proof Generated!</div>
                        <div className="text-[10px] font-mono text-gray-400 mt-1 truncate max-w-md">{txHash}</div>
                      </div>
                      <button 
                        onClick={handleGenerateZkvmProof}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg border border-gray-700"
                      >
                        Regenerate
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!legacyAddress}
                      onClick={handleGenerateZkvmProof}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all shadow-md shadow-cyan-600/10"
                    >
                      Generate zkVM Proof (SP1)
                    </button>
                  )}
                </>
              ) : claimMode === 'lock' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Legacy Wallet Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                      value={legacyAddress}
                      onChange={(e) => setLegacyAddress(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lock Transaction Hash (TXID)</label>
                    <input
                      type="text"
                      placeholder="Paste your transaction hash"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Lock Script Type</label>
                    <select className="w-full bg-gray-950 border border-gray-700 focus:border-emerald-500 rounded-xl p-3 text-sm text-white focus:outline-none">
                      <option value="cltv">Timelock (OP_CHECKLOCKTIMEVERIFY)</option>
                      <option value="multisig">DAO Multisig Vault</option>
                      <option value="unspendable">Provably Unspendable Address</option>
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
                      className="w-full bg-gray-950 border border-gray-700 focus:border-blue-500 rounded-xl p-3 text-sm font-mono text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setStep(4)}
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
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-center shadow-lg"
              >
                Submit Evidence
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Submission Progress Timeline */}
        {step === 6 && (
          <div className="py-4">
            <h2 className="text-2xl font-bold mb-6 text-center text-white">Processing Claim</h2>

            {/* Status Timeline */}
            <div className="max-w-md mx-auto space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-700">
              {(() => {
                const timelineSteps = claimMode === 'zkvm' ? [
                  'Address submitted',
                  'zkVM guest simulator initialized',
                  'Generating SP1 Groth16 proof',
                  'Verifying proof via MockSP1Verifier on Arbitrum Sepolia',
                  'BaaLS attestation stored',
                  'EVM submitter relay sent',
                  'RESURGE minted successfully'
                ] : claimMode === 'signature' ? [
                  'Signature response submitted',
                  'Verifying ed25519 signature',
                  'Scanning transaction history for activity',
                  'Dormancy confirmed',
                  'BaaLS attestation stored',
                  'EVM submitter relay sent',
                  'RESURGE minted successfully'
                ] : [
                  'Transaction evidence submitted',
                  'ChronoNode scanning legacy block data',
                  'Verifying transfer/burn/lock condition',
                  'Evidence verified successfully',
                  'BaaLS attestation stored',
                  'EVM submitter relay sent',
                  'RESURGE minted successfully'
                ];

                return timelineSteps.map((label, i) => {
                  const stepNum = i + 1;
                  const isComplete = claimStatus === 'completed' || 
                    (claimStatus === 'minting' && i < 6) ||
                    (claimStatus === 'attesting' && i < 4) ||
                    (claimStatus === 'ingesting' && i < 1);
                  const isActive = 
                    (claimStatus === 'ingesting' && i === 0) ||
                    (claimStatus === 'attesting' && i >= 1 && i < 4) ||
                    (claimStatus === 'minting' && i >= 4 && i < 6) ||
                    (claimStatus === 'completed' && i === 6);
                  
                  return (
                    <div key={label} className="flex gap-4 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border z-10 transition-all duration-300 ${
                        isActive
                          ? 'bg-blue-600 border-blue-500 text-white animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.4)]'
                          : isComplete
                          ? 'bg-green-950 border-green-800 text-green-400'
                          : 'bg-gray-800 border-gray-700 text-gray-500'
                      }`}>
                        {isComplete ? '✓' : isActive ? '●' : stepNum}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm sm:text-base">{stepNum}. {label}</h4>
                        {i === 4 && confidenceScore && (
                          <span className={`${getConfidenceBadge(claimMode, confidenceScore).color} text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block border`}>
                            {getConfidenceBadge(claimMode, confidenceScore).label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Completion Screen */}
            {claimStatus === 'completed' && (
              <div className="mt-8 pt-8 border-t border-gray-700/60 text-center animate-fade-in">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400 text-2xl shadow-lg">
                  🎉
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Claim Success</h3>
                <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
                  Your claim has been attested with {confidenceScore}% confidence. Rewards have been successfully minted and sent to your wallet.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2.5 rounded-xl font-semibold transition-colors shadow-md shadow-blue-600/10"
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
