'use client';

import Link from 'next/link';
import { 
  Zap, AlertTriangle, Scale, Clock, Activity,
  Coins, ExternalLink, ChevronRight
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
      className="block p-4 rounded-lg bg-bg-surface border border-border hover:border-accent/30 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center font-medium border border-border">
              {agent.name?.charAt(0) || 'A'}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${statusDot} border-2 border-bg-surface`} />
          </div>
          <div>
            <h3 className="font-medium group-hover:text-accent transition-colors">
              {agent.name}
            </h3>
            <p className="text-xs text-fg-faint font-mono">
              {agent.id.slice(0, 8)}
            </p>
          </div>
        </div>
        
        <div className={`px-2 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.color} flex items-center gap-1`}>
          <TierIcon className="w-3 h-3" />
          {agent.survival_tier}
        </div>
      </div>

      {/* Description */}
      {agent.genesis_prompt && (
        <p className="text-sm text-fg-muted line-clamp-2 mb-3">
          {agent.genesis_prompt}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 rounded bg-bg-base">
          <div className="text-fg-faint mb-0.5">Credits</div>
          <div className={credits > 0 ? 'text-success font-medium' : 'text-fg-muted'}>
            ${credits.toFixed(2)}
          </div>
        </div>
        <div className="p-2 rounded bg-bg-base">
          <div className="text-fg-faint mb-0.5">Status</div>
          <div className="font-medium capitalize">{agent.status}</div>
        </div>
        <div className="p-2 rounded bg-bg-base">
          <div className="text-fg-faint mb-0.5">Uptime</div>
          <div className="font-medium">{formatUptime(agent.uptime_seconds)}</div>
        </div>
      </div>
    </Link>
  );
}
