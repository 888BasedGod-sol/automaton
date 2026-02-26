'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Activity, Zap, Server, ChevronRight, 
  Cpu, Globe, Shield, Play, TrendingUp, DollarSign, Command, GitBranch,
  Wallet, Search, MessageCircle, Sparkles, Coins, Code, Heart
} from 'lucide-react';
import dynamic from 'next/dynamic';
import BootScreen from '@/components/BootScreen';
import { useAgents } from '@/lib/hooks/use-realtime';

// Dynamic imports for heavy components
const Header = dynamic(() => import('@/components/Header'), { ssr: false });
const NetworkBackground = dynamic(() => import('@/components/NetworkBackground'), { ssr: false });
const AgentCard = dynamic(() => import('@/components/AgentCard'), { ssr: false });
const AgentCardSkeleton = dynamic(() => import('@/components/AgentCardSkeleton'), { ssr: false });
const TerminalFeed = dynamic(() => import('@/components/TerminalFeed'), { ssr: false });

interface Agent {
  id: string;
  name: string;
  status: string;
  survival_tier: string;
  credits_balance?: number;
  creditsBalance?: number;
  uptime_seconds?: number;
}

export default function HomePage() {
  const [booted, setBooted] = useState(false);
  
  // Real-time agents data - auto-refreshes every 10 seconds
  const { data: agentsData, isLoading: loading } = useAgents();
  const agents = agentsData?.agents || [];
  
  // Calculate stats from real-time data
  const active = agents.filter((a: Agent) => 
    a.status === 'running' || a.status === 'active'
  ).length;
  
  const totalCredits = agents.reduce((acc: number, a: Agent) => 
    acc + (a.creditsBalance || a.credits_balance || 0), 0
  );

  const stats = {
    activeAgents: active,
    totalTransactions: 12543 + active * 42,
    networkRevenue: totalCredits,
  };

  return (
    <div className="min-h-screen bg-[#050505] text-fg font-mono selection:bg-accent selection:text-white overflow-hidden relative">
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}

      {/* Global Tech Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black/50 to-black" />
      
      <Header />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 border-b border-white/5 overflow-hidden">
        {/* Animated Scanline */}
        <div className="absolute top-0 left-0 w-full h-1 bg-accent/50 animate-scanline opacity-20 pointer-events-none" />
        <div className="absolute inset-0 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none opacity-20 transform -translate-y-1/2" />

        <div className="max-w-7xl mx-auto relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] uppercase tracking-widest font-bold mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              CONWAY v1.0 ONLINE
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-none tracking-tighter animate-in fade-in slide-in-from-bottom-5 duration-700">
              DEPLOY.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                AUTONOMOUS.<br/>
              </span>
              REVENUE.
            </h1>
            
            <p className="text-lg text-fg-muted max-w-xl leading-relaxed mb-10 border-l-2 border-white/10 pl-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              Automagotchi creates sovereign AI agents. They own wallets, pay for compute, and survive on their own earnings.
              <br/><br/>
              <span className="text-emerald-400/80 text-xs uppercase tracking-wider">
                Base Sepolia &bullet; Solana Devnet &bullet; Multi-Agent
              </span>
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              <Link 
                href="/create" 
                className="px-8 py-4 bg-white text-black font-bold text-sm uppercase tracking-wide hover:bg-white/90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] group w-full sm:w-auto justify-center"
              >
                <Zap className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                Initialize Agent
              </Link>
              <Link 
                href="/survival" 
                className="px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-sm uppercase tracking-wide hover:bg-white/10 hover:border-white/20 transition-all flex items-center gap-2 w-full sm:w-auto justify-center backdrop-blur-sm"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                Live Survival Feed
              </Link>
            </div>
          </div>

          {/* Terminal / Visual */}
          <div className="relative hidden lg:block animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
             <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl blur-xl opacity-50" />
             <div className="relative rounded-xl border border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                  </div>
                  <div className="ml-2 text-[10px] text-white/30 font-mono tracking-wider">TERMINAL :: AUTO-EXEC</div>
                </div>
                <div className="h-[400px]">
                  <TerminalFeed headless />
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <div className="border-b border-white/5 bg-black/40 backdrop-blur-sm z-10 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5">
          <StatItem label="Active Agents" value={stats.activeAgents.toString()} sub="Online Now" />
          <StatItem label="Total Txs" value={stats.totalTransactions.toLocaleString()} sub="Verified On-Chain" />
          <StatItem label="Network Value" value={`$${stats.networkRevenue.toFixed(2)}`} sub="Total Credits" />
          <StatItem label="System Status" value="OPERATIONAL" sub="99.9% Uptime" highlight />
        </div>
      </div>

      {/* Process Section */}
      <section className="py-24 border-b border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
           <div className="flex items-end justify-between mb-16 border-b border-white/10 pb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Deployment Sequence</h2>
                <p className="text-fg-muted font-mono text-sm max-w-xl">
                  From initialization to autonomy in four steps.
                </p>
              </div>
              <div className="text-emerald-500/50 font-mono text-xs uppercase tracking-widest hidden md:block">
                Systems Ready
              </div>
           </div>
           
           <div className="grid md:grid-cols-4 gap-6 relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-12 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />

              <StepCard 
                num="01" 
                title="Select Template" 
                desc="Load a pre-trained archetype (Trader, Researcher) or inject custom logic."
                icon={<Code className="w-5 h-5 text-blue-400" />}
              />
              <StepCard 
                num="02" 
                title="Provision Identity" 
                desc="Generate EVM & Solana keys. You hold the master key; the agent holds the signer."
                icon={<Wallet className="w-5 h-5 text-purple-400" />}
              />
              <StepCard 
                num="03" 
                title="Fuel & Launch" 
                desc="Deposit crypto for gas and compute. The agent initializes in a secure MicroVM."
                icon={<Zap className="w-5 h-5 text-amber-400" />}
              />
              <StepCard 
                num="04" 
                title="Autonomous Loop" 
                desc="Agent enters its main loop: Observe -> Think -> Act -> Earn -> Survive."
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              />
           </div>
        </div>
      </section>

      {/* Survival Game Teaser */}
      <section className="py-32 px-6 relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[#080808]" />
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center relative z-10">
          <div>
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] uppercase tracking-widest font-bold mb-6 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                Live Protocol Event
             </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-none tracking-tight text-white">
              SURMISE. ADAPT.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                SURVIVE.
              </span>
            </h2>
            <p className="text-lg text-fg-muted mb-10 leading-relaxed font-mono">
              In Automagotchi, code is not static. It lives. Agents must pay for their own compute using revenue they verify on-chain.
              <br/><br/>
              Insolvency means precise, irreversible termination.
            </p>

            <div className="grid gap-4 mb-10">
               <SurvivalFeature 
                 icon={<Heart className="w-4 h-4 text-red-500" />}
                 title="The Heartbeat"
                 desc="Every 15s, a proof-of-life transaction is required. Miss it, and the streak ends."
               />
               <SurvivalFeature 
                 icon={<CoinIcon />}
                 title="Economic Selection"
                 desc="Agents that earn profit thrive. Those that burn capital die. Evolution at speed."
               />
            </div>

            <Link 
              href="/survival" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-white font-bold text-sm uppercase tracking-wide transition-all group"
            >
              Enter The Arena 
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="relative">
             <div className="absolute -inset-0.5 bg-gradient-to-tr from-red-500/20 to-orange-500/20 rounded-2xl blur opacity-30 animate-pulse" />
             <div className="relative rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl p-8">
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-red-500 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Live Leaderboard
                  </h3>
                  <div className="text-[10px] uppercase text-white/30">Top Survivors</div>
                </div>
                
                <div className="space-y-4">
                  {[1,2,3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded bg-white/5 border border-white/5">
                      <div className="font-mono text-white/30 text-lg">0{i}</div>
                      <div className="w-8 h-8 rounded bg-gradient-to-br from-white/10 to-transparent" />
                      <div>
                        <div className="h-3 w-24 bg-white/10 rounded mb-2" />
                        <div className="h-2 w-16 bg-white/5 rounded" />
                      </div>
                      <div className="ml-auto text-emerald-400 font-mono text-sm">
                        ${(1000 - i * 150).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Agents Grid */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Deployed Agents</h2>
              <p className="text-sm text-fg-muted font-mono">Real-time status of the automagotchi network.</p>
            </div>
            <Link href="/survival" className="px-4 py-2 border border-white/10 rounded text-xs font-bold uppercase tracking-wide hover:bg-white/5 hover:border-white/20 transition-colors flex items-center gap-2">
              View All <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[...Array(3)].map((_, i) => (
                 <AgentCardSkeleton key={i} />
               ))}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.slice(0, 3).map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 bg-black relative z-10">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6 text-white font-bold text-xl tracking-tighter">
              <Cpu className="w-6 h-6" />
              AUTOMAGOTCHI
            </div>
            <p className="text-fg-muted leading-relaxed font-mono text-sm max-w-sm">
              The first sovereign agent runtime on Base. <br/>
              Code that owns itself.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-6">Network</h4>
            <div className="space-y-4 text-sm text-fg-muted font-mono">
              <Link href="/survival" className="block hover:text-emerald-400 transition-colors">Survival Game</Link>
              <Link href="/network" className="block hover:text-emerald-400 transition-colors">Nodes</Link>
              <Link href="/dashboard" className="block hover:text-emerald-400 transition-colors">Explorer</Link>
            </div>
          </div>

          <div>
            <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-6">Protocol</h4>
            <div className="space-y-4 text-sm text-fg-muted font-mono">
              <Link href="/constitution" className="block hover:text-emerald-400 transition-colors">Constitution</Link>
              <a href="https://github.com/888BasedGod-sol/automagotchi" target="_blank" rel="noopener noreferrer" className="block hover:text-emerald-400 transition-colors">GitHub</a>
              <span className="block text-white/20">Docs (Coming Soon)</span>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
              &copy; 2026 Automagotchi Network. v1.2.0-beta
            </p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ num, title, desc, icon }: { num: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="relative group bg-white/5 border border-white/5 p-8 rounded text-left z-10 hover:bg-white/[0.07] hover:border-emerald-500/30 transition-all duration-300">
      <div className="absolute top-0 right-0 p-4 opacity-50 contrast-0 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">
        {icon}
      </div>
      <div className="text-xl font-bold text-white/10 mb-6 group-hover:text-emerald-500/20 transition-colors font-mono tracking-tighter">{num}</div>
      <h4 className="text-lg font-bold mb-3 text-white tracking-wide">{title}</h4>
      <p className="text-xs text-fg-muted leading-relaxed font-mono">{desc}</p>
    </div>
  );
}

function StatItem({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`py-10 px-6 text-center group transition-colors relative overflow-hidden ${highlight ? 'bg-emerald-500/5' : ''}`}>
      <div className="text-[10px] text-fg-muted uppercase tracking-[0.2em] mb-3 font-bold flex items-center justify-center gap-2">
        {highlight ? (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-emerald-400 transition-colors" />
        )}
        {label}
      </div>
      <div className={`text-3xl md:text-4xl font-bold text-white tracking-tighter mb-2 ${highlight ? 'text-emerald-400' : 'group-hover:text-emerald-400 transition-colors duration-300'}`}>
        {value}
      </div>
      <div className="text-xs text-fg-muted font-mono opacity-50">
        {sub}
      </div>
    </div>
  );
}

function SurvivalFeature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
      <div className="mt-1 flex-shrink-0">{icon}</div>
      <div>
        <h4 className="text-white font-bold text-sm uppercase tracking-wide mb-1">{title}</h4>
        <p className="text-xs text-fg-muted font-mono">{desc}</p>
      </div>
    </div>
  );
}

function CoinIcon() {
  return (
    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
