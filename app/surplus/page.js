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
  assignSurplusWorkManually
} from '@/services/allocationService';
import { subscribeEmployees } from '@/services/employeeService';
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
import {
  AlertOctagon,
  Users,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  UserCheck,
  Building2,
  Sparkles
} from 'lucide-react';
import { ROLES, ROLE_LABELS } from '@/lib/constants';

export default function SurplusPage() {
  const [surplusList, setSurplusList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manual Assignment Modal
  const [selectedSurplus, setSelectedSurplus] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [assignQuantity, setAssignQuantity] = useState(1);
  const [allowOverload, setAllowOverload] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubSurplus = subscribeSurplusWork((data) => {
      setSurplusList(data || []);
      setLoading(false);
    });

    const unsubEmp = subscribeEmployees(setEmployees);
    const unsubClients = subscribeClients(setClients);
    const unsubWeeks = subscribeWorkWeeks(setWeeks);
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
  }, []);

  const openAssignModal = (surplusItem) => {
    setSelectedSurplus(surplusItem);
    setAssignQuantity(surplusItem.quantity || 1);
    setAllowOverload(false);
    setOverrideReason('');

    // Pre-select first eligible employee
    const eligible = employees.filter(
      (e) => e.role === surplusItem.roleRequired && e.status === 'active'
    );
    setSelectedEmpId(eligible[0]?.id || '');
  };

  const handleAssign = async (e) => {
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
        `Overload Warning: ${employee.name} will reach ${projectedUtilization}% utilization. Please check "Allow Overload" and provide a reason to confirm.`
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

      success(`Successfully assigned ${assignQuantity} ${selectedSurplus.contentType}s to ${employee.name}.`);
      setSelectedSurplus(null);
    } catch (err) {
      console.error(err);
      error('Failed to assign surplus work.');
    } finally {
      setIsAssigning(false);
    }
  };

  const unassignedSurplus = surplusList.filter((s) => s.status !== 'assigned');

  return (
    <AppLayout
      title="Surplus Work Management"
      subtitle="Deliverables exceeding automated team capacity requiring manual assignment or capacity reallocation"
    >
      <div className="space-y-6 bg-white">
        {/* KPI Alert Banner */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 font-bold">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {unassignedSurplus.length} Surplus Items Requiring Attention
              </h3>
              <p className="text-xs text-slate-500">
                These items could not be allocated within normal daily capacity limits and need manual staff assignment.
              </p>
            </div>
          </div>
        </div>

        {/* Surplus Table */}
        <Card>
          <CardHeader
            title="Unassigned Deliverables"
            subtitle="Surplus items recorded by the automated allocation engine"
          />

          {loading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : unassignedSurplus.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No Surplus Work Pending"
              description="All client requirements have been successfully allocated within standard team capacity."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Client</th>
                    <th className="py-3.5 px-6">Work Week</th>
                    <th className="py-3.5 px-6">Deliverable</th>
                    <th className="py-3.5 px-6">Role Needed</th>
                    <th className="py-3.5 px-6">Surplus Reason</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {unassignedSurplus.map((item) => {
                    const client = clients.find((c) => c.id === item.clientId);
                    const week = weeks.find((w) => w.id === item.weekId);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {client?.name || item.clientId}
                        </td>

                        <td className="py-4 px-6 text-slate-700 font-medium">
                          {week?.name || item.weekId}
                        </td>

                        <td className="py-4 px-6">
                          <span className="font-extrabold text-rose-600">
                            {item.quantity} {item.contentType?.toUpperCase()}
                          </span>
                        </td>

                        <td className="py-4 px-6">
                          <Badge role={item.roleRequired} size="sm" />
                        </td>

                        <td className="py-4 px-6 text-xs text-rose-700 font-semibold">
                          {item.reasonLabel || item.reason}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={UserCheck}
                            onClick={() => openAssignModal(item)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
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
      </div>

      {/* Manual Assignment Modal */}
      {selectedSurplus && (
        <Modal
          isOpen={Boolean(selectedSurplus)}
          onClose={() => !isAssigning && setSelectedSurplus(null)}
          title="Manually Assign Surplus Work"
          subtitle={`Assigning ${selectedSurplus.quantity} ${selectedSurplus.contentType}s to available staff`}
        >
          <form onSubmit={handleAssign} className="space-y-4">
            <Select
              label="Select Team Member"
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              options={employees
                .filter((e) => e.role === selectedSurplus.roleRequired && e.status === 'active')
                .map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.employeeCode})`,
                }))}
              required
            />

            <Input
              label="Quantity to Assign"
              type="number"
              min="1"
              max={selectedSurplus.quantity}
              value={assignQuantity}
              onChange={(e) => setAssignQuantity(Number(e.target.value) || 1)}
              required
            />

            {/* Overload Notice & Override */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOverload}
                  onChange={(e) => setAllowOverload(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span className="text-xs text-amber-950 font-bold">
                  Authorize Capacity Overload (Permit &gt;100% capacity)
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
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                Confirm Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
