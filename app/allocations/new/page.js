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
import { useToast } from '@/contexts/ToastContext';
import { generateMonthlyAllocation, generateWeeklyAllocation } from '@/lib/allocationEngine';
import { getClients } from '@/services/clientService';
import { getEmployees } from '@/services/employeeService';
import { getCapacityRules } from '@/services/capacityService';
import { getWorkWeeks } from '@/services/weekService';
import { getWorkRequirements, createWorkRequirement } from '@/services/requirementService';
import { getEmployeeAvailability } from '@/services/availabilityService';
import {
  checkExistingMonthlyAllocations,
  commitMonthlyAllocation
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
  Layers
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
  const [months, setMonths] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('');
  const [weeks, setWeeks] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewTab, setPreviewTab] = useState('full_month'); // 'full_month' | 'weeks' | 'schedule' | 'surplus'
  const [activeWeekSubTab, setActiveWeekSubTab] = useState('0'); // index in weeklyBreakdowns

  // Engine Output State
  const [allocationResult, setAllocationResult] = useState(null);

  // Duplicate Existing Allocation State
  const [existingAllocations, setExistingAllocations] = useState([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

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

  const currentMonthData = months.find((m) => m.monthKey === selectedMonthKey) || months[0];
  const targetWeeks = currentMonthData?.weeks || [];

  const handleRunAllocation = async () => {
    if (!selectedMonthKey) {
      error('Please select a Target Month.');
      return;
    }

    setCalculating(true);
    try {
      const activeClients = clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS;
      let allReqs = [...requirements];

      // Auto-generate default client requirements for weeks in this month if missing
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

      // Check if duplicate allocation exists for this month
      const existing = await checkExistingMonthlyAllocations(selectedMonthKey);
      setExistingAllocations(existing);
      if (existing.length > 0) {
        setIsDuplicateModalOpen(true);
      }

      // Execute Month Engine in Memory
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
      setActiveWeekSubTab('0');

      if (result.validation?.invariantSatisfied) {
        success(`Full Month Allocation calculated for ${currentMonthData?.monthLabel || selectedMonthKey} across ${result.weeksCount} calendar weeks!`);
      } else {
        error('Allocation calculation finished with warnings. Please review surplus tasks.', 'Notice');
      }
    } catch (err) {
      console.error('Error running monthly allocation:', err);
      error(err.message || 'Monthly allocation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmCommit = async () => {
    if (!allocationResult) return;

    setCommitting(true);
    try {
      const res = await commitMonthlyAllocation({
        monthKey: selectedMonthKey,
        allocations: allocationResult.allocations,
        surplus: allocationResult.surplus,
      });

      success(`Successfully committed ${res.allocatedCount} monthly allocations and ${res.surplusCount} surplus records for ${currentMonthData?.monthLabel || selectedMonthKey}!`, 'Month Saved');
      router.push('/allocations');
    } catch (err) {
      console.error('Error committing monthly allocation:', err);
      error('Failed to commit monthly allocation.');
    } finally {
      setCommitting(false);
      setIsDuplicateModalOpen(false);
    }
  };

  const handleExportPreviewExcel = () => {
    if (!allocationResult) return;
    const currentWeekBreakdown = allocationResult.weeklyBreakdowns?.[parseInt(activeWeekSubTab, 10)] || null;
    const exportAllocations = previewTab === 'weeks' && currentWeekBreakdown
      ? currentWeekBreakdown.allocations
      : allocationResult.allocations;
    const exportWeek = previewTab === 'weeks' && currentWeekBreakdown
      ? currentWeekBreakdown.week
      : { name: currentMonthData?.monthLabel || 'Full Month' };

    exportAllocationReport({
      week: exportWeek,
      monthLabel: currentMonthData?.monthLabel,
      isMonthly: previewTab !== 'weeks',
      allocations: exportAllocations,
      clients: clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS,
      employees,
    });
    success('Preview Excel matrix downloaded successfully!');
  };

  return (
    <AppLayout
      title="Month-Wise Work Allocation Generator"
      subtitle="Run deterministic fair workload distribution across all calendar weeks of a month in 1 click"
    >
      <div className="space-y-6 bg-white">
        {/* Top Month Selector & Run Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-xs font-bold border border-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Month-Level Deterministic Engine</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Generate Month-Wise Allocation Plan
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                Select your operational month to distribute all client deliverables fairly across graphic designers and video editors for each calendar work week.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
              <div className="w-full sm:w-64">
                <Select
                  label="Target Month"
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

              <div className="sm:pt-5">
                <Button
                  variant="primary"
                  size="lg"
                  icon={Sparkles}
                  onClick={handleRunAllocation}
                  isLoading={calculating}
                  disabled={months.length === 0 || loading}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md"
                >
                  {allocationResult ? 'Re-Calculate Month' : 'Run Full Month Allocation'}
                </Button>
              </div>
            </div>
          </div>

          {/* Month Overview Badges */}
          {currentMonthData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Month Period</span>
                <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">{currentMonthData.monthLabel}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calendar Weeks</span>
                <span className="text-sm font-extrabold text-indigo-700 mt-0.5 block">{currentMonthData.weeks.length} Work Weeks</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Working Days</span>
                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">{currentMonthData.totalCalculatedWorkingDays} Effective Days</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Holidays</span>
                <span className="text-sm font-extrabold text-amber-700 mt-0.5 block">{currentMonthData.holidaysCount} Days Off</span>
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
                    {currentMonthData?.monthLabel} Plan Ready
                  </h4>
                  <p className="text-xs text-slate-300">
                    {allocationResult.allocations.length} total assignments • {allocationResult.surplus.length} surplus items
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
                  Commit Month Allocation
                </Button>
              </div>
            </div>

            {/* Preview Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPreviewTab('full_month')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  previewTab === 'full_month'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>1. Full Month Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('weeks')}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all ${
                  previewTab === 'weeks'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>2. Week-by-Week Breakdown</span>
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
                <span>3. Daily Timetables</span>
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
                <span>4. Surplus & Capacity ({allocationResult.surplus.length})</span>
              </button>
            </div>

            {/* Sub-Tabs for Week-by-Week View */}
            {previewTab === 'weeks' && (
              <div className="flex flex-wrap items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                <span className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider mr-2">
                  Select Work Week:
                </span>
                {allocationResult.weeklyBreakdowns.map((wb, idx) => (
                  <button
                    key={wb.weekId}
                    type="button"
                    onClick={() => setActiveWeekSubTab(String(idx))}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                      activeWeekSubTab === String(idx)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-100 hover:text-indigo-900'
                    }`}
                  >
                    {wb.weekName} ({wb.allocations.length} items)
                  </button>
                ))}
              </div>
            )}

            {/* TAB 1: FULL MONTH MATRIX */}
            {previewTab === 'full_month' && (
              <AgencyMatrixGrid
                monthLabel={currentMonthData?.monthLabel}
                title={`${currentMonthData?.monthLabel} • FULL MONTH COMBINED ALLOCATION MATRIX`}
                isMonthly={true}
                clients={clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS}
                employees={employees}
                allocations={allocationResult.allocations}
              />
            )}

            {/* TAB 2: WEEK-BY-WEEK BREAKDOWN */}
            {previewTab === 'weeks' && allocationResult.weeklyBreakdowns?.[parseInt(activeWeekSubTab, 10)] && (
              <AgencyMatrixGrid
                week={allocationResult.weeklyBreakdowns[parseInt(activeWeekSubTab, 10)].week}
                clients={clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS}
                employees={employees}
                allocations={allocationResult.weeklyBreakdowns[parseInt(activeWeekSubTab, 10)].allocations}
              />
            )}

            {/* TAB 3: DAILY SCHEDULE TIMETABLE */}
            {previewTab === 'schedule' && (
              <div className="space-y-6">
                {allocationResult.weeklyBreakdowns.map((wb) => (
                  <Card key={wb.weekId}>
                    <CardHeader
                      title={`${wb.weekName} Daily Timetable (${wb.week.startDate} to ${wb.week.endDate})`}
                      subtitle="Day-wise staff task distribution"
                    />
                    <DailyScheduleTimetable
                      workWeek={wb.week}
                      dailySchedules={wb.dailySchedules}
                      employees={employees}
                    />
                  </Card>
                ))}
              </div>
            )}

            {/* TAB 4: SURPLUS & CAPACITY */}
            {previewTab === 'surplus' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Team Capacity Gauges */}
                <Card>
                  <CardHeader
                    title="Monthly Team Capacity Utilization"
                    subtitle="Aggregated across all calendar weeks in this month"
                  />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Graphic Design Team</span>
                        <span>{allocationResult.teamCapacity.graphic.usedUnits} / {allocationResult.teamCapacity.graphic.totalUnits} Units ({allocationResult.teamCapacity.graphic.utilization}%)</span>
                      </div>
                      <ProgressBar percentage={allocationResult.teamCapacity.graphic.utilization} size="md" />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex justify-between text-xs font-bold">
                        <span>Video Editing Team</span>
                        <span>{allocationResult.teamCapacity.video.usedUnits} / {allocationResult.teamCapacity.video.totalUnits} Units ({allocationResult.teamCapacity.video.utilization}%)</span>
                      </div>
                      <ProgressBar percentage={allocationResult.teamCapacity.video.utilization} size="md" />
                    </div>
                  </div>
                </Card>

                {/* Surplus List */}
                <Card>
                  <CardHeader
                    title={`Surplus Deliverables (${allocationResult.surplus.length})`}
                    subtitle="Deliverables exceeding employee capacity limits"
                  />
                  {allocationResult.surplus.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {allocationResult.surplus.map((s, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-slate-900">{s.clientName || 'Client'}</span>
                            <span className="text-rose-700 font-bold ml-2">
                              {s.quantity} {s.contentType?.toUpperCase()} ({s.weekName || 'Week'})
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
                      <span>All monthly requirements accommodated within staff capacities.</span>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Existing Overwrite Confirmation Modal */}
        <Modal
          isOpen={isDuplicateModalOpen}
          onClose={() => setIsDuplicateModalOpen(false)}
          title="Existing Monthly Allocation Detected"
          subtitle={`The month of ${currentMonthData?.monthLabel || selectedMonthKey} already contains committed allocations.`}
        >
          <div className="space-y-4 text-xs text-slate-700">
            <p className="font-medium">
              Re-committing will overwrite previous automated assignments for this month with the newly calculated optimal plan.
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
