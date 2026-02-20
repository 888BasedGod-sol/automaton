'use client';

import { FC, ReactNode } from 'react';
import dynamic from 'next/dynamic';

const WalletProvider = dynamic(() => import('./WalletProvider'), { ssr: false });
const EvmProvider = dynamic(() => import('./EvmProvider').then(mod => mod.EvmProvider), { ssr: false });

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <EvmProvider>
      <WalletProvider>
        {children}
      </WalletProvider>
    </EvmProvider>
  );
};

export default Providers;
