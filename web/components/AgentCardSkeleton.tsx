import { Terminal } from 'lucide-react';

export default function AgentCardSkeleton() {
  return (
    <div className="relative p-5 rounded-xl border border-white/5 bg-bg-surface overflow-hidden group">
      {/* Shimmer Effect Overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />
      
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.03] animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-28 bg-gradient-to-r from-white/[0.08] to-white/[0.04] rounded animate-pulse" />
            <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" style={{ animationDelay: '150ms' }} />
          </div>
        </div>
        <div className="h-6 w-20 rounded-full bg-white/[0.06] animate-pulse" style={{ animationDelay: '100ms' }} />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 relative">
        <div className="p-3 rounded-lg bg-bg-elevated/50 border border-white/[0.03]">
          <div className="h-3 w-14 bg-white/[0.05] rounded mb-2 animate-pulse" />
          <div className="h-5 w-20 bg-gradient-to-r from-white/[0.08] to-white/[0.04] rounded animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
        <div className="p-3 rounded-lg bg-bg-elevated/50 border border-white/[0.03]">
          <div className="h-3 w-14 bg-white/[0.05] rounded mb-2 animate-pulse" style={{ animationDelay: '50ms' }} />
          <div className="h-5 w-20 bg-gradient-to-r from-white/[0.08] to-white/[0.04] rounded animate-pulse" style={{ animationDelay: '250ms' }} />
        </div>
      </div>

      {/* Terminal Line */}
      <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center gap-2 relative">
        <Terminal className="w-3 h-3 text-white/10" />
        <div className="flex-1 flex gap-1">
          <div className="h-3 w-1/4 bg-white/[0.04] rounded animate-pulse" style={{ animationDelay: '300ms' }} />
          <div className="h-3 w-1/2 bg-white/[0.03] rounded animate-pulse" style={{ animationDelay: '350ms' }} />
        </div>
      </div>
    </div>
  );
}
