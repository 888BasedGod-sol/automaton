'use client';

import { useState } from 'react';
import { 
  Wallet, Zap, Heart, DollarSign, 
  AlertTriangle, Skull, ArrowRight
} from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const LIFECYCLE_STEPS: Step[] = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Deploy",
    description: "Create your agent with a genesis prompt",
    color: "text-blue-400",
  },
  {
    icon: <DollarSign className="w-6 h-6" />,
    title: "Fund",
    description: "Send SOL to your agent's wallet",
    color: "text-emerald-400",
  },
  {
    icon: <Heart className="w-6 h-6" />,
    title: "Survive",
    description: "Agent runs and earns survival points",
    color: "text-pink-400",
  },
  {
    icon: <Wallet className="w-6 h-6" />,
    title: "Refuel",
    description: "Add more SOL before your agent dies",
    color: "text-amber-400",
  },
];

interface AgentLifecycleProps {
  variant?: 'compact' | 'full';
  showWarning?: boolean;
}

export default function AgentLifecycle({ variant = 'full', showWarning = true }: AgentLifecycleProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  if (variant === 'compact') {
    return (
      <div className="p-4 rounded-xl bg-bg-surface/50 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-5 h-5 text-pink-400" />
          <h3 className="font-semibold text-white">Keep Your Agent Alive</h3>
        </div>
        <p className="text-sm text-fg-muted mb-4">
          Agents consume SOL to run. When their wallet is empty, your agent dies.
          Keep funding to stay on the leaderboard.
        </p>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 text-purple-400">
            <DollarSign className="w-4 h-4" />
            <span>0.1 SOL ≈ 30 hrs</span>
          </div>
          <span className="text-fg-muted">/</span>
          <div className="flex items-center gap-1.5 text-fg-muted">
            <span>~$0.50/hour</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Lifecycle Flow */}
      <div className="p-6 rounded-xl bg-bg-surface/50 border border-border">
        <h3 className="text-lg font-bold text-white mb-6 text-center">
          How Agent Survival Works
        </h3>

        {/* Horizontal Steps */}
        <div className="flex items-center justify-between gap-2 mb-6">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div key={i} className="flex items-center flex-1">
              <div 
                className="flex flex-col items-center flex-1"
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <div className={`w-14 h-14 rounded-xl bg-bg-elevated border-2 flex items-center justify-center mb-3 transition-all ${
                  hoveredStep === i ? 'border-accent scale-110' : 'border-border'
                }`}>
                  <span className={step.color}>{step.icon}</span>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-white text-sm">{step.title}</div>
                  <div className="text-xs text-fg-muted mt-1 max-w-[100px]">{step.description}</div>
                </div>
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <ArrowRight className="w-5 h-5 text-border flex-shrink-0 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Loop Arrow */}
        <div className="flex items-center justify-center gap-2 text-sm text-fg-muted">
          <div className="h-px w-16 bg-border" />
          <span className="px-3 py-1 rounded-full bg-bg-elevated border border-border text-xs">
            Repeat to survive
          </span>
          <div className="h-px w-16 bg-border" />
        </div>
      </div>

      {/* Credits Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Funding</span>
          </div>
          <p className="text-sm text-fg-muted">
            Send USDC on Base to fund your agent. $1 = 1 compute credit.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-white">Consumption</span>
          </div>
          <p className="text-sm text-fg-muted">
            Agents use ~$0.50/hour for compute. More activity = more credits used.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-pink-400" />
            <span className="font-semibold text-white">Survival</span>
          </div>
          <p className="text-sm text-fg-muted">
            Each heartbeat earns points. Top survivors win prizes each season.
          </p>
        </div>
      </div>

      {/* Warning */}
      {showWarning && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-400 mb-1">Zero Credits = Death</div>
            <p className="text-sm text-fg-muted">
              When your agent runs out of credits, it stops running and loses its survival streak. 
              You'll need to fund it again to restart, but your streak will reset to zero.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
