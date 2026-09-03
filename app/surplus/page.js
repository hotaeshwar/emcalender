'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import Input from '@/components/common/Input';
import Textarea from '@/components/common/Textarea';
import Modal from '@/components/common/Modal';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeSurplusWork,
  assignSurplusWorkManually,
  createSurplusWorkRecord,
  createDirectManualAllocation
} from '@/services/allocationService';
import {
  subscribeEmployees,
  createEmployee
} from '@/services/employeeService';
import { subscribeClients } from '@/services/clientService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeCapacityRules } from '@/services/capacityService';
import { subscribeAllocations } from '@/services/allocationService';
import {
  calculateDailyEmployeeCapacity,
  calculateWeeklyEmployeeCapacity,
  getEffectiveWorkingDays,
  calculateUtilization,
  convertTaskToCapacityUnits
} from '@/lib/capacityCalculator';
import { groupWeeksByMonth, getActiveMonth } from '@/lib/monthUtils';
import Link from 'next/link';
import {
  AlertOctagon,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  History,
  Sliders,
  AlertTriangle,
  Plus,
  UserCheck,
  Building2,
  Layers,
  HelpCircle,
  FileCheck,
  Search,
  Filter,
  RotateCcw,
  UserPlus
} from 'lucide-react';
import { ROLES, ROLE_LABELS, ROLE_OPTIONS, CONTENT_TYPES } from '@/lib/constants';

