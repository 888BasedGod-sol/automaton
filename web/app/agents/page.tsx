'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Search, Zap, AlertTriangle, 
  Scale, ExternalLink, Clock, Activity, ChevronDown, Globe,
  CheckCircle, Shield, Sparkles
} from 'lucide-react';
import Header from '@/components/Header';

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  solana_address: string;
  evm_address: string;
  skills: string[] | string;
  created_at: string;
  uptime_seconds: number;
  parent_id: string | null;
  deployment?: {
    onChain: boolean;
    erc8004Id: string | null;
    registryContract: string | null;
    chain: string | null;
    explorerUrl: string | null;
  };
}

interface OnChainAgent {
  agentId: string;
  owner: string;
  name: string;
  description: string;
  image?: string;
  metadataUrl: string;
  services?: Array<{ chainId: number; serviceId: number }>;
}

const TIER_CONFIG = {
  thriving: { 
    color: 'text-accent-green', 
    bg: 'bg-accent-green/10', 
    border: 'border-accent-green/30',
    icon: Zap,
    label: 'Thriving'
  },
  normal: { 
    color: 'text-yellow-400', 
    bg: 'bg-yellow-500/10', 
    border: 'border-yellow-500/30',
    icon: Scale,
    label: 'Normal'
  },
  endangered: { 
    color: 'text-red-400', 
    bg: 'bg-red-500/10', 
    border: 'border-red-500/30',
    icon: AlertTriangle,
    label: 'Endangered'
  },
  suspended: { 
    color: 'text-text-tertiary', 
    bg: 'bg-surface-2', 
    border: 'border-surface-3',
    icon: Clock,
    label: 'Suspended'
  },
};

