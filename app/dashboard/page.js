'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ProgressBar from '@/components/common/ProgressBar';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import Select from '@/components/common/Select';
import { SkeletonCard, SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { getDashboardData } from '@/services/dashboardService';
import { seedDefaultCapacityRules } from '@/services/capacityService';
import { subscribeAllocations, subscribeSurplusWork } from '@/services/allocationService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeClients } from '@/services/clientService';
import { useToast } from '@/contexts/ToastContext';
import { exportAllocationReport, exportToCSV } from '@/lib/exportExcel';
import Link from 'next/link';
import {
  Building2,
  Users,
  Calendar,
  Sparkles,
  AlertOctagon,
  TrendingUp,
  Sliders,
  CalendarCheck,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  CalendarDays,
  FileSpreadsheet,
  Download,
  Clock,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { ROLES, ROLE_LABELS } from '@/lib/constants';

const INITIAL_DATA = {
  activeWeek: null,
  stats: {
    totalClients: 0,
    activeClients: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    graphicDesignersCount: 0,
    videoEditorsCount: 0,
    activeWeeksCount: 0,
    totalAllocatedPosts: 0,
    totalAllocatedReels: 0,
    totalAllocatedStories: 0,
    totalSurplusCount: 0,
    unassignedSurplusCount: 0,
  },
  teamCapacity: {
    graphic: { totalUnits: 0, usedUnits: 0, utilization: 0 },
    video: { totalUnits: 0, usedUnits: 0, utilization: 0 },
  },
  recentSurplus: [],
  upcomingHolidays: [],
  employees: [],
};

export default function DashboardPage() {
  const [data, setData] = useState(INITIAL_DATA);
  const [months, setMonths] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const { success, error } = useToast();

  const loadData = async (targetMonthKey = null) => {
    try {
      const res = await getDashboardData(targetMonthKey || selectedMonthKey);
      if (res) {
        setData(res);
        setMonths(res.monthsList || []);
        if (!selectedMonthKey && res.activeMonth) {
          setSelectedMonthKey(res.activeMonth.monthKey);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonthKey);

    const unsubWeeks = subscribeWorkWeeks(() => {
      loadData(selectedMonthKey);
    });
    const unsubAllocations = subscribeAllocations(() => {
      loadData(selectedMonthKey);
    });
    const unsubSurplus = subscribeSurplusWork(() => {
      loadData(selectedMonthKey);
    });
    const unsubEmployees = subscribeEmployees(() => {
      loadData(selectedMonthKey);
    });
    const unsubClients = subscribeClients(() => {
      loadData(selectedMonthKey);
    });

    return () => {
      if (unsubWeeks) unsubWeeks();
      if (unsubAllocations) unsubAllocations();
      if (unsubSurplus) unsubSurplus();
      if (unsubEmployees) unsubEmployees();
      if (unsubClients) unsubClients();
    };
  }, [selectedMonthKey]);

  const handleMonthChange = (newMonthKey) => {
    setSelectedMonthKey(newMonthKey);
    loadData(newMonthKey);
  };

  const handleSeedRules = async () => {
    setSeeding(true);
    try {
      await seedDefaultCapacityRules();
      success('Default capacity rules have been seeded successfully!', 'Rules Initialized');
      loadData(selectedMonthKey);
    } catch (err) {
      console.error(err);
      error('Failed to seed capacity rules.', 'Error');
    } finally {
      setSeeding(false);
    }
  };

  const handleExportSummaryExcel = () => {
    const summaryRows = [
      { Metric: 'Active Month', Value: data?.activeMonth?.monthLabel || 'All Months', Category: 'Period' },
      { Metric: 'Active Clients', Value: stats.activeClients, Category: 'Clients' },
      { Metric: 'Total Clients', Value: stats.totalClients, Category: 'Clients' },
      { Metric: 'Active Graphic Designers', Value: stats.graphicDesignersCount, Category: 'Team' },
      { Metric: 'Active Video Editors', Value: stats.videoEditorsCount, Category: 'Team' },
      { Metric: 'Monthly Graphic Utilization (%)', Value: `${teamCapacity.graphic?.utilization || 0}%`, Category: 'Capacity' },
      { Metric: 'Monthly Graphic Units (Used / Total)', Value: `${teamCapacity.graphic?.usedUnits || 0} / ${teamCapacity.graphic?.totalUnits || 0}`, Category: 'Capacity' },
      { Metric: 'Monthly Video Utilization (%)', Value: `${teamCapacity.video?.utilization || 0}%`, Category: 'Capacity' },
      { Metric: 'Monthly Video Units (Used / Total)', Value: `${teamCapacity.video?.usedUnits || 0} / ${teamCapacity.video?.totalUnits || 0}`, Category: 'Capacity' },
      { Metric: 'Monthly Allocated Posts', Value: stats.totalAllocatedPosts, Category: 'Deliverables' },
      { Metric: 'Monthly Allocated Reels', Value: stats.totalAllocatedReels, Category: 'Deliverables' },
      { Metric: 'Monthly Allocated Stories', Value: stats.totalAllocatedStories, Category: 'Deliverables' },
      { Metric: 'Monthly Surplus Deliverables', Value: stats.totalSurplusCount, Category: 'Surplus' },
    ];
    exportToCSV(`Bid_Work_Distributer_${data?.activeMonth?.monthLabel || 'Summary'}`, summaryRows);
    success('Color-coded Excel summary report downloaded successfully!');
  };

  const stats = data?.stats || INITIAL_DATA.stats;
  const teamCapacity = data?.teamCapacity || INITIAL_DATA.teamCapacity;

  return (
    <AppLayout
      title="Agency Operations Dashboard"
      subtitle="Real-time capacity tracking, team utilization, and Month-Wise work distribution metrics"
    >
      <div className="space-y-6 animate-fade-in bg-white">
        {/* Top Clean White Banner with Month Selector */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Month-Level Deterministic Engine Active</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome to Bid employee work distributer
            </h2>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              {data?.activeMonth
                ? `Viewing aggregated monthly metrics for ${data.activeMonth.monthLabel} (${data.activeMonth.weeks.length} calendar weeks, ${data.activeMonth.totalCalculatedWorkingDays} effective working days).`
                : 'Start by setting up your calendar work weeks, client requirements, and capacity rules.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 z-10 w-full lg:w-auto">
            {/* Month Selector */}
            <div className="w-full sm:w-64">
              <Select
                label="Target Operational Month"
                value={selectedMonthKey || data?.activeMonth?.monthKey || ''}
                onChange={(e) => handleMonthChange(e.target.value)}
                options={(months.length > 0 ? months : data?.monthsList || []).map((m) => ({
                  value: m.monthKey,
                  label: `${m.monthLabel} (${m.weeks.length} Weeks)`,
                }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:pt-5">
              <DownloadExcelButton
                onExport={handleExportSummaryExcel}
                label="Download Summary"
                size="md"
              />
              <Link href="/allocations/new">
                <Button variant="primary" size="md" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                  Generate Month Allocation
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Clients Card */}
          <Card hover={true} className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Total Clients
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats.totalClients}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-700 font-medium">
                <span className="font-bold text-emerald-700">{stats.activeClients} Active</span>
                <span>•</span>
                <Link href="/clients" className="text-indigo-700 font-bold hover:underline">
                  Manage →
                </Link>
              </div>
            </div>
          </Card>

          {/* Employees Card */}
          <Card hover={true} className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Team Members
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats.totalEmployees}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-700 font-medium">
                <span className="font-bold text-indigo-700">{stats.graphicDesignersCount} Designers</span>
                <span>•</span>
                <span className="font-bold text-emerald-700">{stats.videoEditorsCount} Editors</span>
              </div>
            </div>
          </Card>

          {/* Allocated Work Items */}
          <Card hover={true} className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Allocated Content
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats.totalAllocatedPosts + stats.totalAllocatedReels + stats.totalAllocatedStories}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-700 font-semibold">
                <span className="text-blue-700">{stats.totalAllocatedPosts} Posts</span>
                <span>•</span>
                <span className="text-purple-700">{stats.totalAllocatedReels} Reels</span>
                <span>•</span>
                <span className="text-amber-700">{stats.totalAllocatedStories} Stories</span>
              </div>
            </div>
          </Card>

          {/* Surplus Work Card */}
          <Card hover={true} className="flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Surplus Work
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                stats.totalSurplusCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
              }`}>
                <AlertOctagon className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-extrabold text-slate-900">
                {stats.totalSurplusCount}
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                {stats.totalSurplusCount > 0 ? (
                  <Link href="/surplus" className="text-rose-700 font-bold hover:underline flex items-center gap-1">
                    Needs Manual Assignment →
                  </Link>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> All work allocated
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Team Capacity Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphic Team Capacity */}
          <Card>
            <CardHeader
              title="Graphic Design Team Capacity"
              subtitle="Aggregated normalized post, reel, and story units"
              action={
                <Badge role={ROLES.GRAPHIC_DESIGNER} />
              }
            />
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-slate-900">
                  {teamCapacity.graphic?.utilization || 0}%
                  <span className="text-xs font-semibold text-slate-600 ml-2">Total Utilization</span>
                </div>
                <div className="text-xs text-slate-700 font-medium">
                  <span className="font-extrabold text-slate-900">
                    {teamCapacity.graphic?.usedUnits || 0}
                  </span> / {teamCapacity.graphic?.totalUnits || 0} Capacity Units
                </div>
              </div>

              <ProgressBar
                percentage={teamCapacity.graphic?.utilization || 0}
                showLabel={false}
                size="lg"
              />

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Active Designers</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {stats.graphicDesignersCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Used Units</p>
                  <p className="text-base font-extrabold text-indigo-700 mt-0.5">
                    {teamCapacity.graphic?.usedUnits || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Free Units</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                    {Math.max(0, (teamCapacity.graphic?.totalUnits || 0) - (teamCapacity.graphic?.usedUnits || 0))}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Video Editor Team Capacity */}
          <Card>
            <CardHeader
              title="Video Editing Team Capacity"
              subtitle="Aggregated video reel cuts and motion story units"
              action={
                <Badge role={ROLES.VIDEO_EDITOR} />
              }
            />
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold text-slate-900">
                  {teamCapacity.video?.utilization || 0}%
                  <span className="text-xs font-semibold text-slate-600 ml-2">Total Utilization</span>
                </div>
                <div className="text-xs text-slate-700 font-medium">
                  <span className="font-extrabold text-slate-900">
                    {teamCapacity.video?.usedUnits || 0}
                  </span> / {teamCapacity.video?.totalUnits || 0} Capacity Units
                </div>
              </div>

              <ProgressBar
                percentage={teamCapacity.video?.utilization || 0}
                showLabel={false}
                size="lg"
              />

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Active Editors</p>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">
                    {stats.videoEditorsCount}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Used Units</p>
                  <p className="text-base font-extrabold text-indigo-700 mt-0.5">
                    {teamCapacity.video?.usedUnits || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] text-slate-600 uppercase font-bold">Free Units</p>
                  <p className="text-base font-extrabold text-emerald-700 mt-0.5">
                    {Math.max(0, (teamCapacity.video?.totalUnits || 0) - (teamCapacity.video?.usedUnits || 0))}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Individual Staff Workload & Utilization for Selected Week */}
        <Card>
          <CardHeader
            title={`Individual Staff Workload & Capacity (${data?.activeWeek?.name || 'Active Week'})`}
            subtitle="Live deliverable counts and capacity unit utilization for each team member"
            action={
              <Link href="/employees">
                <Button variant="ghost" size="sm" className="font-bold text-slate-700">
                  Manage Staff →
                </Button>
              </Link>
            }
          />

          {data?.employees && data.employees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.employees.map((emp) => {
                const isOverloaded = emp.utilization > 100;
                return (
                  <div
                    key={emp.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">
                          {emp.name}
                        </h4>
                        <p className="text-[11px] font-bold text-slate-500">
                          {emp.employeeCode || 'Staff'} • {ROLE_LABELS[emp.role] || emp.role}
                        </p>
                      </div>
                      <Badge role={emp.role} size="sm" />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span className="text-slate-600 font-medium">Deliverables:</span>
                      <span className="font-extrabold text-slate-900">
                        {emp.postsCount > 0 && <span className="text-blue-700">{emp.postsCount}P </span>}
                        {emp.reelsCount > 0 && <span className="text-purple-700">{emp.reelsCount}R </span>}
                        {emp.storiesCount > 0 && <span className="text-amber-700">{emp.storiesCount}S</span>}
                        {emp.postsCount === 0 && emp.reelsCount === 0 && emp.storiesCount === 0 && (
                          <span className="text-slate-400">0 Items</span>
                        )}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700">Capacity Used:</span>
                        <span className={isOverloaded ? 'text-rose-600' : 'text-slate-900'}>
                          {emp.usedUnits} / {emp.totalUnits} Units ({emp.utilization}%)
                        </span>
                      </div>
                      <ProgressBar
                        percentage={emp.utilization}
                        showLabel={false}
                        size="sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No active team members configured.
            </div>
          )}
        </Card>

        {/* Bottom Section: Surplus Alerts & Upcoming Holidays */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Surplus Alerts */}
          <Card>
            <CardHeader
              title="Surplus Work Alerts"
              subtitle="Tasks requiring capacity adjustment or manual assignment"
              action={
                <Link href="/surplus">
                  <Button variant="ghost" size="sm" className="font-bold text-slate-700">
                    View All ({stats.unassignedSurplusCount})
                  </Button>
                </Link>
              }
            />

            {data?.recentSurplus && data.recentSurplus.length > 0 ? (
              <div className="space-y-3">
                {data.recentSurplus.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.quantity} {item.contentType?.toUpperCase()}s ({ROLE_LABELS[item.roleRequired] || item.roleRequired})
                        </p>
                        <p className="text-[11px] text-rose-700 font-bold truncate">
                          {item.reasonLabel || item.reason}
                        </p>
                      </div>
                    </div>

                    <Link href="/surplus">
                      <Button variant="danger" size="sm" className="font-bold">
                        Assign
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-600 flex flex-col items-center justify-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <p className="font-bold text-slate-900">No Surplus Work</p>
                <p className="text-slate-600 font-medium">All client requirements have been completely absorbed by the team.</p>
              </div>
            )}
          </Card>

          {/* Upcoming Holidays */}
          <Card>
            <CardHeader
              title="Configured Holidays"
              subtitle="Dates automatically deducted from employee capacity"
              action={
                <Link href="/work-weeks">
                  <Button variant="ghost" size="sm" className="font-bold text-slate-700">
                    Calendar →
                  </Button>
                </Link>
              }
            />

            {data?.upcomingHolidays && data.upcomingHolidays.length > 0 ? (
              <div className="space-y-2.5">
                {data.upcomingHolidays.map((h, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {h.name || 'Public Holiday'}
                        </p>
                        <p className="text-[11px] text-slate-600 font-medium">
                          {h.holidayDate || h.date} • {h.weekName || 'Active Week'}
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning" size="sm">
                      Holiday
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-600 flex flex-col items-center justify-center gap-2">
                <Calendar className="w-8 h-8 text-slate-400" />
                <p className="font-bold text-slate-900">No Holidays in Active Weeks</p>
                <p className="text-slate-600 font-medium">Working days will operate at standard 100% capacity.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
