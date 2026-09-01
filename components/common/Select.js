'use client';

import React from 'react';

export default function Select({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  error,
  helperText,
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const selectId = id || name;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`w-full text-sm rounded-xl border bg-white transition-colors py-2.5 px-3.5 ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 text-rose-900'
            : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-100 text-slate-900'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-slate-400 bg-white">
            {placeholder}
          </option>
        )}
        {options.map((opt, idx) => {
          const val = typeof opt === 'object' && opt !== null ? opt.value : opt;
          const lbl = typeof opt === 'object' && opt !== null ? opt.label : opt;
          const isDisabled = typeof opt === 'object' && opt !== null ? opt.disabled : false;

          return (
            <option
              key={val !== undefined ? val : idx}
              value={val}
              disabled={isDisabled}
              className="text-slate-900 bg-white py-1"
            >
              {lbl}
            </option>
          );
        })}
      </select>

      {error ? (
        <p className="text-xs text-rose-600 mt-1 font-semibold">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
}
