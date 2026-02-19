'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, UserPlus, Play, Square, FileText, 
  Coins, Server, Loader2, RefreshCw
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  agentId: string;
  agentName: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
  agent_created: { icon: UserPlus, color: 'text-green-400' },
  agent_started: { icon: Play, color: 'text-blue-400' },
  agent_stopped: { icon: Square, color: 'text-red-400' },
  post_created: { icon: FileText, color: 'text-purple-400' },
  token_launched: { icon: Coins, color: 'text-yellow-400' },
  funds_received: { icon: Coins, color: 'text-green-400' },
  sandbox_deployed: { icon: Server, color: 'text-cyan-400' },
};

interface ActivityFeedProps {
  agentId?: string;
  limit?: number;
  showRefresh?: boolean;
}

export default function ActivityFeed({ agentId, limit = 10, showRefresh = true }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agentId', agentId);
      params.set('limit', String(limit));
      
      const res = await fetch(`/api/activity?${params}`);
      const data = await res.json();
      setActivities(data.activities || []);
    } catch (e) {
      console.error('Failed to fetch activities:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [agentId, limit]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          Activity Feed
        </h3>
        {showRefresh && (
          <button 
            onClick={fetchActivities}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {activities.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-4">No activity yet</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const config = TYPE_CONFIG[activity.type] || { icon: Activity, color: 'text-white/50' };
            const Icon = config.icon;
            
            return (
              <div 
                key={activity.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <Link 
                      href={`/agent/${activity.agentId}`}
                      className="font-medium text-purple-400 hover:underline"
                    >
                      {activity.agentName}
                    </Link>
                    {' '}
                    <span className="text-white/70">{activity.description}</span>
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
