import { Suspense } from 'react';
import PoolDetailClient from '@/components/PoolDetailClient';

export default function PoolDetailPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-gray-800 rounded-xl" />}>
      <PoolDetailClient />
    </Suspense>
  );
}
