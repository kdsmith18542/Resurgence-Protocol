import { useAccount } from 'wagmi';

export default function GovernancePage() {
  const { isConnected } = useAccount();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 text-center text-white">Governance Proposals</h1>

      {!isConnected ? (
        <p className="text-center text-xl text-gray-400">Please connect your wallet to view governance proposals.</p>
      ) : (
        <div className="space-y-6">
          {/* Create Proposal Button */}
          <div className="flex justify-end">
            <button className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-lg">
              Create New Proposal
            </button>
          </div>

          {/* Active Proposals Section */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Active Proposals</h2>
            <div className="space-y-4">
              {/* Placeholder for individual proposal card */}
              <div className="bg-gray-800 p-4 rounded-md text-white">
                <h3 className="font-bold text-xl mb-1">Proposal: Adjust Reward Rate for Pool X</h3>
                <p className="text-gray-300 text-sm mb-2">Proposer: 0xAbC...123</p>
                <p className="text-gray-400">Status: Active</p>
                <p className="text-gray-400 mb-2">Voting Ends: June 30, 2025</p>
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">View & Vote</button>
              </div>
              {/* TODO: Dynamically load active proposals */}
            </div>
          </section>

          {/* Pending Proposals Section */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Pending Proposals</h2>
            <p className="text-gray-300">No pending proposals at the moment.</p>
            {/* TODO: Dynamically load pending proposals */}
          </section>

          {/* Executed Proposals Section */}
          <section className="bg-gray-700 p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-white">Executed Proposals</h2>
            <p className="text-gray-300">No executed proposals at the moment.</p>
            {/* TODO: Dynamically load executed proposals */}
          </section>
        </div>
      )}
    </div>
  );
} 