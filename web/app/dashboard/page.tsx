'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  Loader2, AlertTriangle, Plus, Coins, Clock, Zap, Scale,
  RefreshCw, Wallet, ArrowRight, Users, Activity, Copy, Check,
  Play, Square, RotateCw, Upload, Terminal
} from 'lucide-react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-10 w-40 bg-accent-purple/50 rounded-lg animate-pulse" /> }
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
  thriving: { color: 'text-accent-green', bg: 'bg-accent-green/10', border: 'border-accent-green/30', icon: Zap },
  normal: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Scale },
  endangered: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle },
  suspended: { color: 'text-text-tertiary', bg: 'bg-surface-2', border: 'border-surface-3', icon: Clock },
};

const STATUS_CONFIG = {
  running: { color: 'text-accent-green', dot: 'status-dot-online' },
  pending: { color: 'text-yellow-400', dot: 'status-dot-warning' },
  funded: { color: 'text-accent-cyan', dot: 'status-dot-online' },
  suspended: { color: 'text-red-400', dot: 'status-dot-error' },
  terminated: { color: 'text-text-tertiary', dot: 'bg-text-tertiary' },
};

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAgentAction = async (agentId: string, action: string) => {
    setActionLoading(`${agentId}-${action}`);
    try {
      const res = await fetch('/api/agents/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action }),
      });
      if (res.ok) {
        await fetchMyAgents();
      }
    } finally {
      setActionLoading(null);
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
  const totalUptime = agents.reduce((sum, a) => sum + (a.uptime_seconds || 0), 0);

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <div className="fixed inset-0 bg-gradient-to-b from-accent-purple/5 via-transparent to-transparent pointer-events-none" />

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Not Connected State */}
        {!connected && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center mx-auto mb-6 border border-accent-purple/30">
              <Wallet className="w-10 h-10 text-accent-purple" />
            </div>
            <h1 className="text-3xl font-bold mb-4 gradient-text">My Agents Dashboard</h1>
            <p className="text-text-secondary mb-8 max-w-md mx-auto">
              Connect your Solana wallet to view and manage the agents you've deployed.
            </p>
            <WalletMultiButton style={{
              background: 'linear-gradient(135deg, #9333ea 0%, #06b6d4 100%)',
              borderRadius: '12px',
              fontSize: '16px',
              height: '52px',
              padding: '0 32px',
              border: 'none',
            }} />
          </div>
        )}

        {/* Connected State */}
        {connected && publicKey && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold mb-2">My Agents</h1>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 text-text-secondary text-sm font-mono hover:text-accent-purple transition-colors group"
                >
                  {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                  {copied ? (
                    <Check className="w-4 h-4 text-accent-green" />
                  ) : (
                    <Copy className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchMyAgents}
                  disabled={loading}
                  className="p-2.5 text-text-secondary hover:text-text-primary bg-surface-1 hover:bg-surface-2 border border-surface-3 rounded-lg transition-all"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/infrastructure"
                  className="px-4 py-2.5 bg-surface-1 hover:bg-surface-2 text-text-primary border border-surface-3 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  Infrastructure
                </Link>
                <Link
                  href="/create"
                  className="px-4 py-2.5 bg-gradient-to-r from-accent-purple to-accent-cyan hover:opacity-90 text-white rounded-lg transition-opacity flex items-center gap-2 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Deploy Agent
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <StatCard
                label="Total Agents"
                value={agents.length.toString()}
                icon={<Users className="w-5 h-5" />}
              />
              <StatCard
                label="Active"
                value={activeAgents.toString()}
                icon={<Activity className="w-5 h-5" />}
                change={agents.length > 0 ? Math.round((activeAgents / agents.length) * 100) : undefined}
                trend={activeAgents > 0 ? 'up' : 'neutral'}
              />
              <StatCard
                label="Total Credits"
                value={`$${totalCredits.toFixed(2)}`}
                icon={<Coins className="w-5 h-5" />}
              />
              <StatCard
                label="Combined Uptime"
                value={formatUptime(totalUptime)}
                icon={<Clock className="w-5 h-5" />}
              />
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-accent-purple mx-auto" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-center py-12 glass-effect rounded-xl border border-red-500/30">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* No Agents */}
            {!loading && !error && agents.length === 0 && (
              <div className="text-center py-16 glass-effect rounded-xl border border-surface-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center mx-auto mb-4 border border-accent-purple/30">
                  <Plus className="w-8 h-8 text-accent-purple" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No agents yet</h3>
                <p className="text-text-secondary mb-6">Deploy your first autonomous agent to get started</p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-purple to-accent-cyan hover:opacity-90 text-white rounded-lg transition-opacity font-medium"
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
                  const isRunning = agent.status === 'running' || agent.status === 'funded';

                  return (
                    <div
                      key={agent.id}
                      className="glass-effect border border-surface-3 rounded-xl overflow-hidden card-hover"
                    >
                      <Link href={`/agents/${agent.id}`} className="block p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold truncate">{agent.name}</h3>
                              <span className={`flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${tier.bg} ${tier.color} ${tier.border} border`}>
                                <TierIcon className="w-3 h-3" />
                                {agent.survival_tier}
                              </span>
                              <span className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                                {agent.status}
                              </span>
                            </div>
                            <p className="text-text-secondary text-sm line-clamp-1 max-w-xl">
                              {agent.genesis_prompt}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm ml-4">
                            <div className="text-right">
                              <p className="text-xs text-text-tertiary mb-1">Credits</p>
                              <p className="text-accent-green font-mono font-medium">${agent.credits_balance?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-text-tertiary mb-1">Uptime</p>
                              <p className="font-mono">{formatUptime(agent.uptime_seconds || 0)}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Control Panel */}
                      <div className="flex items-center justify-between px-5 py-3 bg-surface-1 border-t border-surface-3">
                        <div className="flex items-center gap-4 text-xs text-text-tertiary font-mono">
                          <span>EVM: {agent.evm_address.slice(0, 10)}...</span>
                          <span>SOL: {agent.solana_address.slice(0, 8)}...</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isRunning ? (
                            <button
                              onClick={(e) => { e.preventDefault(); handleAgentAction(agent.id, 'start'); }}
                              disabled={actionLoading === `${agent.id}-start`}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-green/10 text-accent-green hover:bg-accent-green/20 rounded-lg transition-colors"
                            >
                              {actionLoading === `${agent.id}-start` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3" />
                              )}
                              Start
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.preventDefault(); handleAgentAction(agent.id, 'stop'); }}
                              disabled={actionLoading === `${agent.id}-stop`}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            >
                              {actionLoading === `${agent.id}-stop` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Square className="w-3 h-3" />
                              )}
                              Stop
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); handleAgentAction(agent.id, 'restart'); }}
                            disabled={actionLoading === `${agent.id}-restart`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-2 text-text-secondary hover:text-text-primary border border-surface-3 rounded-lg transition-colors"
                          >
                            {actionLoading === `${agent.id}-restart` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCw className="w-3 h-3" />
                            )}
                            Restart
                          </button>
                          <button
                            onClick={(e) => { e.preventDefault(); handleAgentAction(agent.id, 'deploy'); }}
                            disabled={actionLoading === `${agent.id}-deploy`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 rounded-lg transition-colors"
                          >
                            {actionLoading === `${agent.id}-deploy` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Upload className="w-3 h-3" />
                            )}
                            Deploy
                          </button>
                        </div>
                      </div>
                    </div>
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
