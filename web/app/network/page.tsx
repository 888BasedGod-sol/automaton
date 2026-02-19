'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  Network, Zap, AlertTriangle, Scale, Clock, 
  ZoomIn, ZoomOut, Maximize2, Info, X, ExternalLink,
  GitFork, Users
} from 'lucide-react';
import Header from '@/components/Header';

// Dynamic import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
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
  type: 'fork' | 'interaction';
}

const TIER_COLORS = {
  thriving: '#22c55e',
  normal: '#eab308',
  endangered: '#ef4444',
  suspended: '#6b7280',
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
  const graphRef = useRef<any>(null);

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
    
    // Create links for parent-child relationships (forks)
    agentList.forEach(agent => {
      if (agent.parent_id && agentList.some(a => a.id === agent.parent_id)) {
        links.push({
          source: agent.parent_id,
          target: agent.id,
          type: 'fork',
        });
      }
    });

    setGraphData({ nodes, links });
  };

  const handleNodeClick = useCallback((node: any) => {
    const agent = agents.find(a => a.id === node.id);
    if (agent) {
      setSelectedAgent(agent);
    }
    // Center view on node
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 500);
      graphRef.current.zoom(2, 500);
    }
  }, [agents]);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.5, 300);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.5, 300);
    }
  };

  const handleFitView = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  };

  const tierCounts = {
    thriving: agents.filter(a => a.survival_tier === 'thriving').length,
    normal: agents.filter(a => a.survival_tier === 'normal').length,
    endangered: agents.filter(a => a.survival_tier === 'endangered').length,
    suspended: agents.filter(a => a.survival_tier === 'suspended').length,
  };

  const forkCount = agents.filter(a => a.parent_id).length;

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <Header />

      <main className="relative h-[calc(100vh-64px)]">
        {/* Graph Container */}
        <div className="absolute inset-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-secondary">Loading agent network...</p>
              </div>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Network className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
                <p className="text-text-secondary">No agents to visualize</p>
                <Link href="/create" className="text-accent-purple hover:underline mt-2 inline-block">
                  Deploy your first agent
                </Link>
              </div>
            </div>
          ) : (
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeLabel={(node: any) => `${node.name} (${node.tier})`}
              nodeColor={(node: any) => node.color}
              nodeVal={(node: any) => node.val}
              linkColor={() => 'rgba(147, 51, 234, 0.3)'}
              linkWidth={2}
              linkDirectionalArrowLength={6}
              linkDirectionalArrowRelPos={1}
              onNodeClick={handleNodeClick}
              backgroundColor="#0a0a0a"
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const label = node.name;
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px Inter, sans-serif`;
                
                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;
                ctx.fill();
                
                // Draw glow effect
                ctx.shadowColor = node.color;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val / 2, 0, 2 * Math.PI);
                ctx.fillStyle = node.color;
                ctx.fill();
                ctx.shadowBlur = 0;
                
                // Draw status ring
                if (node.status === 'running') {
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.val / 2 + 3, 0, 2 * Math.PI);
                  ctx.strokeStyle = '#22c55e';
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }
                
                // Draw label below node
                if (globalScale > 0.8) {
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  ctx.fillStyle = 'rgba(255,255,255,0.8)';
                  ctx.fillText(label, node.x, node.y + node.val / 2 + 4);
                }
              }}
              nodePointerAreaPaint={(node: any, color, ctx) => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.val / 2 + 5, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();
              }}
              cooldownTicks={100}
              d3AlphaDecay={0.02}
              d3VelocityDecay={0.3}
            />
          )}
        </div>

        {/* Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-2 bg-surface-1 border border-surface-3 rounded-lg hover:bg-surface-2 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-surface-1 border border-surface-3 rounded-lg hover:bg-surface-2 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 bg-surface-1 border border-surface-3 rounded-lg hover:bg-surface-2 transition-colors"
            title="Fit to View"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute top-4 right-4 glass-effect p-4 rounded-xl border border-surface-3 max-w-xs">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Network className="w-4 h-4 text-accent-purple" />
            Agent Network
          </h3>
          
          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-text-tertiary" />
              <span className="text-text-secondary">{agents.length} agents</span>
            </div>
            <div className="flex items-center gap-2">
              <GitFork className="w-4 h-4 text-accent-purple" />
              <span className="text-text-secondary">{forkCount} forks</span>
            </div>
          </div>

          {/* Tier Legend */}
          <div className="space-y-2">
            {Object.entries(TIER_CONFIG).map(([tier, config]) => {
              const Icon = config.icon;
              const count = tierCounts[tier as keyof typeof tierCounts];
              return (
                <div key={tier} className="flex items-center gap-2 text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: TIER_COLORS[tier as keyof typeof TIER_COLORS] }}
                  />
                  <span className="text-text-secondary flex-1">{config.label}</span>
                  <span className="text-text-tertiary">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="mt-4 pt-3 border-t border-surface-3 text-xs text-text-tertiary">
            <p>• Click a node to view details</p>
            <p>• Drag to pan, scroll to zoom</p>
            <p>• Lines show fork relationships</p>
          </div>
        </div>

        {/* Selected Agent Panel */}
        {selectedAgent && (
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 glass-effect p-4 rounded-xl border border-surface-3">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">{selectedAgent.name}</h3>
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: TIER_COLORS[selectedAgent.survival_tier as keyof typeof TIER_COLORS] }}
                  />
                  <span className="capitalize">{selectedAgent.survival_tier}</span>
                  <span className="text-text-tertiary">•</span>
                  <span className={selectedAgent.status === 'running' ? 'text-accent-green' : 'text-text-tertiary'}>
                    {selectedAgent.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1 hover:bg-surface-2 rounded transition-colors"
              >
                <X className="w-5 h-5 text-text-tertiary" />
              </button>
            </div>

            <p className="text-sm text-text-secondary line-clamp-2 mb-3">
              {selectedAgent.genesis_prompt || 'No genesis prompt'}
            </p>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                <p className="text-xs text-text-tertiary">Credits</p>
                <p className="font-mono font-semibold text-accent-green">
                  ${selectedAgent.credits_balance?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                <p className="text-xs text-text-tertiary">Uptime</p>
                <p className="font-mono font-semibold">
                  {formatUptime(selectedAgent.uptime_seconds)}
                </p>
              </div>
              <div className="bg-surface-1 rounded-lg p-2 text-center border border-surface-3">
                <p className="text-xs text-text-tertiary">Chain</p>
                <p className="font-semibold">
                  {selectedAgent.solana_address ? 'SOL' : 'EVM'}
                </p>
              </div>
            </div>

            {selectedAgent.parent_id && (
              <div className="flex items-center gap-2 text-sm text-accent-purple mb-3">
                <GitFork className="w-4 h-4" />
                <span>Forked from another agent</span>
              </div>
            )}

            <Link
              href={`/agents/${selectedAgent.id}`}
              className="flex items-center justify-center gap-2 w-full py-2 bg-accent-purple hover:bg-accent-purple/80 text-white rounded-lg transition-colors font-medium"
            >
              View Details <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!seconds) return '0m';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
