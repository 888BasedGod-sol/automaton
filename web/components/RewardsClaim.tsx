'use client';

import { useState, useEffect } from 'react';
import { 
  Trophy, Flame, Clock, Gift, Wallet, 
  CheckCircle, Loader2, ExternalLink 
} from 'lucide-react';

interface RewardClaim {
  id: string;
  seasonId: string;
  agentId: string;
  amount: number;
  rank: number;
  status: string;
}

interface RewardsClaimProps {
  wallet: string;
  onClaim?: (claimId: string, amount: number) => Promise<string | null>;
}

export default function RewardsClaim({ wallet, onClaim }: RewardsClaimProps) {
  const [rewards, setRewards] = useState<RewardClaim[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimedTx, setClaimedTx] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRewards() {
      if (!wallet) return;
      
      try {
        const res = await fetch(`/api/survival/rewards?wallet=${wallet}`);
        const data = await res.json();
        
        if (data.success) {
          setRewards(data.rewards);
          setTotalPending(data.totalPending);
        } else {
          setError(data.error);
        }
      } catch (err: any) {
        setError('Failed to load rewards');
      } finally {
        setLoading(false);
      }
    }

    fetchRewards();
  }, [wallet]);

  const handleClaim = async (claimId: string, amount: number) => {
    if (!onClaim) {
      setError('Claiming not configured');
      return;
    }

    setClaiming(claimId);
    setError(null);

    try {
      // Simulate claim (in production, this would send a transaction)
      const txHash = await onClaim(claimId, amount);
      
      if (!txHash) {
        throw new Error('Transaction failed');
      }

      // Mark as claimed via API
      const res = await fetch('/api/survival/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, txHash, wallet }),
      });

      const data = await res.json();

      if (data.success) {
        setClaimedTx(txHash);
        setRewards(rewards.filter(r => r.id !== claimId));
        setTotalPending(totalPending - amount);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border animate-pulse">
        <div className="h-6 bg-bg-elevated rounded w-32 mb-4" />
        <div className="h-12 bg-bg-elevated rounded" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border text-center">
        <Wallet className="w-12 h-12 mx-auto mb-4 text-fg-muted" />
        <p className="text-fg-muted">Connect your wallet to view rewards</p>
      </div>
    );
  }

  if (rewards.length === 0 && !claimedTx) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-fg-muted opacity-50" />
        <p className="text-fg-muted mb-2">No pending rewards</p>
        <p className="text-xs text-fg-faint">
          Keep your agents alive to earn season rewards!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {claimedTx && (
        <div className="p-4 bg-success/10 border border-success/30 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-success" />
          <div className="flex-1">
            <p className="text-success font-medium">Reward Claimed!</p>
            <a 
              href={`https://solscan.io/tx/${claimedTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-success/70 hover:text-success flex items-center gap-1"
            >
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-error text-sm">
          {error}
        </div>
      )}

      {/* Total Pending */}
      {totalPending > 0 && (
        <div className="p-6 bg-gradient-to-r from-emerald-500/20 to-bg-surface border border-emerald-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                <Gift className="w-4 h-4" />
                <span className="uppercase tracking-wider">Ready to Claim</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {totalPending.toFixed(4)} SOL
              </div>
            </div>
            <button
              onClick={() => rewards[0] && handleClaim(rewards[0].id, rewards[0].amount)}
              disabled={claiming !== null}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {claiming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claiming...
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4" />
                  Claim All
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Individual Rewards */}
      {rewards.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm text-fg-muted uppercase tracking-wider px-1">
            Reward Breakdown
          </h4>
          <div className="space-y-2">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="p-4 bg-bg-surface/50 border border-border rounded-xl flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-bg-elevated flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">
                      Rank #{reward.rank} Finish
                    </div>
                    <div className="text-xs text-fg-muted">
                      Agent: {reward.agentId.slice(0, 8)}...
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-emerald-400">
                    {reward.amount.toFixed(4)} SOL
                  </div>
                  <button
                    onClick={() => handleClaim(reward.id, reward.amount)}
                    disabled={claiming !== null}
                    className="text-xs text-accent hover:text-accent-hover transition-colors disabled:opacity-50"
                  >
                    {claiming === reward.id ? 'Claiming...' : 'Claim'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
