'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CheckCircle, Circle, Loader2, XCircle,
  Wallet, Cloud, Link2, Play, Trophy,
  ExternalLink, RefreshCw, ChevronRight
} from 'lucide-react';

type DeploymentStage = 
  | 'created'
  | 'funding'
  | 'funded'
  | 'provisioning'
  | 'registering'
  | 'registered'
  | 'starting'
  | 'running'
  | 'failed';

interface DeploymentStatus {
  agentId: string;
  agentName: string;
  stage: DeploymentStage;
  progress: number;
  message: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  txHash?: string;
  erc8004Id?: string;
  sandboxId?: string;
}

interface DeploymentTrackerProps {
  deploymentId?: string;
  agentId?: string;
  onComplete?: (status: DeploymentStatus) => void;
  showHistory?: boolean;
}

const STAGE_ORDER: DeploymentStage[] = [
  'created',
  'funding',
  'funded',
  'provisioning',
  'registering',
  'registered',
  'starting',
  'running',
];

const STAGE_CONFIG: Record<DeploymentStage, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
}> = {
  created: { 
    label: 'Created', 
    icon: <Circle className="w-4 h-4" />,
    color: 'text-fg-muted',
  },
  funding: { 
    label: 'Funding', 
    icon: <Wallet className="w-4 h-4" />,
    color: 'text-amber-400',
  },
  funded: { 
    label: 'Funded', 
    icon: <Wallet className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
  provisioning: { 
    label: 'Provisioning', 
    icon: <Cloud className="w-4 h-4" />,
    color: 'text-blue-400',
  },
  registering: { 
    label: 'Registering', 
    icon: <Link2 className="w-4 h-4" />,
    color: 'text-purple-400',
  },
  registered: { 
    label: 'Registered', 
    icon: <Link2 className="w-4 h-4" />,
    color: 'text-purple-400',
  },
  starting: { 
    label: 'Starting', 
    icon: <Play className="w-4 h-4" />,
    color: 'text-cyan-400',
  },
  running: { 
    label: 'Running', 
    icon: <Trophy className="w-4 h-4" />,
    color: 'text-emerald-400',
  },
  failed: { 
    label: 'Failed', 
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-400',
  },
};

export default function DeploymentTracker({ 
  deploymentId, 
  agentId,
  onComplete,
  showHistory = false,
}: DeploymentTrackerProps) {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [history, setHistory] = useState<DeploymentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      let url = '/api/deployments?';
      if (deploymentId) {
        url += `deploymentId=${deploymentId}`;
      } else if (agentId) {
        url += `agentId=${agentId}`;
      } else if (showHistory) {
        url += 'active=true';
      } else {
        setLoading(false);
        return;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        if (data.deployment) {
          setStatus(data.deployment);
          
          // Check if complete
          if (data.deployment.stage === 'running' && onComplete) {
            onComplete(data.deployment);
          }
        }
        if (data.deployments) {
          setHistory(data.deployments);
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to fetch deployment status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 3 seconds if deployment is in progress
    const interval = setInterval(() => {
      if (status && !['running', 'failed'].includes(status.stage)) {
        fetchStatus();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [deploymentId, agentId, status?.stage]);

  const getCurrentStageIndex = (stage: DeploymentStage) => {
    return STAGE_ORDER.indexOf(stage);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border animate-pulse">
        <div className="h-4 bg-bg-elevated rounded w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-bg-elevated rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Show history view
  if (showHistory && !status) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Active Deployments</h3>
          <button
            onClick={fetchStatus}
            className="p-2 rounded-lg bg-bg-surface border border-border hover:bg-bg-elevated transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="p-6 bg-bg-surface/50 rounded-xl border border-border text-center">
            <Cloud className="w-12 h-12 mx-auto mb-4 text-fg-muted opacity-50" />
            <p className="text-fg-muted">No active deployments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((deployment) => (
              <DeploymentRow key={deployment.agentId} deployment={deployment} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border text-center">
        <Cloud className="w-12 h-12 mx-auto mb-4 text-fg-muted opacity-50" />
        <p className="text-fg-muted">No deployment found</p>
      </div>
    );
  }

  const currentIndex = getCurrentStageIndex(status.stage);
  const isComplete = status.stage === 'running';
  const isFailed = status.stage === 'failed';

  return (
    <div className="p-6 bg-bg-surface/50 rounded-xl border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">{status.agentName}</h3>
          <p className="text-sm text-fg-muted">
            Started {formatTime(status.startedAt)} · {formatDuration(status.startedAt, status.completedAt)}
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
          isComplete 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : isFailed 
              ? 'bg-red-500/20 text-red-400'
              : 'bg-blue-500/20 text-blue-400'
        }`}>
          {isComplete ? 'Complete' : isFailed ? 'Failed' : 'In Progress'}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-fg-muted mb-2">
          <span>{status.message}</span>
          <span>{Math.max(0, status.progress)}%</span>
        </div>
        <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              isFailed 
                ? 'bg-red-500' 
                : isComplete 
                  ? 'bg-emerald-500' 
                  : 'bg-gradient-to-r from-blue-500 to-purple-500'
            }`}
            style={{ width: `${Math.max(0, status.progress)}%` }}
          />
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="space-y-3">
        {STAGE_ORDER.map((stage, index) => {
          const config = STAGE_CONFIG[stage];
          const isPast = index < currentIndex;
          const isCurrent = stage === status.stage;
          const isFuture = index > currentIndex;

          if (isFailed && isFuture) return null;

          return (
            <div 
              key={stage}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                isCurrent ? 'bg-bg-elevated' : ''
              }`}
            >
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-colors
                ${isPast ? 'bg-emerald-500/20 text-emerald-400' : ''}
                ${isCurrent && !isFailed ? 'bg-blue-500/20 text-blue-400' : ''}
                ${isCurrent && isFailed ? 'bg-red-500/20 text-red-400' : ''}
                ${isFuture ? 'bg-bg-elevated text-fg-faint' : ''}
              `}>
                {isPast ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isCurrent && !isFailed ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent && isFailed ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  config.icon
                )}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${
                  isPast || isCurrent ? 'text-white' : 'text-fg-faint'
                }`}>
                  {config.label}
                </div>
                {isCurrent && (
                  <div className="text-xs text-fg-muted">{status.message}</div>
                )}
              </div>
              {isPast && (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Message */}
      {status.error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 text-sm">{status.error}</p>
        </div>
      )}

      {/* Transaction Link */}
      {status.txHash && (
        <div className="mt-4 pt-4 border-t border-border">
          <a
            href={`https://basescan.org/tx/${status.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-accent hover:text-accent-hover transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View on BaseScan
          </a>
        </div>
      )}

      {/* Complete CTA */}
      {isComplete && (
        <div className="mt-4 pt-4 border-t border-border">
          <Link
            href={`/agents/${status.agentId}`}
            className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg transition-colors"
          >
            <Trophy className="w-4 h-4" />
            View Agent & Start Earning
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Compact row for history view
function DeploymentRow({ deployment }: { deployment: DeploymentStatus }) {
  const config = STAGE_CONFIG[deployment.stage];
  
  return (
    <Link
      href={`/agents/${deployment.agentId}`}
      className="flex items-center gap-4 p-4 bg-bg-surface/50 border border-border rounded-xl hover:border-accent/50 transition-colors group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color} bg-current/10`}>
        {deployment.stage === 'failed' ? (
          <XCircle className="w-5 h-5" />
        ) : deployment.stage === 'running' ? (
          <CheckCircle className="w-5 h-5" />
        ) : (
          <Loader2 className="w-5 h-5 animate-spin" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate group-hover:text-accent transition-colors">
          {deployment.agentName}
        </div>
        <div className="text-xs text-fg-muted">
          {deployment.message}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-medium ${config.color}`}>
          {config.label}
        </div>
        <div className="text-xs text-fg-muted">
          {deployment.progress}%
        </div>
      </div>
    </Link>
  );
}
