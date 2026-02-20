import { Zap, Scale, Terminal } from 'lucide-react';

export default function AgentCardSkeleton() {
  return (
    <div className="relative p-5 rounded-xl border border-white/5 bg-bg-surface overflow-hidden">
      {/* Shimmer Effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-white/5">
          <div className="h-3 w-12 bg-white/5 rounded mb-2 animate-pulse" />
          <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="p-2 rounded-lg bg-bg-elevated/50 border border-white/5">
          <div className="h-3 w-12 bg-white/5 rounded mb-2 animate-pulse" />
          <div className="h-5 w-16 bg-white/10 rounded animate-pulse" />
        </div>
      </div>

      {/* Terminal Line */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
        <Terminal className="w-3 h-3 text-white/20" />
        <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse" />
      </div>
    </div>
  );
}
