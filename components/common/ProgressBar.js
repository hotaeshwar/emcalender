'use client';

import React from 'react';
import { UTILIZATION_THRESHOLDS } from '@/lib/constants';

export default function ProgressBar({
  percentage = 0,
  usedUnits,
  totalUnits,
  showLabel = true,
  label,
  size = 'md',
  className = '',
}) {
  const pct = Math.max(0, Number(percentage) || 0);
  const visualPct = Math.min(100, pct);

  let barColor = 'bg-emerald-500';
  let badgeColor = 'text-emerald-800 bg-emerald-50 border border-emerald-200';

  if (pct > UTILIZATION_THRESHOLDS.HIGH) {
    barColor = 'bg-purple-600 animate-pulse';
    badgeColor = 'text-purple-800 bg-purple-50 border border-purple-200';
  } else if (pct > UTILIZATION_THRESHOLDS.MODERATE) {
    barColor = 'bg-rose-500';
    badgeColor = 'text-rose-800 bg-rose-50 border border-rose-200';
  } else if (pct > UTILIZATION_THRESHOLDS.SAFE) {
    barColor = 'bg-amber-500';
    badgeColor = 'text-amber-800 bg-amber-50 border border-amber-200';
  }

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
          <span className="text-slate-700">
            {label || (usedUnits !== undefined && totalUnits !== undefined ? `${usedUnits} / ${totalUnits} Units` : 'Utilization')}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${badgeColor}`}>
            {pct}%
          </span>
        </div>
      )}

      <div className={`w-full bg-slate-100 border border-slate-200 rounded-full overflow-hidden ${heightStyles[size] || heightStyles.md}`}>
        <div
          className={`${barColor} ${heightStyles[size] || heightStyles.md} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${visualPct}%` }}
        />
      </div>
    </div>
  );
}
