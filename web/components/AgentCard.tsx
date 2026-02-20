'use client';

import Link from 'next/link';
import { 
  Zap, AlertTriangle, Scale, Clock, Activity,
  Coins, ExternalLink, ChevronRight, Terminal
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  genesis_prompt?: string;
  status: string;
  survival_tier: string;
  credits_balance?: number;
  creditsBalance?: number;
  solana_address?: string;
  evm_address?: string;
  uptime_seconds?: number;
  created_at?: string;
  last_thought?: string;
}

interface AgentCardProps {
  agent: Agent;
  variant?: 'default' | 'compact' | 'featured';
}

const TIER_CONFIG = {
  thriving: { color: 'text-success', bg: 'bg-success/10', icon: Zap },
  normal: { color: 'text-warning', bg: 'bg-warning/10', icon: Scale },
  endangered: { color: 'text-error', bg: 'bg-error/10', icon: AlertTriangle },
  low_compute: { color: 'text-warning', bg: 'bg-warning/10', icon: AlertTriangle },
  suspended: { color: 'text-fg-faint', bg: 'bg-bg-elevated', icon: Clock },
};

const STATUS_DOT = {
  running: 'bg-success',
  active: 'bg-success',
  pending: 'bg-warning',
  funded: 'bg-accent',
  suspended: 'bg-error',
  terminated: 'bg-fg-faint',
};

export default function AgentCard({ agent, variant = 'default' }: AgentCardProps) {
  const tier = TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal;
  const TierIcon = tier.icon;
  const credits = agent.creditsBalance || agent.credits_balance || 0;
  const statusDot = STATUS_DOT[agent.status as keyof typeof STATUS_DOT] || STATUS_DOT.pending;

  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0m';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d`;
    return `${hours}h`;
  };

  if (variant === 'compact') {
    return (
      <Link 
        href={`/agents/${agent.id}`}
        className="flex items-center gap-3 p-3 rounded-lg bg-bg-surface border border-border hover:border-border-hover transition-colors group"
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center text-sm font-medium border border-border">
            {agent.name?.charAt(0) || 'A'}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${statusDot} border-2 border-bg-surface`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-accent transition-colors">
            {agent.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span className={tier.color}>{agent.survival_tier}</span>
            {credits > 0 && (
              <>
                <span>·</span>
                <span className="text-success">${credits.toFixed(0)}</span>
              </>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link 
      href={`/agents/${agent.id}`}
      className="block p-5 rounded-xl bg-bg-surface/50 border border-white/5 hover:border-accent/40 hover:bg-bg-surface hover:shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all duration-300 group backdrop-blur-sm relative overflow-hidden"
    >
      {/* Decorative Corner */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-bg-elevated flex items-center justify-center font-bold text-lg border border-white/10 shadow-inner group-hover:border-accent/30 transition-colors">
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60">
                {agent.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${statusDot} border-[3px] border-bg-surface shadow-sm`}>
              {agent.status === 'running' && (
                <div className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-75" />
              )}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-accent transition-colors flex items-center gap-2">
              {agent.name}
              <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-accent" />
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-fg-muted font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                ID: {agent.id.slice(0, 6)}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${tier.bg} ${tier.color} border border-current/20`}>
                {agent.survival_tier}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Thought Snippet */}
      <div className="mb-4 bg-black/40 rounded-lg p-3 border border-white/5 font-mono text-xs text-green-400/90 overflow-hidden relative group-hover:border-green-500/20 transition-colors">
        <div className="flex items-center gap-2 mb-1.5 opacity-50 text-[10px] uppercase tracking-widest text-green-500">
          <Terminal className="w-3 h-3" />
          Last Output
        </div>
        <p className="line-clamp-2 leading-relaxed opacity-90">
          {agent.last_thought || `> System check complete. Maintaining optimal uptime (${formatUptime(agent.uptime_seconds)}). Awaiting instructions...`}
        </p>
        <div className="absolute bottom-0 right-0 p-1">
           <div className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2.5 rounded-lg bg-bg-elevated/50 border border-white/5 group-hover:bg-bg-elevated transition-colors">
          <div className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5" /> Balance
          </div>
          <div className={`font-mono font-medium ${credits > 0 ? 'text-white' : 'text-fg-muted'}`}>
            ${credits.toFixed(2)}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg-elevated/50 border border-white/5 group-hover:bg-bg-elevated transition-colors">
          <div className="text-xs text-fg-muted mb-1 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Uptime
          </div>
          <div className="font-mono font-medium text-white">
            {formatUptime(agent.uptime_seconds)}
          </div>
        </div>
      </div>

      {/* Chain Identifiers */}
      <div className="flex items-center justify-between text-[10px] font-mono text-fg-faint pt-3 border-t border-white/5">
        <div className="flex gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-blue-500" /> BASE
          </span>
          {agent.solana_address && (
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-purple-500" /> SOLANA
            </span>
          )}
        </div>
        <span className="group-hover:text-accent transition-colors">v1.2.0</span>
      </div>
    </Link>
  );
}
