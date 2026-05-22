import PoolDetailClient from '@/components/PoolDetailClient';

export function generateStaticParams(): Array<{ address: string }> {
  return [];
}

export default function PoolDetailPage() {
  return <PoolDetailClient />;
}
