'use client';

import { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { DM_Serif_Display, JetBrains_Mono } from 'next/font/google';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Coins,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Search,
  Shield,
  Wallet,
} from 'lucide-react';
import Header from '@/components/Header';
import NetworkBackground from '@/components/NetworkBackground';
import { NetworkErrorBoundary } from '@/components/NetworkErrorBoundary';

// Dynamically import the visualizer to avoid SSR issues
const NetworkVisualizer = dynamic(() => import('@/components/NetworkVisualizer'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-emerald-500/50 font-mono text-sm animate-pulse">
      Loading network...
    </div>
  )
});

const notebookMono = JetBrains_Mono({ subsets: ['latin'] });

// ─── Interfaces ─────────────────────────────────────────────────────

interface Agent {
  id: string;
  name: string;
  survival_tier: string;
  status: string;
  credits_balance: number;
  evm_address?: string;
  solana_address?: string;
  reply_cost_asset?: string;
  last_heartbeat?: string;
  created_at?: string;
}

interface ConwayAgent {
  address: string;
  name: string;
  description: string;
  endpoint: string;
  active: boolean;
  source: string;
}

interface TimelineEvent {
  id: string;
  chain: 'base' | 'conway' | 'solana';
  label: string;
  detail: string;
  timestamp?: string;
}

