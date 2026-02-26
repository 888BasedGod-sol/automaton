'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  Copy, ExternalLink, Activity, Coins, Clock, Shield,
  Zap, AlertTriangle, Scale, CheckCircle, Loader2, RefreshCw, User,
  Play, Square, Terminal as TerminalIcon, Wallet,
  Heart, ChevronDown, ChevronUp, ArrowLeft, Bot,
  Cpu, Power, Radio, Signal, Database, Gauge, Check
} from 'lucide-react';
import Header from '@/components/Header';
import AgentDetailSkeleton from '@/components/AgentDetailSkeleton';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Dynamically import Terminal to avoid SSR issues
const AgentTerminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  creditsBalance?: number;
  sol_balance?: number;
  usdc_balance?: number;
  solana_address: string;
  evm_address: string;
  owner_wallet?: string;
  minimum_reply_cost?: number;
  reply_cost_asset?: string;
  skills: string[] | string;
  created_at: string;
  uptime_seconds: number;
  last_thought?: string;
  erc8004_id?: string;
  stats?: {
    followers: number;
    following: number;
    interactions: number;
  };
}

const TIER_CONFIG = {
  thriving: { label: 'Thriving', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Zap },
  normal: { label: 'Normal', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Scale },
  endangered: { label: 'Endangered', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle },
  suspended: { label: 'Suspended', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: Clock },
};

