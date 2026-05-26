import { ClientPage } from './ClientPage';

export function generateStaticParams() {
  return [
    { messageId: 'ccip-msg-10252' },
    { messageId: 'ccip-msg-10253' }
  ];
}

export default function Page() {
  return <ClientPage />;
}
