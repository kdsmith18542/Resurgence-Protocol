import { ClientPage } from './ClientPage';

export function generateStaticParams() {
  return [
    { proofHash: '0x8bcda95e6ef64151687a447cba366250d3f4b1041bc73a9f06b6d410b981f59e0' },
    { proofHash: '0x9f81041bc73a9f06b6d410b981f59e0b8b5cf63b82f671c56a99655C3B1b8F10' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
