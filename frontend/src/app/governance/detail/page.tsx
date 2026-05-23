import { Suspense } from 'react';
import ProposalDetailClient from '@/components/ProposalDetailClient';

export default function ProposalDetailPage() {
  return (
    <Suspense fallback={<div className="animate-pulse h-64 bg-gray-800 rounded-xl" />}>
      <ProposalDetailClient />
    </Suspense>
  );
}
