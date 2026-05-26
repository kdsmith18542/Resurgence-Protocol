'use client';
import { useAccount, useChainId, useWriteContract, useReadContract, useReadContracts } from 'wagmi';
import { useState, useEffect, useMemo } from 'react';
import { PoolInfo } from '@/types';
import PoolCard from '@/components/PoolCard';
import StakeModal from '@/components/StakeModal';
import UnstakeModal from '@/components/UnstakeModal';
import ClaimModal from '@/components/ClaimModal';
import { LoadingSpinner } from '@/components/StateComponents';
import { useErc20Balance } from '@/hooks/useTokenData';
import { ABIS } from '@/lib/abis';
import { formatUSD } from '@/lib/utils';
import { fetchPoolsWithUserPosition, getSubgraphUrl } from '@/lib/graphql';
import { isSpokeChain, CHAIN_NAMES, getContractAddress } from '@/lib/contracts';
import { stringToHex, pad } from 'viem';

export default function PoolsPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [stakePool, setStakePool] = useState<PoolInfo | null>(null);
  const [unstakePool, setUnstakePool] = useState<PoolInfo | null>(null);
  const [claimPool, setClaimPool] = useState<PoolInfo | null>(null);
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const isSpoke = isSpokeChain(chainId);
  const subgraphAvailable = !!getSubgraphUrl(chainId);
  const chainName = CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;

  useEffect(() => {
    setLoading(true);
    setPools([]);
    if (!subgraphAvailable) {
      setLoading(false);
      return;
    }
    (async () => {
      const subgraphData = await fetchPoolsWithUserPosition(address || '', chainId);
      if (subgraphData) {
        setPools(subgraphData.map(p => ({
          address: p.poolAddress,
          deadCoinAddress: p.deadCoinToken,
          deadCoinName: p.deadCoinToken.slice(0, 10),
          deadCoinSymbol: '',
          stakedAmount: BigInt(p.position?.stakedAmount || '0'),
          totalStaked: BigInt(p.totalStaked),
          rewardRate: BigInt(p.rewardRatePerSecond),
          userRewards: BigInt(p.position?.unclaimedRewards || '0'),
          tvl: Number(BigInt(p.totalStaked) / BigInt(1e18)),
          apr: Number(BigInt(p.rewardRatePerSecond) * 365n * 86400n) / Number(BigInt(p.totalStaked || 1n)) * 100,
          stakerCount: Number(p.stakerCount || '0'),
          createdAt: p.createdAt || '',
        })));
      }
      setLoading(false);
    })();
  }, [address, chainId, subgraphAvailable]);

  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

  // For pools where the subgraph couldn't resolve deadCoinToken (bootstrapped pools),
  // fetch the actual address directly from the contract.
  const zeroDeadCoinIndices = useMemo(
    () => pools.reduce<number[]>((acc, p, i) => {
      if (p.deadCoinAddress === ZERO_ADDR) acc.push(i);
      return acc;
    }, []),
    [pools]
  );

  const { data: resolvedDeadCoins } = useReadContracts({
    contracts: zeroDeadCoinIndices.map(i => ({
      abi: ABIS.DeadCoinStakingPool,
      address: pools[i].address as `0x${string}`,
      functionName: 'deadCoin' as const,
    })),
    query: { enabled: zeroDeadCoinIndices.length > 0 },
  });

  const poolsWithResolvedDeadCoins = useMemo(() => {
    if (!resolvedDeadCoins || zeroDeadCoinIndices.length === 0) return pools;
    return pools.map((pool, i) => {
      const resolvedIdx = zeroDeadCoinIndices.indexOf(i);
      if (resolvedIdx === -1) return pool;
      const resolved = resolvedDeadCoins[resolvedIdx]?.result as string | undefined;
      if (!resolved || resolved === ZERO_ADDR) return pool;
      return { ...pool, deadCoinAddress: resolved, deadCoinName: resolved.slice(0, 10) };
    });
  }, [pools, resolvedDeadCoins, zeroDeadCoinIndices]);

  const deadCoinAddresses = useMemo(
    () => poolsWithResolvedDeadCoins
      .map(p => p.deadCoinAddress as `0x${string}`)
      .filter(a => !!a && a !== ZERO_ADDR),
    [poolsWithResolvedDeadCoins]
  );

  const { data: symbolResults } = useReadContracts({
    contracts: deadCoinAddresses.map(addr => ({
      abi: ABIS.Erc20,
      address: addr,
      functionName: 'symbol',
    })),
    query: { enabled: deadCoinAddresses.length > 0 },
  });

  const poolsWithSymbols = useMemo(() =>
    poolsWithResolvedDeadCoins.map((pool, i) => {
      const dcAddr = pool.deadCoinAddress;
      const addrIdx = dcAddr && dcAddr !== ZERO_ADDR
        ? deadCoinAddresses.indexOf(dcAddr as `0x${string}`)
        : -1;
      return {
        ...pool,
        deadCoinSymbol: addrIdx >= 0 ? ((symbolResults?.[addrIdx]?.result as string) || '???') : '???',
      };
    }),
    [poolsWithResolvedDeadCoins, deadCoinAddresses, symbolResults]
  );

  const totalTVL = useMemo(() =>
    poolsWithSymbols.reduce((sum, p) => sum + p.tvl, 0),
    [poolsWithSymbols]
  );

  const selectedDeadCoinAddress = (stakePool || unstakePool)?.deadCoinAddress as `0x${string}` | undefined;
  const { data: selectedBalance } = useErc20Balance(selectedDeadCoinAddress, address as `0x${string}`);

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h1 className="text-3xl font-bold mb-4">Staking Pools</h1>
        <p className="text-gray-400">Connect your wallet to view and interact with staking pools.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Staking Pools</h1>
        <LoadingSpinner label="Loading pools..." />
      </div>
    );
  }

  const displayPools = poolsWithSymbols.length > 0 ? poolsWithSymbols : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold">Staking Pools</h1>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${isSpoke ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'}`}>
              {isSpoke ? `SPOKE · ${chainName}` : `HUB · ${chainName}`}
            </span>
          </div>
          <p className="text-gray-400 mt-1">
            {isSpoke
              ? `Stake dead tokens on ${chainName}. Rewards bridge to Arbitrum via CCIP.`
              : 'Stake abandoned ERC-20 tokens and earn RESURGE rewards directly.'
            }
          </p>
        </div>
        {displayPools.length > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-400">{formatUSD(totalTVL)}</p>
            <p className="text-sm text-gray-400">Total TVL</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-white">{displayPools.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Pools</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-white">{displayPools.reduce((s, p) => s + p.stakerCount, 0)}</p>
          <p className="text-xs text-gray-400 mt-1">Total Stakers</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-green-400">{displayPools.filter(p => p.stakedAmount > 0n).length}</p>
          <p className="text-xs text-gray-400 mt-1">Your Pools</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 text-center">
          <p className="text-xl font-bold text-blue-400">{displayPools.filter(p => p.apr > 0).length}</p>
          <p className="text-xs text-gray-400 mt-1">Active Rewards</p>
        </div>
      </div>

      {!subgraphAvailable ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-yellow-400 font-medium">Subgraph not yet indexed for {chainName}</p>
          <p className="text-gray-500 text-sm mt-2">
            Spoke deployment pending. Once deployed and the subgraph is synced, pools will appear here.
          </p>
          {isSpoke && (
            <p className="text-gray-600 text-xs mt-3">
              Hub: Arbitrum One / Arbitrum Sepolia &mdash; Rewards mint there after bridge claim.
            </p>
          )}
        </div>
      ) : displayPools.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-xl border border-gray-700">
          <p className="text-gray-400">No staking pools available yet on {chainName}.</p>
          <p className="text-gray-500 text-sm mt-2">Pools will appear here once deployed and indexed by the subgraph.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayPools.map((pool) => (
            <PoolCard
              key={pool.address}
              pool={pool}
              isSpoke={isSpoke}
              onStake={() => setStakePool(pool)}
              onUnstake={() => setUnstakePool(pool)}
              onClaim={() => setClaimPool(pool)}
            />
          ))}
        </div>
      )}

      {stakePool && (
        <StakeModal
          isOpen={!!stakePool}
          onClose={() => setStakePool(null)}
          poolAddress={stakePool.address as `0x${string}`}
          deadCoinAddress={stakePool.deadCoinAddress as `0x${string}`}
          userBalance={(selectedBalance as bigint) || 0n}
          userStaked={stakePool.stakedAmount}
          tokenSymbol={stakePool.deadCoinSymbol}
        />
      )}
      {unstakePool && (
        <UnstakeModal
          isOpen={!!unstakePool}
          onClose={() => setUnstakePool(null)}
          poolAddress={unstakePool.address as `0x${string}`}
          stakedAmount={unstakePool.stakedAmount}
          tokenSymbol={unstakePool.deadCoinSymbol}
        />
      )}
      {claimPool && (
        <ClaimModal
          isOpen={!!claimPool}
          onClose={() => setClaimPool(null)}
          poolAddress={claimPool.address as `0x${string}`}
          pendingRewards={claimPool.userRewards}
          isBridgeClaim={isSpoke}
        />
      )}

      <NonEvmStakingPanel />
    </div>
  );
}

