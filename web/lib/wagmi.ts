'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, mainnet } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Automaton Cloud',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || 'demo_project_id', // Get one from Cloud WalletConnect
  chains: [base, mainnet],
  ssr: true,
});
