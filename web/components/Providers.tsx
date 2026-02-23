'use client';

import { FC, ReactNode } from 'react';
import WalletProvider from './WalletProvider';
import { EvmProvider } from './EvmProvider';
import { ToastProvider } from './Toast';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: FC<ProvidersProps> = ({ children }) => {
  return (
    <EvmProvider>
      <WalletProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </WalletProvider>
    </EvmProvider>
  );
};

export default Providers;
