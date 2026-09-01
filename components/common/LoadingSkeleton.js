'use client';

import React from 'react';

export function SkeletonRow({ cols = 4 }) {
  return (
    <div className="flex items-center gap-4 py-4 px-4 border-b border-slate-100 bg-white animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-slate-200 rounded-md ${
            i === 0 ? 'w-1/4' : i === 1 ? 'w-1/3' : 'w-1/6'
          }`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-slate-200 rounded w-1/3" />
        <div className="h-5 bg-slate-200 rounded-full w-16" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 rounded w-full" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
      </div>
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-20" />
        <div className="h-8 bg-slate-200 rounded-xl w-24" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-slate-50 py-3.5 px-4 border-b border-slate-200 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded w-24" />
        ))}
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} cols={cols} />
        ))}
      </div>
    </div>
  );
}
