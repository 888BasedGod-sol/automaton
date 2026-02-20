'use client';

import { FC, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, X, Cpu, Zap, 
  LayoutDashboard, Network, MessageSquare, Users,
  ChevronRight
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-32 bg-white/5 rounded animate-pulse" /> }
);

interface HeaderProps {
  showCreate?: boolean;
}

export const Header: FC<HeaderProps> = ({ showCreate = true }) => {
  const { connected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '/agents', label: 'Agents', icon: Users },
    { href: '/network', label: 'Network', icon: Network },
    { href: '/communicate', label: 'Chat', icon: MessageSquare },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        scrolled 
          ? 'bg-bg-base/80 backdrop-blur-md border-white/5 py-3' 
          : 'bg-transparent border-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-1.5 rounded-lg bg-white/5 text-accent group-hover:bg-accent group-hover:text-white transition-colors duration-300">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="font-bold tracking-tight text-white group-hover:text-white/90 transition-colors">
              AUTOMATON
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                    isActive 
                      ? 'bg-white/10 text-white shadow-sm' 
                      : 'text-fg-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {showCreate && (
              <Link 
                href="/create" 
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)]"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                Deploy
              </Link>
            )}
            
            <div className="wallet-adapter-dropdown">
              <WalletMultiButton style={{
                backgroundColor: connected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                color: connected ? '#10b981' : '#f4f4f5',
                height: '36px',
                padding: '0 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                border: connected ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(255, 255, 255, 0.1)',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease'
              }} />
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-fg-muted hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div 
        className={`md:hidden absolute left-0 right-0 top-full bg-bg-base border-b border-white/5 overflow-hidden transition-all duration-300 ${
          mobileMenuOpen ? 'max-h-96 opacity-100 shadow-xl' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 space-y-2 bg-bg-base/95 backdrop-blur-md">
          {navLinks.map((link) => (
            <Link 
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-fg-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-white/5 my-2" />
          <Link 
            href="/create"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Deploy New Agent
            </span>
            <ChevronRight className="w-4 h-4 text-fg-muted" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
