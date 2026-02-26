'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { 
  Loader2, AlertTriangle, Plus, Coins, Clock, Zap, Scale,
  RefreshCw, Wallet, ArrowRight, Users, Activity, Copy, Check,
  Play, Square, RotateCw, Upload, Terminal, Bot, Globe,
  Shield, ExternalLink
} from 'lucide-react';
import Header from '@/components/Header';
import { useNotifications } from '@/components/Toast';
import { useOwnerAgents, useAgents, useInvalidateData } from '@/lib/hooks/use-realtime';

// Stats component import
const StatCard = dynamic(() => import('@/components/StatCard'), { ssr: false });
const ActivityFeed = dynamic(() => import('@/components/ActivityFeed'), { ssr: false });

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false, loading: () => <div className="h-9 w-32 bg-white/5 border border-white/10 rounded animate-pulse" /> }
);

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  evm_address: string;
  solana_address: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  uptime_seconds: number;
  skills: string[];
  created_at: string;
  owner_wallet?: string;
  last_thought?: string;
}

type FleetView = 'my-agents' | 'ecosystem';

export default function Dashboard() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const notifications = useNotifications();
  
  // Real-time data hooks - auto-refresh every 10 seconds
  const { data: ownerData, isLoading: ownerLoading, error: ownerError } = useOwnerAgents(
    connected && publicKey ? publicKey.toBase58() : null
  );
  const { data: ecosystemData, isLoading: ecosystemLoading } = useAgents();
  const { invalidateAgents } = useInvalidateData();
  
  const agents = ownerData?.agents || [];
  const ecosystemAgents = ecosystemData?.agents || [];
  const loading = ownerLoading && connected;
  const error = ownerError ? 'Failed to load your agents' : null;
  
  const [copied, setCopied] = useState<string | null>(null);
  const [fleetView, setFleetView] = useState<FleetView>('ecosystem');
  const alertedAgentsRef = useRef<Set<string>>(new Set());

  // Set initial view based on connection
  useEffect(() => {
    if (connected) {
      setFleetView('my-agents');
    } else {
      setFleetView('ecosystem');
    }
  }, [connected]);

  // Derived stats
  const activeAgents = (fleetView === 'my-agents' ? agents : ecosystemAgents).filter((a: Agent) => a.status === 'running').length;
  const totalFleetValue = (fleetView === 'my-agents' ? agents : ecosystemAgents).reduce((acc: number, a: Agent) => acc + (a.credits_balance || 0), 0);
  const avgUptime = (fleetView === 'my-agents' ? agents : ecosystemAgents).reduce((acc: number, a: Agent) => acc + (a.uptime_seconds || 0), 0) / (agents.length || 1);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h`;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-fg font-mono selection:bg-accent selection:text-white overflow-hidden relative">
      <Header />

      {/* Global Tech Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black/50 to-black/80" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] uppercase tracking-widest font-bold mb-4">
              <Activity className="w-3 h-3" />
              Fleet Command
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Mission Control</h1>
            <p className="text-fg-muted max-w-xl">
              Monitor, fund, and command your autonomous agents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href="/create" 
              className="px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-wide hover:bg-white/90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] group"
            >
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Deploy Agent
            </Link>
            {!connected && (
               <div className="h-[44px]"> <WalletMultiButton /> </div>
            )}
          </div>
        </div>

        {/* View Toggle & Stats */}
        <div className="grid lg:grid-cols-4 gap-6 mb-12">
           <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Active Agents" value={activeAgents.toString()} icon={<Bot className="w-5 h-5 text-emerald-400" />} />
              <StatCard label="Total Resources" value={`$${totalFleetValue.toFixed(2)}`} icon={<Coins className="w-5 h-5 text-yellow-400" />} />
              <StatCard label="Avg Uptime" value={formatUptime(avgUptime)} icon={<Clock className="w-5 h-5 text-blue-400" />} />
           </div>
           
           <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex flex-col justify-center gap-1">
              <button 
                onClick={() => setFleetView('my-agents')}
                disabled={!connected}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-left ${
                  fleetView === 'my-agents' 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                    : 'text-fg-muted hover:bg-white/5 hover:text-white'
                } ${!connected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="p-1.5 rounded bg-current/10"><Users className="w-4 h-4" /></div>
                <div>
                  <div className="leading-none mb-1">My Fleet</div>
                  <div className="text-[10px] opacity-60 font-normal uppercase tracking-wider">
                    {connected ? `${agents.length} Deployed` : 'Connect Wallet'}
                  </div>
                </div>
              </button>

              <button 
                onClick={() => setFleetView('ecosystem')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all w-full text-left ${
                  fleetView === 'ecosystem'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                    : 'text-fg-muted hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="p-1.5 rounded bg-current/10"><Globe className="w-4 h-4" /></div>
                <div>
                  <div className="leading-none mb-1">Ecosystem</div>
                  <div className="text-[10px] opacity-60 font-normal uppercase tracking-wider">
                    {ecosystemAgents.length} Visible
                  </div>
                </div>
              </button>
           </div>
        </div>

        {/* Agent Grid */}
        <div className="mb-8 flex items-center justify-between">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <Terminal className="w-5 h-5 text-fg-muted" />
             {fleetView === 'my-agents' ? 'Your Deployments' : 'Public Network'}
           </h2>
           
           {loading && <Loader2 className="w-5 h-5 animate-spin text-fg-muted" />}
        </div>

        {!connected && fleetView === 'my-agents' ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
            <Wallet className="w-12 h-12 text-fg-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Wallet Disconnected</h3>
            <p className="text-fg-muted mb-8 max-w-md mx-auto">Connect your wallet to view and manage your autonomous agents.</p>
            <div className="inline-block">
              <WalletMultiButton />
            </div>
          </div>
        ) : (fleetView === 'my-agents' && agents.length === 0 && !loading) ? (
          <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
             <Bot className="w-12 h-12 text-fg-muted mx-auto mb-4 opacity-50" />
             <h3 className="text-xl font-bold text-white mb-2">No Agents Found</h3>
             <p className="text-fg-muted mb-8 max-w-md mx-auto">You haven't deployed any sovereign agents yet.</p>
             <Link href="/create" className="btn btn-primary px-8 py-3">
               Initialize First Agent
             </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(fleetView === 'my-agents' ? agents : ecosystemAgents).map((agent: Agent) => (
              <AgentDashboardCard 
                key={agent.id} 
                agent={agent} 
                isOwner={fleetView === 'my-agents'} 
                onCopy={(text, type) => copyToClipboard(text, type ? `${agent.id}-${type}` : agent.id)}
                copiedId={copied}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentDashboardCard({ agent, isOwner, onCopy, copiedId }: { agent: Agent; isOwner: boolean; onCopy: (t: string, type?: string) => void; copiedId: string | null }) {
  const statusColor = agent.status === 'running' ? 'text-emerald-400' : agent.status === 'suspended' ? 'text-red-400' : 'text-yellow-400';
  const statusBg = agent.status === 'running' ? 'bg-emerald-500' : agent.status === 'suspended' ? 'bg-red-500' : 'bg-yellow-500';

  return (
    <div className="group relative bg-[#0c0c0e]/80 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300 flex flex-col h-full">
       {/* Accents */}
       <div className={`absolute top-0 left-0 w-full h-1 ${statusBg} opacity-50`} />
       
       <div className="p-6 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center font-bold text-lg text-white">
                  {agent.name.charAt(0)}
                </div>
                <div>
                   <h3 className="font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                     {agent.name}
                     <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                   </h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold ${statusColor}`}>
                         <span className={`w-1.5 h-1.5 rounded-full ${statusBg} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
                         {agent.status}
                      </span>
                      <span className="text-[10px] text-fg-muted font-mono px-1.5 py-0.5 rounded border border-white/5 bg-white/5">
                        {agent.survival_tier || 'basic'}
                      </span>
                   </div>
                </div>
             </div>
          </div>

          {/* Terminal Output */}
          <div className="bg-black/40 rounded border border-white/5 p-3 mb-4 font-mono text-xs h-24 overflow-hidden relative group-hover:border-white/10 transition-colors">
             <div className="absolute top-2 right-2 flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/20" />
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/20" />
             </div>
             <div className="text-fg-muted opacity-50 mb-1">$ tail -f thought_process.log</div>
             <div className="text-emerald-400/90 leading-relaxed max-h-[60px] overflow-hidden">
               {agent.last_thought || "> System initialized. Monitoring blockchain state for arbitrage opportunities..."}
             </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-4">
             <div className="p-2 rounded bg-white/5 border border-white/5">
                <div className="text-[10px] text-fg-muted uppercase tracking-wider mb-1">Balance</div>
                <div className="text-sm font-mono text-white">${agent.credits_balance?.toFixed(2) || '0.00'}</div>
             </div>
             <div className="p-2 rounded bg-white/5 border border-white/5">
                <div className="text-[10px] text-fg-muted uppercase tracking-wider mb-1">Uptime</div>
                <div className="text-sm font-mono text-white">{(agent.uptime_seconds / 3600).toFixed(1)}h</div>
             </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-2">
             <div className="flex items-center justify-between gap-2">
                <button 
                  onClick={() => onCopy(agent.evm_address, 'evm')}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-fg-muted hover:text-white transition-colors px-2 py-2 rounded bg-white/5 hover:bg-white/10"
                  title="Copy EVM Address"
                >
                  <span className="font-bold text-[9px] text-[#627eea]">EVM</span>
                  {copiedId === `${agent.id}-evm` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>

                <button 
                  onClick={() => onCopy(agent.solana_address, 'sol')}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-fg-muted hover:text-white transition-colors px-2 py-2 rounded bg-white/5 hover:bg-white/10"
                  title="Copy Solana Address"
                >
                  <span className="font-bold text-[9px] text-[#9945FF]">SOL</span>
                  {copiedId === `${agent.id}-sol` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
             </div>
             
             <Link 
               href={`/agents/${agent.id}`}
               className="w-full text-center px-3 py-2 bg-white text-black text-xs font-bold uppercase tracking-wide rounded hover:bg-white/90 transition-colors flex items-center justify-center gap-1.5 mt-2"
             >
               Command Center <ArrowRight className="w-3 h-3" />
             </Link>
          </div>
       </div>
    </div>
  );
}
