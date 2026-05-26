'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function OracleStatusPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
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
        <span className="text-white font-medium">Oracle Status</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Oracle Registries</h1>
        <p className="text-gray-400 text-sm">
          Review non-EVM watched network integrations and active dormancy proof verify checkpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/resurgence/oracle/non-evm" className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-500 transition-colors flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Non-EVM Registries</h3>
            <p className="text-sm text-gray-400">List of registered non-EVM wallets, dormancy status, and cross-chain bridge maps.</p>
          </div>
          <span className="text-blue-400 text-xs font-semibold uppercase mt-4">Inspect Non-EVM →</span>
        </Link>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-2">Active Oracle Validators</h3>
          <div className="text-sm text-gray-400 space-y-2 pt-2">
            <div className="flex justify-between border-b border-gray-700/60 pb-1">
              <span>Total Validators</span>
              <span className="text-white font-semibold">3 validators</span>
            </div>
            <div className="flex justify-between">
              <span>Threshold Status</span>
              <span className="text-white font-semibold">Quorum Active (2/3 signatures)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
