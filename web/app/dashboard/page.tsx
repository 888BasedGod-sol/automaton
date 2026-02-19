'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  Loader2, AlertTriangle, Plus, Coins, Clock, Zap, Scale,
  ExternalLink, RefreshCw, Wallet, ArrowRight, Users, Activity
} from 'lucide-react';
import Header from '@/components/Header';

// Dynamically import wallet button to avoid SSR issues
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-40 bg-purple-600/50 rounded-lg animate-pulse" /> }
);

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  evm_address: string;
  solana_address: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  uptime_seconds: number;
  skills: string[];
  created_at: string;
}

const TIER_CONFIG = {
  thriving: { color: 'text-green-400', bg: 'bg-green-500/10', icon: Zap },
  normal: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Scale },
  endangered: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  suspended: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock },
};

const STATUS_CONFIG = {
  running: { color: 'text-green-400', dot: 'bg-green-400' },
  pending: { color: 'text-yellow-400', dot: 'bg-yellow-400' },
  funded: { color: 'text-blue-400', dot: 'bg-blue-400' },
  suspended: { color: 'text-red-400', dot: 'bg-red-400' },
  terminated: { color: 'text-gray-400', dot: 'bg-gray-400' },
};

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      fetchMyAgents();
    } else {
      setAgents([]);
    }
  }, [connected, publicKey]);

  const fetchMyAgents = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/owner?wallet=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) {
      setError('Failed to load your agents');
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const totalCredits = agents.reduce((sum, a) => sum + (a.credits_balance || 0), 0);
  const activeAgents = agents.filter(a => a.status === 'running' || a.status === 'funded').length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950/20 via-black to-black pointer-events-none" />

      <Header showCreate={true} />

      <main className="relative max-w-5xl mx-auto px-4 py-8">
        {/* Not Connected State */}
        {!connected && (
          <div className="text-center py-20">
            <Wallet className="w-16 h-16 text-purple-400 mx-auto mb-6" />
            <h1 className="text-3xl font-bold mb-4">My Agents Dashboard</h1>
            <p className="text-white/50 mb-8 max-w-md mx-auto">
              Connect your Solana wallet to view and manage the agents you've deployed.
            </p>
            <WalletMultiButton style={{
              backgroundColor: 'rgba(147, 51, 234, 1)',
              borderRadius: '8px',
              fontSize: '16px',
              height: '48px',
              padding: '0 32px',
            }} />
          </div>
        )}

        {/* Connected State */}
        {connected && publicKey && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-1">My Agents</h1>
                <p className="text-white/50 text-sm font-mono">
                  {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchMyAgents}
                  disabled={loading}
                  className="p-2 text-white/50 hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/create"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Deploy New Agent
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <Users className="w-4 h-4" />
                  Total Agents
                </div>
                <p className="text-2xl font-bold">{agents.length}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  Active Agents
                </div>
                <p className="text-2xl font-bold text-green-400">{activeAgents}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
                <div className="flex items-center gap-2 text-white/50 text-sm mb-2">
                  <Coins className="w-4 h-4 text-green-400" />
                  Total Credits
                </div>
                <p className="text-2xl font-bold text-green-400">${totalCredits.toFixed(2)}</p>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* No Agents */}
            {!loading && !error && agents.length === 0 && (
              <div className="text-center py-16 border border-white/10 rounded-lg bg-white/5">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
                <p className="text-white/50 mb-6">Deploy your first autonomous agent to get started</p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  Deploy Your First Agent <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Agents List */}
            {!loading && !error && agents.length > 0 && (
              <div className="space-y-4">
                {agents.map((agent) => {
                  const tier = TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal;
                  const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const TierIcon = tier.icon;

                  return (
                    <Link
                      key={agent.id}
                      href={`/agents/${agent.id}`}
                      className="block p-5 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{agent.name}</h3>
                            <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                              {agent.status}
                            </span>
                          </div>
                          <p className="text-white/50 text-sm line-clamp-1 max-w-xl">
                            {agent.genesis_prompt}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className={`flex items-center gap-1 ${tier.color}`}>
                            <TierIcon className="w-4 h-4" />
                            <span className="capitalize">{agent.survival_tier}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-400">
                            <Coins className="w-4 h-4" />
                            ${agent.credits_balance?.toFixed(2) || '0.00'}
                          </div>
                          <div className="flex items-center gap-1 text-white/50">
                            <Clock className="w-4 h-4" />
                            {formatUptime(agent.uptime_seconds || 0)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-4 text-xs text-white/40">
                        <span className="font-mono">EVM: {agent.evm_address.slice(0, 10)}...</span>
                        <span className="font-mono">SOL: {agent.solana_address.slice(0, 8)}...</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
