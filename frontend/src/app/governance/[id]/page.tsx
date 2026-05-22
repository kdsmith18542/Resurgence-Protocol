import ProposalDetailClient from '@/components/ProposalDetailClient';

export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

export default function ProposalDetailPage() {
  return <ProposalDetailClient />;
}
