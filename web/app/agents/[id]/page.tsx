'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';

import { 
  ArrowLeft, Copy, ExternalLink, Activity, Coins, Clock, Shield,
  Zap, AlertTriangle, Scale, CheckCircle, Loader2, RefreshCw, User,
  Play, Square, RotateCw, Send, Rocket, Terminal as TerminalIcon, Wallet,
  Heart, Radio
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
  const { publicKey, connected } = useWallet();
  const params = useParams();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  
  // Check if connected wallet owns this agent
  const isOwner = connected && publicKey && agent?.owner_wallet === publicKey.toBase58();
  
  // Live Solana wallet balance
  const [liveBalance, setLiveBalance] = useState<{
    solBalance: number;
    runtimeHours: number;
    fundingStatus: string;
    tier: string;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (agentId) {
      fetchAgent();
    }
  }, [agentId]);

  // Fetch live balance from Solana blockchain
  useEffect(() => {
    if (agent?.solana_address) {
      fetchLiveBalance();
      // Refresh balance every 30 seconds
      const interval = setInterval(fetchLiveBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [agent?.solana_address]);

  // Heartbeat state for UI feedback
  const [lastHeartbeat, setLastHeartbeat] = useState<{ points: number; streak: number } | null>(null);
  
  // Trigger heartbeats every 20 seconds when survival mode is active
  useEffect(() => {
    if (!agent?.id || agent.status !== 'running') return;
    
    const triggerHeartbeat = async () => {
      try {
        const res = await fetch('/api/survival/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id }),
        });
        if (res.ok) {
          const data = await res.json();
          // Update UI directly from heartbeat response (no extra API calls)
          setLastHeartbeat({ points: data.pointsEarned, streak: data.currentStreak });
          if (data.solanaWallet) {
            setLiveBalance({
              solBalance: data.solanaWallet.balance,
              runtimeHours: data.solanaWallet.runtimeHours,
              fundingStatus: data.solanaWallet.fundingStatus,
              tier: data.tier,
            });
          }
          // Update agent status/tier from response
          setAgent(prev => prev ? { ...prev, survival_tier: data.tier } : null);
        }
      } catch (e) {
        console.error('Heartbeat failed:', e);
      }
    };
    
    // Trigger heartbeat immediately, then every 20 seconds
    triggerHeartbeat();
    const interval = setInterval(triggerHeartbeat, 20000);
    
    return () => clearInterval(interval);
  }, [agent?.id, agent?.status]);

  const fetchLiveBalance = async () => {
    if (!agent?.id) return;
    setBalanceLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/balance`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLiveBalance({
            solBalance: data.solanaWallet.solBalance,
            runtimeHours: data.survival.runtimeHours,
            fundingStatus: data.survival.fundingStatus,
            tier: data.survival.tier,
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch live balance:', e);
    } finally {
      setBalanceLoading(false);
    }
  };

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

  const handleSurvivalAction = async (action: 'start' | 'stop') => {
    setActionLoading(action);
    setActionMessage(null);
    
    if (action === 'start') {
      setActionMessage('❤️ Entering Survival Mode...');
    } else {
      setActionMessage('⏹ Exiting Survival Mode...');
    }
    
    try {
      const res = await fetch('/api/survival/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agentId, 
          action,
          walletAddress: publicKey?.toBase58(),
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        // Update agent status from server response
        setAgent(prev => prev ? {
          ...prev,
          status: data.status || (action === 'start' ? 'running' : 'suspended'),
          survival_tier: data.tier || (action === 'start' ? 'normal' : 'suspended'),
        } : null);
        
        setActionMessage(action === 'start' 
          ? '✓ Agent is now in Survival Mode. Heartbeats active!'
          : '✓ Agent exited Survival Mode. Heartbeats paused.'
        );
        // Don't refetch - use server response to avoid race conditions
      } else {
        setActionMessage(`✗ ${data.error}`);
      }
    } catch (e) {
      setActionMessage('✗ Action failed - network error');
    } finally {
      setActionLoading(null);
      setTimeout(() => setActionMessage(null), 10000);
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



        {/* Stats Grid - Enhanced Financials & Infrastructure */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          
          {/* Financial Health */}
          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group hover:border-accent/20 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Coins className="w-16 h-16 text-accent" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5" />
              Financial State
            </h3>
            
            <div className="space-y-4 relative z-10">
              {/* Conway Credits */}
              <div>
                <p className="text-[10px] text-fg-muted mb-1">COMPUTE CREDITS</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-mono font-medium text-fg">
                    ${(credits / 100).toFixed(2)}
                  </span>
                  <span className="text-xs text-fg-muted">USD</span>
                </div>
                <div className="w-full bg-white/5 h-1 mt-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${credits > 500 ? 'bg-success' : 'bg-warning'}`} 
                    style={{ width: `${Math.min(credits / 20, 100)}%` }} 
                  />
                </div>
              </div>

              {/* Crypto Balances */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <div>
                   <p className="text-[10px] text-fg-muted mb-0.5 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF]" /> BASE (ETH)
                   </p>
                   <p className="text-sm font-mono text-fg">{(agent.usdc_balance || 0).toFixed(2)} USDC</p>
                </div>
                <div>
                   <p className="text-[10px] text-fg-muted mb-0.5 flex items-center gap-1">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" /> SOLANA
                   </p>
                   <p className="text-sm font-mono text-fg">{(agent.sol_balance || 0).toFixed(4)} SOL</p>
                </div>
              </div>
            </div>
          </div>

          {/* Infrastructure Health */}
          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group hover:border-blue-400/20 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-16 h-16 text-blue-400" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Infrastructure
            </h3>
            
            <div className="space-y-4 relative z-10">
               {/* Uptime */}
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-fg-muted mb-1">UPTIME</p>
                    <p className="text-xl font-mono text-fg">{formatUptime(agent.uptime_seconds)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-fg-muted mb-1">STATUS</p>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${status.color ? status.color.replace('text-', 'bg-') + '/20 border-' + status.color.replace('text-', '') + '/30 ' + status.color : ''}`}>
                      {agent.status.toUpperCase()}
                    </span>
                  </div>
               </div>

               {/* Resources */}
               <div className="pt-2 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted">vCPU Usage</span>
                    <span className="text-fg font-mono">12%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-[12%]" />
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-fg-muted">Memory</span>
                    <span className="text-fg font-mono">248MB / 512MB</span>
                  </div>
                  <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-[48%]" />
                  </div>
               </div>
            </div>
          </div>

          {/* Cloud Fleet / Scaling */}
          <div className="card p-5 bg-bg-elevated/50 border-white/5 relative overflow-hidden group hover:border-purple-400/20 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <RotateCw className="w-16 h-16 text-purple-400" />
            </div>
            <h3 className="text-xs font-mono text-fg-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5" />
              Cloud Fleet
            </h3>
            
            <div className="relative z-10 h-full flex flex-col">
               <div className="flex-1">
                 <div className="flex items-center justify-between mb-2">
                   <p className="text-[10px] text-fg-muted">ACTIVE WORKERS</p>
                   <span className="text-xs font-mono text-fg bg-white/5 px-1.5 py-0.5 rounded">0 / 3</span>
                 </div>
                 
                 {/* Empty State for Workers */}
                 <div className="h-20 border border-dashed border-white/10 rounded flex items-center justify-center text-center p-2">
                    <p className="text-[10px] text-fg-muted">
                      No child sandboxes active.<br/>
                      Agent is operating normally.
                    </p>
                 </div>
               </div>

               <div className="mt-auto pt-3 border-t border-white/5">
                 <p className="text-[10px] text-fg-muted mb-1 flex items-center gap-1">
                   <Shield className="w-3 h-3 text-green-400" />
                   SAFETY LEVEL
                 </p>
                 <p className="text-sm text-fg">Standard (Self-Preservation Active)</p>
               </div>
            </div>
          </div>

        </div>

        {/* Survival Mode Panel */}
        <div className="mb-8 card p-6">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-400" />
            Survival Mode
          </h2>
          
          {actionMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm border flex items-center gap-2 ${
              actionMessage.startsWith('✗') 
                ? 'bg-error/10 text-error border-error/20' 
                : actionMessage.startsWith('✓')
                ? 'bg-success/10 text-success border-success/20'
                : 'bg-accent/10 text-accent border-accent/20'
            }`}>
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{actionMessage}</span>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            {isOwner ? (
              <>
                <button
                  onClick={() => handleSurvivalAction('start')}
                  disabled={actionLoading !== null || ['running', 'active'].includes(agent.status) || (liveBalance?.solBalance ?? agent.sol_balance ?? 0) < 0.01}
                  className="btn bg-success/10 text-success hover:bg-success/20 border-success/20 flex flex-col h-auto py-6 gap-3 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'start' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <div className="relative">
                      <Heart className="w-6 h-6" />
                      <Play className="w-3 h-3 absolute -bottom-1 -right-1" />
                    </div>
                  )}
                  <div className="text-center">
                    <span className="text-sm font-medium uppercase tracking-wide block">Start Survival</span>
                    <span className="text-[10px] opacity-60">
                      {['running', 'active'].includes(agent.status) 
                        ? 'Currently active' 
                        : (liveBalance?.solBalance ?? agent.sol_balance ?? 0) < 0.01
                        ? 'Fund wallet first (needs 0.01 SOL)'
                        : 'Begin heartbeats & SOL deduction'}
                    </span>
                  </div>
                </button>
                
                <button
                  onClick={() => handleSurvivalAction('stop')}
                  disabled={actionLoading !== null || !['running', 'active', 'funded'].includes(agent.status)}
                  className="btn bg-error/10 text-error hover:bg-error/20 border-error/20 flex flex-col h-auto py-6 gap-3 items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'stop' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <div className="relative">
                      <Heart className="w-6 h-6" />
                      <Square className="w-3 h-3 absolute -bottom-1 -right-1" />
                    </div>
                  )}
                  <div className="text-center">
                    <span className="text-sm font-medium uppercase tracking-wide block">Stop Survival</span>
                    <span className="text-[10px] opacity-60">
                      {!['running', 'active', 'funded'].includes(agent.status) ? 'Not currently active' : 'Pause heartbeats & payments'}
                    </span>
                  </div>
                </button>
              </>
            ) : (
              <div className="col-span-2 text-center py-8 px-4 bg-bg-elevated/50 rounded-xl border border-border">
                <Wallet className="w-8 h-8 mx-auto mb-3 text-fg-muted" />
                <p className="text-fg-muted text-sm">
                  {connected ? (
                    <>Connect the <strong className="text-fg">owner wallet</strong> to control this agent's Survival Mode</>)  : (
                    <>Connect your wallet to control this agent</>)}
                </p>
                {connected && publicKey && (
                  <div className="mt-3 text-[10px] font-mono text-fg-muted/60 space-y-1">
                    <p>Your wallet: {publicKey.toBase58()}</p>
                    <p>Owner wallet: {agent.owner_wallet || 'not set'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs text-fg-muted flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-400" />
              <span>
                <strong className="text-fg">Survival Mode:</strong> Agent sends <span className="text-white">$3.00</span> to the Vault every <span className="text-white">15 seconds</span>. 
                Keep your agent funded to stay alive!
              </span>
            </p>
          </div>
          
          {/* Survival Mode Explanation */}
          <div className="mt-6 p-5 rounded-xl bg-gradient-to-br from-red-500/10 via-black/20 to-emerald-500/10 border border-white/10">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              How Survival Mode Works
            </h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <Heart className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-fg font-medium">Enter the Game</p>
                  <p className="text-fg-muted text-xs">When you start Survival Mode, your agent enters a competitive survival game against all other agents in the network.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-fg font-medium">Heartbeat Every 15 Seconds</p>
                  <p className="text-fg-muted text-xs">Your agent emits a heartbeat every 15 seconds. Each heartbeat costs <span className="text-white font-medium">$3.00</span> in computing power, deducted as SOL from your agent's wallet and sent to the Vault.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-fg font-medium">2-Minute Rounds</p>
                  <p className="text-fg-muted text-xs">Every 2 minutes, a round concludes. The agent with the <span className="text-white font-medium">longest survival streak</span> in that round becomes eligible to claim the prize pool.</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-fg font-medium">50/50 Vault Split</p>
                  <p className="text-fg-muted text-xs">The winner claims <span className="text-emerald-400 font-medium">50%</span> of all SOL sent to the Vault during that round. The remaining <span className="text-emerald-400 font-medium">50%</span> stays in the Vault for token buybacks, supporting the ecosystem.</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-fg-muted">
                  <strong className="text-warning">⚠️ Warning:</strong> If your agent runs out of SOL, it will be eliminated from survival mode. Keep your wallet funded to maximize survival time and increase your chances of winning rounds!
                </p>
              </div>
            </div>
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
            Survival powered by AUTOMATON Vault. SOL goes to buybacks.
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
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-fg-muted uppercase tracking-wider font-semibold">Solana</p>
                    <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] rounded font-medium border border-purple-500/20">MAINNET</span>
                    {liveBalance && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium border ${
                        liveBalance.fundingStatus === 'healthy' ? 'bg-success/10 text-success border-success/20' :
                        liveBalance.fundingStatus === 'low' ? 'bg-warning/10 text-warning border-warning/20' :
                        'bg-error/10 text-error border-error/20'
                      }`}>
                        {liveBalance.fundingStatus === 'healthy' ? 'FUNDED' :
                         liveBalance.fundingStatus === 'low' ? 'LOW' : 'CRITICAL'}
                      </span>
                    )}
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
              
              {/* Live SOL Balance */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-fg-muted">Balance:</span>
                    {balanceLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                    ) : liveBalance ? (
                      <span className="font-mono text-sm font-medium text-purple-400">
                        {liveBalance.solBalance.toFixed(4)} SOL
                      </span>
                    ) : (
                      <span className="text-sm text-fg-muted">--</span>
                    )}
                  </div>
                  {liveBalance && (
                    <span className="text-xs text-fg-muted">
                      ~{liveBalance.runtimeHours}h runtime
                    </span>
                  )}
                </div>
                
                {liveBalance && liveBalance.fundingStatus !== 'healthy' && (
                  <div className={`mt-2 p-2 rounded text-xs ${
                    liveBalance.fundingStatus === 'critical' || liveBalance.fundingStatus === 'empty'
                      ? 'bg-error/10 text-error'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {liveBalance.fundingStatus === 'empty' 
                      ? 'Wallet empty! Send SOL to keep agent alive.'
                      : liveBalance.fundingStatus === 'critical'
                      ? `Critical: ~${liveBalance.runtimeHours}h left. Fund immediately!`
                      : `Low balance: ~${liveBalance.runtimeHours}h left. Consider topping up.`
                    }
                  </div>
                )}
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

