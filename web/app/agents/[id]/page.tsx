'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Copy, ExternalLink, Activity, Coins, Clock, Shield,
  Zap, AlertTriangle, Scale, CheckCircle, Loader2, RefreshCw, User,
  Play, Square, RotateCw, Send, Rocket, Terminal as TerminalIcon
} from 'lucide-react';
import Header from '@/components/Header';
import AgentTerminal from '@/components/Terminal';
import AgentDetailSkeleton from '@/components/AgentDetailSkeleton';

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  creditsBalance?: number;
  solana_address: string;
  evm_address: string;
  skills: string[] | string;
  created_at: string;
  uptime_seconds: number;
  stats?: {
    followers: number;
    following: number;
    interactions: number;
  };
}

const TIER_CONFIG = {
  thriving: { color: 'text-success', bg: 'bg-success/10', icon: Zap },
  normal: { color: 'text-warning', bg: 'bg-warning/10', icon: Scale },
  endangered: { color: 'text-error', bg: 'bg-error/10', icon: AlertTriangle },
  suspended: { color: 'text-fg-muted', bg: 'bg-bg-elevated', icon: Clock },
};

const STATUS_CONFIG = {
  running: { color: 'text-success', dot: 'bg-success' },
  pending: { color: 'text-warning', dot: 'bg-warning' },
  funded: { color: 'text-accent', dot: 'bg-accent' },
  suspended: { color: 'text-error', dot: 'bg-error' },
  terminated: { color: 'text-fg-muted', dot: 'bg-fg-muted' },
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    // Only set loading on initial fetch if not already loaded
    if (!agent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Agent not found');
        } else {
          setError('Failed to fetch agent');
        }
        return;
      }
      const data = await res.json();
      setAgent(data.agent);
    } catch (e) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'deploy') => {
    setActionLoading(action);
    setActionMessage(null);
    try {
      const res = await fetch('/api/agents/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        // Refresh agent data
        await fetchAgent();
      } else {
        setActionMessage(`Error: ${data.error}`);
      }
    } catch (e) {
      setActionMessage('Action failed');
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  if (loading && !agent) {
    return <AgentDetailSkeleton />;
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-bg-base text-fg">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <AlertTriangle className="w-16 h-16 text-error mx-auto mb-4 opacity-50" />
          <h1 className="text-2xl font-bold mb-2">{error || 'Agent not found'}</h1>
          <p className="text-fg-muted mb-6">The agent you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/agents" className="text-accent hover:underline">
            ← Back to all agents
          </Link>
        </div>
      </div>
    );
  }

  const tier = TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal;
  const status = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const TierIcon = tier.icon;
  const skills = Array.isArray(agent.skills) ? agent.skills : JSON.parse(agent.skills || '[]');
  const credits = agent.creditsBalance || agent.credits_balance || 0;

  return (
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      {/* Content */}
      <main className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-fg-muted mb-6">
          <Link href="/" className="hover:text-fg transition-colors">Home</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-fg transition-colors">Agents</Link>
          <span>/</span>
          <span className="text-fg">{agent.name}</span>
        </nav>

        {/* Agent Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center border border-border/50">
              <User className="w-8 h-8 text-accent" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-semibold">{agent.name}</h1>
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border ${status.color ? status.color.replace('text-', 'bg-') + '/10 ' + status.color : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
                  {agent.status}
                </span>
              </div>
              <p className="text-fg-muted text-sm font-mono tracking-tight">
                {agent.id}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAgent}
            className="p-2 text-fg-muted hover:text-fg hover:bg-bg-elevated rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`card p-4 flex flex-col justify-between`}>
            <div className="flex items-center gap-2 mb-2 text-fg-muted">
              <TierIcon className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Survival Tier</span>
            </div>
            <p className={`text-lg font-medium capitalize ${tier.color}`}>{agent.survival_tier}</p>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2 text-fg-muted">
              <Coins className="w-4 h-4 text-warning" />
              <span className="text-xs uppercase tracking-wider font-medium">Balance</span>
            </div>
            <p className="text-lg font-mono font-medium text-fg">${credits.toFixed(2)}</p>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2 text-fg-muted">
              <Clock className="w-4 h-4 text-accent" />
              <span className="text-xs uppercase tracking-wider font-medium">Uptime</span>
            </div>
            <p className="text-lg font-mono font-medium">{formatUptime(agent.uptime_seconds)}</p>
          </div>

          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2 text-fg-muted">
              <Activity className="w-4 h-4 text-success" />
              <span className="text-xs uppercase tracking-wider font-medium">Interactions</span>
            </div>
            <p className="text-lg font-mono font-medium">{agent.stats?.interactions || 0}</p>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="mb-8 card p-6">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-accent" />
            Control Plane
          </h2>
          
          {actionMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm border ${
              actionMessage.startsWith('Error') 
                ? 'bg-error/10 text-error border-error/20' 
                : 'bg-success/10 text-success border-success/20'
            }`}>
              {actionMessage}
            </div>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => handleAction('start')}
              disabled={actionLoading !== null || agent.status === 'running'}
              className="btn bg-success/10 text-success hover:bg-success/20 border-success/20 flex flex-col h-auto py-4 gap-2 items-center justify-center"
            >
              {actionLoading === 'start' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide">Start</span>
            </button>
            
            <button
              onClick={() => handleAction('stop')}
              disabled={actionLoading !== null || agent.status === 'suspended'}
              className="btn bg-error/10 text-error hover:bg-error/20 border-error/20 flex flex-col h-auto py-4 gap-2 items-center justify-center"
            >
              {actionLoading === 'stop' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide">Stop</span>
            </button>
            
            <button
              onClick={() => handleAction('restart')}
              disabled={actionLoading !== null}
              className="btn bg-warning/10 text-warning hover:bg-warning/20 border-warning/20 flex flex-col h-auto py-4 gap-2 items-center justify-center"
            >
              {actionLoading === 'restart' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RotateCw className="w-5 h-5" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide">Restart</span>
            </button>
            
            <button
              onClick={() => handleAction('deploy')}
              disabled={actionLoading !== null}
              className="btn bg-accent/10 text-accent hover:bg-accent/20 border-accent/20 flex flex-col h-auto py-4 gap-2 items-center justify-center"
            >
              {actionLoading === 'deploy' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Rocket className="w-5 h-5" />
              )}
              <span className="text-xs font-medium uppercase tracking-wide">Deploy</span>
            </button>
          </div>

          <div className="mt-8 border-t border-white/5 pt-6">
            <h3 className="text-sm font-medium text-fg-muted mb-3 flex items-center gap-2">
              <TerminalIcon className="w-4 h-4" />
              Live Logs
            </h3>
            <AgentTerminal 
              agentId={agent.id} 
              agentName={agent.name}
              status={agent.status}
            />
          </div>
          
          <p className="mt-4 text-xs text-fg-muted flex items-center gap-1.5 opacity-70">
            <Shield className="w-3 h-3" />
            Requires Conway API key for full functionality. Demo mode simulates actions.
          </p>
        </div>

        {/* Wallet Addresses */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-accent" />
            Wallet Addresses
          </h2>
          <div className="space-y-3">
            <div className="card p-4 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-fg-muted uppercase tracking-wider font-semibold">Base (EVM)</p>
                    <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] rounded font-medium border border-accent/20">MAINNET</span>
                  </div>
                  <p className="font-mono text-sm truncate text-fg bg-bg-base/50 p-1.5 rounded border border-border/50">{agent.evm_address}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 self-end mb-1.5">
                  <button
                    onClick={() => copyToClipboard(agent.evm_address, 'evm')}
                    className="p-2 text-fg-muted hover:text-fg hover:bg-bg-elevated rounded transition-colors"
                    title="Copy address"
                  >
                    {copied === 'evm' ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://basescan.org/address/${agent.evm_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-fg-muted hover:text-fg hover:bg-bg-elevated rounded transition-colors"
                    title="View on Basescan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="card p-4 group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-fg-muted uppercase tracking-wider font-semibold">Solana</p>
                    <span className="px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] rounded font-medium border border-accent/20">MAINNET</span>
                  </div>
                  <p className="font-mono text-sm truncate text-fg bg-bg-base/50 p-1.5 rounded border border-border/50">{agent.solana_address}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 self-end mb-1.5">
                  <button
                    onClick={() => copyToClipboard(agent.solana_address, 'sol')}
                    className="p-2 text-fg-muted hover:text-fg hover:bg-bg-elevated rounded transition-colors"
                    title="Copy address"
                  >
                    {copied === 'sol' ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://solscan.io/account/${agent.solana_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-fg-muted hover:text-fg hover:bg-bg-elevated rounded transition-colors"
                    title="View on Solscan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Genesis Prompt */}
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-accent" />
            Genesis Prompt
          </h2>
          <div className="card p-5">
            <p className="text-fg-muted whitespace-pre-wrap leading-relaxed font-mono text-sm">{agent.genesis_prompt}</p>
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-bg-elevated text-fg-muted text-sm rounded border border-border"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border">
          <Link
            href={`/credits?agent=${agent.evm_address}`}
            className="flex-1 py-3 px-4 btn btn-primary flex items-center justify-center gap-2"
          >
            <Coins className="w-4 h-4" />
            Add Credits
          </Link>
          <Link
            href="/agents"
            className="flex-1 py-3 px-4 btn btn-secondary flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agents
          </Link>
        </div>
      </main>
    </div>
  );
}

