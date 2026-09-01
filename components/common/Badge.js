'use client';

import React from 'react';
import { ROLES, ROLE_LABELS, CONTENT_TYPES, CONTENT_TYPE_LABELS } from '@/lib/constants';

export default function Badge({
  children,
  variant = 'default',
  role,
  contentType,
  size = 'md',
  className = '',
}) {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-md font-bold tracking-wide',
    md: 'text-xs px-2.5 py-1 rounded-lg font-bold',
    lg: 'text-sm px-3 py-1.5 rounded-xl font-extrabold',
  };

  let style = 'bg-slate-100 text-slate-800 border-slate-200';

  if (role) {
    if (role === ROLES.GRAPHIC_DESIGNER) {
      style = 'bg-indigo-50 text-indigo-800 border-indigo-200';
    } else if (role === ROLES.VIDEO_EDITOR) {
      style = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else {
      style = 'bg-purple-50 text-purple-800 border-purple-200';
    }
  } else if (contentType) {
    if (contentType === CONTENT_TYPES.POST) {
      style = 'bg-blue-50 text-blue-800 border-blue-200';
    } else if (contentType === CONTENT_TYPES.REEL) {
      style = 'bg-purple-50 text-purple-800 border-purple-200';
    } else if (contentType === CONTENT_TYPES.STORY) {
      style = 'bg-amber-50 text-amber-800 border-amber-200';
    }
  } else {
    const variants = {
      default: 'bg-slate-100 text-slate-800 border-slate-200',
      success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      warning: 'bg-amber-50 text-amber-800 border-amber-200',
      danger: 'bg-rose-50 text-rose-800 border-rose-200',
      purple: 'bg-purple-50 text-purple-800 border-purple-200',
      brand: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    };
    style = variants[variant] || variants.default;
  }

  const displayText = role ? (ROLE_LABELS[role] || role) : contentType ? (CONTENT_TYPE_LABELS[contentType] || contentType) : children;

  return (
    <span className={`inline-flex items-center justify-center border leading-none ${sizeStyles[size] || sizeStyles.md} ${style} ${className}`}>
      {displayText}
    </span>
  );
}
