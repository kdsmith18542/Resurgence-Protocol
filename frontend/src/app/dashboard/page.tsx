import { useAccount } from 'wagmi';
import { useResurgenceProtocolStore } from '../../components/store';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { resurgePrice, setResurgePrice } = useResurgenceProtocolStore();

  // Mock data for active staking pools
  const activeStakingPools = [
    { id: 1, name: 'DEAD Coin Pool A', apr: '10%', tvl: '$1,000,000', address: '0x123...abc' },
    { id: 2, name: 'XYZ Coin Pool B', apr: '12%', tvl: '$750,000', address: '0x456...def' },
    { id: 3, name: 'MNO Coin Pool C', apr: '8%', tvl: '$500,000', address: '0x789...ghi' },
  ];

  useEffect(() => {
    // Placeholder for fetching RESURGE price from a DEX API
    // For now, setting a mock price.
    const mockPrice = 0.05;
    setResurgePrice(mockPrice);
  }, [setResurgePrice]);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-white">Dashboard</h1>

      {!isConnected ? (
        <p className="text-center text-xl text-gray-400">Please connect your wallet to view your dashboard.</p>
      ) : (
        <div className="space-y-8">
          {/* User Aggregated Stats */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Your Stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg text-gray-300">
              <p><strong>Wallet Address:</strong> {address}</p>
              <p><strong>Total RESURGE Earned:</strong> 0 RESURGE (placeholder)</p>
              <p><strong>Total Dead Coins Staked:</strong> 0 (placeholder)</p>
              {/* TODO: Add more detailed user stats */}
            </div>
          </section>

          {/* Active Staking Pools Summary */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Active Staking Pools</h2>
            <p className="text-lg text-gray-300">Summary of currently active staking pools:</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeStakingPools.map((pool) => (
                <Link key={pool.id} href={`/pools/${pool.address}`}>
                  <div className="bg-gray-800 p-4 rounded-md text-white cursor-pointer hover:bg-gray-600 transition-colors">
                    <h3 className="font-bold text-xl mb-2">{pool.name}</h3>
                    <p className="text-gray-400">APR: {pool.apr}</p>
                    <p className="text-gray-400">TVL: {pool.tvl}</p>
                    <p className="text-sm text-blue-400 mt-2">View Details &rarr;</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* RESURGE Price Information */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">RESURGE Token Price</h2>
            <p className="text-lg text-gray-300">Current RESURGE price: ${resurgePrice !== null ? resurgePrice.toFixed(4) : 'Loading...'}</p>
            {/* TODO: Fetch and display live RESURGE price from DEX API */}
          </section>
        </div>
      )}
    </div>
  );
} 