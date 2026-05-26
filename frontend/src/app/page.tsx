import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Resurgence Protocol
      </h1>
      <p className="text-xl text-gray-400 mb-8 max-w-2xl">
        Proof-of-Dormancy Staking — give abandoned ERC-20 tokens a second life.
        Stake dead coins, earn RESURGE rewards, governed by the community.
      </p>
      <div className="flex gap-4">
        <Link href="/resurgence" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-6 py-3 rounded-xl font-medium transition-colors">
          Open Protocol Explorer
        </Link>
        <Link href="/dashboard" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-medium border border-gray-700 transition-colors">
          Enter Dashboard
        </Link>
        <Link href="/pools" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-medium border border-gray-700 transition-colors">
          View Pools
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Stake Dead Coins</h3>
          <p className="text-sm text-gray-400">Deposit abandoned ERC-20 tokens and earn continuous RESURGE rewards.</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Earn RESURGE</h3>
          <p className="text-sm text-gray-400">Rewards accrue per-second. Claim anytime. The longer you stake, the more you earn.</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Govern the Protocol</h3>
          <p className="text-sm text-gray-400">RESURGE holders vote on pool additions, reward rates, and protocol parameters.</p>
        </div>
      </div>
    </div>
  );
}
