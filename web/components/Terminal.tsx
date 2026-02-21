
'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

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
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Helper to add log
  const addLog = (level: LogLine['level'], message: string) => {
    const now = new Date();
    const timeString = now.toISOString().split('T')[1].split('.')[0];
    
    setLogs(prev => {
      // Avoid duplicate messages
      if (prev.length > 0 && prev[prev.length - 1].message === message) {
        return prev;
      }
      return [...prev.slice(-100), {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: timeString,
        level,
        message
      }];
    });
  };

  // Initial status-based logs
  useEffect(() => {
    setLogs([]); // Clear on status change
    
    const now = new Date().toISOString().split('T')[1].split('.')[0];
    const initialLogs: LogLine[] = [
      {
        id: '1',
        timestamp: now,
        level: 'SYSTEM',
        message: `Agent: ${agentName} (${agentId.slice(0, 8)})`
      }
    ];

    if (status === 'running') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: 'Agent is RUNNING' },
        { id: '3', timestamp: now, level: 'INFO', message: 'Fetching live logs from sandbox...' }
      );
    } else if (status === 'suspended') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'WARN', message: 'Agent is SUSPENDED' },
        { id: '3', timestamp: now, level: 'INFO', message: 'Click Start to resume execution' }
      );
    } else if (status === 'pending' || status === 'funded') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: `Status: ${status.toUpperCase()}` },
        { id: '3', timestamp: now, level: 'INFO', message: 'Click Deploy to create sandbox and start agent' }
      );
    } else {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: `Status: ${status.toUpperCase()}` }
      );
    }

    setLogs(initialLogs);
  }, [status, agentId, agentName]);

  // Poll logs from sandbox when running
  useEffect(() => {
    if (status !== 'running') return;

    let isMounted = true;
    
    const fetchLogs = async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(`/api/agents/${agentId}/logs`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.thought && data.thought !== lastFetched) {
          setLastFetched(data.thought);
          
          // Parse multi-line logs
          const lines = data.thought.split('\n').filter((l: string) => l.trim());
          
          if (lines.length > 0) {
            const now = new Date().toISOString().split('T')[1].split('.')[0];
            lines.slice(-10).forEach((line: string) => {
              // Detect log level from content
              let level: LogLine['level'] = 'INFO';
              if (line.toLowerCase().includes('error')) level = 'ERROR';
              else if (line.toLowerCase().includes('warn')) level = 'WARN';
              else if (line.toLowerCase().includes('debug')) level = 'DEBUG';
              
              addLog(level, line.trim());
            });
          }
        }
      } catch (e) {
        // Silent fail on poll error
      }
    };
    
    // Fetch immediately then poll
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [agentId, status, lastFetched]);

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
      ${isExpanded ? 'fixed inset-4 z-[100] shadow-2xl' : 'h-80 sm:h-96 w-full'}
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