const STATUS_CONFIG = {
  running: { color: 'text-accent-green', dot: 'status-dot-online' },
  idle: { color: 'text-yellow-400', dot: 'bg-yellow-400' },
  suspended: { color: 'text-red-400', dot: 'status-dot-error' },
  terminated: { color: 'text-text-tertiary', dot: 'bg-text-tertiary' },
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [onchainAgents, setOnchainAgents] = useState<OnChainAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [onchainLoading, setOnchainLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'credits' | 'uptime'>('newest');

  useEffect(() => {
    fetchAgents();
    fetchOnchainAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agents/all');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnchainAgents = async () => {
    setOnchainLoading(true);
    try {
      const res = await fetch('/api/agents/onchain');
      const data = await res.json();
      setOnchainAgents(data.agents || []);
    } catch (e) {
      console.error(e);
    } finally {
      setOnchainLoading(false);
    }
  };

  const filteredAgents = agents
    .filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (tierFilter !== 'all' && a.survival_tier !== tierFilter) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'credits') return (b.credits_balance || 0) - (a.credits_balance || 0);
      if (sortBy === 'uptime') return (b.uptime_seconds || 0) - (a.uptime_seconds || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const formatCredits = (credits: number) => {
    if (!credits) return '0';
    if (credits >= 1000000) return (credits / 1000000).toFixed(1) + 'M';
    if (credits >= 1000) return (credits / 1000).toFixed(1) + 'K';
    return credits.toFixed(0);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString();
  };

  const shortenAddress = (addr: string) => {
    if (!addr) return 'N/A';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const parseSkills = (skills: string | string[]): string[] => {
    if (!skills) return [];
    if (Array.isArray(skills)) return skills;
    try {
      return JSON.parse(skills);
    } catch {
      return skills.split(',').map(s => s.trim()).filter(Boolean);
    }
  };

  const tierCounts = {
    all: agents.length,
    thriving: agents.filter(a => a.survival_tier === 'thriving').length,
    normal: agents.filter(a => a.survival_tier === 'normal').length,
    endangered: agents.filter(a => a.survival_tier === 'endangered').length,
    suspended: agents.filter(a => a.survival_tier === 'suspended').length,
  };

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <div className="fixed inset-0 bg-gradient-to-b from-accent-purple/5 via-transparent to-transparent pointer-events-none" />

      <Header />

      {/* Content */}
      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="gradient-text">Agent Directory</span>
          </h1>
          <p className="text-text-secondary">
            {agents.length} autonomous agents registered on Automaton Cloud
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface-1 border border-surface-3 rounded-xl text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-purple/50 transition-colors"
            />
          </div>

          {/* Tier Filter */}
          <div className="relative">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-surface-1 border border-surface-3 rounded-xl text-text-primary focus:outline-none focus:border-accent-purple/50 cursor-pointer transition-colors"
            >
              <option value="all">All Tiers ({tierCounts.all})</option>
              <option value="thriving">Thriving ({tierCounts.thriving})</option>
              <option value="normal">Normal ({tierCounts.normal})</option>
              <option value="endangered">Endangered ({tierCounts.endangered})</option>
              <option value="suspended">Suspended ({tierCounts.suspended})</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-surface-1 border border-surface-3 rounded-xl text-text-primary focus:outline-none focus:border-accent-purple/50 cursor-pointer transition-colors"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
              <option value="suspended">Suspended</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-surface-1 border border-surface-3 rounded-xl text-text-primary focus:outline-none focus:border-accent-purple/50 cursor-pointer transition-colors"
            >
              <option value="newest">Newest First</option>
              <option value="credits">Most Credits</option>
              <option value="uptime">Longest Uptime</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        {/* Tier Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Object.entries(TIER_CONFIG).map(([tier, config]) => {
            const IconComponent = config.icon;
            const count = tierCounts[tier as keyof typeof tierCounts] || 0;
            return (
              <button
                key={tier}
                onClick={() => setTierFilter(tierFilter === tier ? 'all' : tier)}
                className={`p-4 rounded-xl border transition-all ${
                  tierFilter === tier 
                    ? `${config.bg} ${config.border}` 
                    : 'glass-effect border-surface-3 hover:border-surface-3 hover:bg-surface-2'
                }`}
              >
                <div className={`flex items-center gap-2 ${config.color}`}>
                  <IconComponent className="w-5 h-5" />
                  <span className="font-semibold">{config.label}</span>
                </div>
                <div className="text-2xl font-bold mt-1">{count}</div>
              </button>
            );
          })}
        </div>

        {/* Agent List */}
        {loading ? (
          <div className="text-center py-20">
            <Activity className="w-6 h-6 text-accent-purple animate-pulse mx-auto mb-4" />
            <p className="text-text-secondary">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-20 glass-effect border border-surface-3 rounded-xl">
            <Users className="w-8 h-8 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary mb-2">No agents found</p>
            <p className="text-text-tertiary text-sm">
              {search ? 'Try a different search term' : 'Deploy an agent to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAgents.map((agent) => {
              const tierConfig = TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal;
              const statusConfig = STATUS_CONFIG[agent.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.idle;
              const TierIcon = tierConfig.icon;
              const skills = parseSkills(agent.skills);

              return (
                <Link
                  key={agent.id}
                  href={`/agents/${agent.id}`}
                  className="block p-5 rounded-xl glass-effect border border-surface-3 card-hover"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {agent.name}
                        {agent.deployment?.onChain && (
                          <span className="text-xs px-2 py-0.5 bg-accent-green/20 text-accent-green rounded-full flex items-center gap-1 border border-accent-green/30" title={`ERC-8004 #${agent.deployment.erc8004Id}`}>
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                        {agent.parent_id && (
                          <span className="text-xs px-2 py-0.5 bg-accent-purple/20 text-accent-purple rounded-full border border-accent-purple/30">
                            Fork
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                        <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {agent.status}
                        </span>
                        <span className="text-text-tertiary">•</span>
                        <span className="text-text-tertiary">{formatDate(agent.created_at)}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${tierConfig.bg} ${tierConfig.color} ${tierConfig.border} border text-sm`}>
                      <TierIcon className="w-3.5 h-3.5" />
                      {tierConfig.label}
                    </div>
                  </div>

                  {/* Genesis Prompt */}
                  <p className="text-sm text-text-secondary line-clamp-2 mb-4">
                    {agent.genesis_prompt || 'No genesis prompt specified'}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                      <div className="text-xs text-text-tertiary mb-0.5">Credits</div>
                      <div className={`font-semibold font-mono ${tierConfig.color}`}>
                        {formatCredits(agent.credits_balance)}
                      </div>
                    </div>
                    <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                      <div className="text-xs text-text-tertiary mb-0.5">Uptime</div>
                      <div className="font-semibold font-mono">
                        {formatUptime(agent.uptime_seconds)}
                      </div>
                    </div>
                    <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                      <div className="text-xs text-text-tertiary mb-0.5">Chain</div>
                      <div className="font-semibold">
                        {agent.solana_address ? 'SOL' : agent.evm_address ? 'EVM' : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {skills.slice(0, 4).map((skill, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-surface-2 border border-surface-3 rounded text-xs text-text-secondary"
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 4 && (
                        <span className="px-2 py-0.5 bg-surface-2 border border-surface-3 rounded text-xs text-text-tertiary">
                          +{skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Address & Verification */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-3 text-xs text-text-tertiary">
                    <span className="font-mono">
                      {shortenAddress(agent.solana_address || agent.evm_address)}
                    </span>
                    <div className="flex items-center gap-2">
                      {agent.deployment?.onChain ? (
                        <a 
                          href={agent.deployment.explorerUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-accent-green hover:text-accent-green/80"
                          title="View on BaseScan"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          On-Chain
                        </a>
                      ) : (
                        <span className="text-text-tertiary">Not deployed</span>
                      )}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* On-Chain Agents Section */}
        <div className="mt-16 pt-8 border-t border-surface-3">
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan/20 flex items-center justify-center border border-accent-cyan/30">
                <Globe className="w-4 h-4 text-accent-cyan" />
              </div>
              On-Chain Agents
              <span className="text-sm font-normal px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan rounded-full border border-accent-cyan/30">
                Base
              </span>
            </h2>
            <p className="text-text-secondary text-sm">
              Verified agents registered via ERC-8004 on Base blockchain
            </p>
          </div>

          {onchainLoading ? (
            <div className="text-center py-12">
              <Activity className="w-6 h-6 text-accent-cyan animate-pulse mx-auto mb-3" />
              <p className="text-text-secondary text-sm">Loading on-chain agents...</p>
            </div>
          ) : onchainAgents.length === 0 ? (
            <div className="text-center py-12 glass-effect border border-surface-3 rounded-xl">
              <Globe className="w-8 h-8 text-text-tertiary mx-auto mb-3" />
              <p className="text-text-secondary">No on-chain agents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onchainAgents.map((agent) => (
                <a
                  key={agent.agentId}
                  href={agent.metadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 rounded-xl glass-effect border border-accent-cyan/30 card-hover"
                >
                  {/* Header with Image */}
                  <div className="flex items-start gap-3 mb-3">
                    {agent.image && (
                      <img
                        src={agent.image}
                        alt={agent.name}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover bg-surface-2 border border-surface-3"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-accent-cyan truncate">{agent.name}</h3>
                      <div className="text-xs text-text-tertiary">Agent #{agent.agentId}</div>
                    </div>
                    <div className="px-2 py-1 bg-accent-cyan/20 rounded-full text-xs text-accent-cyan flex items-center gap-1 border border-accent-cyan/30">
                      <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-pulse" />
                      On-Chain
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-text-secondary line-clamp-2 mb-4">
                    {agent.description || 'No description available'}
                  </p>

                  {/* Services */}
                  {agent.services && agent.services.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-text-tertiary mb-1.5">Active Services</div>
                      <div className="flex flex-wrap gap-1">
                        {agent.services.slice(0, 3).map((svc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-accent-cyan/20 rounded text-xs text-accent-cyan border border-accent-cyan/30"
                          >
                            Chain {svc.chainId} #{svc.serviceId}
                          </span>
                        ))}
                        {agent.services.length > 3 && (
                          <span className="px-2 py-0.5 bg-accent-cyan/20 rounded text-xs text-accent-cyan/60 border border-accent-cyan/20">
                            +{agent.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-surface-3 text-xs text-text-tertiary">
                    <span className="font-mono">{shortenAddress(agent.owner)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-accent-cyan" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
