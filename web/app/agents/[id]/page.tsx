'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Copy, ExternalLink, Activity, Coins, Clock, Shield,
  Zap, AlertTriangle, Scale, CheckCircle, Loader2, RefreshCw, User
} from 'lucide-react';
import Header from '@/components/Header';

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
  thriving: { color: 'text-green-400', bg: 'bg-green-500/10', icon: Zap },
  normal: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Scale },
  endangered: { color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertTriangle },
  suspended: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock },
};

const STATUS_CONFIG = {
  running: { color: 'text-green-400', dot: 'bg-green-400' },
  pending: { color: 'text-yellow-400', dot: 'bg-yellow-400' },
  funded: { color: 'text-blue-400', dot: 'bg-blue-400' },
  suspended: { color: 'text-red-400', dot: 'bg-red-400' },
  terminated: { color: 'text-gray-400', dot: 'bg-gray-400' },
};

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  const fetchAgent = async () => {
    setLoading(true);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{error || 'Agent not found'}</h1>
          <p className="text-white/50 mb-6">The agent you&apos;re looking for doesn&apos;t exist or has been removed.</p>
          <Link href="/agents" className="text-purple-400 hover:underline">
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
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 bg-gradient-to-b from-purple-950/20 via-black to-black pointer-events-none" />

      <Header />

      {/* Content */}
      <main className="relative max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-white/50 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/agents" className="hover:text-white transition-colors">Agents</Link>
          <span>/</span>
          <span className="text-white">{agent.name}</span>
        </nav>

        {/* Agent Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-900/30 flex items-center justify-center border border-purple-500/20">
              <User className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold">{agent.name}</h1>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${status.color} bg-white/5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
                  {agent.status}
                </span>
              </div>
              <p className="text-white/50 text-sm font-mono">
                {agent.id}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAgent}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className={`p-4 rounded-lg border ${tier.bg} ${tier.color} border-white/10`}>
            <div className="flex items-center gap-2 mb-1">
              <TierIcon className="w-4 h-4" />
              <span className="text-xs opacity-70">Survival Tier</span>
            </div>
            <p className="text-lg font-semibold capitalize">{agent.survival_tier}</p>
          </div>

          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white/50">Credits Balance</span>
            </div>
            <p className="text-lg font-semibold text-green-400">${credits.toFixed(2)}</p>
          </div>

          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-white/50">Uptime</span>
            </div>
            <p className="text-lg font-semibold">{formatUptime(agent.uptime_seconds)}</p>
          </div>

          <div className="p-4 rounded-lg border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-white/50">Interactions</span>
            </div>
            <p className="text-lg font-semibold">{agent.stats?.interactions || 0}</p>
          </div>
        </div>

        {/* Wallet Addresses */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Wallet Addresses
          </h2>
          <div className="space-y-3">
            <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-white/50">Base (EVM)</p>
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded">MAINNET</span>
                  </div>
                  <p className="font-mono text-sm truncate">{agent.evm_address}</p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => copyToClipboard(agent.evm_address, 'evm')}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copied === 'evm' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://basescan.org/address/${agent.evm_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="View on Basescan"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-white/50">Solana</p>
                    <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">MAINNET</span>
                  </div>
                  <p className="font-mono text-sm truncate">{agent.solana_address}</p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => copyToClipboard(agent.solana_address, 'sol')}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copied === 'sol' ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <a
                    href={`https://solscan.io/account/${agent.solana_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-400" />
            Genesis Prompt
          </h2>
          <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
            <p className="text-white/70 whitespace-pre-wrap leading-relaxed">{agent.genesis_prompt}</p>
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-purple-600/20 text-purple-300 text-sm rounded-full border border-purple-500/20 hover:border-purple-500/40 transition-colors"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
          <Link
            href={`/credits?agent=${agent.evm_address}`}
            className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-center transition-colors flex items-center justify-center gap-2"
          >
            <Coins className="w-4 h-4" />
            Add Credits
          </Link>
          <Link
            href="/agents"
            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium text-center transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Agents
          </Link>
        </div>
      </main>
    </div>
  );
}
