import { ClientPage } from './ClientPage';

export function generateStaticParams() {
  return [
    { address: '0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f' },
    { address: '0x99655C3B1b8F1041BC71C56X917088d3745f3F4F' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