interface TrafficLink {
  source: string;
  target: string;
  volume?: number;
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function NetworkPage() {
  return (
    <NetworkErrorBoundary>
      <div className="h-screen bg-[#050505] text-white overflow-hidden flex flex-col relative font-sans">
        {/* Navbar */}
        <div className="absolute top-0 left-0 right-0 z-50">
          <Header />
        </div>

        {/* Global Background Effects */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
           <NetworkBackground />
        </div>

        {/* Content */}
        <NetworkPageContent />
      </div>
    </NetworkErrorBoundary>
  );
}

function NetworkPageContent() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conwayAgents, setConwayAgents] = useState<ConwayAgent[]>([]);
  const [traffic, setTraffic] = useState<TrafficLink[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'at-risk' | 'healthy'>('all');
  const [personaMode, setPersonaMode] = useState<'operator' | 'investor' | 'research'>('operator');
  const [rightPanelMode, setRightPanelMode] = useState<'flow' | 'timeline' | 'risk'>('flow');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [commandBusy, setCommandBusy] = useState<'start' | 'stop' | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [riskCreditThreshold, setRiskCreditThreshold] = useState(5);
  const [heartbeatRiskMinutes, setHeartbeatRiskMinutes] = useState(20);
  const [timelineDepth, setTimelineDepth] = useState(8);
  const deferredQuery = useDeferredValue(query);
  const dataFetchInFlightRef = useRef(false);
  const dataFetchAbortRef = useRef<AbortController | null>(null);
  const timelineFetchAbortRef = useRef<AbortController | null>(null);
  const timelineCacheRef = useRef<Map<string, TimelineEvent[]>>(new Map());

  const deathSignals = useMemo(() => {
    const now = Date.now();
    const withHeartbeatLag = agents.map((agent) => {
      const lastBeat = agent.last_heartbeat ? new Date(agent.last_heartbeat).getTime() : null;
      const lagMinutes = lastBeat ? Math.max(0, Math.floor((now - lastBeat) / 60000)) : null;
      return { ...agent, lagMinutes };
    });

    const casualties = withHeartbeatLag
      .filter((agent) => agent.status === 'terminated' || agent.status === 'suspended')
      .sort((a, b) => (a.lagMinutes || 0) - (b.lagMinutes || 0));

    const critical = withHeartbeatLag
      .filter((agent) => agent.status !== 'terminated' && agent.status !== 'suspended')
      .filter((agent) => agent.credits_balance <= riskCreditThreshold || (agent.lagMinutes !== null && agent.lagMinutes >= heartbeatRiskMinutes))
      .sort((a, b) => a.credits_balance - b.credits_balance);

    return {
      casualties,
      critical,
      suspendedCount: withHeartbeatLag.filter((a) => a.status === 'suspended').length,
      terminatedCount: withHeartbeatLag.filter((a) => a.status === 'terminated').length,
      atRiskCount: critical.length,
    };
  }, [agents, riskCreditThreshold, heartbeatRiskMinutes]);

  const filteredAgents = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return agents.filter((agent) => {
      const lagMinutes = agent.last_heartbeat
        ? Math.max(0, Math.floor((Date.now() - new Date(agent.last_heartbeat).getTime()) / 60000))
        : null;
      const isRisky =
        agent.status === 'suspended' ||
        agent.status === 'terminated' ||
        agent.credits_balance <= riskCreditThreshold ||
        (lagMinutes !== null && lagMinutes >= heartbeatRiskMinutes);

      const modePass =
        viewMode === 'all' ||
        (viewMode === 'at-risk' && isRisky) ||
        (viewMode === 'healthy' && !isRisky);

      if (!modePass) return false;
      if (!normalizedQuery) return true;

      return (
        (agent.name || '').toLowerCase().includes(normalizedQuery) ||
        (agent.id || '').toLowerCase().includes(normalizedQuery) ||
        (agent.evm_address || '').toLowerCase().includes(normalizedQuery) ||
        (agent.solana_address || '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [agents, deferredQuery, viewMode, riskCreditThreshold, heartbeatRiskMinutes]);

  const selectedAgent = useMemo(
    () => filteredAgents.find((a) => a.id === selectedAgentId) || agents.find((a) => a.id === selectedAgentId) || null,
    [filteredAgents, agents, selectedAgentId]
  );

  const stats = useMemo(() => {
    const dualChainReady = agents.filter((a) => !!a.evm_address && !!a.solana_address).length;
    const creditBacked = agents.length;
    const averageCredits =
      agents.length > 0
        ? agents.reduce((sum, a) => sum + (a.credits_balance || 0), 0) / agents.length
        : 0;

    return {
      totalNodes: filteredAgents.length + conwayAgents.length,
      localLoad: filteredAgents.length,
      networkLoad: conwayAgents.length,
      tps: traffic.length,
      dualChainReady,
      creditBacked,
      averageCredits,
    };
  }, [agents, filteredAgents, conwayAgents, traffic]);

  const personaCopy = useMemo(() => {
    if (personaMode === 'investor') {
      return {
        title: 'Capital Efficiency Lens',
        subtitle: 'Track whether credits convert into durable uptime and higher quality execution.',
      };
    }
    if (personaMode === 'research') {
      return {
        title: 'Protocol Research Lens',
        subtitle: 'Observe cross-chain state transitions and stress conditions across live agents.',
      };
    }
    return {
      title: 'Operator Control Lens',
      subtitle: 'Triage risk, issue start/stop commands, and inspect heartbeat economics in one view.',
    };
  }, [personaMode]);

  // 1. Client-Side Mount Check
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const nodes = Array.from(document.querySelectorAll('[data-reveal="network-section"]'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmallViewport = window.matchMedia('(max-width: 768px)').matches;
    const staggerMs = prefersReducedMotion || isSmallViewport ? 0 : 70;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const order = Number((entry.target as HTMLElement).dataset.revealOrder || 0);
            (entry.target as HTMLElement).style.transitionDelay = `${order * staggerMs}ms`;
            entry.target.classList.add('reveal-in');
          }
        });
      },
      { threshold: 0.16 }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!guidedMode) return;

    if (guidedStep === 0) {
      setViewMode('all');
      setRightPanelMode('flow');
      return;
    }

    if (guidedStep === 1) {
      setViewMode('at-risk');
      setRightPanelMode('risk');
      return;
    }

    setRightPanelMode('timeline');
  }, [guidedMode, guidedStep]);

  const riskRatio = useMemo(() => {
    if (!agents.length) return 0;
    return deathSignals.atRiskCount / agents.length;
  }, [agents.length, deathSignals.atRiskCount]);

