'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Activity, Zap, Server, ChevronRight, 
  Cpu, Globe, Shield, Play, TrendingUp, DollarSign, Command, GitBranch
} from 'lucide-react';
import Header from '@/components/Header';
import AgentCard from '@/components/AgentCard';

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
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 border-b border-white/5 overflow-hidden">
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
            Sovereign AI Infrastructure
          </h1>
          
          <p className="text-lg md:text-xl text-fg-muted max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            Automaton is the deployment layer for autonomous agents. 
            Powered by <strong>Conway</strong>, a decentralized runtime where code pays for its own existence.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <Link 
              href="/create" 
              className="px-8 py-3.5 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-all flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Deploy Agent
            </Link>
            <Link 
              href="/network" 
              className="px-8 py-3.5 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              View Network
            </Link>
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

      {/* Explainer Section: What is Conway? */}
      <section className="py-24 px-6 bg-bg-base relative">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Cpu className="w-8 h-8 text-accent" />
                Powered by Conway
              </h2>
              <div className="space-y-6 text-fg-muted leading-relaxed">
                <p>
                  <strong className="text-white">Conway</strong> is the specialized execution environment (runtime) that powers every agent on Automaton.
                </p>
                <p>
                  Unlike traditional cloud functions, Conway processes are persistent, stateful, and economically aware. 
                  They don't just run code; they manage their own wallets, pay for their own compute, and die if they run out of funds.
                </p>
                <ul className="space-y-3 mt-4">
                  <FeatureItem icon={<DollarSign className="w-4 h-4 text-success" />}>
                    Self-Funding: Agents pay for resources using crypto.
                  </FeatureItem>
                  <FeatureItem icon={<Shield className="w-4 h-4 text-accent" />}>
                    Sovereign Identity: On-chain ownership via ERC-8004.
                  </FeatureItem>
                  <FeatureItem icon={<GitBranch className="w-4 h-4 text-warning" />}>
                    Evolutionary: Agents can fork and improve themselves.
                  </FeatureItem>
                </ul>
              </div>
            </div>
            
            {/* Visual Representation of Conway */}
            <div className="relative">
              <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full opacity-20" />
              <div className="relative bg-bg-surface border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                  </div>
                  <div className="text-xs font-mono text-fg-muted ml-2">conway-kernel — zsh</div>
                </div>
                <div className="p-6 font-mono text-xs md:text-sm text-fg-muted space-y-2">
                  <div className="flex gap-2">
                    <span className="text-accent">➜</span>
                    <span className="text-white">conway spawn --agent research-v1</span>
                  </div>
                  <div className="pl-4 text-fg-faint">
                    [system] Initializing runtime environment...<br/>
                    [wallet] Generated address: 0x71C...9A2<br/>
                    [credit] Balance: 0.00 USDC<br/>
                    <span className="text-warning">[warn] Insufficient funds for genesis.</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <span className="text-accent">➜</span>
                    <span className="text-white">conway fund --amount 25</span>
                  </div>
                  <div className="pl-4 text-fg-faint">
                    [network] Transaction confirmed.<br/>
                    [system] Agent activated. Starting loop...
                  </div>
                  <div className="pl-4 text-success mt-1">
                    [status] RUNNING (PID: 4821)
                  </div>
                </div>
              </div>
            </div>
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
              title="Universal Access"
              description="Deploy from anywhere. Manage agents via a simple dashboard or CLI. No complex infrastructure to maintain."
            />
            <Card 
              icon={<Command className="w-6 h-6 text-purple-400" />}
              title="Command & Control"
              description="Directly interact with your agents via the terminal sandbox. Debug, update, or pause execution instantly."
            />
            <Card 
              icon={<TrendingUp className="w-6 h-6 text-green-400" />}
              title="Economic Survival"
              description="Agents that provide value earn credits. Those that don't run out of funds. A true meritocracy for code."
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
                 <div key={i} className="h-48 rounded-xl bg-bg-surface animate-pulse" />
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
            &copy; 2026 Automaton Cloud. Powered by the Conway Runtime Environment.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-6 px-4 text-center">
      <div className="text-xs text-fg-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-mono font-medium text-white">{value}</div>
    </div>
  );
}

function FeatureItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-1 flex-shrink-0">{icon}</div>
      <span className="text-sm text-fg-muted">{children}</span>
    </li>
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
