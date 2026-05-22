'use client';
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}

export default function StatCard({ label, value, sub, loading }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-24 bg-gray-700 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold text-white">{value}</p>
      )}
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}
