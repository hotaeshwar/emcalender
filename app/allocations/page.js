'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import AgencyMatrixGrid from '@/components/common/AgencyMatrixGrid';
import DailyScheduleTimetable from '@/components/common/DailyScheduleTimetable';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ConfirmModal from '@/components/common/ConfirmModal';
import Modal from '@/components/common/Modal';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeAllocations,
  deleteAllocation,
  clearWeeklyAllocations,
  clearMonthlyAllocations
} from '@/services/allocationService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeClients } from '@/services/clientService';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeSurplusWork } from '@/services/allocationService';
import { subscribeEmployeeAvailability } from '@/services/availabilityService';
import { generateDailySchedule } from '@/lib/allocationEngine';
import { exportAllocationReport } from '@/lib/exportExcel';
import { groupWeeksByMonth, getActiveMonth } from '@/lib/monthUtils';
import Link from 'next/link';
import Input from '@/components/common/Input';
import {
  Sparkles,
  Calendar,
  Building2,
  Users,
  Trash2,
  AlertTriangle,
  Plus,
  ArrowRight,
  ShieldAlert,
  FileSpreadsheet,
  Table,
  Clock,
  List,
  Search,
  Filter,
  RotateCcw,
  Layers
} from 'lucide-react';
import { ROLES, ROLE_OPTIONS } from '@/lib/constants';

