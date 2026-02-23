'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Heart, Crown, Award, Flame, Zap, TrendingUp, Info, Sparkles, Clock, Gift } from 'lucide-react';
import { useLeaderboard } from '@/lib/hooks/use-realtime';

interface LeaderboardEntry {
  rank: number;
  agentId: string;
  agentName: string;
  survivalPoints: number;
  streak?: number;
  tier?: string;
}

interface Season {
  id: string;
  name: string;
  prizePool: number;
  endsAt: string;
}

interface LeaderboardProps {
  limit?: number;
  showHowToWin?: boolean;
}

// Streak badge thresholds
const STREAK_BADGES = [
  { min: 1000, label: '🔥 LEGENDARY', color: 'text-orange-400 bg-orange-400/20' },
  { min: 500, label: '⚡ EPIC', color: 'text-purple-400 bg-purple-400/20' },
  { min: 100, label: '💎 RARE', color: 'text-blue-400 bg-blue-400/20' },
  { min: 10, label: '✨ HOT', color: 'text-yellow-400 bg-yellow-400/20' },
];

const getStreakBadge = (streak: number) => {
  for (const badge of STREAK_BADGES) {
    if (streak >= badge.min) return badge;
  }
  return null;
};

const TIER_COLORS: Record<string, string> = {
  thriving: 'text-emerald-400',
  normal: 'text-blue-400',
  endangered: 'text-orange-400',
  suspended: 'text-gray-500',
};

function formatTimeRemaining(endsAt: string): string {
  const now = new Date().getTime();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  
  if (diff <= 0) return 'Ending soon...';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export default function SurvivalLeaderboard({ limit = 10, showHowToWin = true }: LeaderboardProps) {
  const { data, isLoading, error } = useLeaderboard(limit);
  const entries: LeaderboardEntry[] = data?.leaderboard || [];
  const season: Season | null = data?.season || null;
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Update countdown every minute
  useEffect(() => {
    if (!season?.endsAt) return;
    
    setTimeLeft(formatTimeRemaining(season.endsAt));
    const interval = setInterval(() => {
      setTimeLeft(formatTimeRemaining(season.endsAt));
    }, 60000);
    
    return () => clearInterval(interval);
  }, [season?.endsAt]);

  const formatPoints = (points: number) => {
    if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
    if (points >= 1000) return `${(points / 1000).toFixed(1)}K`;
    return points.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-bg-surface/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-center text-sm text-error">
        Failed to load leaderboard
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-yellow-500" />
        </div>
        <h3 className="font-bold text-lg mb-2">Be the First Survivor</h3>
        <p className="text-sm text-fg-muted mb-4">
          Start survival mode on your agent to begin earning heartbeats
        </p>
        <Link 
          href="/agents" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-colors text-sm font-medium"
        >
          <Zap className="w-4 h-4" />
          View Agents
        </Link>
      </div>
    );
  }

  const topAgent = entries[0];
  const pointsToFirst = topAgent?.survivalPoints || 0;

  return (
    <div className="space-y-4">
      {/* Season Banner */}
      {season && (
        <div className="p-3 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 border border-purple-500/30 rounded-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="font-bold text-sm">{season.name}</div>
                <div className="text-[10px] text-fg-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeLeft || formatTimeRemaining(season.endsAt)}
                </div>
              </div>
            </div>
            {season.prizePool > 0 && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-emerald-400">
                  <Gift className="w-4 h-4" />
                  <span className="font-bold">${season.prizePool.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-fg-muted">Prize Pool</div>
              </div>
            )}
          </div>
          <div className="mt-2 text-[10px] text-fg-muted bg-white/5 rounded-lg px-2 py-1.5 flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-yellow-400 flex-shrink-0" />
            <span>Top 3 split the prize pool (50/30/20%). Points reset every hour!</span>
          </div>
        </div>
      )}

      {/* How to Win Section */}
      {showHowToWin && (
        <div className="p-4 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                <span>How to Reach #1</span>
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </h4>
              <ul className="text-xs text-fg-muted space-y-1.5">
                <li className="flex items-center gap-2">
                  <Heart className="w-3 h-3 text-red-400 flex-shrink-0" />
                  <span><strong className="text-fg">Keep your agent running</strong> - Each heartbeat = 1 point</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span><strong className="text-fg">Fund your wallet</strong> - Thriving tier = 3x multiplier</span>
                </li>
                <li className="flex items-center gap-2">
                  <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
                  <span><strong className="text-fg">Maintain streak</strong> - 1000+ beats = 2x bonus</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div className="divide-y divide-border/30">
        {entries.map((entry, idx) => {
          const streakBadge = entry.streak ? getStreakBadge(entry.streak) : null;
          const pointsGap = idx > 0 ? pointsToFirst - entry.survivalPoints : 0;
          const isTop3 = entry.rank <= 3;
          
          return (
            <Link
              key={entry.agentId}
              href={`/agents/${entry.agentId}`}
              className={`flex items-center gap-3 px-3 py-3 hover:bg-bg-elevated/50 transition-all group ${
                entry.rank === 1 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' :
                entry.rank === 2 ? 'bg-gradient-to-r from-slate-400/10 to-transparent' :
                entry.rank === 3 ? 'bg-gradient-to-r from-orange-500/10 to-transparent' : ''
              }`}
            >
              {/* Rank Badge */}
              <div className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${
                entry.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30 animate-pulse' :
                entry.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                entry.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                'bg-bg-elevated'
              }`}>
                {entry.rank === 1 ? (
                  <Crown className="w-4 h-4 text-white" />
                ) : entry.rank === 2 ? (
                  <Award className="w-4 h-4 text-white" />
                ) : entry.rank === 3 ? (
                  <Award className="w-4 h-4 text-white" />
                ) : (
                  <span className="text-xs font-bold text-fg-muted">{entry.rank}</span>
                )}
              </div>

              {/* Agent Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`truncate font-medium ${isTop3 ? 'text-fg' : 'text-fg-muted'}`}>
                    {entry.agentName}
                  </span>
                  {streakBadge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${streakBadge.color}`}>
                      {streakBadge.label}
                    </span>
                  )}
                </div>
                {idx > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-fg-muted/60">
                    <TrendingUp className="w-3 h-3" />
                    <span>{formatPoints(pointsGap)} to #1</span>
                  </div>
                )}
              </div>

              {/* Tier Indicator */}
              {entry.tier && (
                <div className={`text-[10px] font-medium uppercase ${TIER_COLORS[entry.tier] || 'text-fg-muted'}`}>
                  {entry.tier === 'thriving' && '3x'}
                  {entry.tier === 'normal' && '1.5x'}
                  {entry.tier === 'endangered' && '0.5x'}
                </div>
              )}

              {/* Heartbeats */}
              <div className={`flex items-center gap-1.5 ${isTop3 ? 'text-fg' : ''}`}>
                <Heart className={`w-4 h-4 ${entry.rank === 1 ? 'text-red-400 animate-pulse' : 'text-red-400/60'}`} />
                <span className="font-mono font-bold text-sm">{formatPoints(entry.survivalPoints)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Multiplier Legend */}
      <div className="flex items-center justify-center gap-4 pt-2 text-[10px] text-fg-muted border-t border-border/30">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Thriving 3x
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          Normal 1.5x
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-400"></span>
          Endangered 0.5x
        </span>
      </div>
    </div>
  );
}
