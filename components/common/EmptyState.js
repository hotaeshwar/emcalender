'use client';

import React from 'react';
import { FolderOpen } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  icon: Icon = FolderOpen,
  title = 'No records found',
  description = 'Get started by creating your first entry.',
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-subtle border border-slate-200/60 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
        <Icon className="w-7 h-7" />
      </div>

      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>

      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button
          variant="primary"
          onClick={onAction}
          icon={actionIcon}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
