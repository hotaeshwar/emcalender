'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { subscribeAllocations } from '@/services/allocationService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeClients } from '@/services/clientService';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeCapacityRules } from '@/services/capacityService';
import { buildDailyTimetable } from '@/lib/allocationEngine';
import { exportAllocationReport } from '@/lib/exportExcel';
import { groupWeeksByMonth, getActiveMonth } from '@/lib/monthUtils';
import { useToast } from '@/contexts/ToastContext';
import {
  History,
  Calendar,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  RotateCcw,
  Layers
} from 'lucide-react';
import { ROLES, ROLE_OPTIONS } from '@/lib/constants';

export default function HistoryPage() {
  const [allocations, setAllocations] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [months, setMonths] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('all');
  const [selectedWeekId, setSelectedWeekId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedAllocId, setExpandedAllocId] = useState(null);
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      const grouped = groupWeeksByMonth(data || []);
      setMonths(grouped);
    });

    const unsubClients = subscribeClients(setClients);
    const unsubEmployees = subscribeEmployees(setEmployees);
    const unsubRules = subscribeCapacityRules(setCapacityRules);

    const unsubAllocations = subscribeAllocations((data) => {
      setAllocations(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubWeeks) unsubWeeks();
      if (unsubClients) unsubClients();
      if (unsubEmployees) unsubEmployees();
      if (unsubRules) unsubRules();
      if (unsubAllocations) unsubAllocations();
    };
  }, []);

  const currentMonthData = months.find((m) => m.monthKey === selectedMonthKey);
  const monthWeeks = currentMonthData?.weeks || weeks;

  const filteredAllocations = allocations.filter((a) => {
    if (selectedMonthKey !== 'all') {
      const matchMonth = a.monthKey === selectedMonthKey || (a.date && a.date.startsWith(selectedMonthKey)) ||
                         monthWeeks.some(w => w.id === a.weekId || w.name === a.weekName);
      if (!matchMonth) return false;
    }
    if (selectedWeekId && selectedWeekId !== 'all') {
      const matchWeek = a.weekId === selectedWeekId || (a.weekName && a.weekName === selectedWeekId);
      if (!matchWeek) return false;
    }
    if (roleFilter !== 'all' && (a.employeeRole || '').toLowerCase() !== roleFilter.toLowerCase()) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchClient = (a.clientName || '').toLowerCase().includes(q) || (a.clientId || '').toLowerCase().includes(q);
      const matchEmp = (a.employeeName || '').toLowerCase().includes(q) || (a.employeeCode || '').toLowerCase().includes(q);
      if (!matchClient && !matchEmp) return false;
    }
    return true;
  });

  const currentWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];

  const toggleExpand = (id) => {
    setExpandedAllocId(expandedAllocId === id ? null : id);
  };

  const handleExportExcel = () => {
    if (filteredAllocations.length === 0) {
      error('No allocation records found to export.');
      return;
    }

    exportAllocationReport({
      week: selectedWeekId !== 'all' ? currentWeek : { name: currentMonthData?.monthLabel || 'All Months' },
      monthLabel: currentMonthData?.monthLabel,
      isMonthly: selectedWeekId === 'all',
      allocations: filteredAllocations,
      surplus: [],
      clients,
      employees,
    });
    success('Color-coded Excel allocation history downloaded successfully!');
  };

  return (
    <AppLayout
      title="Allocation History & Timetables"
      subtitle="Historical audit of committed allocations with Month-Wise and Week-Wise daily item distribution timetables"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar with Animated Download Button */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Filter by Month:
            </span>
            <div className="w-56">
              <Select
                value={selectedMonthKey}
                onChange={(e) => {
                  setSelectedMonthKey(e.target.value);
                  setSelectedWeekId('all');
                }}
                options={[
                  { value: 'all', label: 'All Months' },
                  ...months.map((m) => ({
                    value: m.monthKey,
                    label: `${m.monthLabel} (${m.weeks.length} Wks)`,
                  })),
                ]}
              />
            </div>

            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-2">
              Work Week:
            </span>
            <div className="w-56">
              <Select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={[
                  { value: 'all', label: selectedMonthKey !== 'all' ? 'All Weeks in Month' : 'All Work Weeks' },
                  ...monthWeeks.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.startDate})`,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DownloadExcelButton
              onExport={handleExportExcel}
              label="Download Report (Excel)"
              size="sm"
            />
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by client or staff name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="w-48">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...ROLE_OPTIONS,
                ]}
              />
            </div>

            {(searchQuery || roleFilter !== 'all' || selectedWeekId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setSelectedWeekId('all');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            Showing {filteredAllocations.length} of {allocations.length} Records
          </div>
        </div>

        {/* History Table */}
        <Card>
          <CardHeader
            title="Committed Work Deliverables"
            subtitle="Click on any assignment row to view its suggested daily schedule"
            action={
              <Badge variant="brand" size="sm">
                {filteredAllocations.length} Saved Records
              </Badge>
            }
          />

          {loading ? (
            <SkeletonTable rows={5} cols={6} />
          ) : filteredAllocations.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Allocation History for this Week"
              description="Run the auto allocation engine to generate schedule assignments."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-8"></th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Deliverables</th>
                    <th className="py-3.5 px-4">Capacity Effort</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Saved At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAllocations.map((alloc) => {
                    const isExpanded = expandedAllocId === alloc.id;
                    const client = clients.find((c) => c.id === alloc.clientId);
                    const emp = employees.find((e) => e.id === alloc.employeeId);

                    // Generate daily schedule breakdown
                    const timetable = currentWeek
                      ? buildDailyTimetable(
                          alloc,
                          currentWeek,
                          currentWeek.holidays || [],
                          capacityRules
                        )
                      : [];

                    return (
                      <React.Fragment key={alloc.id}>
                        <tr
                          onClick={() => toggleExpand(alloc.id)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-indigo-50/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-4 text-slate-400">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {client?.name || alloc.clientId}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {alloc.employeeName} ({alloc.employeeCode})
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge role={alloc.employeeRole} size="sm" />
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-bold text-blue-700">{alloc.work?.posts || 0}P</span>
                            <span className="mx-1 text-slate-400">•</span>
                            <span className="font-bold text-purple-700">{alloc.work?.reels || 0}R</span>
                            <span className="mx-1 text-slate-400">•</span>
                            <span className="font-bold text-amber-700">{alloc.work?.stories || 0}S</span>
                          </td>

                          <td className="py-3.5 px-4 font-extrabold text-indigo-700 bg-indigo-50/40">
                            {alloc.capacityUsed} Units
                          </td>

                          <td className="py-3.5 px-4">
                            {alloc.assignmentType === 'manual' ? (
                              <Badge variant="warning" size="sm">Manual Override</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Auto Balanced</Badge>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right text-xs text-slate-500 font-mono">
                            {alloc.createdAt ? new Date(alloc.createdAt).toLocaleDateString() : 'Active'}
                          </td>
                        </tr>

                        {/* Expandable Daily Timetable Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={8} className="p-4 pl-12 border-b border-slate-100">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                  <Clock className="w-4 h-4 text-indigo-600" />
                                  <span>Suggested Daily Production Schedule:</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                  {timetable.map((day, idx) => (
                                    <div
                                      key={idx}
                                      className={`p-2.5 rounded-xl border text-center ${
                                        day.isHoliday
                                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                                          : 'bg-white border-slate-200 text-slate-900 shadow-sm'
                                      }`}
                                    >
                                      <p className="text-[10px] font-mono text-slate-600 font-bold">{day.date}</p>
                                      {day.isHoliday ? (
                                        <p className="text-xs font-bold text-amber-800 mt-1">🏖️ Holiday</p>
                                      ) : (
                                        <div className="mt-1 space-y-0.5 text-xs font-bold">
                                          {day.posts > 0 && <p className="text-blue-700">{day.posts} Posts</p>}
                                          {day.reels > 0 && <p className="text-purple-700">{day.reels} Reels</p>}
                                          {day.stories > 0 && <p className="text-amber-700">{day.stories} Stories</p>}
                                          {day.posts === 0 && day.reels === 0 && day.stories === 0 && (
                                            <p className="text-slate-400 text-[11px] font-normal">Buffer Day</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