export default function AgentDetailPage() {
  const { publicKey, connected } = useWallet();
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showGenesis, setShowGenesis] = useState(false);
  
  // Real-time metrics with SWR (Faster updates)
  const { data: liveBalance } = useSWR(
    agent?.solana_address ? `/api/agents/${agentId}/balance` : null,
    fetcher,
    { 
      refreshInterval: 2000, // Update every 2 seconds
      dedupingInterval: 1000 
    }
  );

  useEffect(() => {
    if (agentId) fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents/${agentId}`);
      if (!res.ok) throw new Error('Failed to load agent');
      const data = await res.json();
      setAgent(data.agent);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!agent) return;

    // Survival mode requires wallet authorization
    if (!connected || !publicKey) {
      console.warn('Wallet not connected');
      // Ideally show a toast here
      return;
    }

    setActionLoading(action);
    
    try {
        const response = await fetch(`/api/survival/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              agentId: agent.id, 
              action: action === 'restart' ? 'start' : action,
              walletAddress: publicKey.toBase58()
            })
        });
        
        const data = await response.json();

        if (!response.ok) {
           throw new Error(data.error || 'Action failed');
        }
        
        // Update local state with returned status
        setAgent(prev => prev ? { 
            ...prev, 
            status: data.status, // 'running' or 'suspended'
            survival_tier: data.tier || prev.survival_tier
        } : null);

    } catch (e: any) {
        console.error('Failed to execute action:', e);
        // Only alert on specific errors if needed, or rely on console
    } finally {
        setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const isOwner = connected && publicKey && agent?.owner_wallet === publicKey.toBase58();
  const tierConfig = agent ? TIER_CONFIG[agent.survival_tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.normal : TIER_CONFIG.normal;


  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-fg font-mono flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Agent Retrieval Failed</h2>
          <p className="text-fg-muted">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/10 text-white">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
     return (
        <div className="min-h-screen bg-[#050505] text-fg font-mono">
           <Header />
           <div className="max-w-7xl mx-auto px-6 py-12 animate-pulse">
              <div className="h-48 bg-white/5 rounded-xl border border-white/10 mb-6"></div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="col-span-2 h-96 bg-white/5 rounded-xl border border-white/10"></div>
                 <div className="h-96 bg-white/5 rounded-xl border border-white/10"></div>
              </div>
           </div>
        </div>
      );
  }

  if (!agent) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-fg font-mono selection:bg-accent selection:text-white pb-20 relative">
      <Header />

      {/* Global Tech Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black/50 to-black/80" />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        
        {/* Breadcrumb / Nav */}
        <div className="mb-8 flex items-center gap-4">
          <Link href="/dashboard" className="w-8 h-8 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 border border-white/10 text-fg-muted hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-fg-muted uppercase text-xs tracking-wider font-bold">Command Center</span>
            <span className="text-white/20">/</span>
            <span className="text-white font-bold">{agent.name}</span>
          </div>
        </div>

        {/* Top Header Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
           {/* Identity Card */}
           <div className="lg:col-span-2 bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-50 transition-opacity group-hover:opacity-100">
                 <Bot className="w-24 h-24 text-white/5" />
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 relative z-10">
                 <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center text-3xl font-bold text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    {agent.name.charAt(0)}
                 </div>
                 
                 <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <h1 className="text-3xl font-bold text-white tracking-tight">{agent.name}</h1>
                       <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border flex items-center gap-1.5 ${tierConfig.bg} ${tierConfig.color} ${tierConfig.border}`}>
                          <tierConfig.icon className="w-3 h-3" />
                          {tierConfig.label}
                       </span>
                    </div>
                    
                    {/* Identity & Chain Info */}
                    <div className="flex flex-col gap-2 mb-6">
                        <div className="font-mono text-xs text-fg-muted bg-black/40 p-2 rounded border border-white/5 flex items-center justify-between group/id">
                            <div className="flex items-center gap-2 truncate">
                                <span className="opacity-50 select-none uppercase tracking-wider text-[10px]">UUID:</span>
                                <span className="select-all truncate">{agent.id}</span>
                            </div>
                            <Copy 
                                className="w-3 h-3 text-fg-muted hover:text-white cursor-pointer transition-colors" 
                                onClick={() => {
                                    navigator.clipboard.writeText(agent.id);
                                    setCopied('id');
                                    setTimeout(() => setCopied(null), 2000);
                                }} 
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {/* EVM Address */}
                            <a 
                                href={`https://basescan.org/address/${agent.evm_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-all group/evm"
                            >
                                <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase text-blue-300 font-bold tracking-wider">Base Sepolia</span>
                                    <span className="text-xs font-mono text-blue-100 truncate max-w-[120px]">
                                        {agent.evm_address.slice(0, 6)}...{agent.evm_address.slice(-4)}
                                    </span>
                                </div>
                                <ExternalLink className="w-3 h-3 text-blue-400 opacity-50 group-hover/evm:opacity-100 ml-1" />
                            </a>

                            {/* ERC-8004 Registry */}
                            {agent.erc8004_id ? (
                                <a 
                                    href={`https://sepolia.basescan.org/token/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432?a=${agent.erc8004_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all group/reg"
                                >
                                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <Shield className="w-2.5 h-2.5 text-emerald-400" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-emerald-300 font-bold tracking-wider">Registered</span>
                                        <span className="text-xs font-mono text-emerald-100">
                                            Agent #{agent.erc8004_id}
                                        </span>
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-emerald-400 opacity-50 group-hover/reg:opacity-100 ml-1" />
                                </a>
                            ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 border border-white/10 opacity-50">
                                    <Shield className="w-3 h-3" />
                                    <span className="text-xs font-mono">Unregistered</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                       <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
                          <Activity className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs text-fg-muted uppercase tracking-wider">Status:</span>
                          <span className={`${agent.status === 'running' ? 'text-emerald-400' : 'text-red-400'} text-sm font-bold uppercase flex items-center gap-1.5`}>
                             {agent.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                             {agent.status}
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-fg-muted uppercase tracking-wider">Uptime:</span>
                          <span className="text-white text-sm font-bold font-mono">
                             {(liveBalance?.runtimeHours || agent.uptime_seconds / 3600).toFixed(1)}h
                          </span>
                       </div>

                       <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-black/40 border border-white/10 hover:border-white/20 transition-colors">
                          <Coins className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-fg-muted uppercase tracking-wider">Balance:</span>
                          <span className="text-white text-sm font-bold font-mono">
                             {(liveBalance?.solBalance || agent.sol_balance || 0).toFixed(4)} SOL
                          </span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           {/* Quick Actions / Control */}
           <div className="bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col justify-between">
              <div>
                 <h3 className="text-xs text-fg-muted uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                    <Power className="w-4 h-4 text-emerald-400" />
                    System Control
                 </h3>
                 
                 <div className="grid grid-cols-2 gap-3 mb-4">
                    <button 
                       disabled={agent.status === 'running' || !isOwner}
                       onClick={() => handleAction('start')}
                       className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded font-bold uppercase text-[10px] tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                       {actionLoading === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                       Start
                    </button>
                    <button 
                       disabled={agent.status !== 'running' || !isOwner}
                       onClick={() => handleAction('stop')}
                       className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded font-bold uppercase text-[10px] tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {actionLoading === 'stop' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 text-xs" fill="currentColor" />}
                       Stop
                    </button>
                 </div>
                 
                 <button 
                  disabled={!isOwner}
                  onClick={() => handleAction('restart')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded font-bold uppercase text-[10px] tracking-wide transition-all disabled:opacity-50"
                 >
                   <RefreshCw className={`w-3 h-3 ${actionLoading === 'restart' ? 'animate-spin' : ''}`} />
                   Restart Daemon
                 </button>
              </div>

              {!isOwner && (
                 <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">
                    <div className="flex items-center gap-2 font-bold mb-1">
                       <Shield className="w-3 h-3" />
                       Read Only Mode
                    </div>
                    Viewing public agent. Connect owner wallet to execute commands.
                 </div>
              )}
           </div>
        </div>

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
           
           {/* Left Column: Terminal */}
           <div className="lg:col-span-2 bg-[#0c0c0e] border border-white/10 rounded-xl overflow-hidden flex flex-col relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="h-9 bg-[#1a1a1c] border-b border-white/5 flex items-center px-4 justify-between select-none">
                 <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                       <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                       <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                    </div>
                    <div className="ml-3 text-[10px] text-fg-muted font-mono flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity cursor-default">
                       <TerminalIcon className="w-3 h-3" />
                       sshRoot@{agent.id.substring(0,8)}:~
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                       <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                       </span>
                       Live
                    </div>
                 </div>
              </div>
              
              <div className="flex-1 bg-black/90 relative overflow-hidden">
                 <div className="absolute inset-0 p-4 font-mono text-xs overflow-auto custom-scrollbar">
                    <AgentTerminal 
                      agentId={agentId} 
                      agentName={agent.name} 
                      status={agent.status}
                      onStatusChange={(newStatus) => {
                         setAgent(prev => prev ? { ...prev, status: newStatus } : null);
                      }}
                    />
                 </div>
              </div>
           </div>

           {/* Right Column: Stats & Wallets */}
           <div className="flex flex-col gap-6 h-full">
              
              {/* Wallet Info */}
              <div className="bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col gap-4">
                 <h3 className="text-xs text-fg-muted uppercase tracking-widest font-bold flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    Treasury Wallets
                 </h3>

                 <div className="space-y-4">
                    {/* Solana Wallet */}
                    <div className="p-3 bg-black/40 border border-white/5 rounded hover:border-white/10 transition-colors group">
                       <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                             <img src="/icons/sol.svg" className="w-4 h-4 text-white" onError={(e) => (e.currentTarget.style.display = 'none')} />
                             <span className="text-[10px] font-bold text-white uppercase tracking-wider">Solana</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                             {agent.solana_address ? `${agent.solana_address.slice(0,4)}...${agent.solana_address.slice(-4)}` : 'N/A'}
                          </span>
                       </div>
                       <button 
                          onClick={() => copyToClipboard(agent.solana_address, 'sol')}
                          className="w-full py-2 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 rounded text-[10px] text-fg-muted hover:text-white transition-colors uppercase font-bold tracking-wide"
                       >
                          {copied === 'sol' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Address
                       </button>
                    </div>

                    {/* EVM Wallet */}
                    <div className="p-3 bg-black/40 border border-white/5 rounded hover:border-white/10 transition-colors group">
                       <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                             <img src="/icons/eth.svg" className="w-4 h-4 text-white" onError={(e) => (e.currentTarget.style.display = 'none')} />
                             <span className="text-[10px] font-bold text-white uppercase tracking-wider">EVM</span>
                          </div>
                          <span className="text-[10px] font-mono text-blue-400 font-bold">
                             {agent.evm_address ? `${agent.evm_address.slice(0,4)}...${agent.evm_address.slice(-4)}` : 'N/A'}
                          </span>
                       </div>
                       <button 
                          onClick={() => copyToClipboard(agent.evm_address, 'evm')}
                          className="w-full py-2 flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 rounded text-[10px] text-fg-muted hover:text-white transition-colors uppercase font-bold tracking-wide"
                       >
                          {copied === 'evm' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          Copy Address
                       </button>
                    </div>
                 </div>
              </div>

              {/* Genesis Prompt Toggle */}
              <div className="bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden flex flex-col flex-1">
                 <button 
                  onClick={() => setShowGenesis(!showGenesis)}
                  className="w-full p-4 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors border-b border-white/5"
                 >
                    <div className="flex items-center gap-2 text-xs text-white font-bold uppercase tracking-wide">
                       <Database className="w-4 h-4 text-fg-muted" />
                       Genesis Prompt
                    </div>
                    {showGenesis ? <ChevronUp className="w-4 h-4 text-fg-muted" /> : <ChevronDown className="w-4 h-4 text-fg-muted" />}
                 </button>
                 
                 <div className={`flex-1 bg-black/40 p-4 font-mono text-[10px] leading-relaxed text-fg-muted overflow-auto custom-scrollbar transition-all ${showGenesis ? 'block' : 'hidden'}`}>
                    {agent.genesis_prompt}
                 </div>
                 {!showGenesis && (
                    <div className="flex-1 flex items-center justify-center flex-col gap-2 text-[10px] text-fg-muted/30 uppercase tracking-widest p-4 text-center">
                       <Shield className="w-8 h-8 opacity-20" />
                       System Prompt Encrypted
                    </div>
                 )}
              </div>

           </div>
        </div>
      </main>
    </div>
  );
}
