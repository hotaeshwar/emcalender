'use client';

import React from 'react';

export default function Textarea({
  label,
  id,
  name,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  rows = 3,
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const textareaId = id || name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <textarea
        id={textareaId}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        required={required}
        className={`w-full text-sm rounded-xl border bg-white transition-colors py-2.5 px-3.5 ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 text-rose-900'
            : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-100 text-slate-900'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        {...props}
      />

      {error ? (
        <p className="text-xs text-rose-600 mt-1 font-semibold">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
