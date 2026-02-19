'use client';

import { FC } from 'react';
import Link from 'next/link';
import { Users, LayoutDashboard } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

// Dynamically import wallet button to avoid SSR issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-24 bg-purple-600/50 rounded-lg animate-pulse" /> }
);

interface HeaderProps {
  showCreate?: boolean;
}

export const Header: FC<HeaderProps> = ({ showCreate = true }) => {
  const { connected, publicKey } = useWallet();

  return (
    <header className="relative border-b border-white/10 backdrop-blur-sm sticky top-0 z-20 bg-black/90">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-1">
          AUTOMATON<span className="text-purple-400">CLOUD</span>
        </Link>
        
        <nav className="flex items-center gap-4 text-sm text-white/60">
          <Link href="/explore" className="hover:text-white transition-colors hidden sm:block">
            Explore
          </Link>
          <Link href="/agents" className="hover:text-white transition-colors flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Agents</span>
          </Link>
          
          {connected && publicKey && (
            <Link 
              href="/dashboard" 
              className="hover:text-white transition-colors flex items-center gap-1 text-purple-400/80 hover:text-purple-400"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">My Agents</span>
            </Link>
          )}
          
          <Link href="/credits" className="hover:text-white transition-colors text-green-400/80 hover:text-green-400 hidden sm:block">
            Buy Credits
          </Link>
          
          {showCreate && (
            <Link href="/create" className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-xs sm:text-sm">
              Deploy
            </Link>
          )}
          
          <div className="wallet-button-wrapper">
            <WalletMultiButton style={{
              backgroundColor: connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(147, 51, 234, 0.8)',
              borderRadius: '8px',
              fontSize: '12px',
              height: '36px',
              padding: '0 12px',
            }} />
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;
