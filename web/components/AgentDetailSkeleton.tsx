export default function AgentDetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-base text-fg animate-pulse">
      {/* Header Skeleton */}
      <div className="border-b border-white/5 bg-bg-surface/50">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-lg" />
            <div className="h-6 w-32 bg-white/5 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-white/5 rounded" />
            <div className="h-10 w-24 bg-white/5 rounded" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className="h-32 bg-bg-surface rounded-xl border border-white/5" />
          
          {/* Terminal */}
          <div className="h-[500px] bg-black rounded-xl border border-white/10" />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="h-64 bg-bg-surface rounded-xl border border-white/5" />
          <div className="h-48 bg-bg-surface rounded-xl border border-white/5" />
        </div>
      </div>
    </div>
  );
}
