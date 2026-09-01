'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Building2,
  Users,
  Sliders,
  CalendarDays,
  CalendarCheck,
  ClipboardList,
  Sparkles,
  AlertOctagon,
  History,
  Grid,
  Settings,
  X
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/capacity-rules', label: 'Capacity Rules', icon: Sliders },
  { href: '/work-weeks', label: 'Calendar / Work Weeks', icon: CalendarDays },
  { href: '/availability', label: 'Employee Availability', icon: CalendarCheck },
  { href: '/requirements', label: 'Work Requirements', icon: ClipboardList },
  { href: '/allocations', label: 'Auto Allocation', icon: Sparkles, highlight: true },
  { href: '/surplus', label: 'Surplus Work', icon: AlertOctagon },
  { href: '/history', label: 'Allocation History', icon: History },
  { href: '/matrix', label: 'Workload Matrix', icon: Grid },
  { href: '/settings', label: 'Settings & Audit', icon: Settings },
];

export default function Sidebar({ onClose, isMobile = false }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col h-full bg-white border-r border-slate-200 w-72 select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-white">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="relative w-12 h-10 flex-shrink-0 flex items-center justify-center">
            <Image
              src="/bid-logo.png"
              alt="BiD Logo"
              width={54}
              height={40}
              className="object-contain transform group-hover:scale-105 transition-transform"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm leading-tight text-slate-900 tracking-tight">
              Bid employee work distributer
            </span>
            <span className="text-[10px] text-slate-600 font-bold tracking-wide uppercase">
              Operations Hub
            </span>
          </div>
        </Link>

        {isMobile && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin bg-white">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={isMobile ? onClose : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm font-bold'
                  : item.highlight
                  ? 'text-indigo-700 hover:bg-indigo-50 font-bold'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
              {item.highlight && !isActive && (
                <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-extrabold flex items-center justify-center text-xs shadow-sm flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              Agency Administrator
            </p>
            <p className="text-[10px] text-emerald-700 font-bold">
              ● Active System
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
