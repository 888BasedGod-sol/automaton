'use client';

import { useEffect, useState } from 'react';

export default function BootScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Faster, cleaner animation
    const duration = 2000; // 2 seconds total
    const interval = 20;
    const steps = duration / interval;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const prog = Math.min((step / steps) * 100, 100);
      setProgress(prog);

      if (step >= steps) {
        clearInterval(timer);
        setIsExiting(true);
        setTimeout(onComplete, 800); // Wait for fade out
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">
        
        {/* Minimalist Logo */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-2 border-2 border-t-white border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_2s_linear_infinite_reverse]" />
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </div>

        {/* Clean Progress Bar */}
        <div className="w-48 space-y-2">
          <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(255,255,255,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-white/40 tracking-widest uppercase">
            <span>System__Init</span>
            <span>{Math.floor(progress)}%</span>
          </div>
        </div>

      </div>
    </div>
  );
}
