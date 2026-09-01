'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import Modal from '@/components/common/Modal';
import Badge from '@/components/common/Badge';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeEmployeeAvailability,
  setEmployeeAvailability,
  deleteEmployeeAvailability
} from '@/services/availabilityService';
import { subscribeEmployees } from '@/services/employeeService';
import {
  CalendarCheck,
  Plus,
  Trash2,
  Calendar,
  Users,
  Clock
} from 'lucide-react';
import { AVAILABILITY_TYPES, AVAILABILITY_OPTIONS } from '@/lib/constants';

export default function AvailabilityPage() {
  const [availabilityList, setAvailabilityList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    availability: AVAILABILITY_TYPES.LEAVE,
    customCapacityUnits: '',
    reason: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubEmp = subscribeEmployees(setEmployees);
    const unsubAvail = subscribeEmployeeAvailability((data) => {
      setAvailabilityList(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubEmp) unsubEmp();
      if (unsubAvail) unsubAvail();
    };
  }, []);

  const openModal = () => {
    setFormData({
      employeeId: employees[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      availability: AVAILABILITY_TYPES.LEAVE,
      customCapacityUnits: '',
      reason: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.date) {
      error('Please select an employee and date.');
      return;
    }

    setIsSaving(true);
    try {
      const emp = employees.find((e) => e.id === formData.employeeId);
      await setEmployeeAvailability({
        ...formData,
        employeeName: emp?.name || '',
      });
      success(`Updated availability for ${emp?.name || 'employee'}.`);
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to save availability.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmployeeAvailability(id);
      success('Availability override removed.');
    } catch (err) {
      console.error(err);
      error('Failed to remove override.');
    }
  };

  return (
    <AppLayout
      title="Employee Availability & Leaves"
      subtitle="Log leaves, half-days, and custom capacity adjustments that modify effective capacity multipliers"
    >
      <div className="space-y-6 bg-white">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-600">
            <strong>Capacity Multipliers:</strong> Full Leave = 0x (0 units) • Half Day = 0.5x (50% units).
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={openModal}
            disabled={employees.length === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold"
          >
            Record Leave / Override
          </Button>
        </div>

        {/* Availability Table */}
        <Card>
          <CardHeader
            title="Recorded Leaves & Overrides"
            subtitle="Overrides are automatically applied during allocation engine runs"
          />

          {loading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : availabilityList.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No Overrides Recorded"
              description="All staff members are operating at standard 100% working day capacity."
              actionLabel="Record Leave / Override"
              onAction={openModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Staff Member</th>
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Availability Status</th>
                    <th className="py-3.5 px-6">Reason / Notes</th>
                    <th className="py-3.5 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {availabilityList.map((item) => {
                    const emp = employees.find((e) => e.id === item.employeeId);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 font-bold text-slate-900">
                          {item.employeeName || emp?.name || item.employeeId}
                        </td>

                        <td className="py-4 px-6 font-mono text-xs text-slate-700 font-semibold">
                          {item.date}
                        </td>

                        <td className="py-4 px-6">
                          {item.availability === AVAILABILITY_TYPES.LEAVE && (
                            <Badge variant="danger" size="sm">Full Leave (0x)</Badge>
                          )}
                          {item.availability === AVAILABILITY_TYPES.HALF_DAY && (
                            <Badge variant="warning" size="sm">Half Day (0.5x)</Badge>
                          )}
                          {item.availability === AVAILABILITY_TYPES.CUSTOM && (
                            <Badge variant="purple" size="sm">Custom ({item.customCapacityUnits} Units)</Badge>
                          )}
                          {item.availability === AVAILABILITY_TYPES.AVAILABLE && (
                            <Badge variant="success" size="sm">Available (1x)</Badge>
                          )}
                        </td>

                        <td className="py-4 px-6 text-xs text-slate-500">
                          {item.reason || '—'}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(item.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
      </div>

      {/* Add Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title="Record Staff Leave or Capacity Override"
        subtitle="Deducts or modifies working day capacity units during auto allocation"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Staff Member"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` }))}
            required
          />

          <Input
            label="Override Date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

          <Select
            label="Availability Status"
            value={formData.availability}
            onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
            options={AVAILABILITY_OPTIONS}
            required
          />

          {formData.availability === AVAILABILITY_TYPES.CUSTOM && (
            <Input
              label="Custom Capacity Units for this Date"
              type="number"
              min="0"
              step="0.5"
              value={formData.customCapacityUnits}
              onChange={(e) => setFormData({ ...formData, customCapacityUnits: e.target.value })}
              required
            />
          )}

          <Textarea
            label="Reason / Notes"
            placeholder="e.g. Sick leave, personal travel, doctor appointment..."
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            rows={2}
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
              Save Override
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
