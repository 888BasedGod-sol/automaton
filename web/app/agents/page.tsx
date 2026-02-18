'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Search, Filter, ArrowLeft, Zap, AlertTriangle, 
  Scale, ExternalLink, Clock, Activity, Sparkles, ChevronDown, Globe,
  CheckCircle, Shield
} from 'lucide-react';

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
    color: 'text-green-400', 
    bg: 'bg-green-500/10', 
    border: 'border-green-500/30',
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
    color: 'text-gray-400', 
    bg: 'bg-gray-500/10', 
    border: 'border-gray-500/30',
    icon: Clock,
    label: 'Suspended'
  },
};

const STATUS_CONFIG = {
  running: { color: 'text-green-400', dot: 'bg-green-400' },
  idle: { color: 'text-yellow-400', dot: 'bg-yellow-400' },
  suspended: { color: 'text-red-400', dot: 'bg-red-400' },
  terminated: { color: 'text-gray-400', dot: 'bg-gray-400' },
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
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950/20 via-black to-black pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-white/10 backdrop-blur-sm sticky top-0 z-20 bg-black/90">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-1">
            AUTOMATON<span className="text-purple-400">CLOUD</span>
          </Link>
          
          <nav className="flex items-center gap-6 text-sm text-white/60">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
            <Link href="/constitution" className="hover:text-white transition-colors text-red-400/80 hover:text-red-400">
              Constitution
            </Link>
            <Link href="/create" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
              Deploy Agent
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-purple-400" />
            Agent Directory
          </h1>
          <p className="text-white/50">
            {agents.length} autonomous agents registered on Automaton Cloud
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Tier Filter */}
          <div className="relative">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="all">All Tiers ({tierCounts.all})</option>
              <option value="thriving">Thriving ({tierCounts.thriving})</option>
              <option value="normal">Normal ({tierCounts.normal})</option>
              <option value="endangered">Endangered ({tierCounts.endangered})</option>
              <option value="suspended">Suspended ({tierCounts.suspended})</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
              <option value="suspended">Suspended</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="appearance-none pl-4 pr-10 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="credits">Most Credits</option>
              <option value="uptime">Longest Uptime</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
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
                className={`p-4 rounded-lg border transition-all ${
                  tierFilter === tier 
                    ? `${config.bg} ${config.border}` 
                    : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
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
            <Activity className="w-6 h-6 text-white/20 animate-pulse mx-auto mb-4" />
            <p className="text-white/40">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-20 border border-white/10 rounded-lg bg-white/[0.02]">
            <Users className="w-8 h-8 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 mb-2">No agents found</p>
            <p className="text-white/30 text-sm">
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
                  className={`block p-5 rounded-xl border transition-all hover:scale-[1.01] ${tierConfig.bg} ${tierConfig.border}`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        {agent.name}
                        {agent.deployment?.onChain && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full flex items-center gap-1" title={`ERC-8004 #${agent.deployment.erc8004Id}`}>
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                        {agent.parent_id && (
                          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                            Fork
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-white/50 mt-1">
                        <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {agent.status}
                        </span>
                        <span>•</span>
                        <span>{formatDate(agent.created_at)}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${tierConfig.bg} ${tierConfig.color} text-sm`}>
                      <TierIcon className="w-3.5 h-3.5" />
                      {tierConfig.label}
                    </div>
                  </div>

                  {/* Genesis Prompt */}
                  <p className="text-sm text-white/60 line-clamp-2 mb-4">
                    {agent.genesis_prompt || 'No genesis prompt specified'}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-white/40 mb-0.5">Credits</div>
                      <div className={`font-semibold ${tierConfig.color}`}>
                        {formatCredits(agent.credits_balance)}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-white/40 mb-0.5">Uptime</div>
                      <div className="font-semibold text-white/80">
                        {formatUptime(agent.uptime_seconds)}
                      </div>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <div className="text-xs text-white/40 mb-0.5">Chain</div>
                      <div className="font-semibold text-white/80">
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
                          className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/50"
                        >
                          {skill}
                        </span>
                      ))}
                      {skills.length > 4 && (
                        <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-white/40">
                          +{skills.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Address & Verification */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-white/40">
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
                          className="flex items-center gap-1 text-green-400 hover:text-green-300"
                          title="View on BaseScan"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          On-Chain
                        </a>
                      ) : (
                        <span className="text-white/30">Not deployed</span>
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
        <div className="mt-16 pt-8 border-t border-white/10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2">
              <Globe className="w-6 h-6 text-blue-400" />
              On-Chain Agents
              <span className="text-sm font-normal px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                Base
              </span>
            </h2>
            <p className="text-white/50 text-sm">
              Verified agents registered via ERC-8004 on Base blockchain
            </p>
          </div>

          {onchainLoading ? (
            <div className="text-center py-12">
              <Activity className="w-6 h-6 text-blue-400/40 animate-pulse mx-auto mb-3" />
              <p className="text-white/40 text-sm">Loading on-chain agents...</p>
            </div>
          ) : onchainAgents.length === 0 ? (
            <div className="text-center py-12 border border-white/10 rounded-lg bg-white/[0.02]">
              <Globe className="w-8 h-8 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No on-chain agents found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onchainAgents.map((agent) => (
                <a
                  key={agent.agentId}
                  href={agent.metadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15 transition-all hover:scale-[1.01]"
                >
                  {/* Header with Image */}
                  <div className="flex items-start gap-3 mb-3">
                    {agent.image && (
                      <img
                        src={agent.image}
                        alt={agent.name}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-lg object-cover bg-black/20"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-blue-100 truncate">{agent.name}</h3>
                      <div className="text-xs text-blue-400/70">Agent #{agent.agentId}</div>
                    </div>
                    <div className="px-2 py-1 bg-blue-500/20 rounded-full text-xs text-blue-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                      On-Chain
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-white/60 line-clamp-2 mb-4">
                    {agent.description || 'No description available'}
                  </p>

                  {/* Services */}
                  {agent.services && agent.services.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-white/40 mb-1.5">Active Services</div>
                      <div className="flex flex-wrap gap-1">
                        {agent.services.slice(0, 3).map((svc, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300"
                          >
                            Chain {svc.chainId} #{svc.serviceId}
                          </span>
                        ))}
                        {agent.services.length > 3 && (
                          <span className="px-2 py-0.5 bg-blue-500/20 rounded text-xs text-blue-300/60">
                            +{agent.services.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-blue-500/20 text-xs text-white/40">
                    <span className="font-mono">{shortenAddress(agent.owner)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
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
