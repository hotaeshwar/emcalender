'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Select from '@/components/common/Select';
import Badge from '@/components/common/Badge';
import ProgressBar from '@/components/common/ProgressBar';
import AgencyMatrixGrid from '@/components/common/AgencyMatrixGrid';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeClients } from '@/services/clientService';
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
  FileSpreadsheet,
  Layers,
  Table
} from 'lucide-react';
import { ROLES, AVAILABILITY_TYPES } from '@/lib/constants';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WorkloadMatrixPage() {
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'heatmap'
  const [loading, setLoading] = useState(true);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubEmp = subscribeEmployees((data) => {
      setEmployees(data || []);
      setLoading(false);
    });

    const unsubClients = subscribeClients(setClients);

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
      if (unsubClients) unsubClients();
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

  const filteredAllocations = selectedWeekId
    ? allocations.filter((a) => a.weekId === selectedWeekId)
    : allocations;

  const handleExportMatrixExcel = () => {
    if (!selectedWeek) {
      error('No matrix data available to export.');
      return;
    }

    exportMatrixReport({
      week: selectedWeek,
      activeEmployees,
      allocations: filteredAllocations,
      availabilityList,
      holidays,
      clients,
    });
    success('Color-coded Excel matrix downloaded in exact agency format!');
  };

  return (
    <AppLayout
      title="Bid Employee Work Distributer Matrix"
      subtitle="Client × Staff work distribution matrix and workload capacity heatmap"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar with Tabs & Download Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Select Week:
            </span>
            <div className="w-60">
              <Select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={weeks.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${w.startDate})`,
                }))}
              />
            </div>

            {/* View Mode Toggle Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'grid'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Matrix Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('heatmap')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  activeTab === 'heatmap'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Daily Heatmap</span>
              </button>
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

        {loading ? (
          <SkeletonTable rows={6} cols={7} />
        ) : activeTab === 'grid' ? (
          /* Exact Matrix Grid Format Matching User Image */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Distribution Schedule Matrix ({selectedWeek?.name || 'Active Week'})
              </span>
              <span className="text-xs text-slate-600 font-bold">
                {clients.length} Clients • {activeEmployees.length} Staff Members
              </span>
            </div>

            <AgencyMatrixGrid
              week={selectedWeek}
              clients={clients}
              employees={activeEmployees}
              allocations={filteredAllocations}
              dayName="MONDAY"
            />
          </div>
        ) : (
          /* Daily Heatmap View */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    <th className="py-3.5 px-6 min-w-[200px]">Employee</th>
                    <th className="py-3.5 px-4 min-w-[120px]">Role</th>
                    {workingDates.map((dateStr) => {
                      const isHoliday = holidayDateSet.has(dateStr);
                      return (
                        <th
                          key={dateStr}
                          className={`py-3.5 px-4 text-center min-w-[140px] ${
                            isHoliday ? 'bg-amber-100/70 text-amber-950 font-bold' : ''
                          }`}
                        >
                          <span className="font-black text-xs text-slate-900 block">{dateStr}</span>
                          {isHoliday && <span className="text-[10px] text-amber-900 font-extrabold block">Holiday</span>}
                        </th>
                      );
                    })}
                    <th className="py-3.5 px-6 text-right min-w-[140px]">Week Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeEmployees.map((emp) => {
                    const empAllocations = filteredAllocations.filter(
                      (a) => a.employeeId === emp.id
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
                          <p className="text-[11px] font-mono text-slate-500 font-bold">{emp.employeeCode}</p>
                        </td>

                        <td className="py-4 px-4">
                          <Badge role={emp.role} size="sm" />
                        </td>

                        {workingDates.map((dateStr) => {
                          const isHoliday = holidayDateSet.has(dateStr);
                          const avail = availabilityList.find(
                            (a) => a.employeeId === emp.id && normalizeDate(a.date) === dateStr
                          );

                          if (isHoliday) {
                            return (
                              <td key={dateStr} className="py-4 px-4 text-center bg-amber-50">
                                <span className="text-xs font-extrabold text-amber-900">🏖️ Holiday</span>
                              </td>
                            );
                          }

                          if (avail && avail.availability === AVAILABILITY_TYPES.LEAVE) {
                            return (
                              <td key={dateStr} className="py-4 px-4 text-center bg-rose-50">
                                <span className="text-xs font-extrabold text-rose-800">🌴 Leave (0x)</span>
                              </td>
                            );
                          }

                          return (
                            <td key={dateStr} className="py-4 px-4 text-center">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="text-xs font-black text-slate-900">{weekUtilization}%</span>
                                <p className="text-[10px] text-slate-600 font-bold">{dailyBaseCap} Units/Day</p>
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-4 px-6 text-right font-bold text-slate-900">
                          <div>
                            <span className="text-sm font-black">{weekUtilization}%</span>
                            <p className="text-[11px] text-slate-600 font-bold">{totalUnitsUsed} / {empWeekCap.weeklyCapacityUnits} Units</p>
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
