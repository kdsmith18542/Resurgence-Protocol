import { ClientPage } from './ClientPage';

export function generateStaticParams() {
  return [
    { poolAddress: '0x71C56X917088d3745f3F4F19C8b8F1041BC73a9f' },
    { poolAddress: '0x99655C3B1b8F1041BC71C56X917088d3745f3F4F' },
    { poolAddress: '0x201624cBa366250D08bCdA95e6eF64151687A447' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
