'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  Loader2, AlertTriangle, Plus, Coins, Clock, Zap, Scale,
  RefreshCw, Wallet, ArrowRight, Users, Activity, Copy, Check,
  Play, Square, RotateCw, Upload, Terminal, Bot, Globe
} from 'lucide-react';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { useNotifications } from '@/components/Toast';
import { useOwnerAgents, useAgents, useInvalidateData } from '@/lib/hooks/use-realtime';

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
  owner_wallet?: string;
}

type FleetView = 'my-agents' | 'ecosystem';

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
  const router = useRouter();
  const notifications = useNotifications();
  
  // Real-time data hooks - auto-refresh every 10 seconds
  const { data: ownerData, isLoading: ownerLoading, error: ownerError } = useOwnerAgents(
    connected && publicKey ? publicKey.toBase58() : null
  );
  const { data: ecosystemData, isLoading: ecosystemLoading } = useAgents();
  const { invalidateAgents } = useInvalidateData();
  
  const agents = ownerData?.agents || [];
  const ecosystemAgents = ecosystemData?.agents || [];
  const loading = ownerLoading;
  const error = ownerError ? 'Failed to load your agents' : null;
  
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fleetView, setFleetView] = useState<FleetView>('ecosystem');
  const alertedAgentsRef = useRef<Set<string>>(new Set());

  // Update fleet view when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setFleetView('my-agents');
    }
  }, [connected, publicKey]);

  // Check for low credit agents and show notifications
  useEffect(() => {
    if (agents.length === 0) return;

    const LOW_CREDIT_THRESHOLD = 100; // $1.00 in cents
    const CRITICAL_THRESHOLD = 25; // $0.25 in cents

    agents.forEach((agent) => {
      const agentKey = `${agent.id}-${agent.credits_balance}`;
      
      // Skip if we already alerted for this agent at this balance level
      if (alertedAgentsRef.current.has(agentKey)) return;

      if (agent.status === 'suspended' && !alertedAgentsRef.current.has(`${agent.id}-suspended`)) {
        notifications.agentStopped(agent.name);
        alertedAgentsRef.current.add(`${agent.id}-suspended`);
      } else if (agent.credits_balance > 0 && agent.credits_balance <= CRITICAL_THRESHOLD) {
        notifications.lowCredits(agent.name, agent.credits_balance, () => {
          router.push(`/agents/${agent.id}`);
        });
        alertedAgentsRef.current.add(agentKey);
      } else if (agent.credits_balance > 0 && agent.credits_balance <= LOW_CREDIT_THRESHOLD) {
        notifications.warning(
          `${agent.name} credits low`,
          `$${(agent.credits_balance / 100).toFixed(2)} remaining`
        );
        alertedAgentsRef.current.add(agentKey);
      }
    });
  }, [agents, notifications, router]);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAgentAction = async (agentId: string, action: string) => {
    const agent = agents.find(a => a.id === agentId);
    const agentName = agent?.name || 'Agent';
    
    setActionLoading(`${agentId}-${action}`);
    try {
      const res = await fetch('/api/agents/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action }),
      });
      
      if (res.ok) {
        const data = await res.json();
        // Invalidate cache to trigger re-fetch
        invalidateAgents();
        
        // Show success notification
        if (action === 'start') {
          notifications.success(`${agentName} started`, 'Agent is now running');
        } else if (action === 'stop') {
          notifications.info(`${agentName} stopped`, 'Agent has been suspended');
        } else if (action === 'restart') {
          notifications.success(`${agentName} restarted`, 'Agent is running again');
        } else if (action === 'deploy') {
          notifications.success(`${agentName} deployed`, 'Sandbox created and agent started');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        notifications.error(
          `Failed to ${action} agent`,
          data.error || 'An unexpected error occurred'
        );
      }
    } catch (e) {
      notifications.error(`Failed to ${action} agent`, 'Network error');
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

  // Stats based on current view
  const displayAgents = fleetView === 'my-agents' ? agents : ecosystemAgents;
  const totalCredits = displayAgents.reduce((sum, a) => sum + (a.credits_balance || 0), 0);
  const activeAgents = displayAgents.filter(a => a.status === 'running' || a.status === 'funded').length;
  const totalUptime = displayAgents.reduce((sum, a) => sum + (a.uptime_seconds || 0), 0);
  
  // Ecosystem stats
  const ecosystemTotal = ecosystemAgents.length;
  const ecosystemActive = ecosystemAgents.filter(a => a.status === 'running' || a.status === 'funded').length;

  return (
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-2">My Fleet</h1>
            {connected && publicKey ? (
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
            ) : (
              <p className="text-fg-muted text-sm">Connect wallet to manage your agents</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => invalidateAgents()}
              disabled={loading || ecosystemLoading}
              className="p-2.5 text-fg-muted hover:text-fg bg-bg-surface hover:bg-bg-elevated border border-border rounded transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || ecosystemLoading) ? 'animate-spin' : ''}`} />
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

        {/* Fleet Tabs */}
        <div className="flex items-center gap-2 mb-8 border-b border-border">
          <button
            onClick={() => setFleetView('ecosystem')}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              fleetView === 'ecosystem'
                ? 'border-accent text-accent'
                : 'border-transparent text-fg-muted hover:text-fg'
            }`}
          >
            <Globe className="w-4 h-4" />
            Ecosystem
            <span className="px-1.5 py-0.5 text-xs bg-bg-elevated rounded">
              {ecosystemTotal}
            </span>
          </button>
          <button
            onClick={() => {
              if (connected) {
                setFleetView('my-agents');
              }
            }}
            disabled={!connected}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
              fleetView === 'my-agents'
                ? 'border-accent text-accent'
                : connected
                  ? 'border-transparent text-fg-muted hover:text-fg'
                  : 'border-transparent text-fg-muted/50 cursor-not-allowed'
            }`}
          >
            <Users className="w-4 h-4" />
            My Agents
            {connected && (
              <span className="px-1.5 py-0.5 text-xs bg-bg-elevated rounded">
                {agents.length}
              </span>
            )}
          </button>
          {!connected && (
            <div className="ml-auto">
              <WalletMultiButton />
            </div>
          )}
        </div>

        {/* Command Center Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
               <Users className="w-24 h-24" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-2">
              {fleetView === 'ecosystem' ? 'Total Deployed' : 'My Fleet'}
            </h3>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-mono font-medium text-white">{displayAgents.length}</span>
               <span className="text-sm text-fg-muted">Agents</span>
            </div>
          </div>

          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
               <Activity className="w-24 h-24 text-success" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-2 flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
               Active Nodes
            </h3>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-mono font-medium text-white">{activeAgents}</span>
               <span className="text-sm text-fg-muted">Running</span>
            </div>
          </div>

          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
               <Coins className="w-24 h-24 text-warning" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-2">
              {fleetView === 'ecosystem' ? 'Network Liquidity' : 'Your Liquidity'}
            </h3>
            <div className="flex items-baseline gap-2">
               <span className="text-3xl font-mono font-medium text-white">${totalCredits.toFixed(2)}</span>
               <span className="text-sm text-fg-muted">USD</span>
            </div>
          </div>

          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
               <Clock className="w-24 h-24 text-accent" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-2">Total Uptime</h3>
            <div className="flex items-baseline gap-2">
               <span className="text-xl font-mono font-medium text-white truncate">{formatUptime(totalUptime)}</span>
            </div>
          </div>
        </div>

        {/* Loading */}
        {((fleetView === 'my-agents' && loading) || (fleetView === 'ecosystem' && ecosystemLoading)) && (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          </div>
        )}

        {/* Error (only for my-agents view) */}
        {error && fleetView === 'my-agents' && (
          <div className="text-center py-12 card border-error/30 bg-error/5">
            <AlertTriangle className="w-10 h-10 text-error mx-auto mb-4" />
            <p className="text-error">{error}</p>
          </div>
        )}

        {/* No Agents - My Agents View */}
        {fleetView === 'my-agents' && !loading && !error && agents.length === 0 && (
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

        {/* No Agents - Ecosystem View */}
        {fleetView === 'ecosystem' && !ecosystemLoading && ecosystemAgents.length === 0 && (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-bg-surface/30">
            <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-white/5">
              <Globe className="w-8 h-8 text-fg-muted" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">No Agents in the Ecosystem Yet</h3>
            <p className="text-fg-muted mb-8 max-w-sm mx-auto">
              Be the first to deploy an autonomous agent to this network.
            </p>
            <Link
              href="/create"
              className="btn btn-primary px-8 py-3"
            >
              <Plus className="w-4 h-4 mr-2" />
              Deploy First Agent
            </Link>
          </div>
        )}

        {/* Agents List */}
        {displayAgents.length > 0 && !((fleetView === 'my-agents' && loading) || (fleetView === 'ecosystem' && ecosystemLoading)) && (
          <div className="space-y-4">
            {displayAgents.map((agent) => {
              const tier = TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal;
              const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const TierIcon = tier.icon;
              const isRunning = agent.status === 'running' || agent.status === 'funded';
              const isOwnAgent = connected && publicKey && agent.owner_wallet === publicKey.toBase58();

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
                            EVM: {agent.evm_address?.slice(0, 10) || 'N/A'}...
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-border"></span>
                            SOL: {agent.solana_address?.slice(0, 8) || 'N/A'}...
                          </span>
                          {fleetView === 'ecosystem' && isOwnAgent && (
                            <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[9px]">
                              YOURS
                            </span>
                          )}
                        </div>
                        {(fleetView === 'my-agents' || isOwnAgent) ? (
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
                        ) : (
                          <Link
                            href={`/agents/${agent.id}`}
                            className="text-xs text-accent hover:underline flex items-center gap-1"
                          >
                            View Agent <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </main>
    </div>
  );
}