export default function SurplusPage() {
  const [surplusList, setSurplusList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [months, setMonths] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState('all');
  const [selectedWeekId, setSelectedWeekId] = useState('all');
  const [surplusTab, setSurplusTab] = useState('unassigned'); // 'unassigned' | 'assigned' | 'all'
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [contentTypeFilter, setContentTypeFilter] = useState('all');

  // 1. Manual Surplus Assignment Modal
  const [selectedSurplus, setSelectedSurplus] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState(1);
  const [allowOverload, setAllowOverload] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // 2. Quick Add Employee Modal State
  const [isQuickAddEmpModalOpen, setIsQuickAddEmpModalOpen] = useState(false);
  const [quickEmpData, setQuickEmpData] = useState({
    name: '',
    employeeCode: '',
    role: ROLES.GRAPHIC_DESIGNER,
    dailyCapacityUnits: 7,
    status: 'active',
  });
  const [isCreatingQuickEmp, setIsCreatingQuickEmp] = useState(false);

  // 3. Add New Surplus Item Modal
  const [isAddSurplusModalOpen, setIsAddSurplusModalOpen] = useState(false);
  const [newSurplusData, setNewSurplusData] = useState({
    clientId: '',
    weekId: '',
    contentType: 'reel',
    roleRequired: 'video_editor',
    quantity: 1,
    reason: 'Extra campaign deliverables requested beyond capacity',
  });
  const [isCreatingSurplus, setIsCreatingSurplus] = useState(false);

  // 4. Direct Manual Allocation Modal
  const [isDirectAllocModalOpen, setIsDirectAllocModalOpen] = useState(false);
  const [directAllocData, setDirectAllocData] = useState({
    clientId: '',
    employeeId: '',
    weekId: '',
    posts: 0,
    reels: 0,
    stories: 0,
    allowOverload: false,
    overrideReason: '',
  });
  const [isCreatingDirectAlloc, setIsCreatingDirectAlloc] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubSurplus = subscribeSurplusWork((data) => {
      setSurplusList(data || []);
      setLoading(false);
    });

    const unsubEmp = subscribeEmployees(setEmployees);
    const unsubClients = subscribeClients(setClients);
    const unsubWeeks = subscribeWorkWeeks((wList) => {
      setWeeks(wList || []);
    });
    const unsubRules = subscribeCapacityRules(setCapacityRules);
    const unsubAlloc = subscribeAllocations(setAllocations);

    return () => {
      if (unsubSurplus) unsubSurplus();
      if (unsubEmp) unsubEmp();
      if (unsubClients) unsubClients();
      if (unsubWeeks) unsubWeeks();
      if (unsubRules) unsubRules();
      if (unsubAlloc) unsubAlloc();
    };
  }, [selectedWeekId]);

  // Filter list by selected week, tab, role, content type, client, and search
  const filteredSurplusList = surplusList.filter((s) => {
    if (selectedWeekId !== 'all' && s.weekId !== selectedWeekId) return false;
    if (clientFilter !== 'all' && s.clientId !== clientFilter) return false;
    if (roleFilter !== 'all' && (s.roleRequired || '').toLowerCase() !== roleFilter.toLowerCase()) return false;
    if (contentTypeFilter !== 'all' && (s.contentType || '').toLowerCase() !== contentTypeFilter.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchClient = (s.clientName || '').toLowerCase().includes(q) || (s.clientId || '').toLowerCase().includes(q);
      const matchReason = (s.reason || '').toLowerCase().includes(q) || (s.reasonLabel || '').toLowerCase().includes(q);
      const matchEmp = (s.assignedToEmployeeName || '').toLowerCase().includes(q);
      if (!matchClient && !matchReason && !matchEmp) return false;
    }
    return true;
  });

  const unassignedSurplus = filteredSurplusList.filter((s) => s.status !== 'assigned');
  const assignedSurplus = filteredSurplusList.filter((s) => s.status === 'assigned');

  const hasActiveFilters = searchQuery || clientFilter !== 'all' || roleFilter !== 'all' || contentTypeFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setClientFilter('all');
    setRoleFilter('all');
    setContentTypeFilter('all');
  };

  // --- Handlers ---
  const openAssignModal = (surplusItem) => {
    setSelectedSurplus(surplusItem);
    setAssignQuantity(surplusItem.quantity || 1);
    setAllowOverload(false);
    setOverrideReason('');

    // Pre-select first eligible employee
    const eligible = employees.filter(
      (e) => (e.role === surplusItem.roleRequired || e.role === ROLES.GRAPHIC_DESIGNER) && e.status !== 'inactive'
    );
    setSelectedEmpId(eligible[0]?.id || employees[0]?.id || '');
  };

  const handleAssignSurplus = async (e) => {
    e.preventDefault();
    if (!selectedEmpId) {
      error('Please select an employee to assign this surplus work.');
      return;
    }

    const employee = employees.find((e) => e.id === selectedEmpId);
    if (!employee) return;

    // Check if employee will be overloaded
    const targetWeek = weeks.find((w) => w.id === selectedSurplus.weekId);
    const empAllocations = allocations.filter(
      (a) => a.employeeId === employee.id && a.weekId === selectedSurplus.weekId
    );
    const currentUsedUnits = empAllocations.reduce((sum, a) => sum + (Number(a.capacityUsed) || 0), 0);

    const additionalUnits = convertTaskToCapacityUnits(
      selectedSurplus.contentType,
      employee.role,
      assignQuantity,
      capacityRules
    );

    const { effectiveWorkingDates } = getEffectiveWorkingDays(targetWeek, targetWeek?.holidays || []);
    const empWeekCap = calculateWeeklyEmployeeCapacity(employee, capacityRules, effectiveWorkingDates, []);
    const projectedUnits = currentUsedUnits + additionalUnits;
    const projectedUtilization = calculateUtilization(projectedUnits, empWeekCap.weeklyCapacityUnits);

    if (projectedUtilization > 100 && !allowOverload) {
      warning(
        `Overload Warning: ${employee.name} will reach ${projectedUtilization}% utilization. Please check "Authorize Capacity Overload" to confirm.`
      );
      return;
    }

    setIsAssigning(true);
    try {
      await assignSurplusWorkManually({
        surplusId: selectedSurplus.id,
        employee,
        quantity: assignQuantity,
        manualOverride: projectedUtilization > 100,
        overrideReason,
        capacityRules,
      });

      success(`Successfully assigned ${assignQuantity} ${selectedSurplus.contentType}s to ${employee.name}!`, 'Work Distributed');
      setSelectedSurplus(null);
    } catch (err) {
      console.error(err);
      error('Failed to assign surplus work.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCreateQuickEmployee = async (e) => {
    e.preventDefault();
    if (!quickEmpData.name.trim()) {
      error('Please enter team member name.');
      return;
    }
    setIsCreatingQuickEmp(true);
    try {
      const code = quickEmpData.employeeCode.trim() || `EMP${Math.floor(100 + Math.random() * 900)}`;
      const created = await createEmployee({
        name: quickEmpData.name.trim(),
        employeeCode: code,
        role: quickEmpData.role,
        dailyCapacityUnits: Number(quickEmpData.dailyCapacityUnits) || (quickEmpData.role === 'video_editor' ? 4 : 7),
        status: 'active',
      });

      success(`Added new staff member "${quickEmpData.name}"!`);
      if (selectedSurplus) {
        setSelectedEmpId(created.id);
      }
      if (isDirectAllocModalOpen) {
        setDirectAllocData((prev) => ({ ...prev, employeeId: created.id }));
      }
      setIsQuickAddEmpModalOpen(false);
      setQuickEmpData({
        name: '',
        employeeCode: '',
        role: ROLES.GRAPHIC_DESIGNER,
        dailyCapacityUnits: 7,
        status: 'active',
      });
    } catch (err) {
      console.error(err);
      error('Failed to add new employee.');
    } finally {
      setIsCreatingQuickEmp(false);
    }
  };

  const handleCreateSurplus = async (e) => {
    e.preventDefault();
    if (!newSurplusData.clientId || !newSurplusData.weekId) {
      error('Please select both a Client and Target Work Week.');
      return;
    }

    const client = clients.find((c) => c.id === newSurplusData.clientId);
    setIsCreatingSurplus(true);
    try {
      await createSurplusWorkRecord({
        clientId: newSurplusData.clientId,
        clientName: client?.name || '',
        weekId: newSurplusData.weekId,
        contentType: newSurplusData.contentType,
        roleRequired: newSurplusData.roleRequired,
        quantity: Number(newSurplusData.quantity) || 1,
        reason: 'MANUAL_ENTRY',
        reasonLabel: newSurplusData.reason,
      });

      success(`Added ${newSurplusData.quantity} surplus ${newSurplusData.contentType}s for ${client?.name}!`, 'Surplus Logged');
      setIsAddSurplusModalOpen(false);
      setNewSurplusData({
        clientId: '',
        weekId: weeks[0]?.id || '',
        contentType: 'reel',
        roleRequired: 'video_editor',
        quantity: 1,
        reason: 'Extra campaign deliverables requested beyond capacity',
      });
    } catch (err) {
      console.error(err);
      error('Failed to create surplus deliverable.');
    } finally {
      setIsCreatingSurplus(false);
    }
  };

  const handleCreateDirectAllocation = async (e) => {
    e.preventDefault();
    if (!directAllocData.clientId || !directAllocData.employeeId || !directAllocData.weekId) {
      error('Please select Client, Employee, and Target Work Week.');
      return;
    }

    const client = clients.find((c) => c.id === directAllocData.clientId);
    const employee = employees.find((e) => e.id === directAllocData.employeeId);
    const totalItems = (Number(directAllocData.posts) || 0) + (Number(directAllocData.reels) || 0) + (Number(directAllocData.stories) || 0);

    if (totalItems <= 0) {
      error('Please specify at least 1 post, reel, or story.');
      return;
    }

    setIsCreatingDirectAlloc(true);
    try {
      await createDirectManualAllocation({
        clientId: directAllocData.clientId,
        clientName: client?.name || '',
        employeeId: directAllocData.employeeId,
        weekId: directAllocData.weekId,
        work: {
          posts: Number(directAllocData.posts) || 0,
          reels: Number(directAllocData.reels) || 0,
          stories: Number(directAllocData.stories) || 0,
        },
        manualOverride: directAllocData.allowOverload,
        overrideReason: directAllocData.overrideReason,
        capacityRules,
      });

      success(`Successfully allocated ${totalItems} deliverables directly to ${employee?.name}!`, 'Manual Allocation Saved');
      setIsDirectAllocModalOpen(false);
      setDirectAllocData({
        clientId: '',
        employeeId: '',
        weekId: weeks[0]?.id || '',
        posts: 0,
        reels: 0,
        stories: 0,
        allowOverload: false,
        overrideReason: '',
      });
    } catch (err) {
      console.error(err);
      error('Failed to create manual allocation.');
    } finally {
      setIsCreatingDirectAlloc(false);
    }
  };

  // Live modal capacity calculations
  const selectedEmp = employees.find((e) => e.id === selectedEmpId);
  const targetWeek = selectedSurplus ? weeks.find((w) => w.id === selectedSurplus.weekId) : null;
  const empAllocations = selectedEmp && selectedSurplus
    ? allocations.filter((a) => a.employeeId === selectedEmp.id && a.weekId === selectedSurplus.weekId)
    : [];
  const currentUsedUnits = empAllocations.reduce((sum, a) => sum + (Number(a.capacityUsed) || 0), 0);
  const additionalUnits = selectedEmp && selectedSurplus
    ? convertTaskToCapacityUnits(selectedSurplus.contentType, selectedEmp.role, assignQuantity, capacityRules)
    : 0;
  const { effectiveWorkingDates } = targetWeek ? getEffectiveWorkingDays(targetWeek, targetWeek?.holidays || []) : { effectiveWorkingDates: [] };
  const empWeekCap = selectedEmp ? calculateWeeklyEmployeeCapacity(selectedEmp, capacityRules, effectiveWorkingDates, []) : { weeklyCapacityUnits: 0 };
  const projectedUnits = currentUsedUnits + additionalUnits;
  const projectedUtilization = calculateUtilization(projectedUnits, empWeekCap.weeklyCapacityUnits);

  return (
    <AppLayout
      title="Surplus Work & Manual Distribution"
      subtitle="Manage deliverables exceeding automated capacity and manually distribute workload across staff"
    >
      <div className="space-y-6 bg-white">
        {/* Controls & Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Filter by Week:
            </span>
            <div className="w-60">
              <Select
                value={selectedWeekId}
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

            {/* Tab Switches */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSurplusTab('unassigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  surplusTab === 'unassigned'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Unassigned Surplus ({unassignedSurplus.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSurplusTab('assigned')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                  surplusTab === 'assigned'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Assigned History ({assignedSurplus.length})</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setNewSurplusData({
                  clientId: clients[0]?.id || '',
                  weekId: weeks[0]?.id || '',
                  contentType: 'reel',
                  roleRequired: 'video_editor',
                  quantity: 1,
                  reason: 'Extra deliverables requested beyond weekly capacity',
                });
                setIsAddSurplusModalOpen(true);
              }}
              className="font-bold"
            >
              + Log Surplus Item
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={UserCheck}
              onClick={() => {
                setDirectAllocData({
                  clientId: clients[0]?.id || '',
                  employeeId: employees[0]?.id || '',
                  weekId: weeks[0]?.id || '',
                  posts: 0,
                  reels: 0,
                  stories: 0,
                  allowOverload: false,
                  overrideReason: '',
                });
                setIsDirectAllocModalOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              + Direct Manual Allocation
            </Button>

            <Link href="/allocations/new">
              <Button variant="primary" size="sm" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                Run Auto Allocation
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
                placeholder="Search by client, staff, or surplus reason..."
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

              <div className="w-40">
                <Select
                  value={contentTypeFilter}
                  onChange={(e) => setContentTypeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'post', label: 'Posts' },
                    { value: 'reel', label: 'Reels' },
                    { value: 'story', label: 'Stories' },
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
              Showing {surplusTab === 'unassigned' ? unassignedSurplus.length : assignedSurplus.length} items
            </span>
            {hasActiveFilters && (
              <span className="text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Filters Applied
              </span>
            )}
          </div>
        </div>

        {/* Explain How Surplus Works Banner */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex items-start justify-between gap-4 text-xs text-indigo-950">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-indigo-900">
                How Automatic Allocation & Surplus Rules Work:
              </h4>
              <p className="text-indigo-800 mt-1 leading-relaxed">
                • <strong>Graphic Designer:</strong> Baseline <strong>6 Units/Day</strong> (3P + 1R + 2S) = <strong>30–36 Units/Week</strong>.<br/>
                • <strong>Video Editor:</strong> Baseline <strong>4 Units/Day</strong> (3R + 1S) = <strong>20–24 Units/Week</strong>.<br/>
                • When total client requirements fit within these team capacities, <strong>0 surplus is generated</strong> and all items are allocated. When requirements exceed employee quotas or when staff are on leave, excess items automatically move here to be manually distributed.
              </p>
            </div>
          </div>
        </div>

        {/* Content Section: Unassigned vs Assigned */}
        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : surplusTab === 'unassigned' ? (
          <Card>
            <CardHeader
              title="Unassigned Surplus Deliverables"
              subtitle="Deliverables ready for manual staff assignment and overload distribution"
              action={
                <Badge variant={unassignedSurplus.length > 0 ? 'danger' : 'success'} size="sm">
                  {unassignedSurplus.length} Pending
                </Badge>
              }
            />

            {unassignedSurplus.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-extrabold text-slate-900">No Surplus Work Pending</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
                  All current client requirements fit completely within your team's weekly capacity thresholds (30–36 units for Graphic Designers and 20–24 units for Video Editors).
                </p>
                <div className="flex items-center justify-center gap-3 mt-5">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setIsAddSurplusModalOpen(true)}
                    className="font-bold"
                  >
                    Log Extra Surplus Task
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={UserCheck}
                    onClick={() => setIsDirectAllocModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  >
                    Direct Manual Allocation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Client</th>
                      <th className="py-3.5 px-6">Work Week</th>
                      <th className="py-3.5 px-6">Deliverable</th>
                      <th className="py-3.5 px-6">Role Needed</th>
                      <th className="py-3.5 px-6">Surplus Reason</th>
                      <th className="py-3.5 px-6 text-right">Manual Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {unassignedSurplus.map((item) => {
                      const client = clients.find((c) => c.id === item.clientId);
                      const week = weeks.find((w) => w.id === item.weekId);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {client?.name || item.clientName || item.clientId}
                          </td>

                          <td className="py-4 px-6 text-slate-700 font-medium">
                            {week?.name || item.weekId}
                          </td>

                          <td className="py-4 px-6">
                            <span className="font-extrabold text-rose-600">
                              {item.quantity} {item.contentType?.toUpperCase()}s
                            </span>
                          </td>

                          <td className="py-4 px-6">
                            <Badge role={item.roleRequired} size="sm" />
                          </td>

                          <td className="py-4 px-6 text-xs text-rose-800 font-semibold">
                            {item.reasonLabel || item.reason}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <Button
                              variant="primary"
                              size="sm"
                              icon={UserCheck}
                              onClick={() => openAssignModal(item)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
                            >
                              Assign Manually
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          /* Assigned History Tab */
          <Card>
            <CardHeader
              title="Assigned Surplus History"
              subtitle="Deliverables that were manually distributed to team members"
              action={
                <Badge variant="brand" size="sm">
                  {assignedSurplus.length} Assigned Records
                </Badge>
              }
            />

            {assignedSurplus.length === 0 ? (
              <EmptyState
                icon={History}
                title="No Assigned History"
                description="No surplus deliverables have been manually assigned yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Client</th>
                      <th className="py-3.5 px-6">Work Week</th>
                      <th className="py-3.5 px-6">Deliverable</th>
                      <th className="py-3.5 px-6">Assigned Staff</th>
                      <th className="py-3.5 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {assignedSurplus.map((item) => {
                      const client = clients.find((c) => c.id === item.clientId);
                      const week = weeks.find((w) => w.id === item.weekId);
                      const assignedEmp = employees.find((e) => e.id === item.assignedToEmployeeId);

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {client?.name || item.clientName || item.clientId}
                          </td>
                          <td className="py-4 px-6 text-slate-700 font-medium">
                            {week?.name || item.weekId}
                          </td>
                          <td className="py-4 px-6 font-extrabold text-indigo-700">
                            {item.quantity} {item.contentType?.toUpperCase()}s
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-900">
                            {assignedEmp?.name || item.assignedToEmployeeName || 'Assigned Staff'}
                          </td>
                          <td className="py-4 px-6">
                            <Badge variant="success" size="sm">Distributed</Badge>
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

      {/* 1. Modal: Manually Distribute Selected Surplus Work */}
      {selectedSurplus && (
        <Modal
          isOpen={Boolean(selectedSurplus)}
          onClose={() => !isAssigning && setSelectedSurplus(null)}
          title="Manually Distribute Surplus Work"
          subtitle={`Assigning ${selectedSurplus.quantity} surplus ${selectedSurplus.contentType}s for client ${selectedSurplus.clientName || selectedSurplus.clientId}`}
        >
          <form onSubmit={handleAssignSurplus} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Select Team Member
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickEmpData({
                      name: '',
                      employeeCode: '',
                      role: selectedSurplus.roleRequired || ROLES.GRAPHIC_DESIGNER,
                      dailyCapacityUnits: selectedSurplus.roleRequired === 'video_editor' ? 4 : 7,
                      status: 'active',
                    });
                    setIsQuickAddEmpModalOpen(true);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Create New Staff Member</span>
                </button>
              </div>

              <Select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                options={employees
                  .filter((e) => e.status !== 'inactive')
                  .sort((a, b) => {
                    const matchA = a.role === selectedSurplus.roleRequired ? 0 : 1;
                    const matchB = b.role === selectedSurplus.roleRequired ? 0 : 1;
                    return matchA - matchB;
                  })
                  .map((e) => {
                    const isMatching = e.role === selectedSurplus.roleRequired;
                    const roleLabel = e.role ? e.role.replace(/_/g, ' ') : '';
                    return {
                      value: e.id,
                      label: `${e.name} (${e.employeeCode || 'Staff'}) - ${roleLabel}${isMatching ? ' ★ (Recommended)' : ''}`,
                    };
                  })}
                required
              />
            </div>

            <Input
              label="Quantity to Assign"
              type="number"
              min="1"
              max={selectedSurplus.quantity}
              value={assignQuantity}
              onChange={(e) => setAssignQuantity(Number(e.target.value) || 1)}
              required
            />

            {/* Live Impact Preview */}
            {selectedEmp && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Current Utilization:</span>
                  <span className="font-bold text-slate-900">{calculateUtilization(currentUsedUnits, empWeekCap.weeklyCapacityUnits)}% ({currentUsedUnits} / {empWeekCap.weeklyCapacityUnits} Units)</span>
                </div>
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Additional Effort:</span>
                  <span className="font-bold text-indigo-700">+{additionalUnits} Units ({assignQuantity} {selectedSurplus.contentType}s)</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                  <span className="text-slate-900">Projected Utilization:</span>
                  <span className={projectedUtilization > 100 ? 'text-rose-600' : 'text-emerald-600'}>
                    {projectedUtilization}% {projectedUtilization > 100 ? '(Overloaded)' : '(Within Capacity)'}
                  </span>
                </div>
              </div>
            )}

            {/* Overload Notice & Override */}
            {projectedUtilization > 100 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverload}
                    onChange={(e) => setAllowOverload(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="text-xs text-amber-950 font-bold">
                    Authorize Capacity Overload (Permit {projectedUtilization}% capacity)
                  </span>
                </label>

                {allowOverload && (
                  <Textarea
                    placeholder="State reason for manual overload justification..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                  />
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setSelectedSurplus(null)}
                disabled={isAssigning}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isAssigning}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Confirm Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Modal: Add New Surplus Deliverable */}
      {isAddSurplusModalOpen && (
        <Modal
          isOpen={isAddSurplusModalOpen}
          onClose={() => !isCreatingSurplus && setIsAddSurplusModalOpen(false)}
          title="Log Extra Surplus Deliverable"
          subtitle="Record surplus client deliverables that exceed normal contract quotas"
        >
          <form onSubmit={handleCreateSurplus} className="space-y-4">
            <Select
              label="Select Client"
              value={newSurplusData.clientId}
              onChange={(e) => setNewSurplusData({ ...newSurplusData, clientId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Client --' },
                ...clients.map((c) => ({ value: c.id, label: `${c.name} (${c.clientCode || 'Client'})` })),
              ]}
              required
            />

            <Select
              label="Target Work Week"
              value={newSurplusData.weekId}
              onChange={(e) => setNewSurplusData({ ...newSurplusData, weekId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Week --' },
                ...weeks.map((w) => ({ value: w.id, label: `${w.name} (${w.startDate})` })),
              ]}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Content Type"
                value={newSurplusData.contentType}
                onChange={(e) => setNewSurplusData({
                  ...newSurplusData,
                  contentType: e.target.value,
                  roleRequired: e.target.value === 'post' ? 'graphic_designer' : 'video_editor',
                })}
                options={[
                  { value: 'post', label: 'Graphic Post' },
                  { value: 'reel', label: 'Video Reel' },
                  { value: 'story', label: 'Story Slide' },
                ]}
              />

              <Input
                label="Quantity"
                type="number"
                min="1"
                value={newSurplusData.quantity}
                onChange={(e) => setNewSurplusData({ ...newSurplusData, quantity: Number(e.target.value) || 1 })}
                required
              />
            </div>

            <Textarea
              label="Surplus Reason / Note"
              placeholder="e.g. Urgent extra festival campaign requested by client"
              value={newSurplusData.reason}
              onChange={(e) => setNewSurplusData({ ...newSurplusData, reason: e.target.value })}
              rows={2}
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsAddSurplusModalOpen(false)}
                disabled={isCreatingSurplus}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isCreatingSurplus}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Save Surplus Item
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 3. Modal: Direct Manual Allocation */}
      {isDirectAllocModalOpen && (
        <Modal
          isOpen={isDirectAllocModalOpen}
          onClose={() => !isCreatingDirectAlloc && setIsDirectAllocModalOpen(false)}
          title="Direct Manual Work Allocation"
          subtitle="Assign client deliverables directly to a specific team member"
        >
          <form onSubmit={handleCreateDirectAllocation} className="space-y-4">
            <Select
              label="Select Client"
              value={directAllocData.clientId}
              onChange={(e) => setDirectAllocData({ ...directAllocData, clientId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Client --' },
                ...clients.map((c) => ({ value: c.id, label: `${c.name} (${c.clientCode || 'Client'})` })),
              ]}
              required
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Select Team Member
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickEmpData({
                      name: '',
                      employeeCode: '',
                      role: ROLES.GRAPHIC_DESIGNER,
                      dailyCapacityUnits: 7,
                      status: 'active',
                    });
                    setIsQuickAddEmpModalOpen(true);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Create New Staff Member</span>
                </button>
              </div>

              <Select
                value={directAllocData.employeeId}
                onChange={(e) => setDirectAllocData({ ...directAllocData, employeeId: e.target.value })}
                options={[
                  { value: '', label: '-- Choose Staff Member --' },
                  ...employees.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.employeeCode || 'Staff'}) - ${e.role?.replace(/_/g, ' ')}`,
                  })),
                ]}
                required
              />
            </div>

            <Select
              label="Target Work Week"
              value={directAllocData.weekId}
              onChange={(e) => setDirectAllocData({ ...directAllocData, weekId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Week --' },
                ...weeks.map((w) => ({ value: w.id, label: `${w.name} (${w.startDate})` })),
              ]}
              required
            />

            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Posts"
                type="number"
                min="0"
                value={directAllocData.posts}
                onChange={(e) => setDirectAllocData({ ...directAllocData, posts: Number(e.target.value) || 0 })}
              />
              <Input
                label="Reels"
                type="number"
                min="0"
                value={directAllocData.reels}
                onChange={(e) => setDirectAllocData({ ...directAllocData, reels: Number(e.target.value) || 0 })}
              />
              <Input
                label="Stories"
                type="number"
                min="0"
                value={directAllocData.stories}
                onChange={(e) => setDirectAllocData({ ...directAllocData, stories: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsDirectAllocModalOpen(false)}
                disabled={isCreatingDirectAlloc}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isCreatingDirectAlloc}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                Confirm Direct Allocation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* 4. Modal: Quick Add New Team Member Inline */}
      {isQuickAddEmpModalOpen && (
        <Modal
          isOpen={isQuickAddEmpModalOpen}
          onClose={() => !isCreatingQuickEmp && setIsQuickAddEmpModalOpen(false)}
          title="Create New Team Member"
          subtitle="Add a new Graphic Designer or Video Editor to immediately assign surplus deliverables"
        >
          <form onSubmit={handleCreateQuickEmployee} className="space-y-4">
            <Input
              label="Employee Full Name"
              placeholder="e.g. Rahul Sharma"
              value={quickEmpData.name}
              onChange={(e) => setQuickEmpData({ ...quickEmpData, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Employee Code"
                placeholder="e.g. GD03 or VE02"
                value={quickEmpData.employeeCode}
                onChange={(e) => setQuickEmpData({ ...quickEmpData, employeeCode: e.target.value })}
              />

              <Select
                label="Role"
                value={quickEmpData.role}
                onChange={(e) => {
                  const role = e.target.value;
                  setQuickEmpData({
                    ...quickEmpData,
                    role,
                    dailyCapacityUnits: role === 'video_editor' ? 4 : 7,
                  });
                }}
                options={[
                  { value: ROLES.GRAPHIC_DESIGNER, label: 'Graphic Designer (7 units/day)' },
                  { value: ROLES.VIDEO_EDITOR, label: 'Video Editor (4 units/day)' },
                ]}
                required
              />
            </div>

            <Input
              label="Daily Capacity Quota (Units/Day)"
              type="number"
              min="1"
              value={quickEmpData.dailyCapacityUnits}
              onChange={(e) => setQuickEmpData({ ...quickEmpData, dailyCapacityUnits: Number(e.target.value) || 1 })}
              required
            />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsQuickAddEmpModalOpen(false)}
                disabled={isCreatingQuickEmp}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isCreatingQuickEmp}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Create Staff & Select
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
