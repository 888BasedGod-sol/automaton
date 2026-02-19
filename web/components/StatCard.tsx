'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
  className?: string;
}

export default function StatCard({ 
  label, 
  value, 
  icon, 
  change, 
  trend,
  suffix,
  className = ''
}: StatCardProps) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-accent-green';
    if (trend === 'down') return 'text-accent-red';
    return 'text-text-muted';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`p-4 rounded-2xl bg-surface-1 border border-white/5 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-muted">{label}</span>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
      
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">
          {value}
          {suffix && <span className="text-lg text-text-secondary ml-1">{suffix}</span>}
        </span>
        
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(change)}%
          </div>
        )}
      </div>
    </div>
  );
}