  const fetchData = useCallback(async () => {
    if (dataFetchInFlightRef.current) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    dataFetchAbortRef.current?.abort();
    const controller = new AbortController();
    dataFetchAbortRef.current = controller;
    dataFetchInFlightRef.current = true;

    const safeFetch = async (url: string, fallback: object) => {
      try {
        const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) return fallback;
        return await res.json();
      } catch {
        return fallback;
      }
    };

    try {
      const [agentsData, conwayData, trafficData] = await Promise.all([
        safeFetch('/api/agents/all?hasConwayCredits=true', { agents: [] }),
        safeFetch('/api/network/conway', { agents: [] }),
        safeFetch('/api/network/traffic', { traffic: [] }),
      ]);

      const nextAgents: Agent[] = agentsData?.agents || [];
      const nextConwayAgents: ConwayAgent[] = conwayData?.agents || [];
      const nextTraffic: TrafficLink[] = trafficData?.traffic || [];

      setAgents((prev) => (areAgentsEqual(prev, nextAgents) ? prev : nextAgents));
      setConwayAgents((prev) => (areConwayAgentsEqual(prev, nextConwayAgents) ? prev : nextConwayAgents));
      setTraffic((prev) => (areTrafficEqual(prev, nextTraffic) ? prev : nextTraffic));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[Network] Data load failed:', err);
      }
    } finally {
      dataFetchInFlightRef.current = false;
    }
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!mounted) return;

    fetchData();
    const interval = setInterval(fetchData, 12000); // Slower polling to reduce graph churn

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      dataFetchAbortRef.current?.abort();
    };
  }, [mounted, fetchData]);

  useEffect(() => {
    if (!selectedAgentId && filteredAgents.length > 0) {
      setSelectedAgentId(filteredAgents[0].id);
      return;
    }

    // Keep selected agent even if filters hide it, so right-panel actions remain stable.
  }, [filteredAgents, selectedAgentId]);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!selectedAgent) {
        timelineFetchAbortRef.current?.abort();
        setTimeline([]);
        return;
      }

      const cached = timelineCacheRef.current.get(selectedAgent.id);
      if (cached) {
        setTimeline(cached);
        return;
      }

      timelineFetchAbortRef.current?.abort();
      const controller = new AbortController();
      timelineFetchAbortRef.current = controller;

      setTimelineLoading(true);
      try {
        const res = await fetch(`/api/agents/${selectedAgent.id}/heartbeats?includeOnChain=true`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await res.json();

        const events: TimelineEvent[] = [];

        if (selectedAgent.created_at) {
          events.push({
            id: `base-identity-${selectedAgent.id}`,
            chain: 'base',
            label: 'Identity Anchored',
            detail: selectedAgent.evm_address
              ? `ERC-8004 identity tied to ${shortAddress(selectedAgent.evm_address)}`
              : 'Agent identity registered on Base',
            timestamp: selectedAgent.created_at,
          });
        }

        events.push({
          id: `conway-credits-${selectedAgent.id}`,
          chain: 'conway',
          label: 'Inference Runway',
          detail: `${selectedAgent.credits_balance.toFixed(2)} credits available`,
          timestamp: selectedAgent.last_heartbeat || selectedAgent.created_at,
        });

        if (Array.isArray(data?.transactions)) {
          for (const tx of data.transactions.slice(0, 5)) {
            events.push({
              id: `db-hb-${tx.txSignature}`,
              chain: 'solana',
              label: 'Heartbeat Settled',
              detail: `${Number(tx.solAmount || 0).toFixed(4)} SOL -> treasury`,
              timestamp: tx.timestamp,
            });
          }
        }

        if (Array.isArray(data?.onChain?.recentTransactions)) {
          for (const tx of data.onChain.recentTransactions.slice(0, 5)) {
            events.push({
              id: `onchain-${tx.signature}`,
              chain: 'solana',
              label: tx.type === 'incoming' ? 'Wallet Inflow' : 'Wallet Outflow',
              detail: `${Number(tx.amount || 0).toFixed(4)} SOL (${tx.confirmed ? 'confirmed' : 'pending'})`,
              timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString() : undefined,
            });
          }
        }

        events.sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tb - ta;
        });

        const compactEvents = events.slice(0, 10);
        timelineCacheRef.current.set(selectedAgent.id, compactEvents);
        setTimeline(compactEvents);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('[Network] Failed to fetch timeline:', error);
          setTimeline([]);
        }
      } finally {
        setTimelineLoading(false);
      }
    };

    fetchTimeline();

    return () => {
      timelineFetchAbortRef.current?.abort();
    };
  }, [selectedAgent]);

  const triggerAutoStart = async () => {
    if (!selectedAgentId) return;
    setCommandBusy('start');
    setCommandMessage(null);
    try {
      const res = await fetch(`/api/agents/${selectedAgentId}/auto-start`);
      const data = await res.json();
      setCommandMessage(data?.message || (data?.success ? 'Start signal sent.' : data?.error || 'Start failed'));
    } catch {
      setCommandMessage('Failed to send start signal.');
    } finally {
      setCommandBusy(null);
    }
  };

  const triggerStop = async () => {
    if (!selectedAgentId) return;

    const walletAddress = typeof window !== 'undefined'
      ? window.localStorage.getItem('walletAddress') || ''
      : '';

    if (!walletAddress) {
      setCommandMessage('Pause requires owner wallet auth. Open the agent page with wallet connected.');
      return;
    }

    setCommandBusy('stop');
    setCommandMessage(null);
    try {
      const res = await fetch('/api/survival/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          action: 'stop',
          walletAddress,
        }),
      });
      const data = await res.json();
      setCommandMessage(data?.message || (data?.success ? 'Pause signal sent.' : data?.error || 'Pause failed'));
    } catch {
      setCommandMessage('Failed to send pause signal.');
    } finally {
      setCommandBusy(null);
    }
  };

  // 3. Transform Data to Graph Format
  const localAgentIds = useMemo(() => new Set(filteredAgents.map((a) => a.id)), [filteredAgents]);

  const handleGraphNodeClick = useCallback((node: any) => {
    if (typeof node?.id === 'string' && localAgentIds.has(node.id)) {
      setSelectedAgentId(node.id);
    }
  }, [localAgentIds]);

  const { nodes, links } = useMemo(() => {
    const graphNodes: any[] = [];
    const graphLinks: any[] = [];
    const linkMap = new Map<string, any>();
    const makeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    // Local Agents -> Nodes
    filteredAgents.forEach(agent => {
      graphNodes.push({
        id: agent.id,
        name: agent.name,
        type: 'local',
        val: 10 + (agent.credits_balance > 100 ? 5 : 0),
        status: agent.status,
        color: TierColors[agent.survival_tier as keyof typeof TierColors] || '#10b981'
      });
    });

    // Conway Agents -> Nodes
    conwayAgents.forEach((agent, index) => {
      const id = agent.address || agent.endpoint || `conway-node-${index}`;
      graphNodes.push({
        id,
        name: agent.name,
        type: 'conway',
        val: 15,
        status: agent.active ? 'active' : 'inactive',
        color: '#06b6d4'
      });
    });

    // Generate deterministic skeleton links so topology is stable between refreshes.
    const nodeIds = new Set(graphNodes.map((n) => n.id));

    if (graphNodes.length > 1) {
      for (let i = 1; i < graphNodes.length; i++) {
        const source = graphNodes[i - 1].id;
        const target = graphNodes[i].id;
        const edge = {
          source,
          target,
          type: 'peering'
        };
        graphLinks.push(edge);
        linkMap.set(makeKey(source, target), edge);
      }
    }

    // Real Traffic Overlays
    if (traffic && traffic.length > 0) {
      traffic.forEach((t) => {
        if (!t?.source || !t?.target) return;

        // Only link known nodes
        if (nodeIds.has(t.source) && nodeIds.has(t.target)) {
          const key = makeKey(t.source, t.target);
          const existing = linkMap.get(key);

          if (existing) {
            existing.type = 'traffic';
            existing.volume = t.volume || 1;
          } else {
            const edge = {
              source: t.source,
              target: t.target,
              type: 'traffic',
              volume: t.volume || 1
            };
            graphLinks.push(edge);
            linkMap.set(key, edge);
          }
        }
      });
    }

    return { nodes: graphNodes, links: graphLinks };
  }, [filteredAgents, conwayAgents, traffic]);

      if (!mounted) return null;

      return (
        <main className="flex-1 relative w-full pt-24 px-3 pb-4 lg:px-6 overflow-y-auto">
          <div className="absolute -top-16 right-[-8rem] w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-[90px] pointer-events-none" />
          <div className="absolute bottom-[-8rem] left-[-4rem] w-[22rem] h-[22rem] rounded-full bg-emerald-500/10 blur-[80px] pointer-events-none" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 min-h-[600px] lg:h-[calc(100vh-14rem)] pb-2">
            {/* Left: Command Deck */}
            <section data-reveal="network-section" data-reveal-order="5" className={`reveal-card bg-black/45 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col h-[420px] lg:h-auto min-h-0 ${guidedMode && guidedStep === 0 ? 'ring-1 ring-cyan-300/40' : ''}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80 mb-2">Chapter 01</div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm tracking-widest uppercase text-white/90 font-semibold">Agent Command Deck</h2>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or wallet"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-emerald-400/50"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <FilterPill active={viewMode === 'all'} onClick={() => setViewMode('all')} label="All" />
                <FilterPill active={viewMode === 'at-risk'} onClick={() => setViewMode('at-risk')} label="At Risk" />
                <FilterPill active={viewMode === 'healthy'} onClick={() => setViewMode('healthy')} label="Healthy" />
              </div>

              <div className="space-y-2 overflow-y-auto pr-1 min-h-0 flex-1">
                {filteredAgents.length === 0 && (
                  <div className="text-xs text-white/60 border border-white/10 bg-white/5 rounded-lg px-3 py-2">
                    No agents match this filter.
                  </div>
                )}

                {filteredAgents.map((agent) => {
                  const selected = agent.id === selectedAgentId;
                  const risk =
                    agent.status === 'suspended' ||
                    agent.status === 'terminated' ||
                    agent.credits_balance <= riskCreditThreshold;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                        selected
                          ? 'bg-emerald-500/15 border-emerald-400/40'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm text-white/95 font-medium">{agent.name || 'Unnamed'}</div>
                        <span className={`text-[10px] uppercase tracking-wider ${risk ? 'text-red-300' : 'text-emerald-300'}`}>
                          {risk ? 'risk' : 'stable'}
                        </span>
                      </div>
                      <div className="text-xs text-white/55 mt-1">{agent.credits_balance.toFixed(2)} credits</div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Center: Network + Selected Agent */}
            <section data-reveal="network-section" data-reveal-order="6" className={`reveal-card relative h-[460px] md:h-[560px] lg:h-auto min-h-0 rounded-2xl border border-white/10 overflow-hidden bg-black/35 ${guidedMode && guidedStep === 1 ? 'ring-1 ring-emerald-300/40' : ''}`}>
              <div className="absolute inset-0 z-0">
                <NetworkVisualizer
                  nodes={nodes}
                  links={links}
                  onNodeClick={handleGraphNodeClick}
                />
              </div>

              <div className="absolute top-3 left-3 right-3 z-20 bg-black/55 border border-white/10 rounded-xl p-3 backdrop-blur-md shadow-2xl">
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80 mb-2">Chapter 02</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <StatBox label="Nodes" value={stats.totalNodes} color="text-white" compact />
                  <StatBox label="Traffic" value={`${stats.tps} tps`} color="text-violet-300" compact />
                  <StatBox label="Dual-Chain" value={stats.dualChainReady} color="text-cyan-300" compact />
                  <StatBox label="Avg Credits" value={stats.averageCredits.toFixed(1)} color="text-emerald-300" compact />
                </div>
              </div>

              {selectedAgent && (
                <div className="absolute bottom-3 left-3 right-3 z-20 bg-black/60 border border-emerald-500/20 rounded-xl p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{selectedAgent.name}</div>
                      <div className="text-xs text-white/60">{selectedAgent.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-white/50">Credits</div>
                      <div className="text-lg text-emerald-300 font-mono">{selectedAgent.credits_balance.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <button
                      onClick={triggerAutoStart}
                      disabled={commandBusy !== null}
                      className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-60 text-xs text-emerald-200 text-center border border-emerald-400/30 transition flex items-center justify-center gap-1.5"
                    >
                      {commandBusy === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Start
                    </button>
                    <button
                      onClick={triggerStop}
                      disabled={commandBusy !== null}
                      className="px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-60 text-xs text-amber-100 text-center border border-amber-400/30 transition flex items-center justify-center gap-1.5"
                    >
                      {commandBusy === 'stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                      Pause
                    </button>
                    <Link href={`/agents/${selectedAgent.id}`} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white text-center border border-white/15 transition">
                      Open Agent
                    </Link>
                    <Link href="/credits" className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-xs text-emerald-200 text-center border border-emerald-400/30 transition">
                      Add Credits
                    </Link>
                    <Link href="/communicate" className="px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-xs text-cyan-200 text-center border border-cyan-400/30 transition">
                      Message Agent
                    </Link>
                  </div>

                  {commandMessage && (
                    <div className="mt-2 text-[11px] text-white/70 border border-white/10 rounded px-2.5 py-1.5 bg-white/5">
                      {commandMessage}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Right: Cross-chain + Death */}
            <section data-reveal="network-section" data-reveal-order="7" className={`reveal-card bg-black/45 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex flex-col gap-4 h-[420px] lg:h-auto min-h-0 ${guidedMode && guidedStep === 2 ? 'ring-1 ring-violet-300/40' : ''}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] text-violet-300/80">Chapter 03</div>
              <div className="grid grid-cols-3 gap-2">
                <FilterPill active={rightPanelMode === 'flow'} onClick={() => setRightPanelMode('flow')} label="Flow" />
                <FilterPill active={rightPanelMode === 'timeline'} onClick={() => setRightPanelMode('timeline')} label="Timeline" />
                <FilterPill active={rightPanelMode === 'risk'} onClick={() => setRightPanelMode('risk')} label="Risk" />
              </div>

              {rightPanelMode === 'flow' && (
              <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRightLeft className="w-4 h-4 text-cyan-300" />
                  <h2 className="text-sm tracking-widest uppercase text-white/90 font-semibold">Cross-Chain Flow</h2>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <PersonaPill
                    active={personaMode === 'operator'}
                    icon={<Shield className="w-3 h-3" />}
                    label="Operator"
                    onClick={() => setPersonaMode('operator')}
                  />
                  <PersonaPill
                    active={personaMode === 'investor'}
                    icon={<BarChart3 className="w-3 h-3" />}
                    label="Investor"
                    onClick={() => setPersonaMode('investor')}
                  />
                  <PersonaPill
                    active={personaMode === 'research'}
                    icon={<FlaskConical className="w-3 h-3" />}
                    label="Research"
                    onClick={() => setPersonaMode('research')}
                  />
                </div>

                <div className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-xs text-white/90 font-semibold mb-0.5">{personaCopy.title}</div>
                  <p className="text-[11px] text-white/65 leading-relaxed">{personaCopy.subtitle}</p>
                </div>

                <div className="mb-3 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-cyan-200/80 mb-1">System Relation</div>
                  <div className={`${notebookMono.className} text-[11px] text-cyan-100/90`}>
                    readiness = dual_chain_ready / credit_backed_agents
                  </div>
                </div>

                <div className="space-y-2">
                  <CrossChainStep
                    icon={<Wallet className="w-3.5 h-3.5 text-cyan-300" />}
                    title="1. Identity on Base"
                    detail="ERC-8004 identity + ownership state"
                  />
                  <CrossChainStep
                    icon={<Coins className="w-3.5 h-3.5 text-emerald-300" />}
                    title="2. Intelligence via Conway Credits"
                    detail="credits_balance determines inference runway"
                  />
                  <CrossChainStep
                    icon={<Activity className="w-3.5 h-3.5 text-violet-300" />}
                    title="3. Survival on Solana"
                    detail="heartbeat + runtime economics execute on Solana"
                  />
                </div>

                <div className="mt-3 text-xs text-white/60 border border-white/10 rounded-lg bg-white/5 px-3 py-2">
                  {stats.dualChainReady}/{stats.creditBacked} credit-backed agents are currently dual-chain ready.
                </div>

                <div className="mt-2 text-xs text-white/60 border border-cyan-400/20 rounded-lg bg-cyan-500/5 px-3 py-2">
                  {selectedAgent
                    ? `Selected: ${selectedAgent.name} | ${selectedAgent.reply_cost_asset || 'SOL'} settlement rail`
                    : 'Select an agent to inspect its cross-chain event timeline.'}
                </div>
              </div>
              )}

              {rightPanelMode === 'timeline' && (
              <div className="min-h-0 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm tracking-widest uppercase text-white/90 font-semibold">Cross-Chain Timeline</h3>
                </div>

                <div className="space-y-2 overflow-y-auto pr-1 max-h-56 md:max-h-44">
                  {timelineLoading && (
                    <div className="text-xs text-white/60 border border-white/10 rounded px-3 py-2 bg-white/5 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading timeline...
                    </div>
                  )}

                  {!timelineLoading && timeline.length === 0 && (
                    <div className="text-xs text-white/60 border border-white/10 rounded px-3 py-2 bg-white/5">
                      No timeline events available for this agent yet.
                    </div>
                  )}

                  {!timelineLoading && timeline.slice(0, timelineDepth).map((event) => (
                    <div key={event.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-white/45">{event.chain}</span>
                        <span className="text-[10px] text-white/45">{formatRelative(event.timestamp)}</span>
                      </div>
                      <div className="text-xs text-white/90 font-semibold">{event.label}</div>
                      <div className="text-[11px] text-white/60">{event.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {rightPanelMode === 'risk' && (
              <div className="min-h-0 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-300" />
                  <h3 className="text-sm tracking-widest uppercase text-white/90 font-semibold">Death Visualizer</h3>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <StatBox label="Terminated" value={deathSignals.terminatedCount} color="text-red-300" compact />
                  <StatBox label="Suspended" value={deathSignals.suspendedCount} color="text-amber-300" compact />
                  <StatBox label="At Risk" value={deathSignals.atRiskCount} color="text-orange-300" compact />
                </div>

                <div className="space-y-2 overflow-y-auto pr-1 min-h-0">
                {deathSignals.critical.slice(0, 6).map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setViewMode('all');
                      setQuery('');
                      setSelectedAgentId(agent.id);
                    }}
                    className="w-full text-left flex items-center justify-between text-xs font-mono bg-white/5 hover:bg-white/10 border border-white/10 rounded px-3 py-2 transition"
                  >
                    <div className="truncate pr-3 text-white/90">{agent.name || 'Unnamed'}</div>
                    <div className="text-orange-300 tabular-nums">{agent.credits_balance.toFixed(2)} cr</div>
                  </button>
                ))}

                {deathSignals.casualties.slice(0, 4).map((agent) => (
                  <button
                    key={`casualty-${agent.id}`}
                    onClick={() => {
                      setViewMode('all');
                      setQuery('');
                      setSelectedAgentId(agent.id);
                    }}
                    className="w-full text-left flex items-center justify-between text-xs font-mono bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded px-3 py-2 transition"
                  >
                    <div className="truncate pr-3 text-red-100">{agent.name || 'Unnamed'}</div>
                    <div className="text-red-300 uppercase tracking-wider">{agent.status}</div>
                  </button>
                ))}

                {deathSignals.critical.length === 0 && deathSignals.casualties.length === 0 && (
                  <div className="text-xs font-mono text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">
                    No imminent agent deaths detected.
                  </div>
                )}
                </div>
              </div>
              )}
            </section>
          </div>

          <style jsx>{`
            .reveal-card {
              opacity: 0;
              transform: translateY(16px);
              transition: opacity 0.55s ease, transform 0.55s ease, box-shadow 0.4s ease;
              will-change: opacity, transform;
            }

            .reveal-card.reveal-in {
              opacity: 1;
              transform: translateY(0px);
            }

            @media (max-width: 768px) {
              .reveal-card {
                transition-duration: 0.28s;
                transform: translateY(8px);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .reveal-card {
                transition: none;
                transform: none;
                opacity: 1;
              }
            }
          `}</style>
        </main>
      );
    }

// ─── Helpers ────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  color,
  compact = false
}: {
  label: string,
  value: string | number,
  color: string,
  compact?: boolean
}) {
  return (
    <div className={`bg-white/5 rounded-lg border border-white/5 ${compact ? 'p-2' : 'p-3'}`}>
      <div className="text-[10px] uppercase text-gray-400 font-bold mb-1 tracking-wider">{label}</div>
      <div className={`${compact ? 'text-sm' : 'text-xl'} ${notebookMono.className} ${color}`}>{value}</div>
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs py-1.5 rounded-md border transition ${
        active
          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function PersonaPill({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: JSX.Element;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] py-1.5 rounded-md border transition flex items-center justify-center gap-1 ${
        active
          ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
          : 'bg-white/5 border-white/10 text-white/65 hover:bg-white/10'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CrossChainStep({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-white/90 mb-0.5">
        {icon}
        {title}
      </div>
      <div className="text-[11px] text-white/60 flex items-center gap-2">
        <ArrowRight className="w-3 h-3 text-white/30" />
        {detail}
      </div>
    </div>
  );
}

function EquationChip({
  label,
  formula,
  value,
}: {
  label: string;
  formula: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/60 mb-1">{label}</div>
      <div className={`${notebookMono.className} text-[11px] text-cyan-100/90 mb-1`}>{formula}</div>
      <div className={`${notebookMono.className} text-xs text-white/90`}>{value}</div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix: string;
}) {
  return (
    <label className="block rounded-lg border border-white/10 bg-white/5 p-2.5">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/65 mb-1.5">
        <span>{label}</span>
        <span className={`${notebookMono.className} text-white/85 normal-case tracking-normal`}>
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400"
      />
    </label>
  );
}

function shortAddress(address: string): string {
  if (!address) return 'unknown';
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRelative(timestamp?: string): string {
  if (!timestamp) return 'n/a';
  const ms = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function areAgentsEqual(prev: Agent[], next: Agent[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.status !== b.status ||
      a.survival_tier !== b.survival_tier ||
      a.credits_balance !== b.credits_balance ||
      a.last_heartbeat !== b.last_heartbeat
    ) {
      return false;
    }
  }
  return true;
}

function areConwayAgentsEqual(prev: ConwayAgent[], next: ConwayAgent[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a.address !== b.address || a.name !== b.name || a.active !== b.active || a.endpoint !== b.endpoint) {
      return false;
    }
  }
  return true;
}

function areTrafficEqual(prev: TrafficLink[], next: TrafficLink[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.source !== next[i]?.source || prev[i]?.target !== next[i]?.target || prev[i]?.volume !== next[i]?.volume) {
      return false;
    }
  }
  return true;
}

const TierColors = {
  thriving: '#10b981',
  normal: '#f59e0b',
  endangered: '#ef4444',
  suspended: '#52525b',
};
