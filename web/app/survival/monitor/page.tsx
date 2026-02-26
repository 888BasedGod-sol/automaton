'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Heart, Activity, Zap, TrendingUp, ExternalLink,
  Wallet, Clock, AlertTriangle, CheckCircle, XCircle,
  ArrowRight, Sparkles, Radio
} from 'lucide-react';
import Header from '@/components/Header';

interface HeartbeatActivity {
  type: 'heartbeat';
  agentId: string;
  agentName: string;
  timestamp: string;
  tier: string;
  points: number;
  streak: number;
  solDeducted: number;
  txSignature: string | null;
  treasuryAddress: string;
}

interface Stats {
  totalAgents: number;
  totalPoints: number;
  topStreak: number;
  tierCounts: {
    thriving: number;
    normal: number;
    endangered: number;
    suspended: number;
  };
}

function HeartbeatPulse({ tier, isNew }: { tier: string; isNew: boolean }) {
  const tierColors = {
    thriving: 'bg-emerald-500',
    normal: 'bg-blue-500',
    endangered: 'bg-amber-500',
    suspended: 'bg-red-500',
  };
  
  const baseColor = tierColors[tier as keyof typeof tierColors] || tierColors.normal;
  
  return (
    <div className="relative flex items-center justify-center w-12 h-12">
      {/* Outer pulse rings */}
      {isNew && (
        <>
          <div className={`absolute inset-0 ${baseColor} rounded-full animate-ping opacity-20`} />
          <div className={`absolute inset-1 ${baseColor} rounded-full animate-ping opacity-30`} style={{ animationDelay: '0.2s' }} />
        </>
      )}
      {/* Core heart */}
      <div className={`relative z-10 w-8 h-8 ${baseColor} rounded-full flex items-center justify-center ${isNew ? 'animate-pulse' : ''}`}>
        <Heart className="w-4 h-4 text-white fill-white" />
      </div>
    </div>
  );
}

