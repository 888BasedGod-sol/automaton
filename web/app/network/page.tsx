'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  Network, Zap, AlertTriangle, Scale, Clock, 
  ZoomIn, ZoomOut, Maximize2, Info, X, ExternalLink,
  GitFork, Users, Activity, BarChart2
} from 'lucide-react';
import Header from '@/components/Header';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-fg-muted">
      <div className="flex flex-col items-center">
        <Activity className="w-8 h-8 text-accent animate-spin mb-4" />
        <p className="text-sm font-mono tracking-wider">INITIALIZING NETWORK MATRIX...</p>
      </div>
    </div>
  )
});

interface Agent {
  id: string;
  name: string;
  genesis_prompt: string;
  status: string;
  survival_tier: string;
  credits_balance: number;
  solana_address: string;
  evm_address: string;
  parent_id: string | null;
  created_at: string;
  uptime_seconds: number;
}

interface GraphNode {
  id: string;
  name: string;
  tier: string;
  status: string;
  credits: number;
  val: number;
  color: string;
  parentId: string | null;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

const TIER_COLORS = {
  thriving: '#10b981', // success (emerald-500)
  normal: '#f59e0b',   // warning (amber-500)
  endangered: '#ef4444', // error (red-500)
  suspended: '#52525b', // zinc-600
};

const TIER_CONFIG = {
  thriving: { icon: Zap, label: 'Thriving' },
  normal: { icon: Scale, label: 'Normal' },
  endangered: { icon: AlertTriangle, label: 'Endangered' },
  suspended: { icon: Clock, label: 'Suspended' },
};

export default function NetworkPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [stats, setStats] = useState({ tps: 0, activeConnections: 0 });
  const graphRef = useRef<any>(null);