const CHRONONODE_URL = (process.env.NEXT_PUBLIC_CHRONONODE_URL || '').replace(/\/$/, '');

function NonEvmStakingPanel() {
  const { address } = useAccount();
  const chainId = useChainId();
  const nonEvmPoolAddress = getContractAddress(chainId, 'NonEvmStakingPool');

  const [localWallets, setLocalWallets] = useState<{ chain: string; address: string }[]>([]);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletChain, setNewWalletChain] = useState<'bitcoin' | 'dogecoin'>('bitcoin');
  const [simulatedDormancy, setSimulatedDormancy] = useState<Record<string, boolean>>({});
  const [simulatedAttested, setSimulatedAttested] = useState<Record<string, boolean>>({});
  const [loadingWallets, setLoadingWallets] = useState<Record<string, boolean>>({});
  const [walletStatus, setWalletStatus] = useState<Record<string, { status: string; dormantSince?: number; threshold?: number }>>({});
  const [isSimMode, setIsSimMode] = useState(!CHRONONODE_URL);
  const [attestMessages, setAttestMessages] = useState<Record<string, { ok: boolean; text: string }>>({});

  // Load from local storage
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`resurgence_non_evm_wallets_${address}`);
      if (stored) {
        try {
          setLocalWallets(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [address]);

  // Save to local storage helper
  const saveWallets = (wallets: { chain: string; address: string }[]) => {
    setLocalWallets(wallets);
    if (address) {
      localStorage.setItem(`resurgence_non_evm_wallets_${address}`, JSON.stringify(wallets));
    }
  };

  // Batch on-chain isRegistered check for all saved wallets
  const registrationReads = useMemo(() =>
    nonEvmPoolAddress ? localWallets.map(w => ({
      abi: ABIS.NonEvmStakingPool,
      address: nonEvmPoolAddress as `0x${string}`,
      functionName: 'isRegistered' as const,
      args: [pad(stringToHex(w.chain), { dir: 'right', size: 32 }), w.address] as const,
    })) : [],
  [localWallets, nonEvmPoolAddress]);

  const { data: registrationData } = useReadContracts({
    contracts: registrationReads,
    query: { enabled: !!nonEvmPoolAddress && localWallets.length > 0, refetchInterval: 30_000 },
  });

  const onChainRegistered = useMemo(() => {
    const map: Record<string, boolean> = {};
    registrationData?.forEach((result, i) => {
      if (result.status === 'success') {
        const w = localWallets[i];
        map[`${w.chain}:${w.address}`] = result.result as boolean;
      }
    });
    return map;
  }, [registrationData, localWallets]);

  // Wagmi Write Contract
  const { writeContract: writeRegistry } = useWriteContract();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletAddress || !address) return;

    const chainBytes32 = pad(stringToHex(newWalletChain), { dir: 'right', size: 32 });

    try {
      writeRegistry({
        abi: ABIS.NonEvmStakingPool,
        address: nonEvmPoolAddress as `0x${string}`,
        functionName: 'registerWallet',
        args: [chainBytes32, newWalletAddress],
      });

      const exists = localWallets.some(w => w.address.toLowerCase() === newWalletAddress.toLowerCase() && w.chain === newWalletChain);
      if (!exists) {
        saveWallets([...localWallets, { chain: newWalletChain, address: newWalletAddress }]);
      }
      setNewWalletAddress('');
    } catch (err) {
      console.error("Registration error:", err);
    }
  };

  const handleUnregister = (chain: string, walletAddr: string) => {
    const chainBytes32 = pad(stringToHex(chain), { dir: 'right', size: 32 });
    writeRegistry({
      abi: ABIS.NonEvmStakingPool,
      address: nonEvmPoolAddress as `0x${string}`,
      functionName: 'unregisterWallet',
      args: [chainBytes32, walletAddr],
    });

    const updated = localWallets.filter(w => !(w.address.toLowerCase() === walletAddr.toLowerCase() && w.chain === chain));
    saveWallets(updated);
  };

  // Poll ChronoNode for dormancy status (30s — data changes slowly)
  useEffect(() => {
    if (localWallets.length === 0) return;

    const fetchStatuses = async () => {
      const newStatusMap: typeof walletStatus = {};
      for (const w of localWallets) {
        if (isSimMode) {
          newStatusMap[`${w.chain}:${w.address}`] = {
            status: simulatedAttested[w.address] ? 'attested' : simulatedDormancy[w.address] ? 'dormant' : 'active',
            dormantSince: 500000,
            threshold: 26280,
          };
        } else {
          try {
            const res = await fetch(`${CHRONONODE_URL}/v1/chains/${w.chain}/addresses/${w.address}/dormancy`);
            if (res.ok) {
              const data = await res.json();
              newStatusMap[`${w.chain}:${w.address}`] = {
                status: data.status,
                dormantSince: data.dormant_since_block,
                threshold: data.threshold_blocks,
              };
            } else {
              newStatusMap[`${w.chain}:${w.address}`] = { status: 'offline' };
            }
          } catch {
            newStatusMap[`${w.chain}:${w.address}`] = { status: 'offline' };
          }
        }
      }
      setWalletStatus(prev => ({ ...prev, ...newStatusMap }));
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 30_000);
    return () => clearInterval(interval);
  }, [localWallets, isSimMode, simulatedDormancy, simulatedAttested]);

  const triggerAttestation = async (chain: string, walletAddr: string) => {
    const key = `${chain}:${walletAddr}`;
    setLoadingWallets(prev => ({ ...prev, [walletAddr]: true }));
    setAttestMessages(prev => ({ ...prev, [key]: { ok: true, text: '' } }));

    if (isSimMode) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSimulatedAttested(prev => ({ ...prev, [walletAddr]: true }));
      setLoadingWallets(prev => ({ ...prev, [walletAddr]: false }));
      setAttestMessages(prev => ({ ...prev, [key]: { ok: true, text: 'Simulation: attestation submitted — 1,000 RESURGE will be minted.' } }));
      return;
    }

    try {
      const res = await fetch(`${CHRONONODE_URL}/v1/attestations/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain_id: chain, address: walletAddr, evm_wallet: address }),
      });
      const data = await res.json();
      if (res.ok) {
        setAttestMessages(prev => ({ ...prev, [key]: { ok: true, text: `Attestation submitted — 1,000 RESURGE minting. BaaLS sig: ${(data.baals_sig || data.tx_hash || 'ok').slice(0, 12)}…` } }));
      } else {
        setAttestMessages(prev => ({ ...prev, [key]: { ok: false, text: data.message || 'Submission failed.' } }));
      }
    } catch (e) {
      setAttestMessages(prev => ({ ...prev, [key]: { ok: false, text: `Network error: ${e}` } }));
    } finally {
      setLoadingWallets(prev => ({ ...prev, [walletAddr]: false }));
    }
  };

  if (!nonEvmPoolAddress) return null;

  return (
    <div className="mt-12 bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-md border border-gray-700/60 rounded-2xl p-6 shadow-2xl relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-700/60 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Non-EVM Dormancy Rewards</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 animate-pulse">
              1,000 RESURGE
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Register your Bitcoin or Dogecoin wallets. Claim rewards when ChronoNode verifies they have gone dormant.
          </p>
        </div>

        {CHRONONODE_URL && (
          <div className="flex items-center gap-3 bg-gray-900/40 p-1.5 rounded-lg border border-gray-700/40 self-start md:self-auto">
            <span className="text-xs text-gray-400 font-medium pl-2">Mode:</span>
            <button
              onClick={() => setIsSimMode(false)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${!isSimMode ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Live Node
            </button>
            <button
              onClick={() => setIsSimMode(true)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-all ${isSimMode ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Simulation
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-gray-900/30 p-5 rounded-xl border border-gray-700/40">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Register Wallet</h3>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Network</label>
              <select
                value={newWalletChain}
                onChange={(e) => setNewWalletChain(e.target.value as any)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              >
                <option value="bitcoin">Bitcoin (BTC)</option>
                <option value="dogecoin">Dogecoin (DOGE)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 font-medium mb-1.5">Wallet Address</label>
              <input
                type="text"
                placeholder="e.g. 1A1zP1eP5QGefi2..."
                value={newWalletAddress}
                onChange={(e) => setNewWalletAddress(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!newWalletAddress || !address}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-blue-600/10"
            >
              {address ? 'Register on EVM' : 'Connect Wallet to Register'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Registered Wallets</h3>
          {localWallets.length === 0 ? (
            <div className="text-center py-10 bg-gray-900/20 rounded-xl border border-dashed border-gray-700/60 flex flex-col items-center justify-center">
              <svg className="w-10 h-10 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm text-gray-500">No Non-EVM wallets registered yet.</p>
              <p className="text-xs text-gray-600 mt-1">Register a wallet to begin monitoring for inactivity rewards.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {localWallets.map((wallet) => {
                const mapKey = `${wallet.chain}:${wallet.address}`;
                const statusInfo = walletStatus[mapKey] || { status: 'loading' };
                const isLoading = loadingWallets[wallet.address];
                const isOnChain = onChainRegistered[mapKey];
                const attestMsg = attestMessages[mapKey];

                const chainColor = wallet.chain === 'bitcoin' ? 'from-amber-500 to-orange-600 text-amber-500' :
                                   'from-yellow-400 to-amber-500 text-yellow-400';

                return (
                  <div key={mapKey} className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4 flex flex-col gap-3 transition-all hover:border-gray-600/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${chainColor} bg-opacity-10 flex items-center justify-center font-bold text-lg border border-opacity-20 border-white shrink-0`}>
                          {wallet.chain[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-semibold text-white text-sm capitalize">{wallet.chain}</span>
                            {isOnChain === true && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                ✓ On-Chain
                              </span>
                            )}
                            {isOnChain === false && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                Pending Confirmation
                              </span>
                            )}
                            {statusInfo.status === 'active' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Active (Monitoring)
                              </span>
                            )}
                            {statusInfo.status === 'dormant' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                                Dormant — Claimable!
                              </span>
                            )}
                            {statusInfo.status === 'attested' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Attested
                              </span>
                            )}
                            {statusInfo.status === 'offline' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                                Node Offline
                              </span>
                            )}
                            {statusInfo.status === 'loading' && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                                Checking…
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-xs mt-1 font-mono truncate max-w-[260px]">{wallet.address}</p>
                          {statusInfo.dormantSince !== undefined && statusInfo.dormantSince > 0 && (
                            <p className="text-gray-600 text-[10px] mt-0.5">
                              Dormant since block {statusInfo.dormantSince.toLocaleString()} · threshold {(statusInfo.threshold ?? 0).toLocaleString()} blocks
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {isSimMode && (
                          <button
                            onClick={() => setSimulatedDormancy(prev => ({ ...prev, [wallet.address]: !prev[wallet.address] }))}
                            className={`px-2 py-0.5 rounded text-[10px] border transition-all ${simulatedDormancy[wallet.address] ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-gray-950 text-gray-500 border-gray-800 hover:text-gray-300'}`}
                          >
                            Sim Dormant
                          </button>
                        )}

                        {statusInfo.status === 'dormant' && (
                          <button
                            disabled={isLoading}
                            onClick={() => triggerAttestation(wallet.chain, wallet.address)}
                            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 disabled:opacity-60 text-white text-xs font-semibold py-1.5 px-3.5 rounded-lg shadow-lg shadow-emerald-500/15 flex items-center gap-1.5 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {isLoading ? 'Attesting…' : 'Claim 1,000 RESURGE'}
                          </button>
                        )}

                        {statusInfo.status === 'attested' && !attestMsg && (
                          <span className="text-xs font-semibold text-purple-400 flex items-center gap-1 bg-purple-950/20 border border-purple-900/30 px-2.5 py-1 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Rewards Claimed
                          </span>
                        )}

                        <button
                          onClick={() => handleUnregister(wallet.chain, wallet.address)}
                          className="text-gray-600 hover:text-red-400 p-1.5 rounded hover:bg-gray-800/40 transition-all"
                          title="Unregister wallet"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {attestMsg?.text && (
                      <div className={`text-xs px-3 py-2 rounded-lg border ${attestMsg.ok ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300' : 'bg-red-950/30 border-red-800/40 text-red-300'}`}>
                        {attestMsg.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
