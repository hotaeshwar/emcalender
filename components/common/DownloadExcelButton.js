'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Check, Download } from 'lucide-react';

export default function DownloadExcelButton({
  onExport,
  label = 'Download Excel',
  filename = 'Report',
  className = '',
  size = 'sm'
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const handleClick = () => {
    if (isExporting) return;
    setIsExporting(true);
    setProgress(0);
    setIsComplete(false);

    // Smooth circular progress animation from 0% to 100%
    const duration = 1200; // 1.2 seconds
    const interval = 20;
    const step = 100 / (duration / interval);

    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= 100) {
        current = 100;
        setProgress(100);
        clearInterval(timer);

        // Trigger file download
        try {
          if (onExport) onExport();
        } catch (err) {
          console.error('Export error:', err);
        }

        setIsComplete(true);
        setIsExporting(false);

        // Reset to normal button after 2 seconds
        setTimeout(() => {
          setIsComplete(false);
          setProgress(0);
        }, 2200);
      } else {
        setProgress(Math.round(current));
      }
    }, interval);
  };

  // Circular progress SVG calculations
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const sizeClasses =
    size === 'xs'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : size === 'sm'
      ? 'px-3 py-1.5 text-xs gap-2'
      : 'px-4 py-2 text-sm gap-2.5';

  if (isComplete) {
    return (
      <button
        type="button"
        disabled
        className={`inline-flex items-center font-bold rounded-xl bg-emerald-600 text-white shadow-sm transition-all animate-fade-in ${sizeClasses} ${className}`}
      >
        <Check className="w-3.5 h-3.5 stroke-[3]" />
        <span>Downloaded!</span>
      </button>
    );
  }

  if (isExporting) {
    return (
      <div
        className={`inline-flex items-center font-bold rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 shadow-sm transition-all ${sizeClasses} ${className}`}
      >
        {/* Animated Circular Progress Spinner */}
        <div className="relative w-4 h-4 flex items-center justify-center">
          <svg className="w-4 h-4 -rotate-90 transform" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              className="text-emerald-200"
              fill="transparent"
            />
            <circle
              cx="12"
              cy="12"
              r={radius}
              stroke="currentColor"
              strokeWidth="3"
              className="text-emerald-700 transition-all duration-75"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="font-mono text-xs font-extrabold">{progress}%</span>
        <span className="text-[11px] font-semibold text-emerald-700">Exporting...</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center font-bold rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 active:scale-95 shadow-sm transition-all cursor-pointer ${sizeClasses} ${className}`}
      title="Download formatted color-coded Excel spreadsheet"
    >
      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );
}