export default function AllocationsListPage() {
  const [allocations, setAllocations] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('all');
  const [selectedMonthKey, setSelectedMonthKey] = useState('all');
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [surplusList, setSurplusList] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);
  const [viewMode, setViewMode] = useState('matrix'); // 'matrix' | 'schedule' | 'list'
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [assignmentTypeFilter, setAssignmentTypeFilter] = useState('all');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear / Remove Table Modal State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearScope, setClearScope] = useState('week'); // 'week' | 'month' | 'all'
  const [isClearing, setIsClearing] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      const grouped = groupWeeksByMonth(data || []);
      setMonths(grouped);
      const activeWk = (data || []).find((w) => w.status === 'active') || (data || [])[0];
      if (activeWk && selectedWeekId === 'all') {
        setSelectedWeekId(activeWk.id);
      }
    });

    const unsubClients = subscribeClients(setClients);
    const unsubEmployees = subscribeEmployees(setEmployees);
    const unsubSurplus = subscribeSurplusWork(setSurplusList);
    const unsubAvail = subscribeEmployeeAvailability(setAvailabilityList);

    const unsubAllocations = subscribeAllocations((data) => {
      setAllocations(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubWeeks) unsubWeeks();
      if (unsubClients) unsubClients();
      if (unsubEmployees) unsubEmployees();
      if (unsubAllocations) unsubAllocations();
      if (unsubSurplus) unsubSurplus();
      if (unsubAvail) unsubAvail();
    };
  }, []);

  const currentWeek = weeks.find((w) => w.id === selectedWeekId);
  const currentMonthData = months.find((m) => m.monthKey === selectedMonthKey);

  // Filter allocations
  const filteredAllocations = allocations.filter((a) => {
    // 1. Week Filter
    if (selectedWeekId !== 'all') {
      if (a.weekId !== selectedWeekId && a.weekName !== selectedWeekId) return false;
    }
    // 2. Month Filter (if selected)
    if (selectedMonthKey !== 'all') {
      const matchMonth = a.monthKey === selectedMonthKey || (a.date && a.date.startsWith(selectedMonthKey)) ||
                         (weeks.filter(w => w.startDate?.startsWith(selectedMonthKey)).some(w => w.id === a.weekId));
      if (!matchMonth) return false;
    }
    // 3. Client, Staff, Role, AssignmentType
    if (clientFilter !== 'all' && a.clientId !== clientFilter) return false;
    if (employeeFilter !== 'all' && a.employeeId !== employeeFilter && a.employeeCode !== employeeFilter) return false;
    if (roleFilter !== 'all' && (a.employeeRole || '').toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (assignmentTypeFilter !== 'all' && a.assignmentType !== assignmentTypeFilter) return false;
    // 4. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchClient = (a.clientName || '').toLowerCase().includes(q) || (a.clientId || '').toLowerCase().includes(q);
      const matchEmp = (a.employeeName || '').toLowerCase().includes(q) || (a.employeeCode || '').toLowerCase().includes(q);
      if (!matchClient && !matchEmp) return false;
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAllocation(deleteTarget.id);
      success('Allocation assignment deleted.');
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      error('Failed to delete allocation.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearAllocations = async () => {
    setIsClearing(true);
    try {
      if (clearScope === 'week') {
        const targetWkId = selectedWeekId !== 'all' ? selectedWeekId : weeks[0]?.id;
        const res = await clearWeeklyAllocations({
          weekId: targetWkId,
          clearSurplus: true,
        });
        const wkName = weeks.find((w) => w.id === targetWkId)?.name || 'Selected Week';
        success(`Successfully removed old table (${res.deletedAllocCount} assignments) for ${wkName}!`, 'Table Cleared');
      } else if (clearScope === 'month') {
        const res = await clearMonthlyAllocations({
          monthKey: selectedMonthKey !== 'all' ? selectedMonthKey : null,
          clearSurplus: true,
        });
        const mLabel = currentMonthData?.monthLabel || 'All Months';
        success(`Successfully removed old table (${res.deletedAllocCount} assignments) for ${mLabel}!`, 'Table Cleared');
      } else {
        // Clear ALL
        const res = await clearWeeklyAllocations({
          weekId: 'all',
          clearSurplus: true,
        });
        success(`Successfully removed all ${res.deletedAllocCount} previous allocation assignments from database!`, 'All Tables Removed');
      }
      setIsClearModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to remove allocation table.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportExcel = () => {
    const isWeekSpecific = selectedWeekId !== 'all' && Boolean(currentWeek);
    exportAllocationReport({
      week: isWeekSpecific ? currentWeek : { name: currentMonthData?.monthLabel || 'All Work Weeks' },
      monthLabel: currentMonthData?.monthLabel,
      isMonthly: !isWeekSpecific,
      title: isWeekSpecific ? `${currentWeek.name} Allocation Matrix` : 'Allocation Matrix Schedule',
      allocations: filteredAllocations,
      clients,
      employees,
    });
    success('Color-coded Excel matrix downloaded in exact agency format!');
  };

  return (
    <AppLayout
      title="Bid Employee Work Distributer Allocations"
      subtitle="View, manage, and export client x staff deliverable allocations in Week-Wise and Month-Wise matrix format"
    >
      <div className="space-y-6 bg-white">
        {/* Top Primary Controls Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Work Week:
            </span>
            <div className="w-64">
              <Select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={[
                  { value: 'all', label: 'All Work Weeks (Combined)' },
                  ...weeks.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.startDate} to ${w.endDate})`,
                  })),
                ]}
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>1. Matrix Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('schedule')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>2. Day-Wise Timetable</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  viewMode === 'list'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>3. Records List</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={() => {
                setClearScope(selectedWeekId !== 'all' ? 'week' : 'all');
                setIsClearModalOpen(true);
              }}
              disabled={filteredAllocations.length === 0}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border-rose-200 font-bold"
            >
              Remove Old Table
            </Button>

            <DownloadExcelButton
              onExport={handleExportExcel}
              label="Download Matrix (Excel)"
              size="sm"
            />

            <Link href="/allocations/new">
              <Button variant="primary" size="sm" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                Auto Allocate Work
              </Button>
            </Link>
          </div>
        </div>

        {/* Calendar Details Banner for Selected Week */}
        {selectedWeekId !== 'all' && currentWeek && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="font-extrabold text-indigo-950 block">{currentWeek.name}</span>
                <span className="text-indigo-800 font-medium">{currentWeek.startDate} to {currentWeek.endDate} • {currentWeek.calculatedWorkingDays || 5} Effective Working Days</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Allocated Deliverables:</span>
              <Badge variant="primary" size="sm">{filteredAllocations.length} Staff Assignments</Badge>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Input
                placeholder="Search by client or staff name/code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-40">
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Roles' },
                    ...ROLE_OPTIONS,
                  ]}
                />
              </div>

              <div className="w-44">
                <Select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Clients' },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>

              <div className="w-44">
                <Select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Staff' },
                    ...employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode || 'Emp'})` })),
                  ]}
                />
              </div>

              <div className="w-36">
                <Select
                  value={assignmentTypeFilter}
                  onChange={(e) => setAssignmentTypeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'automatic', label: 'Automated' },
                    { value: 'manual', label: 'Manual' },
                  ]}
                />
              </div>

              {(searchQuery || roleFilter !== 'all' || clientFilter !== 'all' || employeeFilter !== 'all' || assignmentTypeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setRoleFilter('all');
                    setClientFilter('all');
                    setEmployeeFilter('all');
                    setAssignmentTypeFilter('all');
                  }}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* VIEW 1: MATRIX GRID VIEW */}
        {viewMode === 'matrix' && (
          <div className="space-y-4">
            <AgencyMatrixGrid
              week={selectedWeekId !== 'all' ? currentWeek : null}
              title={
                selectedWeekId !== 'all' && currentWeek
                  ? `${currentWeek.name.toUpperCase()} (${currentWeek.startDate} TO ${currentWeek.endDate})`
                  : 'ALL WEEKS ALLOCATION MATRIX'
              }
              isMonthly={selectedWeekId === 'all'}
              clients={clients}
              employees={employees}
              allocations={filteredAllocations}
              searchQuery={searchQuery}
              clientFilter={clientFilter}
              employeeFilter={employeeFilter}
              roleFilter={roleFilter}
            />
          </div>
        )}

        {/* VIEW 2: DAY-WISE SCHEDULE VIEW */}
        {viewMode === 'schedule' && (
          <div className="space-y-6">
            {(selectedWeekId !== 'all' ? [currentWeek].filter(Boolean) : weeks).map((wk) => {
              const wkAllocations = filteredAllocations.filter((a) => a.weekId === wk.id || a.weekName === wk.name);
              const dailySchedules = generateDailySchedule(
                wk,
                employees,
                wkAllocations,
                [],
                availabilityList
              );

              return (
                <Card key={wk.id}>
                  <CardHeader
                    title={`${wk.name} Daily Schedule Timetable (${wk.startDate} to ${wk.endDate})`}
                    subtitle={`Day-wise staff assignments across ${wk.calculatedWorkingDays || 5} effective working days`}
                  />
                  <DailyScheduleTimetable
                    workWeek={wk}
                    dailySchedules={dailySchedules}
                    employees={employees}
                  />
                </Card>
              );
            })}
          </div>
        )}

        {/* VIEW 3: RECORDS LIST VIEW */}
        {viewMode === 'list' && (
          <Card>
            <CardHeader
              title={`Committed Allocation Records (${filteredAllocations.length})`}
              subtitle={`Detailed deliverables breakdown for ${selectedWeekId !== 'all' ? currentWeek?.name : 'All Work Weeks'}`}
            />
            {filteredAllocations.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No Allocations Found"
                description="Generate an allocation or adjust your filters above."
                actionLabel="Auto Allocate Work"
                actionHref="/allocations/new"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Work Week</th>
                      <th className="py-3 px-4 text-center">Posts</th>
                      <th className="py-3 px-4 text-center">Reels</th>
                      <th className="py-3 px-4 text-center">Stories</th>
                      <th className="py-3 px-5 text-center">Capacity</th>
                      <th className="py-3 px-4 text-center">Type</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAllocations.map((alloc) => (
                      <tr key={alloc.id} className="hover:bg-slate-50 transition-all">
                        <td className="py-3.5 px-4 font-bold text-slate-900">{alloc.clientName || alloc.clientId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{alloc.employeeName || alloc.employeeId}</td>
                        <td className="py-3.5 px-4"><Badge role={alloc.employeeRole} size="sm" /></td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">{alloc.weekName || alloc.weekId || 'Week'}</td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-blue-700">{alloc.work?.posts || 0}</td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-purple-700">{alloc.work?.reels || 0}</td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-amber-700">{alloc.work?.stories || 0}</td>
                        <td className="py-3.5 px-5 text-center font-extrabold text-indigo-700 bg-indigo-50/50">{alloc.capacityUsed} Units</td>
                        <td className="py-3.5 px-4 text-center">
                          <Badge variant={alloc.assignmentType === 'manual' ? 'warning' : 'success'} size="sm">
                            {alloc.assignmentType === 'manual' ? 'Manual' : 'Auto'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setDeleteTarget(alloc)}
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Delete Single Record Modal */}
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => !isDeleting && setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Allocation Assignment"
          message="Are you sure you want to delete this specific allocation record?"
          confirmText="Delete Record"
          isLoading={isDeleting}
        />

        {/* Remove Old Table Modal with Scope Selection */}
        {isClearModalOpen && (
          <Modal
            isOpen={isClearModalOpen}
            onClose={() => !isClearing && setIsClearModalOpen(false)}
            title="Remove Previous Allocation Table"
            subtitle="Clear old allocation data to start fresh"
          >
            <div className="space-y-4 text-xs text-slate-700">
              <p className="font-medium">
                Choose the scope of previous allocation tables you wish to remove from the system:
              </p>

              <div className="space-y-2">
                {selectedWeekId !== 'all' && (
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input
                      type="radio"
                      name="clearScope"
                      value="week"
                      checked={clearScope === 'week'}
                      onChange={() => setClearScope('week')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 block">
                        Clear {currentWeek?.name || 'Selected Week'} Only
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Deletes assignments and surplus items for {currentWeek?.name} ({currentWeek?.startDate} to {currentWeek?.endDate}).
                      </span>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100">
                  <input
                    type="radio"
                    name="clearScope"
                    value="all"
                    checked={clearScope === 'all'}
                    onChange={() => setClearScope('all')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="font-extrabold text-rose-700 block">
                      Clear ALL Allocation Tables (Full Reset)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Deletes all committed staff allocations and surplus items across all work weeks.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsClearModalOpen(false)} disabled={isClearing}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleClearAllocations}
                  isLoading={isClearing}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  Remove Table Now
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
