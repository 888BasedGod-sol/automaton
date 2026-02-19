'use client';

import { FC, useState } from 'react';
import Link from 'next/link';
import { 
  Users, LayoutDashboard, Menu, X, Cpu, Wallet, 
  ChevronDown, Zap, Server, Activity, Network, MessageCircle
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-24 bg-accent-purple/30 rounded-lg animate-pulse" /> }
);

interface HeaderProps {
  showCreate?: boolean;
}

export const Header: FC<HeaderProps> = ({ showCreate = true }) => {
  const { connected, publicKey } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block">
              <span className="text-white">AUTOMATON</span>
              <span className="gradient-text">.CLOUD</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/agents" icon={<Users className="w-4 h-4" />}>Agents</NavLink>
            <NavLink href="/network" icon={<Network className="w-4 h-4" />}>Network</NavLink>
            <NavLink href="/communicate" icon={<MessageCircle className="w-4 h-4" />}>Communicate</NavLink>
            <NavLink href="/dashboard" icon={<Activity className="w-4 h-4" />}>Dashboard</NavLink>
            <NavLink href="/infrastructure" icon={<Server className="w-4 h-4" />}>Infrastructure</NavLink>
            
            {connected && (
              <NavLink href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} accent>
                My Agents
              </NavLink>
            )}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-3">
            {showCreate && (
              <Link 
                href="/create" 
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-lg transition-all text-sm font-medium"
              >
                <Zap className="w-4 h-4" />
                Deploy Agent
              </Link>
            )}
            
            <div className="wallet-button-wrapper">
              <WalletMultiButton style={{
                backgroundColor: connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.8)',
                borderRadius: '8px',
                fontSize: '13px',
                height: '38px',
                padding: '0 16px',
                border: connected ? '1px solid rgba(34, 197, 94, 0.3)' : 'none',
              }} />
            </div>

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-text-secondary hover:text-white hover:bg-surface-2 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-1">
          <div className="px-4 py-3 space-y-1">
            <MobileNavLink href="/agents" onClick={() => setMobileMenuOpen(false)}>Agents</MobileNavLink>
            <MobileNavLink href="/network" onClick={() => setMobileMenuOpen(false)}>Network</MobileNavLink>
            <MobileNavLink href="/communicate" onClick={() => setMobileMenuOpen(false)}>Communicate</MobileNavLink>
            <MobileNavLink href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</MobileNavLink>
            <MobileNavLink href="/infrastructure" onClick={() => setMobileMenuOpen(false)}>Infrastructure</MobileNavLink>
            <MobileNavLink href="/create" onClick={() => setMobileMenuOpen(false)} accent>Deploy Agent</MobileNavLink>
          </div>
        </div>
      )}
    </header>
  );
};

function NavLink({ href, children, icon, accent }: { href: string; children: React.ReactNode; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
        accent 
          ? 'text-accent-purple hover:bg-accent-purple/10' 
          : 'text-text-secondary hover:text-white hover:bg-surface-2'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick, accent }: { href: string; children: React.ReactNode; onClick: () => void; accent?: boolean }) {
  return (
    <Link 
      href={href} 
      onClick={onClick}
      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
        accent 
          ? 'text-accent-purple bg-accent-purple/10' 
          : 'text-text-secondary hover:text-white hover:bg-surface-2'
      }`}
    >
      {children}
    </Link>
  );
}

export default Header;
