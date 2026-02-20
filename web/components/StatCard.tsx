'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  suffix?: string;
  className?: string;
}

export default function StatCard({ 
  label, 
  value, 
  icon, 
  suffix,
  className = ''
}: StatCardProps) {
  return (
    <div className={`p-4 rounded-lg bg-bg-surface border border-border ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-fg-muted uppercase tracking-wide">{label}</span>
        {icon && <div className="text-fg-faint">{icon}</div>}
      </div>
      <span className="text-2xl font-semibold tabular-nums">
        {value}
        {suffix && <span className="text-base text-fg-muted ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}
