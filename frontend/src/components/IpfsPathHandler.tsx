'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IpfsPathHandler() {
  const router = useRouter();

  useEffect(() => {
    const redirectPath = (window as any).__IPFS_REDIRECT;
    if (redirectPath && typeof redirectPath === 'string' && redirectPath !== '/') {
      router.replace(redirectPath);
    }
  }, [router]);

  return null;
}
