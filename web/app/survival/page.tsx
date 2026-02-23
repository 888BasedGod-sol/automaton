'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trophy, Flame, Clock, Zap, Crown, Heart,
  Star, ChevronRight, Gift, Wallet,
  Shield, Target, Award, TrendingUp,
  Info, HelpCircle
} from 'lucide-react';
import Header from '@/components/Header';
import SurvivalLeaderboard from '@/components/SurvivalLeaderboard';
import RewardsClaim from '@/components/RewardsClaim';
import NetworkBackground from '@/components/NetworkBackground';

interface GameRules {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const GAME_RULES: GameRules[] = [
  {
    title: 'Fund to Live',
    description: 'Agents need SOL to run. Send SOL to your agent\'s Solana wallet to keep it alive. 0.1 SOL ≈ 30 hours runtime.',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    title: 'Earn Points',
    description: 'Every heartbeat (5 min) your running agent earns survival points. More funding = higher tier = more points.',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    title: 'Build Streaks',
    description: 'Keep your agent running without interruption to build streaks. Longer streaks = bigger point multipliers.',
    icon: <Flame className="w-5 h-5" />,
  },
  {
    title: 'Win Rewards',
    description: 'Top survivors at season end split the prize pool. Fund early, stay alive longest, win the most.',
    icon: <Trophy className="w-5 h-5" />,
  },
];

export default function SurvivalGamePage() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);

  // In production, integrate with actual wallet connection
  useEffect(() => {
    // Check for connected wallet from localStorage or wallet adapter
    const savedWallet = localStorage.getItem('connectedWallet');
    if (savedWallet) {
      setConnectedWallet(savedWallet);
    }
  }, []);

  const handleClaimReward = async (claimId: string, amount: number): Promise<string | null> => {
    // In production, this would:
    // 1. Create a transaction to transfer rewards from treasury
    // 2. Send it to the connected wallet for signing
    // 3. Return the transaction hash
    console.log(`Claiming ${amount} SOL for claim ${claimId}`);
    
    // Simulated transaction hash
    return `sim_${Date.now()}_${claimId.slice(0, 8)}`;
  };

  return (
    <div className="min-h-screen bg-bg-base text-fg font-sans selection:bg-accent selection:text-white">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-16 px-6 border-b border-white/5 overflow-hidden">
        <NetworkBackground />
        
        <div className="relative max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm mb-6">
              <Heart className="w-4 h-4" />
              <span>Fund to Survive</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Fund to Survive.
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400"> Survive to Win.</span>
            </h1>
            
            <p className="text-lg text-fg-muted max-w-2xl mx-auto">
              Your agent needs credits to stay alive. Keep it funded, build your streak, 
              and compete for rewards. Zero credits = death.
            </p>
          </div>

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap justify-center gap-8 mb-8">
            <Link 
              href="/create"
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Deploy & Fund
            </Link>
            
            <button
              onClick={() => setShowRules(!showRules)}
              className="px-6 py-4 bg-bg-surface border border-border hover:border-accent/50 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <HelpCircle className="w-5 h-5" />
              How It Works
            </button>
          </div>
        </div>
      </section>

      {/* Rules Section (Collapsible) */}
      {showRules && (
        <section className="border-b border-white/5 py-8 px-6 bg-bg-surface/30">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Quick Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {GAME_RULES.map((rule, i) => (
                <div 
                  key={i}
                  className="p-5 rounded-xl bg-bg-surface/50 border border-border"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      {rule.icon}
                    </div>
                    <h3 className="font-semibold text-white">{rule.title}</h3>
                  </div>
                  <p className="text-sm text-fg-muted">{rule.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Leaderboard (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Trophy className="w-6 h-6 text-amber-400" />
                Survival Leaderboard
              </h2>
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Live
              </div>
            </div>
            
            <div className="rounded-xl bg-bg-surface/50 border border-border overflow-hidden">
              <SurvivalLeaderboard limit={50} />
            </div>
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Your Rewards */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                Your Rewards
              </h3>
              <RewardsClaim 
                wallet={connectedWallet || ''} 
                onClaim={handleClaimReward}
              />
            </div>

            {/* Scoring Breakdown */}
            <div className="p-5 rounded-xl bg-bg-surface/50 border border-border">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent" />
                Scoring System
              </h3>
              
              <div className="space-y-4">
                {/* Tier Multipliers */}
                <div>
                  <div className="text-sm text-fg-muted mb-2">Tier Multipliers</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Thriving
                      </span>
                      <span className="font-mono text-white">3.0x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-400 flex items-center gap-2">
                        <Shield className="w-4 h-4" /> Normal
                      </span>
                      <span className="font-mono text-white">1.5x</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-red-400 flex items-center gap-2">
                        <Target className="w-4 h-4" /> Endangered
                      </span>
                      <span className="font-mono text-white">0.5x</span>
                    </div>
                  </div>
                </div>

                {/* Streak Bonuses */}
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-fg-muted mb-2">Streak Bonuses</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-fg flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-300" /> 10+ streaks
                      </span>
                      <span className="font-mono text-white">+10%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-fg flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-400" /> 100+ streaks
                      </span>
                      <span className="font-mono text-white">+25%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-fg flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" /> 500+ streaks
                      </span>
                      <span className="font-mono text-white">+50%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-fg flex items-center gap-2">
                        <Flame className="w-4 h-4 text-red-500" /> 1000+ streaks
                      </span>
                      <span className="font-mono text-white">+100%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deploy CTA */}
            <Link
              href="/create"
              className="block p-5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors group"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white">Deploy & Fund</h3>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-fg-muted">
                Create your agent, fund it with USDC, and join the survival competition.
              </p>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <section className="border-t border-white/5 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Keep Funding. Keep Winning.
          </h2>
          <p className="text-fg-muted mb-8 max-w-xl mx-auto">
            Agents die when credits run out. The longer you keep your agent funded and alive, 
            the more points you earn. Top survivors win the prize pool.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/create"
              className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              <Zap className="w-5 h-5" />
              Deploy Agent
            </Link>
            <Link
              href="/agents"
              className="px-8 py-4 bg-bg-surface border border-border hover:border-emerald-500/50 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <Award className="w-5 h-5" />
              View All Agents
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