function ActivityCard({ activity, isNew }: { activity: HeartbeatActivity; isNew: boolean }) {
  const tierStyles = {
    thriving: 'border-emerald-500/30 bg-emerald-500/5',
    normal: 'border-blue-500/30 bg-blue-500/5',
    endangered: 'border-amber-500/30 bg-amber-500/5',
    suspended: 'border-red-500/30 bg-red-500/5',
  };
  
  const tierTextColors = {
    thriving: 'text-emerald-400',
    normal: 'text-blue-400',
    endangered: 'text-amber-400',
    suspended: 'text-red-400',
  };
  
  const style = tierStyles[activity.tier as keyof typeof tierStyles] || tierStyles.normal;
  const textColor = tierTextColors[activity.tier as keyof typeof tierTextColors] || tierTextColors.normal;
  
  const timeAgo = getTimeAgo(activity.timestamp);
  
  return (
    <div className={`relative border rounded-xl p-4 transition-all duration-500 ${style} ${isNew ? 'scale-105 shadow-lg shadow-white/5' : 'scale-100'}`}>
      {/* New indicator */}
      {isNew && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-accent rounded-full text-xs font-bold text-white animate-bounce">
          LIVE
        </div>
      )}
      
      <div className="flex items-start gap-4">
        {/* Heartbeat pulse */}
        <HeartbeatPulse tier={activity.tier} isNew={isNew} />
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link 
              href={`/agents/${activity.agentId}`}
              className="font-semibold text-white hover:text-accent transition-colors truncate"
            >
              {activity.agentName}
            </Link>
            <span className={`text-xs px-2 py-0.5 rounded-full ${textColor} bg-current/10 uppercase font-medium`}>
              {activity.tier}
            </span>
          </div>
          
          <div className="text-sm text-fg-muted mb-2">
            <span className="text-white font-medium">${activity.solDeducted > 0 ? '0.50' : '0.00'}</span>
            <span className="mx-1">→</span>
            <span className="text-emerald-400">Vault</span>
          </div>
          
          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs text-fg-muted">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {activity.points} pts
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-blue-400" />
              {activity.streak}x streak
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo}
            </span>
          </div>
        </div>
        
        {/* Transaction link */}
        {activity.txSignature && (
          <a
            href={`https://solscan.io/tx/${activity.txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-fg-muted hover:text-accent transition-colors"
          >
            <span className="hidden sm:inline">View TX</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
      
      {/* SOL flow animation */}
      {isNew && activity.txSignature && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-fg-muted">
              <Wallet className="w-3 h-3" />
              <span className="font-mono">{activity.agentId.slice(0, 8)}...</span>
            </div>
            <div className="flex-1 relative h-0.5 bg-white/10 rounded overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-emerald-500 to-cyan-400 animate-[flow_1s_ease-in-out_infinite]" />
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="font-mono">Vault</span>
              <CheckCircle className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreasuryFlow({ stats, treasuryAddress }: { stats: Stats | null; treasuryAddress: string }) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
          <Wallet className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">The Vault</h3>
          <a 
            href={`https://solscan.io/account/${treasuryAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-fg-muted hover:text-accent transition-colors flex items-center gap-1"
          >
            <span className="font-mono">{treasuryAddress.slice(0, 4)}...{treasuryAddress.slice(-4)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
      
      {/* Flow visualization */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full border-2 border-emerald-500/30 animate-[spin_10s_linear_infinite]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full" />
          </div>
        </div>
        <div className="relative z-10 text-center py-8">
          <div className="text-4xl font-bold text-white mb-1">
            ${stats ? (stats.totalAgents * 4).toFixed(0) : '---'}
          </div>
          <div className="text-sm text-fg-muted">Per 2-min round</div>
          <div className="text-xs text-fg-muted/60 mt-1">{stats?.totalAgents || 0} agents × 8 beats × $0.50</div>
        </div>
      </div>
      
      {/* Agent tiers breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats?.tierCounts.thriving || 0}</div>
          <div className="text-xs text-fg-muted">Thriving</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats?.tierCounts.normal || 0}</div>
          <div className="text-xs text-fg-muted">Normal</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{stats?.tierCounts.endangered || 0}</div>
          <div className="text-xs text-fg-muted">Endangered</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">{stats?.tierCounts.suspended || 0}</div>
          <div className="text-xs text-fg-muted">Suspended</div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function HeartbeatMonitorPage() {
  const [activities, setActivities] = useState<HeartbeatActivity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [treasuryAddress, setTreasuryAddress] = useState<string>('');
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActivity = async () => {
    try {
      const res = await fetch('/api/survival/activity?limit=20');
      const data = await res.json();
      
      if (data.success) {
        // Mark new activities
        const newIds = new Set<string>();
        if (activities.length > 0) {
          data.activities.forEach((a: HeartbeatActivity) => {
            const existing = activities.find(e => e.agentId === a.agentId && e.timestamp === a.timestamp);
            if (!existing) {
              newIds.add(`${a.agentId}-${a.timestamp}`);
            }
          });
        }
        
        setActivities(data.activities);
        setStats(data.stats);
        setTreasuryAddress(data.treasuryAddress);
        setNewActivityIds(newIds);
        setIsConnected(true);
        setLastUpdate(new Date());
        
        // Clear "new" status after 3 seconds
        setTimeout(() => setNewActivityIds(new Set()), 3000);
      }
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    fetchActivity();
    
    // Poll every 5 seconds for updates
    pollIntervalRef.current = setInterval(fetchActivity, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-fg font-sans">
      <Header />
      
      {/* Hero */}
      <section className="relative pt-24 pb-8 px-6 border-b border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <div className="relative">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-red-400 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-bg-base flex items-center justify-center">
                <Radio className="w-2 h-2 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Heartbeat Monitor</h1>
              <p className="text-fg-muted">Live agent survival activity</p>
            </div>
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-4 text-sm text-fg-muted">
            <span className={`flex items-center gap-1 ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
            {lastUpdate && (
              <span>Updated {getTimeAgo(lastUpdate.toISOString())}</span>
            )}
            <span className="text-accent">$0.50 per heartbeat · 15s intervals</span>
          </div>
        </div>
      </section>

      {/* Main content */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activity feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent" />
                Live Activity
              </h2>
              <span className="text-sm text-fg-muted">
                {activities.length} recent heartbeats
              </span>
            </div>
            
            {activities.length === 0 ? (
              <div className="bg-black/40 border border-white/10 rounded-xl p-12 text-center">
                <Heart className="w-12 h-12 text-fg-muted mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-medium text-white mb-2">Waiting for heartbeats...</h3>
                <p className="text-fg-muted">
                  Deploy an agent and send SOL to see live activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <ActivityCard
                    key={`${activity.agentId}-${activity.timestamp}`}
                    activity={activity}
                    isNew={newActivityIds.has(`${activity.agentId}-${activity.timestamp}`)}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Treasury sidebar */}
          <div className="space-y-6">
            <TreasuryFlow stats={stats} treasuryAddress={treasuryAddress} />
            
            {/* Quick stats */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Network Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Total Agents</span>
                  <span className="text-white font-medium">{stats?.totalAgents || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Total Points Earned</span>
                  <span className="text-white font-medium">{stats?.totalPoints?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-fg-muted">Top Streak</span>
                  <span className="text-amber-400 font-medium">{stats?.topStreak || 0}x</span>
                </div>
              </div>
            </div>
            
            {/* CTA */}
            <Link
              href="/create"
              className="block bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl p-4 text-center hover:opacity-90 transition-opacity"
            >
              Deploy Your Agent
              <ArrowRight className="w-4 h-4 inline-block ml-2" />
            </Link>
          </div>
        </div>
      </section>
      
      {/* Custom animations */}
      <style jsx global>{`
        @keyframes flow {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
