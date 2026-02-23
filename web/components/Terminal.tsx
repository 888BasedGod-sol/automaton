
'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, RefreshCw, Heart, Wallet, ExternalLink } from 'lucide-react';

interface TerminalProps {
  agentId: string;
  agentName: string;
  status: string;
  onClose?: () => void;
}

interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM' | 'HEART';
  message: string;
  txSignature?: string;
  solAmount?: number;
}

export default function Terminal({ agentId, agentName, status, onClose }: TerminalProps) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef<string>('');
  
  // Helper to add log
  const addLog = (level: LogLine['level'], message: string, extra?: { txSignature?: string; solAmount?: number }) => {
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
        message,
        ...extra
      }];
    });
  };

  // Track seen heartbeat transactions and survival state
  const seenTxRef = useRef<Set<string>>(new Set());
  const lastSurvivalRef = useRef<{ points: number; streak: number } | null>(null);

  // Poll heartbeat transactions and survival stats
  useEffect(() => {
    const fetchHeartbeats = async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/heartbeats`);
        if (!res.ok) return;
        const data = await res.json();
        
        // Show survival point gains
        if (data.survival) {
          const points = parseInt(data.survival.points) || 0;
          const streak = data.survival.streak || 0;
          const last = lastSurvivalRef.current;
          
          if (last) {
            // Log point gains
            if (points > last.points) {
              const gain = points - last.points;
              addLog('HEART', `♥ +${gain} SURVIVAL POINT${gain > 1 ? 'S' : ''} (Total: ${points}, Streak: ${streak})`);
            }
          } else if (points > 0) {
            // First fetch - show current state
            addLog('SYSTEM', `Survival Mode: ${points} points, ${streak} streak`);
          }
          
          lastSurvivalRef.current = { points, streak };
        }
        
        // Also show SOL transactions if any
        if (data.transactions && Array.isArray(data.transactions)) {
          // Process in reverse to show oldest first
          [...data.transactions].reverse().forEach((tx: any) => {
            if (!seenTxRef.current.has(tx.txSignature)) {
              seenTxRef.current.add(tx.txSignature);
              addLog(
                'HEART',
                `💸 HEARTBEAT → Vault | ${tx.solAmount.toFixed(6)} SOL ($${tx.usdAmount.toFixed(2)})`,
                { txSignature: tx.txSignature, solAmount: tx.solAmount }
              );
            }
          });
        }
      } catch (e) {
        // Silent fail for heartbeats
      }
    };

    fetchHeartbeats();
    const interval = setInterval(fetchHeartbeats, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  // Initial status-based logs
  useEffect(() => {
    setLogs([]); // Clear on status change
    lastContentRef.current = ''; // Reset content tracker
    
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

  // Track log source for diagnostic display
  const lastSourceRef = useRef<string>('');
  const pollCountRef = useRef<number>(0);

  // Poll logs from sandbox when running
  useEffect(() => {
    if (status !== 'running') return;

    let isMounted = true;
    pollCountRef.current = 0;
    
    const fetchLogs = async () => {
      if (!isMounted) return;
      pollCountRef.current++;
      
      try {
        const res = await fetch(`/api/agents/${agentId}/logs`);
        if (!res.ok) {
          addLog('ERROR', `Failed to fetch logs: ${res.status}`);
          return;
        }
        const data = await res.json();
        
        // Show log source on first fetch or when it changes
        const source = data.source || 'unknown';
        if (source !== lastSourceRef.current) {
          lastSourceRef.current = source;
          if (source === 'sandbox') {
            addLog('SYSTEM', `Connected to sandbox ${data.sandboxId?.slice(0, 8) || ''}`);
          } else if (source === 'database') {
            const reason = data.reason ? ` (${data.reason})` : '';
            addLog('SYSTEM', `Reading from database${reason}`);
          } else if (source === 'sandbox-error') {
            addLog('WARN', 'Sandbox connection issue - showing cached data');
          }
        }
        
        // Show process state if available
        if (data.processState && data.processState !== 'RUNNING') {
          addLog('WARN', `Process state: ${data.processState}`);
        }
        
        // Show errors from the API
        if (data.error) {
          addLog('ERROR', data.error);
        }
        
        // Parse log content
        const thought = data.thought || '';
        if (thought && thought !== lastContentRef.current && thought !== 'No logs yet') {
          lastContentRef.current = thought;
          
          // Parse multi-line logs
          const lines = thought.split('\n').filter((l: string) => l.trim());
          
          if (lines.length > 0) {
            lines.slice(-15).forEach((line: string) => {
              // Detect log level from content
              let level: LogLine['level'] = 'INFO';
              const lowerLine = line.toLowerCase();
              if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('exception')) level = 'ERROR';
              else if (lowerLine.includes('warn') || lowerLine.includes('warning')) level = 'WARN';
              else if (lowerLine.includes('debug')) level = 'DEBUG';
              else if (lowerLine.includes('[system]') || lowerLine.includes('starting') || lowerLine.includes('stopping')) level = 'SYSTEM';
              
              addLog(level, line.trim());
            });
          }
        } else if (thought === 'No logs yet' && lastContentRef.current !== 'No logs yet') {
          lastContentRef.current = thought;
          addLog('SYSTEM', 'Agent started, waiting for output...');
        } else if (!thought && pollCountRef.current <= 2) {
          // Show waiting message on first few polls if no data
          if (lastContentRef.current !== 'waiting') {
            lastContentRef.current = 'waiting';
            addLog('SYSTEM', 'Waiting for agent output...');
          }
        }
      } catch (e: any) {
        addLog('ERROR', `Poll error: ${e.message}`);
      }
    };
    
    // Fetch immediately then poll
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [agentId, status]);

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
              ${log.level === 'HEART' ? 'text-red-400' : ''}
            `}>
              {log.level === 'HEART' ? '♥' : log.level}
            </span>
            <span className="text-gray-300 break-all">
              {log.message}
              {log.txSignature && (
                <a
                  href={`https://solscan.io/tx/${log.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-accent hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 inline" />
                  <span className="font-mono text-xs">{log.txSignature.slice(0, 8)}...</span>
                </a>
              )}
            </span>
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
