'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity, Zap, RefreshCw, Filter } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  agentId: string;
  agentName: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function TerminalFeed({ headless = false }: { headless?: boolean }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Poll for new activities
  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, autoScroll]);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/activity?limit=50');
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        // Reverse to show oldest first (top) -> newest last (bottom) like a log
        setActivities(data.activities.reverse());
      }
    } catch (e) {
      console.error('Failed to fetch activity feed:', e);
    } finally {
      setLoading(false);
    }
  };

  const getLogColor = (type: string) => {
    if (type.includes('error') || type.includes('stopped') || type.includes('fail')) return 'text-red-400';
    if (type.includes('warn')) return 'text-yellow-400';
    if (type.includes('success') || type.includes('created') || type.includes('started') || type.includes('pulse')) return 'text-green-400';
    if (type.includes('funds') || type.includes('token')) return 'text-blue-400';
    if (type.includes('thought')) return 'text-fg-muted';
    if (type.includes('tool') || type.includes('action')) return 'text-accent';
    return 'text-white';
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    });
  };

  return (
    <div className={`w-full max-w-full mx-auto font-mono text-xs overflow-hidden ${headless ? '' : 'shadow-2xl rounded-lg border border-white/10 bg-[#0c0c0e]'}`}>
      
      {!headless && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3 text-fg-muted" />
            <span className="text-fg-muted font-bold tracking-tight">automagotchi-net --live</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
          </div>
        </div>
      )}

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        onScroll={() => {
            // Disable auto-scroll if user scrolls up
            if (scrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                const isAtBottom = scrollHeight - scrollTop === clientHeight;
                setAutoScroll(isAtBottom);
            }
        }}
        className="h-80 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-black/50"
      >
        {loading && activities.length === 0 ? (
          <div className="text-fg-muted animate-pulse">Initializing connection to Automagotchi Network...</div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="flex gap-3 hover:bg-white/5 p-0.5 rounded px-2 transition-colors group">
              <span className="text-fg-muted opacity-50 select-none shrink-0">
                [{formatTime(act.createdAt)}]
              </span>
              
              <div className="flex-1 break-all">
                <span className="text-accent mr-2 opacity-80">
                  {act.agentName}
                </span>
                
                <span className={`font-semibold mr-2 ${getLogColor(act.type)}`}>
                  {act.type.toUpperCase()}
                </span>
                
                <span className="text-fg-muted group-hover:text-fg transition-colors">
                  {act.description}
                </span>
                
                {act.metadata && Object.keys(act.metadata).length > 0 && (
                  <span className="ml-2 text-xs opacity-50 text-fg-muted">
                    {JSON.stringify(act.metadata)}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Cursor */}
        <div className="flex items-center gap-2 px-2 mt-2">
            <span className="text-success">➜</span>
            <span className="w-2 h-4 bg-fg-muted animate-pulse" />
        </div>
      </div>
      
      {/* Footer Status */}
      <div className="px-4 py-1.5 bg-white/5 border-t border-white/5 flex justify-between text-[10px] text-fg-muted uppercase tracking-wider">
        <div className="flex gap-4">
            <span>MEM: 24%</span>
            <span>CPU: 12%</span>
            <span>NET: ACTIVE</span>
        </div>
        <div>
            {autoScroll ? 'SCROLL: SCROLL_LOCKED' : 'SCROLL: MANUAL'}
        </div>
      </div>
    </div>
  );
}
