'use client';

import { FC, ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import WalletProvider to avoid SSR issues
const WalletProvider = dynamic(
  () => import('./WalletProvider'),
  { ssr: false }
);

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <WalletProvider>
      {children}
    </WalletProvider>
  );
};

export default Providers;
