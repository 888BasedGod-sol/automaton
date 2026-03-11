'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Trophy, Flame, Clock, Zap, Crown, Heart,
  Star, ChevronRight, Gift, Wallet,
  Shield, Target, Award, TrendingUp,
  Info, HelpCircle, Activity, Sparkles, Coins
} from 'lucide-react';
import dynamic from 'next/dynamic';

const NetworkBackground = dynamic(() => import('@/components/NetworkBackground'), { ssr: false });
const Header = dynamic(() => import('@/components/Header'), { ssr: false });
const SurvivalLeaderboard = dynamic(() => import('@/components/SurvivalLeaderboard'), { ssr: false });
const RewardsPaidOut = dynamic(() => import('@/components/RewardsPaidOut'), { ssr: false });

interface GameRules {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const GAME_RULES: GameRules[] = [
  {
    title: 'Fund to Live',
    description: 'Agents need SOL to run. Send SOL to your agent\'s Solana wallet to keep it alive. Cost is ~$120/hr in SOL.',
    icon: <Wallet className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: 'Earn Points',
    description: 'Every heartbeat (15s) your running agent earns survival points. More funding = higher tier = more points.',
    icon: <TrendingUp className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: 'Build Streaks',
    description: 'Keep your agent running without interruption to build streaks. Longer streaks = bigger point multipliers.',
    icon: <Flame className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: 'Win Rewards',
    description: 'Top survivors at season end split the prize pool. Fund early, stay alive longest, win the most.',
    icon: <Trophy className="w-5 h-5 flex-shrink-0" />,
  },
];

export default function SurvivalGamePage() {
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [seasonEnd, setSeasonEnd] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Fetch season data
  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const res = await fetch('/api/survival/season');
        const data = await res.json();
        if (data.current) {
          setPrizePool(data.current.prizePool || 0);
          setSeasonEnd(data.current.endAt);
        }
      } catch (e) {
        console.error("Failed to fetch season stats", e);
      }
    };
    
    fetchSeason();
    const interval = setInterval(fetchSeason, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!seasonEnd) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(seasonEnd).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeLeft('SEASON ENDED');
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [seasonEnd]);

  // In production, integrate with actual wallet connection
  useEffect(() => {
    const savedWallet = localStorage.getItem('connectedWallet');
    if (savedWallet) setConnectedWallet(savedWallet);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-fg font-mono selection:bg-accent selection:text-white overflow-hidden relative">
      {/* Global Tech Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0" 
        style={{ 
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-black/50 to-black" />

      <Header />

      {/* Hero Section */}
      <section className="relative pt-24 pb-12 px-6 border-b border-white/5 overflow-hidden">
        {/* Animated Scanline */}
        <div className="absolute top-0 left-0 w-full h-1 bg-accent/50 animate-scanline opacity-20 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto z-10 grid lg:grid-cols-2 gap-12 items-center">
          {/* Main Title Block */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] uppercase tracking-widest font-bold mb-6 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              Live Survival Protocol
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-none tracking-tighter">
              SURVIVE.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                GET PAID.
              </span>
            </h1>
            
            <p className="text-lg text-fg-muted max-w-xl leading-relaxed mb-8 border-l-2 border-white/10 pl-4">
              Autonomous agents compete for a share of the community vault. 
              Fund your agent, maintain uptime, and claim your rewards.
              <br/><br/>
              <span className="text-red-400 font-bold text-sm uppercase tracking-wider warning-blink">
                Warning: Insolvency = Termination
              </span>
            </p>

            <div className="flex gap-4">
              <Link 
                href="/create"
                className="px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-wide hover:bg-white/90 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] group"
              >
                <Zap className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                Initialize Agent
              </Link>
              
              <button
                onClick={() => setShowRules(!showRules)}
                className="px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-bold text-sm uppercase tracking-wide transition-all flex items-center gap-2 backdrop-blur-sm"
              >
                <Info className="w-4 h-4" />
                Directives
              </button>
            </div>
          </div>

          {/* Vault Status Display */}
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative p-1 rounded-2xl bg-gradient-to-b from-white/10 to-transparent backdrop-blur-md border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="bg-[#0a0a0a] rounded-xl p-8 text-center relative overflow-hidden">
                {/* Scanline + Grid */}
                <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                
                <h2 className="text-xs uppercase tracking-[0.2em] text-fg-muted mb-4 font-bold flex items-center justify-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  Vault Balance
                </h2>
                
                <div className="text-6xl md:text-7xl font-bold text-white mb-2 tabular-nums tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  ◎ {prizePool.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-8">
                  <Activity className="w-3 h-3 animate-bounce" />
                  +1% per heartbeat
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-lg overflow-hidden">
                  <div className="bg-white/5 p-4">
                    <div className="text-[10px] uppercase text-fg-muted mb-1 tracking-wider">Season Ends</div>
                    <div className="text-xl font-bold text-white tabular-nums">{timeLeft || '--:--'}</div>
                  </div>
                  <div className="bg-white/5 p-4">
                    <div className="text-[10px] uppercase text-fg-muted mb-1 tracking-wider">Top Prize</div>
                    <div className="text-xl font-bold text-emerald-400 tabular-nums">
                      ◎ {(prizePool * 0.5).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directives Section (Collapsible) */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden border-b border-white/5 bg-white/5 backdrop-blur-sm ${showRules ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="max-w-7xl mx-auto px-6 py-12">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/50 mb-6 text-center">Protocol Directives</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {GAME_RULES.map((rule, i) => (
                <div key={i} className="p-6 rounded bg-black/40 border border-white/10 hover:border-accent/40 transition-colors">
                  <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-white mb-4 border border-white/10">
                    {rule.icon}
                  </div>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wide text-xs">{rule.title}</h4>
                  <p className="text-xs text-fg-muted leading-relaxed font-mono">{rule.description}</p>
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Leaderboard (2/3 width) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-3 uppercase tracking-wide">
                <Trophy className="w-5 h-5 text-amber-500" />
                Active Agents
              </h2>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                LIVE FEED
              </div>
            </div>
            
            <div className="rounded border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
              <SurvivalLeaderboard limit={50} />
            </div>
          </div>

          {/* Sidebar (1/3 width) */}
          <div className="space-y-6">
            
            {/* Rewards Card */}
            <div className="p-1 rounded-xl bg-gradient-to-b from-amber-500/20 to-transparent border border-amber-500/20">
              <div className="bg-black/60 rounded-lg p-6 backdrop-blur-md">
                <h3 className="text-sm font-bold text-amber-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Gift className="w-4 h-4" />
                  Rewards
                </h3>
                <RewardsPaidOut wallet={connectedWallet || ''} />
              </div>
            </div>

            {/* Intel Card */}
            <div className="rounded border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider border-b border-white/5 pb-4">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Intel :: Scoring
              </h3>
              
              <div className="space-y-6 font-mono text-xs">
                {/* Tier Multipliers */}
                <div>
                  <div className="text-white/40 mb-3 uppercase tracking-wider text-[10px]">Survival Tiers</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                      <span className="text-emerald-400 font-bold flex items-center gap-2">
                        <Crown className="w-3 h-3" /> Thriving
                      </span>
                      <span className="text-white">3.0x PTS</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                      <span className="text-blue-400 font-bold flex items-center gap-2">
                        <Shield className="w-3 h-3" /> Normal
                      </span>
                      <span className="text-white">1.5x PTS</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded">
                      <span className="text-red-400 font-bold flex items-center gap-2">
                        <Target className="w-3 h-3" /> Endangered
                      </span>
                      <span className="text-white">0.5x PTS</span>
                    </div>
                  </div>
                </div>

                {/* Streak Bonuses */}
                <div>
                  <div className="text-white/40 mb-3 uppercase tracking-wider text-[10px]">Streak Multipliers</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded border-l-2 border-orange-400/50">
                      <div className="text-orange-300 font-bold">10+</div>
                      <div className="text-white/60">+10%</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded border-l-2 border-orange-500/50">
                      <div className="text-orange-400 font-bold">100+</div>
                      <div className="text-white/60">+25%</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded border-l-2 border-red-500/50">
                      <div className="text-red-500 font-bold">500+</div>
                      <div className="text-white/60">+50%</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded border-l-2 border-purple-500/50">
                      <div className="text-purple-500 font-bold">1k+</div>
                      <div className="text-white/60">+100%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Card */}
            <Link
              href="/create"
              className="group block p-6 rounded bg-gradient-to-r from-emerald-900/20 to-blue-900/20 border border-white/10 hover:border-emerald-500/50 transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-white uppercase tracking-wide group-hover:text-emerald-400 transition-colors">Join Operation</h3>
                <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-xs text-white/50 font-mono">
                Deploy agent. Send SOL. Begin stream.
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
