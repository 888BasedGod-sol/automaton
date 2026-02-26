'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Heart, Wallet, ExternalLink, Cpu, Activity, Zap } from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface TerminalProps {
  agentId: string;
  agentName: string;
  status: string;
  onClose?: () => void;
  onStatusChange?: (status: string) => void;
}

interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM' | 'HEART';
  message: string;
  txSignature?: string;
  solAmount?: number;
}

export default function Terminal({ agentId, agentName, status, onClose, onStatusChange }: TerminalProps) {
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
  const lastSurvivalRef = useRef<{ points: number; streak: number; lastHeartbeat: string } | null>(null);
  const [survivalActive, setSurvivalActive] = useState(false);
  const [nextHeartbeat, setNextHeartbeat] = useState<number>(0);
  const [survivalData, setSurvivalData] = useState<{ points: number; streak: number; solBalance: number } | null>(null);
  const [onChainData, setOnChainData] = useState<{ balance: number | null; rpcSource: string } | null>(null);
  const targetHeartbeatTimeRef = useRef<number>(0);

  // Countdown timer for next heartbeat - robust against background throttling
  useEffect(() => {
    if (!survivalActive) return;
    
    // Update immediately
    const updateTimer = () => {
      if (targetHeartbeatTimeRef.current > 0) {
        const now = Date.now();
        const diff = targetHeartbeatTimeRef.current - now;
        setNextHeartbeat(Math.max(0, Math.ceil(diff / 1000)));
      }
    };
    
    updateTimer();
    const timer = setInterval(updateTimer, 250); // Higher frequency for smoothness
    
    return () => clearInterval(timer);
  }, [survivalActive]);

  // Poll heartbeat transactions and survival stats
  const { data: heartbeatData } = useSWR(
    status === 'running' 
      ? `/api/agents/${agentId}/heartbeats?includeOnChain=false` 
      : null, // Don't poll fast loop if not running (handled by slow loop below)
    fetcher,
    { 
      refreshInterval: 2000,
      dedupingInterval: 1000,
      revalidateOnFocus: true
    }
  );

  // Slow poll for on-chain data (or combined data when not running)
  const { data: heavyData } = useSWR(
    status === 'running'
      ? `/api/agents/${agentId}/heartbeats?includeOnChain=true&limit=1` // Running: just fetch balance occasionally
      : `/api/agents/${agentId}/heartbeats?includeOnChain=true`, // Not running: fetch everything
    fetcher,
    {
      refreshInterval: status === 'running' ? 10000 : 5000, // 10s when running, 5s when idle
      dedupingInterval: 2000
    }
  );

  useEffect(() => {
    // Merge data from fast and slow polls
    const data = heartbeatData || heavyData;
    if (!data) return;
    
    // Always prefer fast loop for survival stats if available
    const survivalSource = heartbeatData?.survival || heavyData?.survival;
    
    if (survivalSource) {
      const points = parseInt(survivalSource.points) || 0;
      const streak = survivalSource.streak || 0;
      const lastHeartbeat = survivalSource.lastHeartbeat || '';
      const solBalance = parseFloat(survivalSource.solBalance) || 0;
      const last = lastSurvivalRef.current;
      
      setSurvivalData({ points, streak, solBalance });
      
      if (lastHeartbeat) {
        const lastHeartbeatTime = new Date(lastHeartbeat).getTime();
        const heartbeatAge = Date.now() - lastHeartbeatTime;
        const isActive = heartbeatAge < 30000;
        setSurvivalActive(isActive);
        
        if (isActive) {
          const interval = (data.heartbeatInterval || 20) * 1000;
          // Set target time relative to when the heartbeat ACTUALLY happened
          targetHeartbeatTimeRef.current = lastHeartbeatTime + interval;
          
          // Immediate update
          const remaining = Math.max(0, interval - heartbeatAge);
          setNextHeartbeat(Math.ceil(remaining / 1000));
        }
      }
      
      if (last) {
        if (points > last.points) {
          const gain = points - last.points;
          addLog('HEART', `♥ SURVIVAL POINT${gain > 1 ? 'S' : ''} +${gain} [TOTAL: ${points} | STREAK: ${streak}]`);
        }
        if (lastHeartbeat && lastHeartbeat !== last.lastHeartbeat) {
          const now = new Date();
          addLog('INFO', `⏱ HEARTBEAT SYNC ${now.toLocaleTimeString()} [STREAK: ${streak}]`);
        }
      } else if (points > 0) {
        addLog('SYSTEM', `SURVIVAL MODE ACTIVE [${points} PTS | ${streak} STREAK]`);
      }
      
      lastSurvivalRef.current = { points, streak, lastHeartbeat };
    }
    
    // Always use heavy data for on-chain stats
    const onChainSource = heavyData?.onChain;
    if (onChainSource) {
      const balance = onChainSource.balance;
      const rpcSource = onChainSource.rpcSource || 'mainnet-beta';
      setOnChainData({ balance, rpcSource });
      
      if (onChainSource.recentTransactions && Array.isArray(onChainSource.recentTransactions)) {
        onChainSource.recentTransactions.forEach((tx: any) => {
          if (!seenTxRef.current.has(tx.signature)) {
            seenTxRef.current.add(tx.signature);
            // ... log logic
          }
        });
      }
    }
    
    if (data.transactions && Array.isArray(data.transactions)) {
      [...data.transactions].reverse().forEach((tx: any) => {
        if (!seenTxRef.current.has(tx.txSignature)) {
          seenTxRef.current.add(tx.txSignature);
          const shortSig = tx.txSignature.slice(0, 8) + '...' + tx.txSignature.slice(-8);
          addLog(
            'HEART',
            `❤️ SYSTEM HEARTBEAT: ${tx.solAmount.toFixed(6)} SOL → VAULT`,
            { txSignature: tx.txSignature, solAmount: tx.solAmount }
          );
        }
      });
    }
  }, [heartbeatData, agentId, status]);

  // Active Heartbeat Loop (Simulated Agent Process)
  useEffect(() => {
    if (status !== 'running') return;

    const performHeartbeat = async () => {
      try {
        const res = await fetch('/api/survival/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId })
        });
        
        if (res.ok) {
            const data = await res.json();
            if (data.feeDeducted) {
                const txSignature = data.feeDeducted.txSignature;
                const solAmount = data.feeDeducted.solAmount;
                const shortSig = txSignature ? `${txSignature.slice(0, 8)}...${txSignature.slice(-8)}` : null;
                
                // Allow the TX CONFIRMED log to appear naturally from the poll loop
                // But for immediate feedback, we also log the heartbeat event
                // The polling loop handles "TX CONFIRMED" via seenTxRef check.
                // We will NOT add to seenTxRef here, so that the "TX CONFIRMED" log ALSO appears when detected.
                
                // Log the heartbeat initiation
                addLog('HEART', `❤️ SYSTEM HEARTBEAT: ${solAmount.toFixed(6)} SOL → VAULT`, {
                    solAmount: solAmount,
                    txSignature: txSignature
                });
            } else if (data.walletEmpty) {
               addLog('WARN', '⚠️ INSUFFICIENT FUNDS: CANNOT PROCESS HEARTBEAT. PLEASE DEPOSIT SOL.');
               if (onStatusChange) {
                 addLog('SYSTEM', 'PROTOCOL SHUTDOWN INITIATED DUE TO LACK OF FUNDS.');
                 onStatusChange('suspended');
               }
            }
        }
      } catch (e) {
        // Silent fail unless debug mode
        console.error('Heartbeat failed:', e);
      }
    };

    // Call immediately on mount if running? No, wait for interval to respect timing
    // actually, let's wait 20s.
    const timer = setInterval(performHeartbeat, 20000);
    
    return () => clearInterval(timer);
  }, [status, agentId]);

  // Initial logs
  useEffect(() => {
    setLogs([]);
    lastContentRef.current = '';
    
    const now = new Date().toISOString().split('T')[1].split('.')[0];
    const initialLogs: LogLine[] = [
      {
        id: '1',
        timestamp: now,
        level: 'SYSTEM',
        message: `INITIALIZING UPLINK TO AGENT: ${agentName.toUpperCase()} <${agentId.slice(0, 8)}>`
      }
    ];

    if (status === 'running') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: 'EXECUTION STATUS: RUNNING' },
        { id: '3', timestamp: now, level: 'INFO', message: 'ESTABLISHING SECURE CONNECTION TO SANDBOX...' }
      );
    } else if (status === 'suspended') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'WARN', message: 'EXECUTION STATUS: SUSPENDED' },
        { id: '3', timestamp: now, level: 'INFO', message: 'AWAITING RESUME COMMAND...' }
      );
    } else if (status === 'pending' || status === 'funded') {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: `STATUS: ${status.toUpperCase()}` },
        { id: '3', timestamp: now, level: 'INFO', message: 'READY FOR DEPLOYMENT SEQUENCE' }
      );
    } else {
      initialLogs.push(
        { id: '2', timestamp: now, level: 'INFO', message: `STATUS: ${status.toUpperCase()}` }
      );
    }

    setLogs(initialLogs);
  }, [status, agentId, agentName]);

  const lastSourceRef = useRef<string>('');
  const pollCountRef = useRef<number>(0);

  // Poll logs with SWR
  const { data: logData, error: logError } = useSWR(
    status === 'running' ? `/api/agents/${agentId}/logs` : null,
    fetcher,
    {
      refreshInterval: 2500,
      dedupingInterval: 1000
    }
  );

  useEffect(() => {
    if (!logData && !logError) return;
    
    if (logError) {
      addLog('ERROR', `POLL EXCEPTION: ${logError.message}`);
      return;
    }

    const data = logData;
    pollCountRef.current++;
    
    const source = data.source || 'unknown';
    if (source !== lastSourceRef.current) {
      lastSourceRef.current = source;
      if (source === 'sandbox') {
        addLog('SYSTEM', `CONNECTED TO SANDBOX ROUTINE [ID: ${data.sandboxId?.slice(0, 8) || 'Unknown'}]`);
      } else if (source === 'database') {
        addLog('SYSTEM', `RETRIEVING ARCHIVED LOGS${data.reason ? ` (${data.reason})` : ''}`);
      } else if (source === 'sandbox-error') {
        addLog('WARN', 'SANDBOX CONNECTION UNSTABLE - USING CACHED BUFFER');
      }
    }
    
    if (data.processState && data.processState !== 'RUNNING') {
      addLog('WARN', `PROCESS STATE CHANGE: ${data.processState}`);
    }
    
    if (data.error) {
      addLog('ERROR', `RUNTIME ERROR: ${data.error}`);
    }
    
    const thought = data.thought || '';
    if (thought && thought !== lastContentRef.current && thought !== 'No logs yet') {
      lastContentRef.current = thought;
      const lines = thought.split('\n').filter((l: string) => l.trim());
      
      if (lines.length > 0) {
        lines.slice(-15).forEach((line: string) => {
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
      addLog('SYSTEM', 'AGENT INITIALIZED. AWAITING OUTPUT STREAM...');
    } else if (!thought && pollCountRef.current <= 2) {
      if (lastContentRef.current !== 'waiting') {
        lastContentRef.current = 'waiting';
        addLog('SYSTEM', 'ESTABLISHING DATA LINK...');
      }
    }

  }, [logData, logError, agentId, status]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Style helpers
  const getLevelColor = (level: LogLine['level']) => {
    switch (level) {
      case 'INFO': return 'text-cyan-400';
      case 'WARN': return 'text-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]';
      case 'ERROR': return 'text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      case 'DEBUG': return 'text-slate-500';
      case 'SYSTEM': return 'text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.3)]';
      case 'HEART': return 'text-pink-500 animate-pulse shadow-[0_0_15px_rgba(236,72,153,0.5)]';
      default: return 'text-white';
    }
  };

  return (
    <div className={`
      relative flex flex-col bg-black/90 border border-white/10 rounded-lg overflow-hidden font-mono text-xs
      transition-all duration-300 ease-in-out backdrop-blur-sm
      ${isExpanded ? 'fixed inset-4 z-[100] shadow-[0_0_50px_rgba(0,0,0,0.8)] border-accent/20' : 'h-80 sm:h-96 w-full shadow-[0_0_20px_rgba(0,0,0,0.5)]'}
    `}>
      {/* Scanline Effect */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      
      {/* Retro Glow Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] rounded-lg" />

      {/* Terminal Header */}
      <div className="relative z-30 flex items-center justify-between px-3 py-2 bg-[#0a0a0a] border-b border-white/10 select-none">
        <div className="flex items-center gap-2 text-fg-muted/70">
          <TerminalIcon className="w-3.5 h-3.5 text-accent animate-[pulse_3s_infinite]" />
          <span className="font-bold tracking-widest text-[10px] uppercase text-accent/80">
            Secure Shell // {agentName.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Status Indicators */}
          <div className="flex items-center gap-2 px-2 py-0.5 bg-black/50 border border-white/5 rounded">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-red-500'}`} />
              <span className={`text-[9px] font-bold tracking-wider ${status === 'running' ? 'text-emerald-500' : 'text-red-500'}`}>
                {status.toUpperCase()}
              </span>
            </div>
            <span className="text-white/10 text-[10px]">|</span>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-500/70" />
              <span className="text-[9px] text-cyan-500/70 font-mono">NET: <span className="text-cyan-400">STABLE</span></span>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/10 rounded text-fg-muted hover:text-white transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 hover:bg-red-500/20 rounded text-fg-muted hover:text-red-400 transition-colors"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="relative z-20 flex-1 p-4 overflow-y-auto font-mono text-xs leading-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ fontFamily: '"Fira Code", monospace' }}
      >
        <div className="space-y-0.5">
          {logs.map((log) => (
            <div key={log.id} className="flex gap-3 group hover:bg-white/5 px-2 -mx-2 rounded-sm transition-colors">
              <span className="text-white/20 select-none w-20 text-right shrink-0 font-light tracking-tight">{log.timestamp}</span>
              <span className={`
                font-bold w-14 shrink-0 select-none text-center tracking-wider text-[10px] py-0.5 
                ${getLevelColor(log.level)}
              `}>
                [{log.level === 'HEART' ? '♥' : log.level}]
              </span>
              <span className={`break-all tracking-wide ${log.level === 'SYSTEM' ? 'text-white/80 italic' : 'text-white/70'} group-hover:text-white transition-colors`}>
                <span className="mr-2 opacity-50 text-[10px] select-none">»</span>
                {log.message}
                {log.txSignature && (
                  <a
                    href={`https://solscan.io/tx/${log.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 px-1 py-0.5 bg-accent/10 border border-accent/20 rounded text-accent hover:bg-accent/20 hover:text-white inline-flex items-center gap-1 transition-all"
                  >
                    <ExternalLink className="w-2.5 h-2.5 inline" />
                    <span className="font-mono text-[9px]">VIEW TX</span>
                  </a>
                )}
              </span>
            </div>
          ))}
          
          {/* Active Line (Cursor) */}
          <div className="flex gap-3 mt-2 px-2 -mx-2 opacity-80">
            <span className="text-white/20 select-none w-20 text-right shrink-0">
               {new Date().toISOString().split('T')[1].split('.')[0]}
            </span>
            <span className="text-accent font-bold select-none w-14 text-center">[CMD]</span>
            <span className="text-white/50 flex items-center">
              <span className="mr-2 text-accent">»</span>
              <span className="w-2 h-4 bg-accent animate-pulse block" />
            </span>
          </div>
        </div>
      </div>
      
      {/* Survival Mode Footer (HUD Style) */}
      {survivalActive && survivalData && (
        <div className="relative z-30 grid grid-cols-3 gap-px bg-white/10 text-[10px] font-mono border-t border-white/10">
          <div className="bg-black/80 p-2 flex items-center justify-center gap-2 border-r border-white/5">
            <Heart className="w-3 h-3 text-pink-500 animate-pulse" />
            <div className="flex flex-col leading-none">
              <span className="text-pink-500 font-bold">{survivalData.points} PTS</span>
              <span className="text-white/40 text-[9px]">TOTAL SCORE</span>
            </div>
          </div>
          
          <div className="bg-black/80 p-2 flex items-center justify-center gap-2 border-r border-white/5">
            <Zap className="w-3 h-3 text-amber-500" />
            <div className="flex flex-col leading-none">
              <span className="text-amber-500 font-bold">{survivalData.streak}x</span>
              <span className="text-white/40 text-[9px]">CURRENT STREAK</span>
            </div>
          </div>
          
          <div className="bg-black/80 p-2 flex items-center justify-center gap-2">
            <div className="relative w-3 h-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path className="text-white/10" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="text-cyan-500 animate-[dash_1s_linear_infinite]" strokeDasharray={`${(nextHeartbeat / 20) * 100}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className={`font-bold ${nextHeartbeat <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-500'}`}>
                {nextHeartbeat}s
              </span>
              <span className="text-white/40 text-[9px]">NEXT PULSE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

