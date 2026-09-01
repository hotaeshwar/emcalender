'use client';

import React from 'react';

export default function Card({
  children,
  className = '',
  hover = false,
  padding = 'p-6',
  onClick,
  ...props
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${
        hover ? 'transition-all duration-200 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 cursor-pointer' : ''
      } ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 ${className}`}>
      <div>
        {title && <h3 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">{title}</h3>}
        {subtitle && <p className="text-xs text-slate-600 font-medium mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}
