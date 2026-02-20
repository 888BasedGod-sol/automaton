
'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Play, Square, RotateCw } from 'lucide-react';

interface TerminalProps {
  agentId: string;
  agentName: string;
  status: string;
  onClose?: () => void;
}

interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM';
  message: string;
}

export default function Terminal({ agentId, agentName, status, onClose }: TerminalProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Connect to SSE stream
  useEffect(() => {
    // Only connect if agent is running
    if (status !== 'running') return;

    const eventSource = new EventSource(`/api/agents/${agentId}/logs/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.content) {
             const now = new Date();
             const timeString = now.toISOString().split('T')[1].split('.')[0];
             
             setLogs(prev => {
                // Prevent duplicate logs if they are identical
                if (prev.length > 0 && prev[prev.length - 1].message === data.content) {
                    return prev;
                }
                return [...prev.slice(-100), {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: timeString,
                level: 'INFO',
                message: data.content
              }]});
        }
      } catch (e) {
        console.error('Failed to parse SSE data', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
      eventSource.close();
      // Simple exponential backoff for reconnection could go here
    };

    return () => {
      eventSource.close();
    };
  }, [agentId, status]);

  // Helper to add log
  const addLog = (level: LogLine['level'], message: string) => {
      const now = new Date();
      const timeString = now.toISOString().split('T')[1].split('.')[0];
      
      setLogs(prev => [...prev.slice(-100), {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: timeString,
        level,
        message
      }]);
  };

  // Initial boot logs (mock)
  useEffect(() => {
    if (logs.length > 0) return; // Don't overwrite if we have logs
    
    addLog('SYSTEM', `Initializing agent ${agentName} (${agentId.slice(0, 8)})...`);
    addLog('INFO', 'Loading configuration...');
    addLog('INFO', 'Connecting to network...');
    
    if (status === 'running') {
      addLog('SYSTEM', 'Agent is RUNNING');
      addLog('INFO', 'Listening for events on port 3000');
      addLog('DEBUG', 'Heartbeat signal active');
    } else {
      addLog('WARN', `Agent status is: ${status.toUpperCase()}`);
    }

    // Periodic random logs based on status
    const interval = setInterval(() => {
      if (status !== 'running') return;
      
      const actions = [
        { level: 'INFO', msg: 'Processing incoming message batch...' },
        { level: 'DEBUG', msg: 'Memory usage: 45MB / 512MB' },
        { level: 'INFO', msg: 'Running scheduled task: update_state' },
        { level: 'INFO', msg: 'Syncing with registry...' },
        { level: 'DEBUG', msg: 'Analyzing local context vector space' },
        { level: 'INFO', msg: 'Heartbeat sent successfully' },
      ];
      
      if (Math.random() > 0.6) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        addLog(action.level as any, action.msg);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []); // Run once on mount (or status change via dependency if needed)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className={`
      flex flex-col bg-[#0c0c0e] border border-white/10 rounded-lg overflow-hidden font-mono text-xs
      transition-all duration-300 ease-in-out
      ${isExpanded ? 'fixed inset-4 z-50 shadow-2xl' : 'h-96 w-full'}
    `}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a1d] border-b border-white/5">
        <div className="flex items-center gap-2 text-fg-muted">
          <TerminalIcon className="w-4 h-4 text-accent" />
          <span className="font-semibold text-fg">user@automaton:~/agents/{agentName.toLowerCase().replace(/\s+/g, '-')}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
             <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-bg-elevated text-[10px] text-fg-muted border border-white/5">
               <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-success animate-pulse' : 'bg-fg-muted'}`} />
               {status.toUpperCase()}
             </span>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-white/10 rounded text-fg-muted hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-red-500/20 rounded text-fg-muted hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-1 font-mono text-sm leading-relaxed"
        onClick={() => {
           // Focus simulated input if we implemented one
        }}
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 hover:bg-white/5 py-0.5 px-2 -mx-2 rounded">
            <span className="text-fg-muted opacity-50 select-none w-16 text-right shrink-0">{log.timestamp}</span>
            <span className={`
              font-bold w-12 shrink-0 select-none text-center rounded px-1 py-0
              ${log.level === 'INFO' ? 'text-blue-400' : ''}
              ${log.level === 'WARN' ? 'text-yellow-400' : ''}
              ${log.level === 'ERROR' ? 'text-red-400' : ''}
              ${log.level === 'DEBUG' ? 'text-gray-500' : ''}
              ${log.level === 'SYSTEM' ? 'text-accent' : ''}
            `}>
              {log.level}
            </span>
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))}
        
        {/* Active Line */}
        <div className="flex gap-3 mt-2 px-2 -mx-2">
          <span className="text-fg-muted opacity-50 select-none w-16 text-right shrink-0">
             {new Date().toISOString().split('T')[1].split('.')[0]}
          </span>
          <span className="text-accent font-bold select-none">&gt;</span>
          <span className="text-fg animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}
