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
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeAllocations,
  deleteAllocation,
  clearWeeklyAllocations
} from '@/services/allocationService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeClients } from '@/services/clientService';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeSurplusWork } from '@/services/allocationService';
import { subscribeEmployeeAvailability } from '@/services/availabilityService';
import { generateDailySchedule } from '@/lib/allocationEngine';
import { exportAllocationReport } from '@/lib/exportExcel';
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
  RotateCcw
} from 'lucide-react';
import { ROLES, ROLE_OPTIONS } from '@/lib/constants';

export default function AllocationsListPage() {
  const [allocations, setAllocations] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [surplusList, setSurplusList] = useState([]);
  const [availabilityList, setAvailabilityList] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
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

  // Clear Table Modal State
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
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

  const weekAllocations = selectedWeekId && selectedWeekId !== 'all'
    ? allocations.filter((a) => a.weekId === selectedWeekId || a.weekName === selectedWeekId)
    : allocations;

  const filteredAllocations = weekAllocations.filter((a) => {
    if (clientFilter !== 'all' && a.clientId !== clientFilter) return false;
    if (employeeFilter !== 'all' && a.employeeId !== employeeFilter && a.employeeCode !== employeeFilter) return false;
    if (roleFilter !== 'all' && (a.employeeRole || '').toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (assignmentTypeFilter !== 'all' && a.assignmentType !== assignmentTypeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchClient = (a.clientName || '').toLowerCase().includes(q) || (a.clientId || '').toLowerCase().includes(q);
      const matchEmp = (a.employeeName || '').toLowerCase().includes(q) || (a.employeeCode || '').toLowerCase().includes(q);
      if (!matchClient && !matchEmp) return false;
    }
    return true;
  });

  const currentWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];
  const currentSurplus = surplusList.filter((s) => s.weekId === selectedWeekId);

  const hasActiveFilters = searchQuery || roleFilter !== 'all' || clientFilter !== 'all' || employeeFilter !== 'all' || assignmentTypeFilter !== 'all' || (selectedWeekId && selectedWeekId !== 'all');

  const resetFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setClientFilter('all');
    setEmployeeFilter('all');
    setAssignmentTypeFilter('all');
    setSelectedWeekId('all');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAllocation(deleteTarget.id);
      success('Allocation record deleted.');
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
      const res = await clearWeeklyAllocations({
        weekId: selectedWeekId !== 'all' ? selectedWeekId : null,
        clearSurplus: true,
      });
      const weekName = weeks.find((w) => w.id === selectedWeekId)?.name || 'All Weeks';
      success(`Successfully cleared ${res.deletedAllocCount} allocations for ${weekName}!`, 'Table Cleared');
      setIsClearModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to clear allocations.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleExportExcel = () => {
    exportAllocationReport({
      week: currentWeek,
      allocations: filteredAllocations,
      surplus: currentSurplus,
      clients,
      employees,
    });
    success('Color-coded Excel matrix downloaded in exact agency format!');
  };

  return (
    <AppLayout
      title="Bid Employee Work Distributer Allocations"
      subtitle="View, manage, and export client x staff deliverable allocations in matrix format"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar with Animated Download Excel Button & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Filter by Week:
            </span>
            <div className="w-60">
              <Select
                value={selectedWeekId || 'all'}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={[
                  { value: 'all', label: 'All Work Weeks' },
                  ...weeks.map((w) => ({
                    value: w.id,
                    label: `${w.name} (${w.startDate})`,
                  })),
                ]}
              />
            </div>

            {/* View Mode Toggle Buttons */}
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
                <span>1. Matrix Grid View</span>
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
                <span>2. Day-Wise Schedule (Mon–Sat)</span>
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
                <span>3. Record List View</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              icon={Trash2}
              onClick={() => setIsClearModalOpen(true)}
              disabled={filteredAllocations.length === 0}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 border-rose-200 font-bold"
            >
              Clear Table
            </Button>

            <DownloadExcelButton
              onExport={handleExportExcel}
              label="Download Matrix (Excel)"
              size="sm"
            />

            <Link href="/allocations/new">
              <Button variant="primary" size="sm" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                Generate New Allocation
              </Button>
            </Link>
          </div>
        </div>

        {/* Extended Interactive Filter Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Input
                placeholder="Search by client or staff name/code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            {/* Filter Selects Grid */}
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

              <div className="w-48">
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
                    ...employees.map((emp) => ({ value: emp.id, label: `${emp.name} (${emp.employeeCode || emp.role})` })),
                  ]}
                />
              </div>

              <div className="w-36">
                <Select
                  value={assignmentTypeFilter}
                  onChange={(e) => setAssignmentTypeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'automatic', label: 'Auto' },
                    { value: 'manual', label: 'Manual' },
                  ]}
                />
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
            <span className="font-extrabold text-slate-700">
              Showing {filteredAllocations.length} of {weekAllocations.length} allocations for {currentWeek?.name || 'Selected Week'}
            </span>
            {hasActiveFilters && (
              <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Filters Applied
              </span>
            )}
          </div>
        </div>

        {/* Surplus Alert if unassigned items exist */}
        {currentSurplus.filter((s) => s.status !== 'assigned').length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm">
                  {currentSurplus.filter((s) => s.status !== 'assigned').length} Surplus Items Requiring Manual Distribution
                </p>
                <p className="text-rose-800 font-medium">
                  Deliverables that exceeded team capacity during auto-allocation can be manually distributed to staff.
                </p>
              </div>
            </div>
            <Link href="/surplus" className="flex-shrink-0">
              <Button variant="primary" size="sm" icon={ArrowRight} className="bg-rose-700 hover:bg-rose-800 text-white font-bold">
                Distribute Surplus Work
              </Button>
            </Link>
          </div>
        )}

        {/* Content Section */}
        {loading ? (
          <SkeletonTable rows={5} cols={7} />
        ) : viewMode === 'matrix' ? (
          /* Exact Matrix Grid Format Matching User Image */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Distribution Schedule ({currentWeek?.name || 'Active Week'})
              </span>
              <span className="text-xs text-slate-600 font-bold">
                {clients.length} Clients • {employees.length} Staff Members
              </span>
            </div>

            <AgencyMatrixGrid
              week={currentWeek}
              clients={clients}
              employees={employees}
              allocations={filteredAllocations}
              searchQuery={searchQuery}
              clientFilter={clientFilter}
              employeeFilter={employeeFilter}
              roleFilter={roleFilter}
            />
          </div>
        ) : viewMode === 'schedule' ? (
          /* Day-Wise Production Schedule (Monday through Saturday) */
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Day-by-Day Production Schedule ({currentWeek?.name || 'Active Week'})
              </span>
              <span className="text-xs text-slate-600 font-bold">
                Monday through Saturday Staff Deliverable Allocation
              </span>
            </div>

            <DailyScheduleTimetable
              dailySchedules={generateDailySchedule(
                filteredAllocations,
                employees,
                currentWeek,
                currentWeek?.holidays || [],
                availabilityList
              )}
              workWeek={currentWeek}
              employees={employees}
              clients={clients}
              employeeFilter={employeeFilter}
              roleFilter={roleFilter}
              searchQuery={searchQuery}
            />
          </div>
        ) : (
          /* List View */
          <Card>
            <CardHeader
              title="Saved Allocation Records"
              subtitle={currentWeek ? `Showing assignments for ${currentWeek.name}` : 'All assignments'}
              action={
                <Badge variant="brand" size="sm">
                  {filteredAllocations.length} Active Records
                </Badge>
              }
            />

            {filteredAllocations.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No Allocations Found"
                description="No allocations have been saved for this week yet. Run the auto allocation engine to distribute client deliverables."
                action={
                  <Link href="/allocations/new">
                    <Button variant="primary" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                      Run Auto Allocation Now
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Client</th>
                      <th className="py-3.5 px-5">Assigned Staff</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4 text-center">Posts</th>
                      <th className="py-3.5 px-4 text-center">Reels</th>
                      <th className="py-3.5 px-4 text-center">Stories</th>
                      <th className="py-3.5 px-5 text-center">Effort Units</th>
                      <th className="py-3.5 px-4 text-center">Type</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredAllocations.map((alloc) => {
                      const client = clients.find((c) => c.id === alloc.clientId);
                      return (
                        <tr key={alloc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-5 font-bold text-slate-900">
                            <p>{client?.name || alloc.clientId}</p>
                            {client?.clientCode && (
                              <p className="text-[11px] font-mono text-slate-500">{client.clientCode}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-5 font-bold text-slate-900">
                            <p>{alloc.employeeName}</p>
                            <p className="text-[11px] font-mono text-slate-500 font-semibold">{alloc.employeeCode}</p>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge role={alloc.employeeRole} size="sm" />
                          </td>

                          <td className="py-3.5 px-4 text-center font-extrabold text-blue-700">
                            {alloc.work?.posts || 0}
                          </td>

                          <td className="py-3.5 px-4 text-center font-extrabold text-purple-700">
                            {alloc.work?.reels || 0}
                          </td>

                          <td className="py-3.5 px-4 text-center font-extrabold text-amber-700">
                            {alloc.work?.stories || 0}
                          </td>

                          <td className="py-3.5 px-5 text-center font-extrabold text-indigo-700 bg-indigo-50/50">
                            {alloc.capacityUsed} Units
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {alloc.assignmentType === 'manual' ? (
                              <Badge variant="warning" size="sm">Manual</Badge>
                            ) : (
                              <Badge variant="success" size="sm">Auto</Badge>
                            )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Allocation Assignment"
        message="Are you sure you want to delete this specific allocation record?"
        confirmText="Delete Record"
        isLoading={isDeleting}
      />

      {/* Clear All Allocations Confirmation Modal */}
      <ConfirmModal
        isOpen={isClearModalOpen}
        onClose={() => !isClearing && setIsClearModalOpen(false)}
        onConfirm={handleClearAllocations}
        title={selectedWeekId && selectedWeekId !== 'all' ? `Clear Allocations for ${currentWeek?.name || 'Selected Week'}` : 'Clear All Allocations'}
        message={`Are you sure you want to completely clear the allocation table${selectedWeekId && selectedWeekId !== 'all' ? ` for ${currentWeek?.name}` : ' across all weeks'}? This will delete all committed staff assignments and surplus items for this period, allowing you to auto-allocate fresh.`}
        confirmText="Clear Allocations"
        variant="danger"
        isLoading={isClearing}
      />
    </AppLayout>
  );
}
