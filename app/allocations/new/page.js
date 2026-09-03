'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Select from '@/components/common/Select';
import Badge from '@/components/common/Badge';
import ProgressBar from '@/components/common/ProgressBar';
import Modal from '@/components/common/Modal';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import AgencyMatrixGrid from '@/components/common/AgencyMatrixGrid';
import DailyScheduleTimetable from '@/components/common/DailyScheduleTimetable';
import { SkeletonCard, SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ConfirmModal from '@/components/common/ConfirmModal';
import { useToast } from '@/contexts/ToastContext';
import { generateWeeklyAllocation, generateMonthlyAllocation } from '@/lib/allocationEngine';
import { getClients } from '@/services/clientService';
import { getEmployees } from '@/services/employeeService';
import { getCapacityRules } from '@/services/capacityService';
import { getWorkWeeks } from '@/services/weekService';
import { getWorkRequirements, createWorkRequirement } from '@/services/requirementService';
import { getEmployeeAvailability } from '@/services/availabilityService';
import {
  checkExistingAllocations,
  commitWeeklyAllocation,
  clearWeeklyAllocations,
  checkExistingMonthlyAllocations,
  commitMonthlyAllocation,
  clearMonthlyAllocations
} from '@/services/allocationService';
import { groupWeeksByMonth, getActiveMonth } from '@/lib/monthUtils';
import { exportAllocationReport } from '@/lib/exportExcel';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  RotateCcw,
  Calendar,
  Building2,
  Users,
  ShieldCheck,
  Check,
  X,
  FileSpreadsheet,
  Table,
  Clock,
  List,
  Layers,
  Trash2
} from 'lucide-react';
import { ROLES, ROLE_LABELS, CONTENT_TYPES } from '@/lib/constants';

const DEFAULT_AGENCY_CLIENTS = [
  { id: 'c1', name: 'ACTION CAR DETAILING', posts: 2, reels: 2, stories: 1 },
  { id: 'c2', name: 'CHUTNEY HOUSE', posts: 2, reels: 2, stories: 2 },
  { id: 'c3', name: 'DND', posts: 3, reels: 1, stories: 2 },
  { id: 'c4', name: 'DIVINE DWELLING', posts: 2, reels: 1, stories: 1 },
  { id: 'c5', name: 'DEVINE STUDIO', posts: 2, reels: 1, stories: 1 },
  { id: 'c6', name: 'ISHA INTERNATIONAL', posts: 3, reels: 2, stories: 1 },
  { id: 'c7', name: 'BALAJI EV', posts: 1, reels: 2, stories: 2 },
  { id: 'c8', name: 'KC CROSSROAD', posts: 2, reels: 1, stories: 2 },
  { id: 'c9', name: 'THE RADIANT MANALI', posts: 2, reels: 1, stories: 2 },
  { id: 'c10', name: 'OREN KASAULI', posts: 2, reels: 2, stories: 2 },
  { id: 'c11', name: 'CELESTIAL TRADER', posts: 1, reels: 2, stories: 1 },
  { id: 'c12', name: 'TSS', posts: 3, reels: 1, stories: 2 },
];

