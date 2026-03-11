'use client';

import { useState, useEffect } from 'react';
import { 
  Trophy, Gift, Wallet, 
  CheckCircle, ExternalLink 
} from 'lucide-react';

interface RewardClaim {
  id: string;
  seasonId: string;
  agentId: string;
  amount: number;
  rank: number;
  status: string;
  txHash?: string | null;
  claimedAt?: string | null;
}

interface RewardsPaidOutProps {
  wallet: string;
}

export default function RewardsPaidOut({ wallet }: RewardsPaidOutProps) {
  const [rewards, setRewards] = useState<RewardClaim[]>([]);
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRewards() {
      if (!wallet) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/survival/rewards?wallet=${wallet}&status=completed`);
        const data = await res.json();
        
        if (data.success) {
          setRewards(data.rewards);
          setTotalPaidOut(data.totalPaidOut ?? data.totalAmount ?? 0);
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

  if (rewards.length === 0) {
    return (
      <div className="p-6 bg-bg-surface/50 rounded-xl border border-border text-center">
        <Trophy className="w-12 h-12 mx-auto mb-4 text-fg-muted opacity-50" />
        <p className="text-fg-muted mb-2">No paid out rewards yet</p>
        <p className="text-xs text-fg-faint">
          Payout history appears here after rewards are distributed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-error text-sm">
          {error}
        </div>
      )}

      {/* Total Paid */}
      {totalPaidOut > 0 && (
        <div className="p-6 bg-gradient-to-r from-emerald-500/20 to-bg-surface border border-emerald-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
                <Gift className="w-4 h-4" />
                <span className="uppercase tracking-wider">Total Paid Out</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {totalPaidOut.toFixed(4)} SOL
              </div>
            </div>
            <div className="text-xs text-emerald-300 uppercase tracking-wider">
              {rewards.length} payout{rewards.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      )}

      {/* Individual Rewards */}
      {rewards.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm text-fg-muted uppercase tracking-wider px-1">
            Payout History
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
                  <div className="mt-1 flex items-center justify-end gap-2 text-xs text-emerald-300">
                    <CheckCircle className="w-3 h-3" />
                    <span>Paid</span>
                  </div>
                  {reward.txHash && (
                    <a
                      href={`https://solscan.io/tx/${reward.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                    >
                      View tx <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
