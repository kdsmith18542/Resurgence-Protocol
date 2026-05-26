'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function RewardsEmissionsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 py-10 max-w-4xl mx-auto text-left">
        <div className="h-10 bg-gray-800 rounded-xl w-64"></div>
        <div className="h-48 bg-gray-800 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left max-w-4xl mx-auto py-6">
      <div className="text-sm text-gray-400 flex items-center gap-2">
        <Link href="/resurgence" className="hover:text-white transition-colors">Explorer</Link>
        <span>/</span>
        <span className="text-white font-medium">Reward Emissions</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Reward Emissions</h1>
        <p className="text-gray-400 text-sm">
          Track emission rates, distribution status, and reward multiplier configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Total Rewards Minted</p>
          <p className="text-2xl font-bold text-green-400 mt-1">1,248,015 RESURGE</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <p className="text-xs text-gray-400">Emission Multiplier</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">1.25x (Active)</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
        <h3 className="text-lg font-semibold text-white">Emission Specs</h3>
        <div className="text-sm text-gray-400 space-y-3">
          <div className="flex justify-between border-b border-gray-700/60 pb-2">
            <span>Reward Rate Per Second</span>
            <span className="text-white font-mono">0.05 RESURGE</span>
          </div>
          <div className="flex justify-between border-b border-gray-700/60 pb-2">
            <span>Emission Cap</span>
            <span className="text-white font-mono">10,000,000 RESURGE</span>
          </div>
          <div className="flex justify-between pb-2">
            <span>Reward Distribution Address</span>
            <span className="text-white font-mono text-xs">0x99655C3B1b8F1041BC71C56X917088d3745f3F4F</span>
          </div>
        </div>
      </div>
    </div>
  );
}
