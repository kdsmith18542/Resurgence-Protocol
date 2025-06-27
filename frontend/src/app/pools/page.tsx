import { useAccount } from 'wagmi';

export default function PoolsPage() {
  const { isConnected } = useAccount();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-white">Staking Pools</h1>

      {!isConnected ? (
        <p className="text-center text-xl text-gray-400">Please connect your wallet to view staking pools.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Placeholder for individual staking pool cards */}
          <div className="bg-gray-700 p-6 rounded-lg shadow-lg text-white">
            <h2 className="text-2xl font-semibold mb-2">DEAD Coin Staking Pool A</h2>
            <p className="text-gray-300"><strong>Dead Coin:</strong> DEAD Token</p>
            <p className="text-gray-300"><strong>Current APR:</strong> 0%</p>
            <p className="text-gray-300"><strong>Your Staked:</strong> 0 DEAD</p>
            <p className="text-gray-300 mb-4"><strong>Pending Rewards:</strong> 0 RESURGE</p>
            <div className="flex justify-around space-x-2">
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Stake</button>
              <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">Unstake</button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Claim Rewards</button>
            </div>
          </div>

          <div className="bg-gray-700 p-6 rounded-lg shadow-lg text-white">
            <h2 className="text-2xl font-semibold mb-2">DEAD Coin Staking Pool B</h2>
            <p className="text-gray-300"><strong>Dead Coin:</strong> DEAD Token</p>
            <p className="text-gray-300"><strong>Current APR:</strong> 0%</p>
            <p className="text-gray-300"><strong>Your Staked:</strong> 0 DEAD</p>
            <p className="text-gray-300 mb-4"><strong>Pending Rewards:</strong> 0 RESURGE</p>
            <div className="flex justify-around space-x-2">
              <button className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Stake</button>
              <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">Unstake</button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">Claim Rewards</button>
            </div>
          </div>

          {/* TODO: Dynamically load staking pools based on deployed contracts */}
        </div>
      )}
    </div>
  );
} 