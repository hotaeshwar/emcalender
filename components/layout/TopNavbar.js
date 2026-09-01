'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, Sparkles } from 'lucide-react';
import Button from '../common/Button';

export default function TopNavbar({ onMenuClick, title, subtitle }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-sm">
      {/* Left section: Hamburger button & page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-xl"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile brand indicator */}
        <div className="flex lg:hidden items-center gap-2">
          <Image
            src="/bid-logo.png"
            alt="BiD Logo"
            width={36}
            height={28}
            className="object-contain"
          />
          <span className="font-extrabold text-xs text-slate-900 truncate max-w-[160px] sm:max-w-none">
            Bid employee work distributer
          </span>
        </div>

        {/* Desktop Title & Subtitle */}
        <div className="hidden lg:block">
          {title && (
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-slate-600 font-medium">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right section: Quick action button & active status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Link href="/allocations/new">
          <Button
            size="sm"
            variant="primary"
            icon={Sparkles}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm"
          >
            Generate Allocation
          </Button>
        </Link>

        <div className="hidden md:flex flex-col text-right">
          <span className="text-xs font-bold text-slate-900">
            Agency Administrator
          </span>
          <span className="text-[10px] text-emerald-700 font-bold">
            ● Active
          </span>
        </div>
      </div>
    </header>
  );
}
