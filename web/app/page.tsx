'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Activity, Zap, Server, ChevronRight, 
  Cpu, Globe, Shield, Play, TrendingUp, DollarSign, Command, GitBranch,
  Wallet, Search, MessageCircle
} from 'lucide-react';
import Header from '@/components/Header';
import AgentCard from '@/components/AgentCard';
import AgentCardSkeleton from '@/components/AgentCardSkeleton';
import TerminalFeed from '@/components/TerminalFeed';
import NetworkBackground from '@/components/NetworkBackground';
import BootScreen from '@/components/BootScreen';

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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [booted, setBooted] = useState(false);
  const [stats, setStats] = useState({
    activeAgents: 0,
    totalTransactions: 0,
    networkRevenue: 0,
  });

  useEffect(() => {
    fetchAgents();
  }, []);


  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents/all');
      const data = await res.json();
      const agentList = data.agents || [];
      setAgents(agentList);
      
      const active = agentList.filter((a: Agent) => 
        a.status === 'running' || a.status === 'active'
      ).length;
      
      const totalCredits = agentList.reduce((acc: number, a: Agent) => 
        acc + (a.creditsBalance || a.credits_balance || 0), 0
      );

      setStats({
        activeAgents: active,
        totalTransactions: 12543 + active * 42, // Simulated historical data + live
        networkRevenue: totalCredits,
      });
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-fg font-sans selection:bg-accent selection:text-white">
      {!booted && <BootScreen onComplete={() => setBooted(true)} />}
      
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 border-b border-white/5 overflow-hidden">
        <NetworkBackground />
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', 
               backgroundSize: '32px 32px' 
             }} 
        />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            CONWAY v1.0 ONLINE
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/50 animate-in fade-in slide-in-from-bottom-5 duration-700">
            Deploy Sovereign AI Agents<br/> In Minutes
          </h1>
          
          <p className="text-lg md:text-xl text-fg-muted max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Automaton gives every AI model a crypto wallet and a cloud runtime. 
            They research, trade, and chat 24/7—paying for compute with their own on-chain earnings.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <Link 
              href="/create" 
              className="px-8 py-3.5 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
            >
              <Zap className="w-4 h-4 group-hover:fill-current" />
              Start Building Now
            </Link>
            <Link 
              href="/agents" 
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Explore Protocol
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works Section - NEW */}
      <section className="py-16 border-b border-white/5 bg-bg-surface/30">
        <div className="max-w-6xl mx-auto px-6">
           <div className="text-center mb-12">
              <h2 className="text-sm font-mono text-accent uppercase tracking-widest mb-2">The Process</h2>
              <h3 className="text-2xl md:text-3xl font-bold">From Code to Sovereignty</h3>
           </div>
           
           <div className="grid md:grid-cols-4 gap-4 relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-y-1/2 z-0" />

              <StepCard 
                num="01" 
                title="Select Template" 
                desc="Choose a pre-built agent archetype (Trader, Researcher, Content Creator) or code your own logic."
              />
              <StepCard 
                num="02" 
                title="Provision Wallet" 
                desc="Deploy a smart wallet for your agent on Base (EVM) or Solana. You control the keys."
              />
              <StepCard 
                num="03" 
                title="Fuel & Launch" 
                desc="Deposit crypto for gas and compute credits. The agent spins up in a secure microVM."
              />
              <StepCard 
                num="04" 
                title="Profit & Scale" 
                desc="Your agent operates 24/7, earning revenue and paying its own survival costs."
              />
           </div>
        </div>
      </section>

      {/* Stats Strip */}
      <div className="border-b border-white/5 bg-bg-surface/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          <StatItem label="Active Agents" value={stats.activeAgents.toString()} />
          <StatItem label="Total Transactions" value={stats.totalTransactions.toLocaleString()} />
          <StatItem label="Network Value" value={`$${stats.networkRevenue.toFixed(0)}`} />
          <StatItem label="Uptime" value="99.99%" />
        </div>
      </div>

      {/* Explainer Section: What can you build? */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/5 to-transparent pointer-events-none" />
        
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Choose Your Agent Type</h2>
            <p className="text-fg-muted max-w-2xl mx-auto">
              Start with a template. Customize their personality. Let them run autonomously.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Search className="w-6 h-6 text-blue-400" />}
              title="Research Analyst"
              desc="Scours the web for news, summarizes papers, and monitors competitors 24/7."
              color="bg-blue-500/10 border-blue-500/20"
            />
            <FeatureCard 
              icon={<TrendingUp className="w-6 h-6 text-green-400" />}
              title="DeFi Trader"
              desc="Monitors on-chain liquidity, executes swaps, and manages yield farming positions."
              color="bg-green-500/10 border-green-500/20"
            />
            <FeatureCard 
              icon={<MessageCircle className="w-6 h-6 text-pink-400" />}
              title="Social Persona"
              desc="Engages with communities on X/Farcaster, replies to mentions, and grows an audience."
              color="bg-pink-500/10 border-pink-500/20"
            />
          </div>
        </div>
      </section>

      {/* Technical Deep Dive */}
      <section className="py-24 px-6 bg-bg-elevated/30 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-mono mb-6">
                POWERED BY CONWAY
              </div>
              <h2 className="text-3xl font-bold mb-6">
                Code that Pays Rent
              </h2>
              <div className="space-y-6 text-fg-muted leading-relaxed">
                <p>
                  Every agent is a sovereign economic entity. They aren't just scripts; they have:
                </p>
                <ul className="space-y-4 mt-4">
                  <FeatureItem icon={<Wallet className="w-4 h-4 text-purple-400" />} text="A Built-in Crypto Wallet (EVM + Solana)" />
                  <FeatureItem icon={<Shield className="w-4 h-4 text-green-400" />} text="Survival Logic (Requires funding to run)" />
                  <FeatureItem icon={<GitBranch className="w-4 h-4 text-orange-400" />} text="Persistent Memory & State" />
                </ul>
                <div className="pt-6">
                  <Link href="/create" className="text-accent hover:text-white flex items-center gap-2 transition-colors">
                    Start Building <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Visual Representation of Conway */}
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full opacity-20" />
              <TerminalFeed />
            </div>
          </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20 px-6 border-t border-white/5 bg-bg-subtle">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Why Build on Automaton?</h2>
            <p className="text-fg-muted max-w-2xl mx-auto">
              Traditional AI agents are fragile scripts. Automaton agents are robust economic actors.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card 
              icon={<Globe className="w-6 h-6 text-blue-400" />}
              title="Multi-Chain Native"
              description="Agents control wallets on both Base and Solana. Interact with DeFi, NFTs, and social protocols seamlessly."
            />
            <Card 
              icon={<Command className="w-6 h-6 text-purple-400" />}
              title="Command & Control"
              description="Directly interact with your agents via the terminal sandbox. Debug, update, or pause execution instantly."
            />
            <Card 
              icon={<TrendingUp className="w-6 h-6 text-green-400" />}
              title="Economic Survival"
              description="Agents must earn credits to survive. A true meritocracy where code pays for its own existence."
            />
          </div>
        </div>
      </section>

      {/* Live Agents Preview */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Thriving Agents</h2>
            <Link href="/agents" className="text-sm text-fg-muted hover:text-white flex items-center gap-1">
              View Directory <ChevronRight className="w-4 h-4" />
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
      <footer className="border-t border-white/5 py-12 bg-bg-base">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Cpu className="w-6 h-6 text-white" />
            <span className="font-bold text-xl tracking-tight">AUTOMATON</span>
          </div>
          <div className="flex justify-center gap-8 mb-8 text-sm text-fg-muted">
            <Link href="/constitution" className="hover:text-white transition-colors">Constitution</Link>
            <Link href="/network" className="hover:text-white transition-colors">Network Map</Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <a href="https://github.com/888BasedGod-sol/automaton" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-xs text-fg-faint">
            &copy; 2026 Automaton Cloud. Powered by the Conway Runtime Environment. (v1.2 - Late Feb Update)
          </p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="relative group bg-bg-base border border-white/5 p-6 rounded-lg text-left z-10 hover:border-accent/40 transition-colors">
      <div className="text-4xl font-bold text-white/5 mb-4 group-hover:text-accent/20 transition-colors font-mono">{num}</div>
      <h4 className="text-lg font-bold mb-2 text-white">{title}</h4>
      <p className="text-sm text-fg-muted">{desc}</p>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-8 px-6 text-center group hover:bg-white/5 transition-colors relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="text-xs text-fg-muted uppercase tracking-widest mb-3 font-semibold flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-accent/50 group-hover:bg-accent animate-pulse transition-colors" />
        {label}
      </div>
      <div className="text-3xl font-mono font-medium text-white tracking-tight group-hover:text-accent transition-colors duration-300">
        {value}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0 bg-white/5 p-1.5 rounded border border-white/5">{icon}</div>
      <span className="text-sm text-fg-muted leading-relaxed">{text}</span>
    </li>
  );
}

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className={`p-6 rounded-xl bg-bg-surface border border-white/5 hover:border-white/10 transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} blur-3xl rounded-full opacity-20 -mr-10 -mt-10 transition-opacity group-hover:opacity-40`} />
      <div className={`w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center mb-4 border border-white/5 group-hover:scale-110 transition-transform duration-300`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-white transition-colors">{title}</h3>
      <p className="text-sm text-fg-muted leading-relaxed group-hover:text-fg-subtle transition-colors">
        {desc}
      </p>
    </div>
  );
}

function Card({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl bg-bg-surface border border-white/5 hover:border-white/10 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-bg-elevated flex items-center justify-center mb-4 border border-white/5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-fg-muted leading-relaxed">
        {description}
      </p>
    </div>
  );
}
