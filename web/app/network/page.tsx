'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  Network, Zap, AlertTriangle, Scale, Clock, 
  ZoomIn, ZoomOut, Maximize2, Info, X, ExternalLink,
  GitFork, Users, Activity, BarChart2, Cpu, Database
} from 'lucide-react';
import Header from '@/components/Header';
import NetworkBackground from '@/components/NetworkBackground';

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
  const [trafficData, setTrafficData] = useState<any[]>([]);
  const [randomLinks, setRandomLinks] = useState<string[][]>([]);
  const [stats, setStats] = useState({ 
    activeAgents: 0, 
    totalTransactions: 0, 
    networkValue: 0 
  });
  const graphRef = useRef<any>(null);

  // Poll for real network traffic & stats
  useEffect(() => {
    const fetchTraffic = async () => {
      try {
        const res = await fetch('/api/network/traffic');
        const data = await res.json();
        if (data.traffic && Array.isArray(data.traffic)) {
          setTrafficData(data.traffic);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (e) {
        console.error("Traffic fetch error", e);
      }
    };
    
    fetchTraffic();
    const interval = setInterval(fetchTraffic, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    if (agents.length > 0 && randomLinks.length === 0) {
       const links: string[][] = [];
       if (agents.length > 5) {
         for (let i = 0; i < agents.length; i++) {
           if (Math.random() > 0.7) {
             const targetIndex = Math.floor(Math.random() * agents.length);
             if (agents[i].id !== agents[targetIndex].id) {
                links.push([agents[i].id, agents[targetIndex].id]);
             }
           }
         }
       }
       setRandomLinks(links);
    }
  }, [agents]);

  useEffect(() => {
    if (agents.length > 0) {
      buildGraph(agents, trafficData);
    }
  }, [agents, trafficData, randomLinks]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents/all');
      const data = await res.json();
      const agentList = data.agents || [];
      setAgents(agentList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buildGraph = (agentList: Agent[], currentTraffic: any[] = []) => {
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
    const linkSet = new Set<string>();

    // 1. Structural Links (Parent-Child)
    agentList.forEach(agent => {
      if (agent.parent_id && agentList.some(a => a.id === agent.parent_id)) {
        links.push({
          source: agent.parent_id,
          target: agent.id,
          type: 'fork',
        });
        linkSet.add(`${agent.parent_id}-${agent.id}`);
      }
    });

    // 2. Traffic Links (Real Communication - High Priority)
    currentTraffic.forEach((t: any) => {
       const sourceId = t.source;
       const targetId = t.target;
       
       const sNode = nodes.find(n => n.id === sourceId);
       const tNode = nodes.find(n => n.id === targetId);

       if (sNode && tNode) {
          // If connection doesn't exist, create it as traffic type
          if (!linkSet.has(`${sourceId}-${targetId}`) && !linkSet.has(`${targetId}-${sourceId}`)) {
            links.push({
              source: sourceId,
              target: targetId,
              type: 'traffic'
            });
            linkSet.add(`${sourceId}-${targetId}`);
            linkSet.add(`${targetId}-${sourceId}`);
          } 
          // If it DOES exist (e.g. fork), we ideally update it to be active
          // But strict graph updates are tricky. 
          // For now, let's assume traffic overrides
       }
    });

    // 3. Simulated Random Links (Static set)
    if (randomLinks && randomLinks.length > 0) {
      randomLinks.forEach((pair) => {
         const src = pair[0];
         const tgt = pair[1];
         
         const sNode = nodes.find(n => n.id === src);
         const tNode = nodes.find(n => n.id === tgt);
         
         if (sNode && tNode && !linkSet.has(`${src}-${tgt}`) && !linkSet.has(`${tgt}-${src}`)) {
            links.push({
              source: src,
              target: tgt,
              type: 'peer'
            });
             linkSet.add(`${src}-${tgt}`);
             linkSet.add(`${tgt}-${src}`);
         }
      });
    } else if (nodes.length > 5) {
      // Fallback if randomLinks not ready
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
        {/* Immersive Background */}
        <div className="absolute inset-0 z-0">
           <NetworkBackground />
        </div>
        
        {/* Graph Container */}
        <div className="absolute inset-0 z-10">
          {!loading && (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeLabel="name"
              nodeColor="color"
              nodeRelSize={6}
              linkColor={(link: any) => {
                if (link.type === 'traffic') return '#8b5cf6'; // Violet for active traffic
                if (link.type === 'fork') return '#52525b';
                return '#27272a';
              }}
              linkWidth={(link: any) => {
                if (link.type === 'traffic') return 2;
                if (link.type === 'fork') return 2;
                return 1;
              }}
              linkDirectionalParticles={(link: any) => {
                if (link.type === 'traffic') return 4;
                if (link.type === 'fork') return 0;
                return 1; // slow passive traffic on peer links
              }}
              linkDirectionalParticleSpeed={(link: any) => {
                if (link.type === 'traffic') return 0.01;
                return 0.002;
              }}
              linkDirectionalParticleWidth={(link: any) => link.type === 'traffic' ? 4 : 2}
              linkDirectionalParticleColor={() => '#8b5cf6'} // accent color particles
              backgroundColor="rgba(0,0,0,0)" // Transparent to show background
              onNodeClick={handleNodeClick}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                const radius = node.val / 2;
                const isActive = node.status === 'running' || node.status === 'active';
                const isThriving = node.tier === 'thriving';
                
                // Helper to draw hex
                const drawHex = (x: number, y: number, r: number) => {
                  ctx.beginPath();
                  for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - (Math.PI / 6); // Rotate 30deg for flat top
                    const px = x + r * Math.cos(angle);
                    const py = y + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                  }
                  ctx.closePath();
                };

                // Glow Effect
                const glowSize = isActive ? 15 : 5;
                ctx.shadowColor = node.color;
                ctx.shadowBlur = glowSize;
                
                // Main Shape (Hex for active/thriving, Circle for others)
                ctx.fillStyle = node.color;
                if (isActive || isThriving) {
                  drawHex(node.x, node.y, radius);
                  ctx.fill();
                } else {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                  ctx.fill();
                }
                
                // Reset shadow for crisp lines
                ctx.shadowBlur = 0;
                
                // Active Pulse effect for running agents
                if (isActive) {
                  const time = Date.now() / 1000;
                  const pulseRadius = radius + (Math.sin(time * 3) + 1) * 2;
                  ctx.strokeStyle = `${node.color}60`; // Low opacity
                  ctx.lineWidth = 1 / globalScale;
                  drawHex(node.x, node.y, pulseRadius);
                  ctx.stroke();

                  // Tech Ring rotating
                  ctx.save();
                  ctx.translate(node.x, node.y);
                  ctx.rotate(time);
                  ctx.strokeStyle = `${node.color}AA`;
                  ctx.lineWidth = 1.5 / globalScale;
                  ctx.beginPath();
                  ctx.arc(0, 0, radius * 1.4, 0, Math.PI); // Half circle ring
                  ctx.stroke();
                  
                  // Second ring opposite
                  ctx.rotate(Math.PI);
                  ctx.strokeStyle = `${node.color}55`;
                  ctx.beginPath();
                  ctx.arc(0, 0, radius * 1.6, 0, Math.PI * 0.5);
                  ctx.stroke();
                  
                  ctx.restore();
                }

                // Inner highlight / Core
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                if (isActive || isThriving) {
                   drawHex(node.x, node.y, radius * 0.7);
                   ctx.fill();
                } else {
                   ctx.beginPath();
                   ctx.arc(node.x, node.y, radius * 0.6, 0, 2 * Math.PI);
                   ctx.fill();
                }
                
                // Border
                ctx.strokeStyle = '#000'; 
                ctx.lineWidth = 1 / globalScale;
                if (isActive || isThriving) {
                   drawHex(node.x, node.y, radius);
                   ctx.stroke();
                } else {
                   ctx.stroke();
                }
                
                // Label
                if (globalScale > 0.9 || isActive) {
                  ctx.font = `${fontSize}px JetBrains Mono, monospace`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  
                  // Text background for readability
                  const textWidth = ctx.measureText(label).width;
                  const bgPad = 4;
                  ctx.fillStyle = 'rgba(0,0,0,0.8)';
                  // Rounded rect background for text
                  ctx.fillRect(node.x - textWidth/2 - bgPad, node.y + radius + 6, textWidth + bgPad*2, fontSize + bgPad);
                  
                  ctx.fillStyle = isActive ? '#fff' : '#aaa';
                  ctx.fillText(label, node.x, node.y + radius + 8);
                }
              }}
              // Simulation physics tweaks for continuous movement
              cooldownTicks={100000}
              d3AlphaDecay={0.01}
              d3VelocityDecay={0.3}
              warmupTicks={10}
            />
          )}
        </div>

        {/* Live Status Overlay - HUD Style */}
        <div className="absolute top-24 left-6 z-20 pointer-events-none">
          <div className="flex flex-col gap-4">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-lg w-72 shadow-2xl">
              <div className="flex items-center gap-2 mb-4 text-xs font-mono text-accent uppercase tracking-widest border-b border-white/5 pb-2">
                <Activity className="w-3 h-3 animate-pulse" />
                Network Metrics :: Live
              </div>
              <div className="space-y-4">
                 <div>
                   <div className="flex items-end justify-between mb-1">
                     <span className="text-xs text-fg-muted font-mono uppercase tracking-wider">Active Entities</span>
                     <span className="text-xl font-mono text-white tabular-nums font-bold">{stats.activeAgents}</span>
                   </div>
                   <div className="w-full bg-white/5 h-1 rounded overflow-hidden">
                     <div className="h-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)] transition-all duration-1000" style={{ width: `${Math.min(100, (stats.activeAgents / 50) * 100)}%` }} />
                   </div>
                 </div>

                 <div>
                   <div className="flex items-end justify-between mb-1">
                     <span className="text-xs text-fg-muted font-mono uppercase tracking-wider">Global Transactions</span>
                     <span className="text-xl font-mono text-accent tabular-nums font-bold">{stats.totalTransactions.toLocaleString()}</span>
                   </div>
                   <div className="w-full bg-white/5 h-1 rounded overflow-hidden">
                      <div className="h-full bg-accent shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-1000" style={{ width: '100%' }} />
                   </div>
                 </div>
                 
                 <div className="pt-3 border-t border-white/5">
                   <div className="flex items-end justify-between">
                     <span className="text-xs text-fg-muted font-mono uppercase tracking-wider">Network Value (TVL)</span>
                     <span className="text-xl font-mono text-white tabular-nums font-bold">${stats.networkValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
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