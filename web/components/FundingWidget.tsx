'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, AlertTriangle, Zap, Copy, Check, 
  ExternalLink, Clock, Heart, Skull
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  credits: number;
  status: 'running' | 'funded' | 'pending' | 'offline';
  survivalTier: 'thriving' | 'normal' | 'endangered';
  hoursRemaining: number;
}

interface FundingWidgetProps {
  agentId?: string;
  solanaAddress?: string;
  onFunded?: () => void;
}

// Estimated costs per hour (in USD equivalent)
const HOURLY_COST_USD = 0.50;
const SOL_PRICE_USD = 150; // Approximate SOL price for display

export default function FundingWidget({ 
  agentId, 
  solanaAddress,
  onFunded 
}: FundingWidgetProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(0.1);
  const [agentSolanaAddress, setAgentSolanaAddress] = useState<string | null>(solanaAddress || null);

  useEffect(() => {
    if (agentId) {
      fetchAgentStatus();
    } else {
      setLoading(false);
    }
  }, [agentId]);

  const fetchAgentStatus = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();
      if (data.agent) {
        const credits = data.agent.credits_balance || data.agent.credits || 0;
        const hoursRemaining = credits / HOURLY_COST_USD;
        // Update solana address from agent data if available
        if (data.agent.solana_address && !solanaAddress) {
          setAgentSolanaAddress(data.agent.solana_address);
        }
        
        let survivalTier: 'thriving' | 'normal' | 'endangered' = 'normal';
        if (hoursRemaining > 48) survivalTier = 'thriving';
        else if (hoursRemaining < 6) survivalTier = 'endangered';

        setAgent({
          id: data.agent.id,
          name: data.agent.name,
          credits,
          status: data.agent.status,
          survivalTier,
          hoursRemaining,
        });
      }
    } catch (e) {
      console.error('Failed to fetch agent:', e);
    } finally {
      setLoading(false);
    }
  };

  const displayAddress = agentSolanaAddress || solanaAddress;

  const copyAddress = () => {
    if (displayAddress) {
      navigator.clipboard.writeText(displayAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SOL funding amounts
  const fundingAmounts = [0.05, 0.1, 0.25, 0.5, 1];

  const getStatusColor = (tier: string) => {
    switch (tier) {
      case 'thriving': return 'text-emerald-400';
      case 'endangered': return 'text-red-400';
      default: return 'text-amber-400';
    }
  };

  const getStatusIcon = (tier: string) => {
    switch (tier) {
      case 'thriving': return <Heart className="w-4 h-4 text-emerald-400" />;
      case 'endangered': return <Skull className="w-4 h-4 text-red-400" />;
      default: return <Heart className="w-4 h-4 text-amber-400" />;
    }
  };

  if (loading) {
    return (
      <div className="p-5 rounded-xl bg-bg-surface/50 border border-border animate-pulse">
        <div className="h-6 w-32 bg-bg-elevated rounded mb-4" />
        <div className="h-16 bg-bg-elevated rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Agent Status (if viewing specific agent) */}
      {agent && (
        <div className={`p-4 rounded-xl border ${
          agent.survivalTier === 'endangered' 
            ? 'bg-red-500/10 border-red-500/30' 
            : agent.survivalTier === 'thriving'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon(agent.survivalTier)}
              <span className="font-semibold text-white">{agent.name}</span>
            </div>
            <span className={`text-sm font-mono ${getStatusColor(agent.survivalTier)}`}>
              ${agent.credits.toFixed(2)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-fg-muted" />
            <span className="text-fg-muted">
              {agent.hoursRemaining > 0 
                ? `~${Math.floor(agent.hoursRemaining)} hours of runtime left`
                : 'Out of credits!'
              }
            </span>
          </div>

          {agent.survivalTier === 'endangered' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Low credits! Fund now to avoid death.</span>
            </div>
          )}
        </div>
      )}

      {/* Funding Card */}
      <div className="p-5 rounded-xl bg-bg-surface/50 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-white">Fund Your Agent</h3>
        </div>

        {/* Quick Amount Selection */}
        <div className="mb-4">
          <div className="text-sm text-fg-muted mb-2">Select amount (SOL)</div>
          <div className="flex flex-wrap gap-2">
            {fundingAmounts.map(amount => (
              <button
                key={amount}
                onClick={() => setSelectedAmount(amount)}
                className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                  selectedAmount === amount 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 border' 
                    : 'bg-bg-elevated border border-border text-fg hover:border-emerald-500/30'
                }`}
              >
                {amount} SOL
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-fg-muted">
            ≈ ${(selectedAmount * SOL_PRICE_USD).toFixed(0)} • ~{Math.floor((selectedAmount * SOL_PRICE_USD) / HOURLY_COST_USD)} hours of runtime
          </div>
        </div>

        {/* Send Instructions */}
        <div className="space-y-3">
          {displayAddress ? (
            <>
              <div className="text-sm text-fg-muted">
                Send <span className="text-purple-400 font-semibold">SOL</span> to your agent's wallet:
              </div>
              
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-bg-base border border-border text-sm font-mono text-fg truncate">
                  {displayAddress}
                </code>
                <button
                  onClick={copyAddress}
                  className="p-2 rounded-lg bg-bg-elevated border border-border hover:border-accent/40 transition-colors"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-fg-muted" />
                  )}
                </button>
              </div>

              {/* Solscan link */}
              <a 
                href={`https://solscan.io/account/${displayAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <span>View on Solscan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Create an agent first to get a Solana wallet address.
            </div>
          )}
        </div>

        {/* Buy SOL Link */}
        {displayAddress && (
          <div className="mt-4 pt-4 border-t border-border">
            <a 
              href="https://phantom.app/" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-colors text-sm"
            >
              <span>Need a Solana wallet?</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>

      {/* Runtime Calculator */}
      <div className="p-4 rounded-xl bg-bg-surface/30 border border-border">
        <div className="text-sm font-semibold text-white mb-3">Runtime Calculator</div>
        <div className="text-xs text-fg-muted mb-2">Based on ~$150/SOL</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-fg-muted">0.1 SOL</span>
            <span className="font-mono text-fg">~30 hours</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-fg-muted">0.25 SOL</span>
            <span className="font-mono text-fg">~3 days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-fg-muted">0.5 SOL</span>
            <span className="font-mono text-fg">~6 days</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-fg-muted">1 SOL</span>
            <span className="font-mono text-fg">~12 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
