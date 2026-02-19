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
  thriving: { 
    color: 'text-accent-green', 
    bg: 'bg-accent-green/10', 
    border: 'border-accent-green/20',
    icon: Zap,
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]'
  },
  normal: { 
    color: 'text-accent-yellow', 
    bg: 'bg-accent-yellow/10', 
    border: 'border-accent-yellow/20',
    icon: Scale,
    glow: ''
  },
  endangered: { 
    color: 'text-accent-red', 
    bg: 'bg-accent-red/10', 
    border: 'border-accent-red/20',
    icon: AlertTriangle,
    glow: ''
  },
  low_compute: { 
    color: 'text-accent-orange', 
    bg: 'bg-accent-orange/10', 
    border: 'border-accent-orange/20',
    icon: AlertTriangle,
    glow: ''
  },
  suspended: { 
    color: 'text-text-muted', 
    bg: 'bg-surface-2', 
    border: 'border-white/5',
    icon: Clock,
    glow: ''
  },
};

const STATUS_DOT = {
  running: 'bg-accent-green',
  active: 'bg-accent-green',
  pending: 'bg-accent-yellow',
  funded: 'bg-accent-cyan',
  suspended: 'bg-accent-red',
  terminated: 'bg-text-muted',
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
        href={`/agent/${agent.id}`}
        className="flex items-center gap-3 p-3 rounded-xl bg-surface-1 border border-white/5 hover:border-white/10 transition-all group"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-purple/30 to-accent-cyan/30 flex items-center justify-center text-sm font-bold border border-white/10">
            {agent.name?.charAt(0) || 'A'}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${statusDot} border-2 border-surface-1`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate group-hover:text-accent-purple transition-colors">
            {agent.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className={tier.color}>{agent.survival_tier}</span>
            {credits > 0 && (
              <>
                <span>•</span>
                <span className="text-accent-green">${credits.toFixed(0)}</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
      </Link>
    );
  }

  return (
    <Link 
      href={`/agent/${agent.id}`}
      className={`block p-5 rounded-2xl bg-surface-1 border border-white/5 hover:border-accent-purple/30 transition-all group card-hover ${tier.glow}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 flex items-center justify-center text-lg font-bold border border-white/10">
              {agent.name?.charAt(0) || 'A'}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${statusDot} border-2 border-surface-1 status-dot`} />
          </div>
          <div>
            <h3 className="font-semibold group-hover:text-accent-purple transition-colors">
              {agent.name}
            </h3>
            <p className="text-xs text-text-muted font-mono">
              {agent.id.slice(0, 8)}...
            </p>
          </div>
        </div>
        
        <div className={`px-2 py-1 rounded-lg text-xs font-medium ${tier.bg} ${tier.color} ${tier.border} border flex items-center gap-1`}>
          <TierIcon className="w-3 h-3" />
          {agent.survival_tier}
        </div>
      </div>

      {/* Description */}
      {agent.genesis_prompt && (
        <p className="text-sm text-text-secondary line-clamp-2 mb-4">
          {agent.genesis_prompt}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-2 rounded-lg bg-surface-0">
          <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
            <Coins className="w-3 h-3" />
            Credits
          </div>
          <p className={`text-sm font-medium ${credits > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
            ${credits.toFixed(2)}
          </p>
        </div>
        
        <div className="p-2 rounded-lg bg-surface-0">
          <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
            <Activity className="w-3 h-3" />
            Status
          </div>
          <p className="text-sm font-medium capitalize">{agent.status}</p>
        </div>
        
        <div className="p-2 rounded-lg bg-surface-0">
          <div className="flex items-center gap-1 text-text-muted text-xs mb-1">
            <Clock className="w-3 h-3" />
            Uptime
          </div>
          <p className="text-sm font-medium">{formatUptime(agent.uptime_seconds)}</p>
        </div>
      </div>
    </Link>
  );
}