  // Simulate real-time data
  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        tps: Math.floor(Math.random() * 50) + 120,
        activeConnections: Math.floor(Math.random() * 10) + graphData.links.length,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [graphData.links.length]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents/all');
      const data = await res.json();
      const agentList = data.agents || [];
      setAgents(agentList);
      buildGraph(agentList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buildGraph = (agentList: Agent[]) => {
    const nodes: GraphNode[] = agentList.map(agent => ({
      id: agent.id,
      name: agent.name,
      tier: agent.survival_tier,
      status: agent.status,
      credits: agent.credits_balance || 0,
      val: Math.max(5, Math.min(30, (agent.credits_balance || 0) / 10 + 10)),
      color: TIER_COLORS[agent.survival_tier as keyof typeof TIER_COLORS] || TIER_COLORS.normal,
      parentId: agent.parent_id,
    }));

    const links: GraphLink[] = [];
    
    // Create heavy links for parent-child
    agentList.forEach(agent => {
      if (agent.parent_id && agentList.some(a => a.id === agent.parent_id)) {
        links.push({
          source: agent.parent_id,
          target: agent.id,
          type: 'fork',
        });
      }
    });

    // Add random "communication" links for visual density (simulated peering)
    if (nodes.length > 5) {
      for (let i = 0; i < nodes.length; i++) {
        if (Math.random() > 0.7) {
          const targetIndex = Math.floor(Math.random() * nodes.length);
          if (targetIndex !== i) {
             links.push({
               source: nodes[i].id,
               target: nodes[targetIndex].id,
               type: 'peer',
             });
          }
        }
      }
    }

    setGraphData({ nodes, links });
  };

  const handleNodeClick = useCallback((node: any) => {
    const agent = agents.find(a => a.id === node.id);
    if (agent) {
      setSelectedAgent(agent);
    }
    // Center view on node with smooth animation
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 800);
      graphRef.current.zoom(2.5, 800);
    }
  }, [agents]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 400);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(600, 50);
    }
  };

  const tierCounts = {
    thriving: agents.filter(a => a.survival_tier === 'thriving').length,
    normal: agents.filter(a => a.survival_tier === 'normal').length,
    endangered: agents.filter(a => a.survival_tier === 'endangered').length,
    suspended: agents.filter(a => a.survival_tier === 'suspended').length,
  };

  return (
    <div className="h-screen bg-bg-base text-fg overflow-hidden flex flex-col relative font-sans">
      <div className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </div>

      <main className="flex-1 relative bg-[#050505]">
        {/* Subtle grid background */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
             style={{ 
               backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
        />
        
        {/* Graph Container */}
        <div className="absolute inset-0 z-0">
          {!loading && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeLabel="name"
              nodeColor="color"
              nodeRelSize={6}
              linkColor={(link: any) => link.type === 'fork' ? '#52525b' : '#27272a'}
              linkWidth={(link: any) => link.type === 'fork' ? 2 : 1}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={() => '#8b5cf6'} // accent color particles
              backgroundColor="rgba(0,0,0,0)" // Transparent to show grid
              onNodeClick={handleNodeClick}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                const radius = node.val / 2;
                
                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;
                ctx.fill();
                
                // Active Pulse effect for running agents
                if (node.status === 'running' || node.status === 'active') {
                  const time = Date.now() / 1000;
                  const pulseRadius = radius + (Math.sin(time * 3) + 1) * 2;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, pulseRadius, 0, 2 * Math.PI);
                  ctx.strokeStyle = `${node.color}40`; // Low opacity
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }

                // Inner highlight
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 0.7, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255,255,255,0.1)';
                ctx.fill();
                
                // Border
                ctx.strokeStyle = '#09090b'; 
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
                
                // Label
                if (globalScale > 0.8) {
                  ctx.font = `${fontSize}px JetBrains Mono, monospace`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  
                  // Text background for readability
                  const textWidth = ctx.measureText(label).width;
                  ctx.fillStyle = 'rgba(0,0,0,0.7)';
                  ctx.fillRect(node.x - textWidth/2 - 2, node.y + radius + 4, textWidth + 4, fontSize + 4);
                  
                  ctx.fillStyle = '#e4e4e7'; // fg
                  ctx.fillText(label, node.x, node.y + radius + 6);
                }
              }}
              // Simulation physics tweaks for stability
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.4}
              warmupTicks={50}
            />
          )}
        </div>

        {/* Live Status Overlay - HUD Style */}
        <div className="absolute top-20 left-6 z-20 pointer-events-none">
          <div className="flex flex-col gap-4">
            <div className="bg-black/40 backdrop-blur-sm border border-white/10 p-4 rounded-lg w-64">
              <div className="flex items-center gap-2 mb-3 text-xs font-mono text-accent uppercase tracking-widest">
                <Activity className="w-3 h-3" />
                Network Status :: Online
              </div>
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-xs text-fg-muted font-mono">TPS (Est)</span>
                   <span className="text-sm font-mono text-white tabular-nums">{stats.tps}</span>
                 </div>
                 <div className="w-full bg-bg-elevated h-1 rounded overflow-hidden">
                   <div className="h-full bg-accent animate-pulse" style={{ width: `${Math.min(100, stats.tps / 2)}%` }} />
                 </div>
                 
                 <div className="flex items-center justify-between pt-2 border-t border-white/5">
                   <span className="text-xs text-fg-muted font-mono">Active Nodes</span>
                   <span className="text-sm font-mono text-success tabular-nums">{agents.filter(a => a.status === 'running').length}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="text-xs text-fg-muted font-mono">Total Stake</span>
                   <span className="text-sm font-mono text-white tabular-nums">${agents.reduce((acc, a) => acc + (a.credits_balance || 0), 0).toFixed(0)}</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-6 left-6 z-20 flex gap-2">
            <button
              onClick={handleZoomIn}
              className="p-3 bg-bg-surface hover:bg-bg-elevated border border-border rounded-lg text-fg transition-all active:scale-95"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-3 bg-bg-surface hover:bg-bg-elevated border border-border rounded-lg text-fg transition-all active:scale-95"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={handleFitView}
              className="p-3 bg-bg-surface hover:bg-bg-elevated border border-border rounded-lg text-fg transition-all active:scale-95"
              title="Reset View"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
        </div>

        {/* Legend */}
        <div className="absolute top-20 right-6 z-20 bg-bg-surface/80 backdrop-blur border border-border rounded-lg shadow-2xl p-4 w-60">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
            <span className="text-xs font-mono text-fg-muted uppercase tracking-wider">Node Types</span>
            <Network className="w-3.5 h-3.5 text-accent" />
          </div>
          <div className="space-y-2">
            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
              const count = tierCounts[tier as keyof typeof tierCounts];
              return (
                <div key={tier} className="flex items-center gap-2 group cursor-default">
                   <div className="relative flex items-center justify-center w-4 h-4">
                      <div 
                        className="w-2 h-2 rounded-full transition-all group-hover:w-3 group-hover:h-3" 
                        style={{ backgroundColor: TIER_COLORS[tier as keyof typeof TIER_COLORS], boxShadow: `0 0 8px ${TIER_COLORS[tier as keyof typeof TIER_COLORS]}40` }}
                      />
                   </div>
                   <span className="text-xs text-fg-muted flex-1 font-mono">{config.label}</span>
                   <span className="text-xs text-fg font-mono">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Agent Panel - Slide in */}
        {selectedAgent && (
          <div className="absolute top-20 right-6 z-30 w-80 bg-[#111] border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="h-1 w-full bg-gradient-to-r from-accent to-purple-500" />
            <div className="p-5">
               <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-white mb-1">{selectedAgent.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedAgent.status === 'running' ? 'bg-success animate-pulse' : 'bg-fg-muted'}`} />
                      <span className="text-xs text-fg-muted font-mono uppercase">{selectedAgent.status}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAgent(null)}
                    className="p-1 hover:bg-white/10 rounded-full text-fg-muted hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
               </div>

               <div className="bg-white/5 rounded p-3 mb-4 text-xs text-fg-muted font-mono leading-relaxed border border-white/5">
                  &gt; {selectedAgent.genesis_prompt || 'System default configuration active.'}
                  <span className="animate-pulse">_</span>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-bg-base p-3 rounded border border-white/5 flex flex-col items-center justify-center text-center">
                     <span className="text-[10px] text-fg-muted uppercase tracking-wider mb-1">Compute</span>
                     <span className="text-lg font-mono text-white">{formatUptime(selectedAgent.uptime_seconds)}</span>
                  </div>
                  <div className="bg-bg-base p-3 rounded border border-white/5 flex flex-col items-center justify-center text-center">
                     <span className="text-[10px] text-fg-muted uppercase tracking-wider mb-1">Balance</span>
                     <span className="text-lg font-mono text-success">${selectedAgent.credits_balance?.toFixed(2)}</span>
                  </div>
               </div>

               <Link 
                  href={`/agents/${selectedAgent.id}`}
                  className="btn btn-primary w-full justify-center group"
                >
                  <span className="group-hover:translate-x-1 transition-transform inline-block">Execute Audit</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-70" />
               </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!seconds) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}