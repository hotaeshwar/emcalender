'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import ConfirmModal from '@/components/common/ConfirmModal';
import Badge from '@/components/common/Badge';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { validateEmployee } from '@/lib/validators';
import {
  subscribeEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from '@/services/employeeService';
import { subscribeCapacityRules } from '@/services/capacityService';
import { calculateDailyEmployeeCapacity } from '@/lib/capacityCalculator';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sliders,
  Calendar,
  Sparkles
} from 'lucide-react';
import { ROLES, ROLE_OPTIONS, normalizeRole } from '@/lib/constants';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [capacityRules, setCapacityRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeCode: '',
    role: ROLES.GRAPHIC_DESIGNER,
    customCapacityRuleId: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubEmployees = subscribeEmployees((data) => {
      setEmployees(data || []);
      setLoading(false);
    });

    const unsubRules = subscribeCapacityRules((data) => {
      setCapacityRules(data || []);
    });

    return () => {
      if (unsubEmployees) unsubEmployees();
      if (unsubRules) unsubRules();
    };
  }, []);

  const openCreateModal = () => {
    setEditingEmp(null);
    setFormData({
      name: '',
      employeeCode: '',
      role: ROLES.GRAPHIC_DESIGNER,
      customCapacityRuleId: '',
      status: 'active',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (emp) => {
    setEditingEmp(emp);
    const resolvedRole = normalizeRole(emp.role, emp.employeeCode);
    setFormData({
      name: emp.name || '',
      employeeCode: emp.employeeCode || '',
      role: resolvedRole || ROLES.GRAPHIC_DESIGNER,
      customCapacityRuleId: emp.customCapacityRuleId || '',
      status: emp.status || 'active',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validation = validateEmployee(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      if (editingEmp) {
        await updateEmployee(editingEmp.id, formData);
        success(`Employee "${formData.name}" updated successfully.`);
      } else {
        await createEmployee(formData);
        success(`Employee "${formData.name}" added successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving employee:', err);
      error('Failed to save employee.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deleteEmployee(deleteTarget.id, deleteTarget.name);
      success(`Employee "${deleteTarget.name}" removed successfully.`);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting employee:', err);
      error('Failed to delete employee.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      (emp.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.employeeCode && emp.employeeCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || emp.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <AppLayout
      title="Employee & Team Management"
      subtitle="Manage agency staff, roles, and baseline capacity units"
    >
      <div className="space-y-6 bg-white">
        {/* Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search staff by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <div className="w-52">
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Roles' },
                  ...ROLE_OPTIONS,
                ]}
              />
            </div>
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreateModal}
            className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
          >
            Add Team Member
          </Button>
        </div>

        {/* Employees Table */}
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchQuery || roleFilter !== 'all' ? 'No matching staff members' : 'No staff added yet'}
            description={
              searchQuery || roleFilter !== 'all'
                ? 'Try adjusting your search query or role filter.'
                : 'Add graphic designers and video editors to enable automated work allocation.'
            }
            actionLabel={searchQuery || roleFilter !== 'all' ? null : 'Add Team Member'}
            onAction={openCreateModal}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Team Member</th>
                    <th className="py-3.5 px-6">Staff Code</th>
                    <th className="py-3.5 px-6">Role</th>
                    <th className="py-3.5 px-6">Baseline Daily Capacity</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredEmployees.map((emp) => {
                    const dailyCapUnits = calculateDailyEmployeeCapacity(emp, capacityRules);

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {emp.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 font-mono text-xs font-bold text-slate-700">
                          {emp.employeeCode ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                              {emp.employeeCode}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic font-normal">None</span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <Badge role={emp.role} size="sm" />
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900">
                              {dailyCapUnits} Units / Day
                            </span>
                            <span className="text-[11px] text-slate-500">
                              ({emp.role === ROLES.GRAPHIC_DESIGNER ? '3P + 1R + 1S' : '3R + 1S'})
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <Badge variant={emp.status === 'active' ? 'success' : 'default'} size="sm">
                            {emp.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit2}
                              onClick={() => openEditModal(emp)}
                              className="text-slate-600 hover:text-slate-900"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => setDeleteTarget(emp)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </Button>
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingEmp ? 'Edit Team Member' : 'Add Team Member'}
        subtitle="Staff members will receive auto-allocated work based on their role and capacity rules"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            placeholder="e.g. Rahul Sharma, Priya Nair"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            required
          />

          <Input
            label="Employee Code"
            name="employeeCode"
            placeholder="e.g. EMP001, GD01"
            value={formData.employeeCode}
            onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
            error={errors.employeeCode}
            required
            helperText="Unique identifier for allocation reports"
          />

          <Select
            label="Designation / Role"
            name="role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={ROLE_OPTIONS}
            required
          />

          <Select
            label="Status"
            name="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active (Available for automatic allocation)' },
              { value: 'inactive', label: 'Inactive (Excluded from allocation)' },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
            >
              {editingEmp ? 'Update Employee' : 'Save Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Team Member"
        message={`Are you sure you want to remove "${deleteTarget?.name}"? Deleting will remove this staff member from future allocations.`}
        confirmText="Delete Member"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}
