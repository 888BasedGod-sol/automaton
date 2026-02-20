'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Search, Zap, AlertTriangle, 
  Scale, ExternalLink, Clock, Activity, ChevronDown, Globe,
  CheckCircle, Shield, Sparkles, Filter
} from 'lucide-react';
import Header from '@/components/Header';
import AgentCard from '@/components/AgentCard';

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

  const tierCounts = {
    all: agents.length,
    thriving: agents.filter(a => a.survival_tier === 'thriving').length,
    normal: agents.filter(a => a.survival_tier === 'normal').length,
    endangered: agents.filter(a => a.survival_tier === 'endangered').length,
    suspended: agents.filter(a => a.survival_tier === 'suspended').length,
  };

  return (
    <div className="min-h-screen bg-bg-base text-fg">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Agent Directory</h1>
            <p className="text-fg-muted">
              {agents.length} autonomous agents registered on Automaton Cloud
            </p>
          </div>
          
          <Link href="/create" className="btn btn-primary inline-flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Deploy Agent
          </Link>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                type="text"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-bg-base border border-border rounded-lg text-fg focus:outline-none focus:border-accent transition-colors"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
              <div className="relative min-w-[140px]">
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-bg-base border border-border rounded-lg text-fg focus:outline-none focus:border-accent transition-colors text-sm"
                >
                  <option value="all">All Tiers ({tierCounts.all})</option>
                  <option value="thriving">Thriving ({tierCounts.thriving})</option>
                  <option value="normal">Normal ({tierCounts.normal})</option>
                  <option value="endangered">Endangered ({tierCounts.endangered})</option>
                  <option value="suspended">Suspended ({tierCounts.suspended})</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
              </div>

              <div className="relative min-w-[120px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-bg-base border border-border rounded-lg text-fg focus:outline-none focus:border-accent transition-colors text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="idle">Idle</option>
                  <option value="suspended">Suspended</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
              </div>

              <div className="relative min-w-[140px]">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-bg-base border border-border rounded-lg text-fg focus:outline-none focus:border-accent transition-colors text-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="credits">Most Credits</option>
                  <option value="uptime">Longest Uptime</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Agent List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-bg-surface animate-pulse" />
            ))}
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 card border-dashed">
            <Users className="w-12 h-12 text-fg-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-1">No agents found</h3>
            <p className="text-fg-muted mb-6">
              {search ? 'Try adjusting your search or filters' : 'Deploy your first agent to get started'}
            </p>
            {!search && (
              <Link href="/create" className="btn btn-primary inline-flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Deploy Agent
              </Link>
            )}
          </div>
        )}

        {/* On-Chain Agents Section */}
        <div className="mt-16 pt-8 border-t border-border">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent" />
              On-Chain Agents
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 bg-bg-surface border border-border rounded-full text-fg-muted">
              Base Network
            </span>
          </div>

          {onchainLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {[...Array(3)].map((_, i) => (
                <div key={i} className="h-40 rounded-lg bg-bg-surface animate-pulse" />
               ))}
            </div>
          ) : onchainAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onchainAgents.map((agent) => (
                <a
                  key={agent.agentId}
                  href={agent.metadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-5 rounded-lg bg-bg-surface border border-border hover:border-accent/30 transition-colors group"
                >
                  <div className="flex items-start gap-4 mb-3">
                    {agent.image ? (
                      <img
                        src={agent.image}
                        alt={agent.name}
                        className="w-12 h-12 rounded-lg object-cover bg-bg-elevated border border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-bg-elevated border border-border flex items-center justify-center">
                        <Globe className="w-6 h-6 text-fg-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-fg truncate group-hover:text-accent transition-colors">{agent.name}</h3>
                      <p className="text-xs text-fg-muted">Agent #{agent.agentId}</p>
                    </div>
                    <div className="px-2 py-0.5 bg-bg-elevated rounded text-[10px] text-fg-muted font-mono border border-border">
                      ERC-8004
                    </div>
                  </div>

                  <p className="text-sm text-fg-muted line-clamp-2 mb-4 h-10">
                    {agent.description || 'No description available'}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border text-xs text-fg-muted">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Users className="w-3 h-3" />
                      <span>{agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              ))}
            </div>
          ) : (
             <p className="text-fg-muted text-sm italic">No on-chain agents found.</p>
          )}
        </div>
      </main>
    </div>
  );
}
