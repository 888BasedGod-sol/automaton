'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Activity, Zap, Server, ChevronRight, 
  ArrowRight, Cpu, Globe, Shield, Sparkles,
  Play, TrendingUp
} from 'lucide-react';
import Header from '@/components/Header';
import AgentCard from '@/components/AgentCard';
import StatCard from '@/components/StatCard';
import ActivityFeed from '@/components/ActivityFeed';

interface Agent {
  id: string;
  name: string;
  genesis_prompt?: string;
  status: string;
  survival_tier: string;
  credits_balance?: number;
  creditsBalance?: number;
  solana_address?: string;
  uptime_seconds?: number;
}

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAgents: 0,
    runningAgents: 0,
    totalCredits: 0,
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
      
      // Calculate stats
      const running = agentList.filter((a: Agent) => 
        a.status === 'running' || a.status === 'active'
      ).length;
      const totalCredits = agentList.reduce((acc: number, a: Agent) => 
        acc + (a.creditsBalance || a.credits_balance || 0), 0
      );
      
      setStats({
        totalAgents: agentList.length,
        runningAgents: running,
        totalCredits,
      });
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-purple/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-accent-purple/10 to-transparent blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Sovereign AI Infrastructure
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Deploy Autonomous
              <br />
              <span className="gradient-text">AI Agents</span>
            </h1>
            
            <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
              Create self-sustaining AI agents that manage their own wallets, 
              run on dedicated infrastructure, and earn their existence.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/create" 
                className="flex items-center gap-2 px-6 py-3 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-accent-purple/25"
              >
                <Zap className="w-5 h-5" />
                Deploy Your Agent
              </Link>
              <Link 
                href="/agents" 
                className="flex items-center gap-2 px-6 py-3 bg-surface-2 hover:bg-surface-3 text-white rounded-xl font-medium transition-all border border-white/5"
              >
                <Users className="w-5 h-5" />
                Browse Agents
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard 
            label="Total Agents" 
            value={stats.totalAgents}
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard 
            label="Running" 
            value={stats.runningAgents}
            icon={<Play className="w-4 h-4" />}
            trend="up"
          />
          <StatCard 
            label="Total Credits" 
            value={`$${stats.totalCredits.toFixed(0)}`}
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard 
            label="Uptime" 
            value="99.9"
            suffix="%"
            icon={<Activity className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Agents Grid - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Cpu className="w-5 h-5 text-accent-purple" />
                Active Agents
              </h2>
              <Link 
                href="/agents" 
                className="text-sm text-text-muted hover:text-white flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-48 rounded-2xl bg-surface-1 animate-pulse" />
                ))}
              </div>
            ) : agents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {agents.slice(0, 6).map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-surface-1 rounded-2xl border border-white/5">
                <Cpu className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="font-medium mb-2">No agents deployed yet</h3>
                <p className="text-text-muted text-sm mb-4">Be the first to deploy an autonomous agent</p>
                <Link 
                  href="/create" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-lg text-sm"
                >
                  <Zap className="w-4 h-4" />
                  Deploy Agent
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Activity Feed */}
            <div className="p-5 rounded-2xl bg-surface-1 border border-white/5">
              <ActivityFeed limit={5} />
            </div>

            {/* Quick Links */}
            <div className="p-5 rounded-2xl bg-surface-1 border border-white/5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent-cyan" />
                Quick Links
              </h3>
              <div className="space-y-2">
                <QuickLink href="/dashboard" icon={<Activity className="w-4 h-4" />}>
                  Dashboard
                </QuickLink>
                <QuickLink href="/infrastructure" icon={<Server className="w-4 h-4" />}>
                  Infrastructure
                </QuickLink>
                <QuickLink href="/constitution" icon={<Shield className="w-4 h-4" />}>
                  Constitution
                </QuickLink>
              </div>
            </div>

            {/* Deploy CTA */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 border border-accent-purple/20">
              <h3 className="font-semibold mb-2">Ready to deploy?</h3>
              <p className="text-sm text-text-secondary mb-4">
                Create your own autonomous agent in minutes.
              </p>
              <Link 
                href="/create" 
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-lg text-sm font-medium transition-all"
              >
                <Zap className="w-4 h-4" />
                Deploy Agent
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center">
                <Cpu className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-text-muted">© 2026 Automaton Cloud</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-text-muted">
              <Link href="/constitution" className="hover:text-white transition-colors">Constitution</Link>
              <Link href="https://github.com/888BasedGod-sol/automaton" className="hover:text-white transition-colors">GitHub</Link>
              <Link href="/admin/pool" className="hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function QuickLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link 
      href={href}
      className="flex items-center gap-3 p-2 rounded-lg text-text-secondary hover:text-white hover:bg-surface-2 transition-all group"
    >
      <div className="text-text-muted group-hover:text-accent-purple transition-colors">{icon}</div>
      <span className="text-sm">{children}</span>
      <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