export default function NewAllocationPage() {
  const [allocationScope, setAllocationScope] = useState('week'); // 'week' | 'month'
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [months, setMonths] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewTab, setPreviewTab] = useState('matrix'); // 'matrix' | 'schedule' | 'surplus'
  const [activeWeekSubTab, setActiveWeekSubTab] = useState('0');

  // Engine Output State
  const [allocationResult, setAllocationResult] = useState(null);

  // Duplicate Existing Allocation State
  const [existingAllocations, setExistingAllocations] = useState([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Clear Old Table Modal
  const [isClearOldTableModalOpen, setIsClearOldTableModalOpen] = useState(false);
  const [isClearingOldTable, setIsClearingOldTable] = useState(false);

  const { success, error, warning } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function loadMasters() {
      try {
        const [cls, emps, rules, wks, reqs, avails] = await Promise.all([
          getClients(),
          getEmployees(),
          getCapacityRules(),
          getWorkWeeks(),
          getWorkRequirements(),
          getEmployeeAvailability(),
        ]);

        setClients(cls || []);
        setEmployees(emps || []);
        setCapacityRules(rules || []);
        setWeeks(wks || []);
        setRequirements(reqs || []);
        setAvailabilityList(avails || []);

        const activeWk = (wks || []).find((w) => w.status === 'active') || (wks || [])[0];
        if (activeWk) {
          setSelectedWeekId(activeWk.id);
        }

        const groupedMonths = groupWeeksByMonth(wks || []);
        setMonths(groupedMonths);
        const activeM = getActiveMonth(wks || []);
        if (activeM) {
          setSelectedMonthKey(activeM.monthKey);
        } else if (groupedMonths[0]) {
          setSelectedMonthKey(groupedMonths[0].monthKey);
        }
      } catch (err) {
        console.error('Error loading masters for allocation:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, []);

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];
  const selectedMonthData = months.find((m) => m.monthKey === selectedMonthKey) || months[0];

  const handleRunAllocation = async () => {
    setCalculating(true);
    try {
      const activeClients = clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS;

      if (allocationScope === 'week') {
        if (!selectedWeekId) {
          error('Please select a Work Week.');
          return;
        }

        let weekReqs = requirements.filter((r) => r.weekId === selectedWeekId);

        // Auto-generate default client requirements if none exist yet for this week
        if (weekReqs.length === 0) {
          const generatedReqs = [];
          for (const c of activeClients) {
            const defaultData = DEFAULT_AGENCY_CLIENTS.find((d) => d.name === c.name) || { posts: 2, reels: 1, stories: 1 };
            const payload = {
              clientId: c.id,
              clientName: c.name,
              weekId: selectedWeekId,
              requirements: {
                posts: defaultData.posts,
                reels: defaultData.reels,
                stories: defaultData.stories,
              },
            };
            try {
              const saved = await createWorkRequirement(payload);
              generatedReqs.push(saved);
            } catch (e) {
              generatedReqs.push({ ...payload, id: `temp_${c.id}` });
            }
          }
          weekReqs = generatedReqs;
          setRequirements((prev) => [...prev, ...generatedReqs]);
        }

        // Check if duplicate allocation exists
        const existing = await checkExistingAllocations(selectedWeekId);
        setExistingAllocations(existing);
        if (existing.length > 0) {
          setIsDuplicateModalOpen(true);
        }

        // Execute Pure Engine in Memory for selected week
        const result = generateWeeklyAllocation({
          workWeek: selectedWeek,
          clients: activeClients,
          employees,
          capacityRules,
          workRequirements: weekReqs,
          holidays: selectedWeek?.holidays || [],
          availabilityList,
          existingAllocations: [],
        });

        setAllocationResult(result);
        setPreviewTab('matrix');

        if (result.validation?.passed) {
          success(`Week Allocation calculated for ${selectedWeek?.name} (${selectedWeek?.calculatedWorkingDays || 5} working days)!`);
        } else {
          error('Allocation calculation finished with warnings. Review surplus items.', 'Notice');
        }
      } else {
        // Month Scope
        if (!selectedMonthKey) {
          error('Please select a Target Month.');
          return;
        }

        const targetWeeks = selectedMonthData?.weeks || [];
        let allReqs = [...requirements];

        const generatedReqs = [];
        for (const wk of targetWeeks) {
          const wkReqs = allReqs.filter((r) => r.weekId === wk.id);
          if (wkReqs.length === 0) {
            for (const c of activeClients) {
              const defaultData = DEFAULT_AGENCY_CLIENTS.find((d) => d.name === c.name) || { posts: 2, reels: 1, stories: 1 };
              const payload = {
                clientId: c.id,
                clientName: c.name,
                weekId: wk.id,
                monthKey: selectedMonthKey,
                requirements: {
                  posts: defaultData.posts,
                  reels: defaultData.reels,
                  stories: defaultData.stories,
                },
              };
              try {
                const saved = await createWorkRequirement(payload);
                generatedReqs.push(saved);
              } catch (e) {
                generatedReqs.push({ ...payload, id: `temp_${c.id}_${wk.id}` });
              }
            }
          }
        }

        if (generatedReqs.length > 0) {
          allReqs = [...allReqs, ...generatedReqs];
          setRequirements(allReqs);
        }

        const existing = await checkExistingMonthlyAllocations(selectedMonthKey);
        setExistingAllocations(existing);
        if (existing.length > 0) {
          setIsDuplicateModalOpen(true);
        }

        const result = generateMonthlyAllocation({
          monthKey: selectedMonthKey,
          workWeeks: targetWeeks,
          clients: activeClients,
          employees,
          capacityRules,
          workRequirements: allReqs,
          holidays: [],
          availabilityList,
          existingAllocations: [],
        });

        setAllocationResult(result);
        setPreviewTab('matrix');

        if (result.validation?.invariantSatisfied) {
          success(`Full Month Allocation calculated for ${selectedMonthData?.monthLabel || selectedMonthKey}!`);
        } else {
          error('Month allocation finished with warnings.', 'Notice');
        }
      }
    } catch (err) {
      console.error('Error running allocation:', err);
      error(err.message || 'Allocation calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmCommit = async () => {
    if (!allocationResult) return;
    setCommitting(true);
    try {
      if (allocationScope === 'week') {
        const res = await commitWeeklyAllocation({
          weekId: selectedWeekId,
          allocations: allocationResult.allocations,
          surplus: allocationResult.surplus,
          recalculate: true,
        });
        success(`Successfully saved ${res.allocatedCount} allocations and ${res.surplusCount} surplus items for ${selectedWeek?.name}!`, 'Week Saved');
      } else {
        const res = await commitMonthlyAllocation({
          monthKey: selectedMonthKey,
          allocations: allocationResult.allocations,
          surplus: allocationResult.surplus,
        });
        success(`Successfully saved ${res.allocatedCount} monthly allocations for ${selectedMonthData?.monthLabel}!`, 'Month Saved');
      }
      router.push('/allocations');
    } catch (err) {
      console.error('Error committing allocation:', err);
      error('Failed to commit allocation.');
    } finally {
      setCommitting(false);
      setIsDuplicateModalOpen(false);
    }
  };

  const handleClearOldTable = async () => {
    setIsClearingOldTable(true);
    try {
      if (allocationScope === 'week') {
        const res = await clearWeeklyAllocations({
          weekId: selectedWeekId,
          clearSurplus: true,
        });
        success(`Removed previous allocation table (${res.deletedAllocCount} assignments) for ${selectedWeek?.name || 'Selected Week'}!`, 'Table Removed');
      } else {
        const res = await clearMonthlyAllocations({
          monthKey: selectedMonthKey,
          clearSurplus: true,
        });
        success(`Removed previous allocation table (${res.deletedAllocCount} assignments) for ${selectedMonthData?.monthLabel}!`, 'Table Removed');
      }
      setAllocationResult(null);
      setIsClearOldTableModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to clear old allocation table.');
    } finally {
      setIsClearingOldTable(false);
    }
  };

  const handleExportPreviewExcel = () => {
    if (!allocationResult) return;
    exportAllocationReport({
      week: allocationScope === 'week' ? selectedWeek : { name: selectedMonthData?.monthLabel || 'Full Month' },
      monthLabel: selectedMonthData?.monthLabel,
      isMonthly: allocationScope === 'month',
      allocations: allocationResult.allocations,
      clients: clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS,
      employees,
    });
    success('Preview Excel matrix downloaded successfully!');
  };

  return (
    <AppLayout
      title="Auto Work Allocation Generator"
      subtitle="Run deterministic fair workload distribution across graphic designers and video editors for your created work weeks"
    >
      <div className="space-y-6 bg-white">
        {/* Scope Selector Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Deterministic Work Allocation Engine</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {allocationScope === 'week' ? 'Week-Wise Auto Allocation' : 'Month-Wise Auto Allocation'}
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                {allocationScope === 'week'
                  ? 'Select your created calendar work week to distribute client deliverables (Posts, Reels, Stories) accurately according to daily capacities and working days.'
                  : 'Select an operational month to distribute workload across all its constituent calendar weeks.'}
              </p>
            </div>

            {/* Scope Switcher & Target Dropdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Allocation Mode Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setAllocationScope('week');
                    setAllocationResult(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    allocationScope === 'week'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Week-Wise</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAllocationScope('month');
                    setAllocationResult(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                    allocationScope === 'month'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Month-Wise</span>
                </button>
              </div>

              {/* Target Selector */}
              {allocationScope === 'week' ? (
                <div className="w-full sm:w-72">
                  <Select
                    label="Select Created Work Week"
                    value={selectedWeekId}
                    onChange={(e) => {
                      setSelectedWeekId(e.target.value);
                      setAllocationResult(null);
                    }}
                    options={weeks.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.startDate} to ${w.endDate} • ${w.calculatedWorkingDays || 5} Days)`,
                    }))}
                  />
                </div>
              ) : (
                <div className="w-full sm:w-72">
                  <Select
                    label="Select Operational Month"
                    value={selectedMonthKey}
                    onChange={(e) => {
                      setSelectedMonthKey(e.target.value);
                      setAllocationResult(null);
                    }}
                    options={months.map((m) => ({
                      value: m.monthKey,
                      label: `${m.monthLabel} (${m.weeks.length} Weeks • ${m.totalCalculatedWorkingDays} Days)`,
                    }))}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 sm:pt-5">
                <Button
                  variant="secondary"
                  size="md"
                  icon={Trash2}
                  onClick={() => setIsClearOldTableModalOpen(true)}
                  disabled={loading}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border-rose-200 font-bold"
                >
                  Remove Old Table
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  icon={Sparkles}
                  onClick={handleRunAllocation}
                  isLoading={calculating}
                  disabled={loading || (allocationScope === 'week' ? weeks.length === 0 : months.length === 0)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
                >
                  {allocationResult ? 'Re-Run Allocation' : 'Run Auto Allocation'}
                </Button>
              </div>
            </div>
          </div>

          {/* Week / Month Details Overview Badges */}
          {allocationScope === 'week' && selectedWeek && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Target Work Week</span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{selectedWeek.name}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calendar Period</span>
                <span className="text-xs font-extrabold text-indigo-700 mt-1 block">{selectedWeek.startDate} to {selectedWeek.endDate}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Effective Working Days</span>
                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">{selectedWeek.calculatedWorkingDays || 5} Days</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Configured Holidays</span>
                <span className="text-sm font-extrabold text-amber-700 mt-0.5 block">{(selectedWeek.holidays || []).length} Days Off</span>
              </div>
            </div>
          )}

          {allocationScope === 'month' && selectedMonthData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Month Period</span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{selectedMonthData.monthLabel}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calendar Weeks</span>
                <span className="text-sm font-extrabold text-indigo-700 mt-0.5 block">{selectedMonthData.weeks.length} Weeks</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Working Days</span>
                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">{selectedMonthData.totalCalculatedWorkingDays} Days</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Month Status</span>
                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">Ready</span>
              </div>
            </div>
          )}
        </div>

        {/* Output Preview Area */}
        {allocationResult && (
          <div className="space-y-6 animate-fade-in">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-extrabold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    {allocationScope === 'week' ? `${selectedWeek?.name} Allocation Calculated` : `${selectedMonthData?.monthLabel} Plan Ready`}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {allocationResult.allocations.length} total staff assignments • {allocationResult.surplus.length} surplus items
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <DownloadExcelButton
                  onExport={handleExportPreviewExcel}
                  label="Download Matrix (Excel)"
                  size="sm"
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={ShieldCheck}
                  onClick={handleConfirmCommit}
                  isLoading={committing}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold"
                >
                  Commit Allocation to System
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewTab('matrix')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  previewTab === 'matrix'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>1. Allocation Matrix Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('schedule')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  previewTab === 'schedule'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>2. Day-Wise Timetables</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('surplus')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  previewTab === 'surplus'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>3. Surplus & Capacities ({allocationResult.surplus.length})</span>
              </button>
            </div>

            {/* TAB 1: MATRIX GRID */}
            {previewTab === 'matrix' && (
              <AgencyMatrixGrid
                week={allocationScope === 'week' ? selectedWeek : null}
                monthLabel={allocationScope === 'month' ? selectedMonthData?.monthLabel : null}
                title={
                  allocationScope === 'week'
                    ? `${selectedWeek?.name?.toUpperCase()} (${selectedWeek?.startDate} TO ${selectedWeek?.endDate})`
                    : `${selectedMonthData?.monthLabel?.toUpperCase()} • FULL MONTH ALLOCATION MATRIX`
                }
                isMonthly={allocationScope === 'month'}
                clients={clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS}
                employees={employees}
                allocations={allocationResult.allocations}
              />
            )}

            {/* TAB 2: DAILY SCHEDULE TIMETABLE */}
            {previewTab === 'schedule' && (
              <div className="space-y-6">
                {allocationScope === 'week' ? (
                  <Card>
                    <CardHeader
                      title={`${selectedWeek?.name} Daily Schedule Timetable (${selectedWeek?.startDate} to ${selectedWeek?.endDate})`}
                      subtitle={`Day-wise staff task distribution across ${selectedWeek?.calculatedWorkingDays || 5} effective working days`}
                    />
                    <DailyScheduleTimetable
                      workWeek={selectedWeek}
                      dailySchedules={allocationResult.dailySchedules || []}
                      employees={employees}
                    />
                  </Card>
                ) : (
                  (allocationResult.weeklyBreakdowns || []).map((wb) => (
                    <Card key={wb.weekId}>
                      <CardHeader
                        title={`${wb.weekName} Daily Timetable (${wb.week?.startDate} to ${wb.week?.endDate})`}
                        subtitle="Day-wise staff task distribution"
                      />
                      <DailyScheduleTimetable
                        workWeek={wb.week}
                        dailySchedules={wb.dailySchedules}
                        employees={employees}
                      />
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* TAB 3: SURPLUS & CAPACITIES */}
            {previewTab === 'surplus' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Capacity */}
                <Card>
                  <CardHeader
                    title="Team Capacity Utilization"
                    subtitle="Calculated units vs assigned workload"
                  />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Graphic Design Team</span>
                        <span>
                          {allocationResult.teamCapacity?.graphic?.usedUnits || 0} / {allocationResult.teamCapacity?.graphic?.totalUnits || 0} Units ({allocationResult.teamCapacity?.graphic?.utilization || 0}%)
                        </span>
                      </div>
                      <ProgressBar percentage={allocationResult.teamCapacity?.graphic?.utilization || 0} size="md" />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Video Editing Team</span>
                        <span>
                          {allocationResult.teamCapacity?.video?.usedUnits || 0} / {allocationResult.teamCapacity?.video?.totalUnits || 0} Units ({allocationResult.teamCapacity?.video?.utilization || 0}%)
                        </span>
                      </div>
                      <ProgressBar percentage={allocationResult.teamCapacity?.video?.utilization || 0} size="md" />
                    </div>
                  </div>
                </Card>

                {/* Surplus List */}
                <Card>
                  <CardHeader
                    title={`Surplus Deliverables (${allocationResult.surplus.length})`}
                    subtitle="Deliverables exceeding staff weekly capacity limits"
                  />
                  {allocationResult.surplus.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {allocationResult.surplus.map((s, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-900">{s.clientName || 'Client'}</span>
                            <span className="text-rose-700 font-bold ml-2">
                              {s.quantity} {s.contentType?.toUpperCase()}
                            </span>
                          </div>
                          <Badge variant="danger" size="sm">Surplus</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      <span className="font-bold text-slate-900">Zero Surplus</span>
                      <span>All deliverables accommodated within staff capacities.</span>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Remove Old Table Confirmation Modal */}
        <ConfirmModal
          isOpen={isClearOldTableModalOpen}
          onClose={() => !isClearingOldTable && setIsClearOldTableModalOpen(false)}
          onConfirm={handleClearOldTable}
          title={
            allocationScope === 'week'
              ? `Remove Previous Allocation Table for ${selectedWeek?.name || 'Selected Week'}`
              : `Remove Previous Allocation Table for ${selectedMonthData?.monthLabel || 'Selected Month'}`
          }
          message={`Are you sure you want to remove and clear all previous allocation records and surplus items for ${
            allocationScope === 'week' ? selectedWeek?.name : selectedMonthData?.monthLabel
          }? This will delete the old table so you can generate a fresh allocation.`}
          confirmText="Remove Old Table"
          variant="danger"
          isLoading={isClearingOldTable}
        />

        {/* Existing Overwrite Confirmation Modal */}
        <Modal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          title="Existing Allocation Records Detected"
          subtitle={`Previous committed allocations exist for ${allocationScope === 'week' ? selectedWeek?.name : selectedMonthData?.monthLabel}.`}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <p className="font-medium">
              Re-committing will overwrite previous assignments with the newly calculated optimal plan.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsDuplicateModalOpen(false)}>
                Review Preview
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmCommit}
                isLoading={committing}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Overwrite & Commit
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
