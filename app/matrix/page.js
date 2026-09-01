'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Select from '@/components/common/Select';
import Badge from '@/components/common/Badge';
import ProgressBar from '@/components/common/ProgressBar';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeAllocations } from '@/services/allocationService';
import { subscribeEmployeeAvailability } from '@/services/availabilityService';
import { subscribeCapacityRules } from '@/services/capacityService';
import { exportMatrixReport } from '@/lib/exportExcel';
import { useToast } from '@/contexts/ToastContext';
import {
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  getEffectiveWorkingDays,
  calculateUtilization,
  normalizeDate
} from '@/lib/capacityCalculator';
import {
  Grid,
  Calendar,
  Users,
  AlertTriangle,
  UserX,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { ROLES, AVAILABILITY_TYPES } from '@/lib/constants';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayHeader(dateStr) {
  if (!dateStr) return { dayName: '', formatted: '' };
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return { dayName: '', formatted: dateStr };
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayName = DAY_NAMES[date.getDay()];
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { dayName, formatted };
  } catch (e) {
    return { dayName: '', formatted: dateStr };
  }
}

export default function WorkloadMatrixPage() {
  const [employees, setEmployees] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubEmp = subscribeEmployees((data) => {
      setEmployees(data || []);
      setLoading(false);
    });

    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      if (data && data.length > 0 && !selectedWeekId) {
        setSelectedWeekId(data[0].id);
      }
    });

    const unsubAlloc = subscribeAllocations(setAllocations);
    const unsubAvail = subscribeEmployeeAvailability(setAvailabilityList);
    const unsubRules = subscribeCapacityRules(setCapacityRules);

    return () => {
      if (unsubEmp) unsubEmp();
      if (unsubWeeks) unsubWeeks();
      if (unsubAlloc) unsubAlloc();
      if (unsubAvail) unsubAvail();
      if (unsubRules) unsubRules();
    };
  }, [selectedWeekId]);

  const activeEmployees = employees.filter((e) => e.status !== 'inactive');
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];

  const workingDates = selectedWeek?.workingDates || [];
  const holidays = selectedWeek?.holidays || [];
  const holidayDateSet = new Set(holidays.map((h) => h.holidayDate || h.date));

  const handleExportMatrixExcel = () => {
    if (!selectedWeek || activeEmployees.length === 0) {
      error('No matrix data available to export.');
      return;
    }

    exportMatrixReport({
      week: selectedWeek,
      activeEmployees,
      allocations,
      availabilityList,
      holidays,
    });
    success('Color-coded Excel matrix heatmap downloaded successfully!');
  };

  return (
    <AppLayout
      title="Workload Heatmap Matrix"
      subtitle="Visual grid of employee capacity and daily distribution across selected work week dates"
    >
      <div className="space-y-6 bg-white">
        {/* Week Selector Bar with Animated Download Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Matrix Week:
            </span>
            <div className="w-64">
              <Select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={weeks.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${w.startDate})`,
                }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DownloadExcelButton
              onExport={handleExportMatrixExcel}
              label="Download Matrix (Excel)"
              size="sm"
            />
          </div>
        </div>

        {/* Matrix Card */}
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : activeEmployees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Active Employees"
            description="Add active employees to visualize the matrix."
          />
        ) : !selectedWeek || workingDates.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No Working Dates"
            description="Configure working dates for this week in the Calendar section."
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-6 min-w-[200px]">Employee</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Role</th>
                    {workingDates.map((dateStr) => {
                      const isHoliday = holidayDateSet.has(dateStr);
                      const { dayName, formatted } = formatDayHeader(dateStr);

                      return (
                        <th
                          key={dateStr}
                          className={`py-3.5 px-4 text-center min-w-[140px] ${
                            isHoliday ? 'bg-amber-100/70 text-amber-950 font-bold' : ''
                          }`}
                        >
                          <span className="font-extrabold text-xs text-slate-900 block">{dayName}</span>
                          <p className="font-mono text-[11px] text-slate-600 font-semibold">{formatted}</p>
                          {isHoliday && <span className="text-[10px] text-amber-900 font-extrabold block">Holiday</span>}
                        </th>
                      );
                    })}
                    <th className="py-3.5 px-6 text-right min-w-[140px]">Week Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeEmployees.map((emp) => {
                    const empAllocations = allocations.filter(
                      (a) => a.employeeId === emp.id && a.weekId === selectedWeek.id
                    );

                    let totalPosts = 0;
                    let totalReels = 0;
                    let totalStories = 0;
                    let totalUnitsUsed = 0;

                    empAllocations.forEach((a) => {
                      totalPosts += Number(a.work?.posts) || 0;
                      totalReels += Number(a.work?.reels) || 0;
                      totalStories += Number(a.work?.stories) || 0;
                      totalUnitsUsed += Number(a.capacityUsed) || 0;
                    });

                    const dailyBaseCap = calculateDailyEmployeeCapacity(emp, capacityRules);
                    const { effectiveWorkingDates } = getEffectiveWorkingDays(selectedWeek, holidays);
                    const empWeekCap = calculateWeeklyEmployeeCapacity(emp, capacityRules, effectiveWorkingDates, availabilityList);

                    const weekUtilization = calculateUtilization(totalUnitsUsed, empWeekCap.weeklyCapacityUnits);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          <p>{emp.name}</p>
                          <p className="text-[11px] font-mono text-slate-500 font-semibold">{emp.employeeCode}</p>
                        </td>

                        <td className="py-4 px-4">
                          <Badge role={emp.role} size="sm" />
                        </td>

                        {/* Working Date Columns */}
                        {workingDates.map((dateStr) => {
                          const isHoliday = holidayDateSet.has(dateStr);
                          const avail = availabilityList.find(
                            (a) => a.employeeId === emp.id && normalizeDate(a.date) === dateStr
                          );

                          if (isHoliday) {
                            return (
                              <td key={dateStr} className="py-4 px-4 text-center bg-amber-50">
                                <span className="text-xs font-bold text-amber-800">
                                  🏖️ Holiday
                                </span>
                              </td>
                            );
                          }

                          if (avail && avail.availability === AVAILABILITY_TYPES.LEAVE) {
                            return (
                              <td key={dateStr} className="py-4 px-4 text-center bg-rose-50">
                                <span className="text-xs font-bold text-rose-700">
                                  🌴 Leave (0x)
                                </span>
                              </td>
                            );
                          }

                          if (avail && avail.availability === AVAILABILITY_TYPES.HALF_DAY) {
                            return (
                              <td key={dateStr} className="py-4 px-4 text-center bg-amber-50">
                                <span className="text-xs font-bold text-amber-700">
                                  ⏳ Half Day (0.5x)
                                </span>
                              </td>
                            );
                          }

                          // Active Working Day Cell
                          return (
                            <td key={dateStr} className="py-4 px-4 text-center">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-xs font-extrabold text-slate-900">
                                  {weekUtilization}%
                                </span>
                                <p className="text-[10px] text-slate-600 mt-0.5 font-bold">
                                  {dailyBaseCap} Units/Day
                                </p>
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-4 px-6 text-right">
                          <div>
                            <span className="text-sm font-extrabold text-slate-900">
                              {weekUtilization}%
                            </span>
                            <p className="text-[11px] text-slate-600 font-bold">
                              {totalUnitsUsed} / {empWeekCap.weeklyCapacityUnits} Units
                            </p>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
