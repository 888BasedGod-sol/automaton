'use client';

import dynamic from 'next/dynamic';

// Dynamically import the WalletMultiButton to avoid SSR issues
export const WalletButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-32 bg-purple-600/50 rounded-lg animate-pulse" /> }
);

export default WalletButton;
