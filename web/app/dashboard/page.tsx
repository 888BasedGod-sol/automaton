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
  { ssr: false, loading: () => <div className="h-10 w-40 bg-bg-elevated rounded animate-pulse" /> }
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
  thriving: { color: 'text-success', bg: 'bg-success/10', border: 'border-success/30', icon: Zap },
  normal: { color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', icon: Scale },
  endangered: { color: 'text-error', bg: 'bg-error/10', border: 'border-error/30', icon: AlertTriangle },
  suspended: { color: 'text-fg-muted', bg: 'bg-bg-elevated', border: 'border-border', icon: Clock },
};

const STATUS_CONFIG = {
  running: { color: 'text-success', dot: 'bg-success' },
  pending: { color: 'text-warning', dot: 'bg-warning' },
  funded: { color: 'text-accent', dot: 'bg-accent' },
  suspended: { color: 'text-error', dot: 'bg-error' },
  terminated: { color: 'text-fg-muted', dot: 'bg-fg-muted' },
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
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Not Connected State */}
        {!connected && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded bg-bg-surface flex items-center justify-center mx-auto mb-6 border border-border dashed">
              <Wallet className="w-8 h-8 text-fg-muted" />
            </div>
            <h1 className="text-3xl font-semibold mb-4 text-fg">My Agents Dashboard</h1>
            <p className="text-fg-muted mb-8 max-w-md mx-auto">
              Connect your Solana wallet to view and manage the agents you've deployed.
            </p>
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
          </div>
        )}

        {/* Connected State */}
        {connected && publicKey && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-semibold mb-2">My Agents</h1>
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-2 text-fg-muted text-sm font-mono hover:text-accent transition-colors group px-2 py-1 -ml-2 rounded hover:bg-bg-surface"
                >
                  {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchMyAgents}
                  disabled={loading}
                  className="p-2.5 text-fg-muted hover:text-fg bg-bg-surface hover:bg-bg-elevated border border-border rounded transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Link
                  href="/infrastructure"
                  className="px-4 py-2.5 bg-bg-surface hover:bg-bg-elevated text-fg border border-border rounded transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Terminal className="w-4 h-4" />
                  Infrastructure
                </Link>
                <Link
                  href="/create"
                  className="btn btn-primary flex items-center gap-2"
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
                icon={<Users className="w-4 h-4" />}
              />
              <StatCard
                label="Active"
                value={activeAgents.toString()}
                icon={<Activity className="w-4 h-4" />}
              />
              <StatCard
                label="Total Credits"
                value={`$${totalCredits.toFixed(2)}`}
                icon={<Coins className="w-4 h-4" />}
              />
              <StatCard
                label="Combined Uptime"
                value={formatUptime(totalUptime)}
                icon={<Clock className="w-4 h-4" />}
              />
            </div>

            {/* Loading */}
            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-center py-12 card border-error/30 bg-error/5">
                <AlertTriangle className="w-10 h-10 text-error mx-auto mb-4" />
                <p className="text-error">{error}</p>
              </div>
            )}

            {/* No Agents */}
            {!loading && !error && agents.length === 0 && (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-bg-surface/30">
                <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-white/5">
                  <Bot className="w-8 h-8 text-fg-muted" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">Your Fleet is Empty</h3>
                <p className="text-fg-muted mb-8 max-w-sm mx-auto">
                  Deploy autonomous agents to run 24/7. They will manage their own wallet and execute tasks on your behalf.
                </p>
                <Link
                  href="/create"
                  className="btn btn-primary px-8 py-3 dark:shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Launch New Agent
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
                      className="card p-0 overflow-hidden group hover:border-accent/30 transition-colors"
                    >
                      <Link href={`/agents/${agent.id}`} className="block p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-medium truncate group-hover:text-accent transition-colors">{agent.name}</h3>
                              <span className={`flex items-center gap-1.5 text-[10px] uppercase font-medium px-2 py-0.5 rounded border ${tier.bg} ${tier.color} ${tier.border}`}>
                                <TierIcon className="w-3 h-3" />
                                {agent.survival_tier}
                              </span>
                              <span className={`flex items-center gap-1.5 text-xs ${status.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                <span className="capitalize">{agent.status}</span>
                              </span>
                            </div>
                            <p className="text-fg-muted text-sm line-clamp-1 max-w-xl font-mono opacity-80">
                              {agent.genesis_prompt}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-8 text-sm ml-6">
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-fg-muted mb-0.5">Credits</p>
                              <p className="text-success font-mono font-medium">${agent.credits_balance?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-fg-muted mb-0.5">Uptime</p>
                              <p className="font-mono text-fg">{formatUptime(agent.uptime_seconds || 0)}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                      
                      {/* Control Panel */}
                      <div className="flex items-center justify-between px-5 py-3 bg-bg-surface/50 border-t border-border">
                        <div className="flex items-center gap-4 text-[10px] text-fg-muted font-mono uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            EVM: {agent.evm_address.slice(0, 10)}...
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            SOL: {agent.solana_address.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isRunning ? (
                            <button
                              onClick={(e) => { e.preventDefault(); handleAgentAction(agent.id, 'start'); }}
                              disabled={!!actionLoading}
                              className="btn btn-ghost text-success hover:text-success hover:bg-success/10 text-xs px-3 py-1.5 h-auto flex items-center gap-1.5"
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
                              disabled={!!actionLoading}
                              className="btn btn-ghost text-error hover:text-error hover:bg-error/10 text-xs px-3 py-1.5 h-auto flex items-center gap-1.5"
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
                            disabled={!!actionLoading}
                            className="btn btn-secondary text-xs px-3 py-1.5 h-auto flex items-center gap-1.5"
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
                            disabled={!!actionLoading}
                            className="btn btn-secondary text-accent hover:text-accent hover:bg-accent/10 border-accent/20 text-xs px-3 py-1.5 h-auto flex items-center gap-1.5"
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
