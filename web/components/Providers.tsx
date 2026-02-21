'use client';

import { FC, ReactNode } from 'react';
import WalletProvider from './WalletProvider';
import { EvmProvider } from './EvmProvider';

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
