import { ClientPage } from './ClientPage';

export function generateStaticParams() {
  return [
    { proposalId: '1' },
    { proposalId: '2' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
