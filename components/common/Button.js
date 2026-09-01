'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]";

  const sizeStyles = {
    sm: "text-xs px-3 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2 gap-2 shadow-sm hover:shadow",
    lg: "text-base px-5 py-2.5 gap-2.5 shadow-md hover:shadow-lg",
  };

  const variantStyles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 focus:ring-slate-900 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:focus:ring-emerald-500",
    brand: "bg-brand-orange text-white hover:bg-orange-600 hover:-translate-y-0.5 focus:ring-orange-500 shadow-orange-500/20",
    green: "bg-brand-green text-white hover:bg-emerald-600 hover:-translate-y-0.5 focus:ring-emerald-500",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200 hover:-translate-y-0.5 focus:ring-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
    outline: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 hover:-translate-y-0.5 focus:ring-slate-400 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
    danger: "bg-rose-600 text-white hover:bg-rose-700 hover:-translate-y-0.5 focus:ring-rose-500 shadow-rose-500/20",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-200 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${variantStyles[variant] || variantStyles.primary} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-4 h-4 flex-shrink-0" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-4 h-4 flex-shrink-0" />}
        </>
      )}
    </button>
  );
}
