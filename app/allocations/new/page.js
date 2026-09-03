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
import { generateWeeklyAllocation } from '@/lib/allocationEngine';
import { getClients } from '@/services/clientService';
import { getEmployees } from '@/services/employeeService';
import { getCapacityRules } from '@/services/capacityService';
import { getWorkWeeks } from '@/services/weekService';
import { getWorkRequirements, createWorkRequirement } from '@/services/requirementService';
import { getEmployeeAvailability } from '@/services/availabilityService';
import {
  checkExistingAllocations,
  commitWeeklyAllocation
} from '@/services/allocationService';
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
  List
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
  const [weeks, setWeeks] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewTab, setPreviewTab] = useState('matrix'); // 'matrix' | 'schedule' | 'deliverables'

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

        const activeWk = (wks || []).find((w) => w.status === 'active') || (wks || [])[0];
        if (activeWk) {
          setSelectedWeekId(activeWk.id);
        }
      } catch (err) {
        console.error('Error loading masters for allocation:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMasters();
  }, []);

  const handleRunAllocation = async () => {
    if (!selectedWeekId) {
      error('Please select a Work Week.');
      return;
    }

    setCalculating(true);
    try {
      const selectedWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];
      let weekRequirements = requirements.filter((r) => r.weekId === selectedWeekId);

      // Auto-generate default client requirements if none exist yet for this week
      if (weekRequirements.length === 0) {
        const activeClients = clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS;
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
            const savedReq = await createWorkRequirement(payload);
            generatedReqs.push(savedReq);
          } catch (e) {
            generatedReqs.push({ ...payload, id: `temp_${c.id}` });
          }
        }

        weekRequirements = generatedReqs;
        setRequirements((prev) => [...prev, ...generatedReqs]);
      }

      // Check if duplicate allocation exists
      const existing = await checkExistingAllocations(selectedWeekId);
      setExistingAllocations(existing);

      if (existing.length > 0) {
        setIsDuplicateModalOpen(true);
      }

      // Execute Pure Engine in Memory
      const result = generateWeeklyAllocation({
        workWeek: selectedWeek,
        clients: clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS,
        employees,
        capacityRules,
        workRequirements: weekRequirements,
        holidays: selectedWeek?.holidays || [],
        availabilityList,
        existingAllocations: [],
      });

      setAllocationResult(result);

      if (result.validation.passed) {
        success('Work allocation calculated successfully with mathematical invariant verification!');
      } else {
        error('Allocation invariant failed! Please review details.', 'Validation Error');
      }
    } catch (err) {
      console.error('Error running allocation:', err);
      error(err.message || 'Allocation calculation failed.');
    } finally {
      setCalculating(false);
    }
  };

  const handleConfirmCommit = async (recalculate = false) => {
    if (!allocationResult) return;
    if (!allocationResult.validation.passed) {
      error('Cannot commit an invalid allocation where Requested !== Allocated + Surplus.');
      return;
    }

    setCommitting(true);
    try {
      const res = await commitWeeklyAllocation({
        weekId: selectedWeekId,
        allocations: allocationResult.allocations,
        surplus: allocationResult.surplus,
        recalculate: recalculate || existingAllocations.length > 0,
      });

      success(`Successfully committed ${res.allocationCount} allocations and recorded ${res.surplusCount} surplus items!`, 'Allocation Saved');
      router.push('/allocations');
    } catch (err) {
      console.error('Error committing allocation:', err);
      error('Failed to commit allocation. Please try again.');
    } finally {
      setCommitting(false);
      setIsDuplicateModalOpen(false);
    }
  };

  const handleDownloadExcelPreview = () => {
    if (!allocationResult) return;
    exportAllocationReport({
      week: selectedWeek,
      allocations: allocationResult.allocations,
      surplus: allocationResult.surplus,
      clients,
      employees,
    });
    success('Color-coded Excel allocation preview downloaded successfully!');
  };

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId);
  const weekReqsCount = requirements.filter((r) => r.weekId === selectedWeekId).length;

  return (
    <AppLayout
      title="Automatic Work Allocation"
      subtitle="Pure, balanced, capacity-weighted allocation engine with live interactive preview"
    >
      <div className="space-y-6 bg-white">
        {/* Step 1: Configuration Card */}
        <Card>
          <CardHeader
            title="1. Select Operational Work Week"
            subtitle="Choose target week to allocate client deliverables across available designers and editors"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4">
            <div className="flex-1 max-w-md">
              <Select
                label="Target Work Week"
                value={selectedWeekId}
                onChange={(e) => {
                  setSelectedWeekId(e.target.value);
                  setAllocationResult(null);
                }}
                options={weeks.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${w.startDate} to ${w.endDate} - ${w.calculatedWorkingDays || 5} working days)`,
                }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-700 font-medium">
                <span className="font-extrabold text-slate-900">{weekReqsCount || 12}</span> Client Requirements Ready
              </div>

              <Button
                variant="primary"
                size="md"
                icon={Sparkles}
                onClick={handleRunAllocation}
                isLoading={calculating}
                disabled={!selectedWeekId}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm"
              >
                Generate Allocation Preview
              </Button>
            </div>
          </div>
        </Card>

        {/* Step 2: Allocation Preview */}
        {calculating ? (
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonTable rows={4} cols={6} />
          </div>
        ) : allocationResult ? (
          <div className="space-y-6 animate-fade-in">
            {/* Validation Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              allocationResult.validation.passed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  allocationResult.validation.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {allocationResult.validation.passed ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-extrabold">
                    {allocationResult.validation.passed
                      ? 'Mathematical Invariant Verified: Requested = Allocated + Surplus'
                      : 'Mathematical Invariant Check Failed'}
                  </h4>
                  <p className="text-xs text-slate-700 mt-0.5">
                    Every requested deliverable is strictly accounted for without loss or artificial inflation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DownloadExcelButton
                  onExport={handleDownloadExcelPreview}
                  label="Download Excel"
                  size="sm"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={handleRunAllocation}
                  className="font-bold"
                >
                  Recalculate
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  onClick={() => handleConfirmCommit(false)}
                  isLoading={committing}
                  disabled={!allocationResult.validation.passed}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm & Save
                </Button>
              </div>
            </div>

            {/* Warnings Section */}
            {allocationResult.warnings.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Allocation Intelligence Warnings ({allocationResult.warnings.length}):</span>
                </div>
                <ul className="space-y-1 pl-6 list-disc text-xs text-amber-800">
                  {allocationResult.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* View Switcher Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewTab('matrix')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    previewTab === 'matrix'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>1. Agency Matrix Grid View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('schedule')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    previewTab === 'schedule'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>2. Day-Wise Production Schedule (Mon–Sat)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('deliverables')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                    previewTab === 'deliverables'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>3. Work Units & Surplus List</span>
                </button>
              </div>

              <div className="text-xs text-slate-600 font-bold">
                {allocationResult.allocations.length} Client Allocations • {allocationResult.surplus.reduce((s, x) => s + x.quantity, 0)} Surplus Units
              </div>
            </div>

            {/* TAB 1: EXACT AGENCY MATRIX GRID VIEW */}
            {previewTab === 'matrix' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Agency Work Distribution Matrix ({selectedWeek?.name || 'Active Week'})
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    {(clients.length > 0 ? clients : DEFAULT_AGENCY_CLIENTS).length} Clients • {employees.length} Staff Members
                  </span>
                </div>

                <AgencyMatrixGrid
                  week={selectedWeek}
                  clients={clients}
                  employees={employees}
                  allocations={allocationResult.allocations}
                />
              </div>
            )}

            {/* TAB 2: DAY-WISE DAILY PRODUCTION SCHEDULE */}
            {previewTab === 'schedule' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Day-by-Day Production Timetable ({selectedWeek?.name || 'Active Week'})
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    Monday to Saturday Deliverable Flow
                  </span>
                </div>

                <DailyScheduleTimetable
                  dailySchedules={allocationResult.dailySchedules}
                  workWeek={selectedWeek}
                  employees={employees}
                  clients={clients}
                />
              </div>
            )}

            {/* TAB 3: DELIVERABLES BREAKDOWN & SURPLUS */}
            {previewTab === 'deliverables' && (
              <div className="space-y-6">
                {/* Employee Utilization Overview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.values(allocationResult.employeeUtilization).map((emp) => (
                    <Card key={emp.empId} className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">
                            {emp.name}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-500 font-semibold">
                            {emp.code} • {emp.effectiveWorkingDays} Working Days
                          </p>
                        </div>
                        <Badge role={emp.role} size="sm" />
                      </div>

                      <ProgressBar
                        percentage={emp.utilizationPercentage}
                        usedUnits={emp.usedCapacityUnits}
                        totalUnits={emp.totalCapacityUnits}
                        size="md"
                      />

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Assigned:</span>
                        <span className="font-bold text-slate-900">
                          {emp.assignedWork.posts} Posts, {emp.assignedWork.reels} Reels, {emp.assignedWork.stories} Stories
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Allocated Deliverables Table */}
                <Card>
                  <CardHeader
                    title="Allocated Work Deliverables"
                    subtitle="Fair balanced distribution among eligible employees"
                    action={
                      <span className="text-xs font-bold text-indigo-700">
                        {allocationResult.allocations.length} Active Assignments
                      </span>
                    }
                  />

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3.5 px-5">Client</th>
                          <th className="py-3.5 px-5">Assigned Employee</th>
                          <th className="py-3.5 px-4">Role</th>
                          <th className="py-3.5 px-4 text-center">Posts</th>
                          <th className="py-3.5 px-4 text-center">Reels</th>
                          <th className="py-3.5 px-4 text-center">Stories</th>
                          <th className="py-3.5 px-5 text-center">Effort Units</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {allocationResult.allocations.map((alloc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              {alloc.clientName || clients.find((c) => c.id === alloc.clientId)?.name || alloc.clientId}
                            </td>
                            <td className="py-3.5 px-5 font-bold text-slate-900">
                              {alloc.employeeName} ({alloc.employeeCode})
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge role={alloc.employeeRole} size="sm" />
                            </td>
                            <td className="py-3.5 px-4 text-center font-extrabold text-blue-700">
                              {alloc.work.posts}
                            </td>
                            <td className="py-3.5 px-4 text-center font-extrabold text-purple-700">
                              {alloc.work.reels}
                            </td>
                            <td className="py-3.5 px-4 text-center font-extrabold text-amber-700">
                              {alloc.work.stories}
                            </td>
                            <td className="py-3.5 px-5 text-center font-extrabold text-indigo-700 bg-indigo-50/40">
                              {alloc.capacityUsed} Units
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Surplus Work Detected Section */}
                {allocationResult.surplus.length > 0 && (
                  <Card className="border-rose-200 bg-rose-50/40">
                    <CardHeader
                      title="Surplus Deliverables (Exceeding Capacity)"
                      subtitle="These items could not be allocated automatically and will be logged in Surplus Work"
                      action={
                        <Badge variant="danger" size="sm">
                          {allocationResult.surplus.reduce((s, x) => s + x.quantity, 0)} Surplus Items
                        </Badge>
                      }
                    />

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-rose-100/60 border-b border-rose-200 text-[11px] font-bold text-rose-900 uppercase tracking-wider">
                            <th className="py-3.5 px-5">Client</th>
                            <th className="py-3.5 px-4">Content Type</th>
                            <th className="py-3.5 px-4">Required Role</th>
                            <th className="py-3.5 px-4 text-center">Surplus Quantity</th>
                            <th className="py-3.5 px-5">Surplus Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-100 text-sm">
                          {allocationResult.surplus.map((s, idx) => (
                            <tr key={idx}>
                              <td className="py-3.5 px-5 font-bold text-slate-900">
                                {s.clientName || clients.find((c) => c.id === s.clientId)?.name || s.clientId}
                              </td>
                              <td className="py-3.5 px-4">
                                <Badge contentType={s.contentType} size="sm" />
                              </td>
                              <td className="py-3.5 px-4">
                                <Badge role={s.roleRequired} size="sm" />
                              </td>
                              <td className="py-3.5 px-4 text-center font-extrabold text-rose-700">
                                {s.quantity} {s.contentType?.toUpperCase()}s
                              </td>
                              <td className="py-3.5 px-5 text-xs font-semibold text-rose-800">
                                {s.reasonLabel || s.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Bottom Commit Action Bar with Animated Excel Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div>
                <h4 className="text-base font-bold text-slate-900">Ready to save this weekly allocation?</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Allocations and surplus records will be committed to the database.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <DownloadExcelButton
                  onExport={handleDownloadExcelPreview}
                  label="Download Excel Preview"
                  size="md"
                />
                <Link href="/requirements">
                  <Button variant="secondary" size="md" className="font-bold">
                    Back to Requirements
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  size="md"
                  icon={CheckCircle2}
                  onClick={() => handleConfirmCommit(false)}
                  isLoading={committing}
                  disabled={!allocationResult.validation.passed}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm & Commit Allocation
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Duplicate Allocation Modal */}
      <Modal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        title="Existing Allocation Detected"
        subtitle={`An allocation already exists for ${selectedWeek?.name}.`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            There are currently <strong>{existingAllocations.length} confirmed allocation records</strong> saved for this week.
          </p>

          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
            Confirming will replace previous automatic allocations for this week with your updated calculations.
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => router.push('/allocations')}
            >
              View Existing
            </Button>
            <Button
              variant="primary"
              onClick={() => handleConfirmCommit(true)}
              isLoading={committing}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Replace & Save
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
