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
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { useToast } from '@/contexts/ToastContext';
import { validateWorkWeek } from '@/lib/validators';
import {
  subscribeWorkWeeks,
  createWorkWeek,
  updateWorkWeek,
  deleteWorkWeek
} from '@/services/weekService';
import { calculateWorkingDays } from '@/lib/capacityCalculator';
import { exportWorkWeeksReport } from '@/lib/exportExcel';
import {
  CalendarDays,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  Info,
  Search,
  Filter,
  RotateCcw,
  X
} from 'lucide-react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDayAndDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(date.getTime())) return dateStr;
    const dayName = DAY_NAMES[date.getDay()];
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dayName}, ${formattedDate} (${dateStr})`;
  } catch (e) {
    return dateStr;
  }
}

function getDistinctWeekdays(workingDates = []) {
  const daySet = new Set();
  workingDates.forEach((d) => {
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        daySet.add(dt.getDay());
      }
    } catch (e) {}
  });
  return [1, 2, 3, 4, 5, 6, 0].filter((idx) => daySet.has(idx));
}

export default function WorkWeeksPage() {
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [formData, setFormData] = useState({
    weekNumber: 1,
    name: '',
    startDate: '',
    endDate: '',
    workingDates: [],
    holidays: [],
    status: 'active',
  });
  const [activeDaysOfWeek, setActiveDaysOfWeek] = useState([1, 2, 3, 4, 5, 6]); // Mon-Sat by default
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // New Holiday Temp Inputs
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const openCreateModal = () => {
    setEditingWeek(null);
    const nextNum = weeks.length + 1;
    setFormData({
      weekNumber: nextNum,
      name: `Week ${nextNum}`,
      startDate: '',
      endDate: '',
      workingDates: [],
      holidays: [],
      status: 'active',
    });
    setActiveDaysOfWeek([1, 2, 3, 4, 5, 6]);
    setHolidayDate('');
    setHolidayName('');
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (week) => {
    setEditingWeek(week);
    setFormData({
      weekNumber: week.weekNumber || 1,
      name: week.name || '',
      startDate: week.startDate || '',
      endDate: week.endDate || '',
      workingDates: week.workingDates || [],
      holidays: week.holidays || [],
      status: week.status || 'active',
    });
    const weekdays = getDistinctWeekdays(week.workingDates || []);
    setActiveDaysOfWeek(weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5, 6]);
    setHolidayDate('');
    setHolidayName('');
    setErrors({});
    setIsModalOpen(true);
  };

  const generateDatesForSelectedDays = (daysArray = activeDaysOfWeek) => {
    if (!formData.startDate || !formData.endDate) return;
    try {
      const startParts = formData.startDate.split('-');
      const endParts = formData.endDate.split('-');
      const start = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]));
      const end = new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]));
      const dates = [];

      let curr = new Date(start);
      while (curr <= end) {
        const dayIndex = curr.getDay();
        if (daysArray.includes(dayIndex)) {
          const y = curr.getFullYear();
          const m = String(curr.getMonth() + 1).padStart(2, '0');
          const d = String(curr.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
        }
        curr.setDate(curr.getDate() + 1);
      }

      setFormData((prev) => ({ ...prev, workingDates: dates }));
    } catch (e) {
      console.error('Error generating dates:', e);
    }
  };

  const applyPreset = (presetDays) => {
    setActiveDaysOfWeek(presetDays);
    generateDatesForSelectedDays(presetDays);
  };

  const toggleDayOfWeek = (dayIndex) => {
    let updated;
    if (activeDaysOfWeek.includes(dayIndex)) {
      updated = activeDaysOfWeek.filter((d) => d !== dayIndex);
    } else {
      updated = [...activeDaysOfWeek, dayIndex].sort();
    }
    setActiveDaysOfWeek(updated);
    generateDatesForSelectedDays(updated);
  };

  const toggleWorkingDate = (dateStr) => {
    const current = formData.workingDates;
    if (current.includes(dateStr)) {
      setFormData({ ...formData, workingDates: current.filter((d) => d !== dateStr) });
    } else {
      setFormData({ ...formData, workingDates: [...current, dateStr].sort() });
    }
  };

  const handleAddHoliday = () => {
    if (!holidayDate) return;
    const newHoliday = {
      holidayDate,
      name: holidayName.trim() || 'Public Holiday',
    };
    setFormData({
      ...formData,
      holidays: [...formData.holidays, newHoliday],
    });
    setHolidayDate('');
    setHolidayName('');
  };

  const handleRemoveHoliday = (idx) => {
    setFormData({
      ...formData,
      holidays: formData.holidays.filter((_, i) => i !== idx),
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validation = validateWorkWeek(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      if (editingWeek) {
        await updateWorkWeek(editingWeek.id, formData);
        success(`Work week "${formData.name}" updated successfully.`);
      } else {
        await createWorkWeek(formData);
        success(`Work week "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to save work week.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deleteWorkWeek(deleteTarget.id, deleteTarget.name);
      success(`Work week "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      error('Failed to delete work week.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (weeks.length === 0) {
      error('No work weeks found to export.');
      return;
    }
    exportWorkWeeksReport(filteredWeeks.length > 0 ? filteredWeeks : weeks);
    success('Color-coded Excel work weeks schedule downloaded!');
  };

  const effectiveDaysPreview = calculateWorkingDays(formData.workingDates, formData.holidays);

  const filteredWeeks = weeks.filter((w) => {
    const matchesSearch =
      !searchQuery ||
      (w.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(w.weekNumber || '').includes(searchQuery) ||
      (w.startDate || '').includes(searchQuery) ||
      (w.endDate || '').includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || (w.status || 'active') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout
      title="Calendar & Work Weeks"
      subtitle="Configure operational work weeks, select active weekdays (Monday-Saturday), and manage holiday deductions"
    >
      <div className="space-y-6 bg-white">
        {/* Top Control Bar with Animated Excel Button & Add Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="text-xs text-slate-700 font-medium">
            <strong>Capacity Principle:</strong> Effective Days = Configured Working Days (Mon-Sat) − Public Holidays.
          </div>

          <div className="flex items-center gap-3">
            <DownloadExcelButton
              onExport={handleExportExcel}
              label="Download Schedule (Excel)"
              size="sm"
            />

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openCreateModal}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              Add Work Week
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by week title, number, or date (e.g. Week 1, 2026-09)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="w-48">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active Weeks' },
                  { value: 'draft', label: 'Draft Weeks' },
                ]}
              />
            </div>

            {(searchQuery || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
              Showing {filteredWeeks.length} of {weeks.length} Work Weeks
            </span>
          </div>
        </div>

        {/* Work Weeks Table View */}
        {loading ? (
          <SkeletonTable rows={4} cols={7} />
        ) : weeks.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No Work Weeks Configured"
            description="Create your first work week to enable deliverable assignment and capacity calculation."
            actionLabel="Create Work Week"
            onAction={openCreateModal}
          />
        ) : filteredWeeks.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No Matching Work Weeks Found"
            description="Try clearing your search query or adjusting the status filter."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center">Week No</th>
                    <th className="py-3.5 px-5">Week Title</th>
                    <th className="py-3.5 px-5">Date Range</th>
                    <th className="py-3.5 px-5">Active Weekdays</th>
                    <th className="py-3.5 px-4 text-center">Effective Days</th>
                    <th className="py-3.5 px-4">Holidays</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-5 text-right">CRUD Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredWeeks.map((week, idx) => {
                    const activeDays = getDistinctWeekdays(week.workingDates || []);

                    return (
                      <tr key={week.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Week No */}
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 font-extrabold text-xs">
                            Week {week.weekNumber || (idx + 1)}
                          </span>
                        </td>

                        {/* Week Title */}
                        <td className="py-4 px-5 font-bold text-slate-900">
                          {week.name}
                        </td>

                        {/* Date Range */}
                        <td className="py-4 px-5 font-mono text-xs text-slate-800 font-bold">
                          {week.startDate} → {week.endDate}
                        </td>

                        {/* Active Weekdays Badges (Mon, Tue, Wed, Thu, Fri, Sat) */}
                        <td className="py-4 px-5">
                          <div className="flex flex-wrap gap-1">
                            {activeDays.length > 0 ? (
                              activeDays.map((dayIdx) => (
                                <span
                                  key={dayIdx}
                                  className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                                >
                                  {DAY_SHORT[dayIdx]}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">None</span>
                            )}
                          </div>
                        </td>

                        {/* Effective Working Days */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            {week.calculatedWorkingDays || 5} Days
                          </span>
                        </td>

                        {/* Holidays */}
                        <td className="py-4 px-4">
                          {week.holidays && week.holidays.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              {week.holidays.length} Holiday{week.holidays.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          <Badge variant={week.status === 'active' ? 'success' : 'default'} size="sm">
                            {week.status === 'active' ? 'Active' : 'Draft'}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit2}
                              onClick={() => openEditModal(week)}
                              className="text-slate-700 hover:text-slate-900 font-bold"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => setDeleteTarget(week)}
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
        title={editingWeek ? 'Edit Work Week' : 'Create Work Week'}
        subtitle="Specify start/end dates, select active working days (Monday-Saturday), and add holidays"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Week Number"
              type="number"
              min="1"
              value={formData.weekNumber}
              onChange={(e) => setFormData({ ...formData, weekNumber: Number(e.target.value) || 1 })}
              error={errors.weekNumber}
              required
            />
            <Input
              label="Week Title"
              value={formData.name}
              placeholder="e.g. Week 1 - Campaign Launch"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => {
                const newStart = e.target.value;
                setFormData((prev) => ({ ...prev, startDate: newStart }));
              }}
              error={errors.startDate}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => {
                const newEnd = e.target.value;
                setFormData((prev) => ({ ...prev, endDate: newEnd }));
              }}
              error={errors.endDate}
              required
            />
          </div>

          {/* Days of the Week Selector (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday) */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Select Active Days of the Week:
                </h4>
                <p className="text-[11px] text-slate-600">
                  Toggle which weekdays are considered working days for this week.
                </p>
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset([1, 2, 3, 4, 5])}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  Mon - Fri (5 Days)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset([1, 2, 3, 4, 5, 6])}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100"
                >
                  Mon - Sat (6 Days)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset([0, 1, 2, 3, 4, 5, 6])}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                >
                  All 7 Days
                </button>
              </div>
            </div>

            {/* Weekday Checkbox Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 pt-1">
              {[
                { index: 1, label: 'Monday', short: 'Mon' },
                { index: 2, label: 'Tuesday', short: 'Tue' },
                { index: 3, label: 'Wednesday', short: 'Wed' },
                { index: 4, label: 'Thursday', short: 'Thu' },
                { index: 5, label: 'Friday', short: 'Fri' },
                { index: 6, label: 'Saturday', short: 'Sat' },
                { index: 0, label: 'Sunday', short: 'Sun' },
              ].map((day) => {
                const isSelected = activeDaysOfWeek.includes(day.index);
                return (
                  <button
                    type="button"
                    key={day.index}
                    onClick={() => toggleDayOfWeek(day.index)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span>{day.short}</span>
                    <span className="text-[10px] font-normal opacity-90">{day.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => generateDatesForSelectedDays(activeDaysOfWeek)}
                disabled={!formData.startDate || !formData.endDate}
                className="bg-white text-slate-800 border-slate-300 hover:bg-slate-100 font-bold"
              >
                Apply Weekdays to Date Range
              </Button>
            </div>
          </div>

          {/* Generated Working Dates List with Day Names */}
          <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-900">
                Generated Working Dates ({formData.workingDates.length})
              </span>
              <span className="text-emerald-700 font-extrabold">
                {effectiveDaysPreview} Effective Working Days
              </span>
            </div>

            {formData.workingDates.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">
                Set start and end dates above and click &quot;Apply Weekdays to Date Range&quot;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {formData.workingDates.map((dateStr) => (
                  <button
                    type="button"
                    key={dateStr}
                    onClick={() => toggleWorkingDate(dateStr)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-bold hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <span>{formatDayAndDate(dateStr)}</span>
                    <span className="text-slate-400 hover:text-rose-600">✕</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Holidays Manager */}
          <div className="space-y-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl">
            <span className="block text-xs font-bold text-amber-950">
              Public Holidays & Office Closures ({formData.holidays.length})
            </span>

            <div className="flex gap-2">
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white text-slate-900 font-bold"
              />
              <input
                type="text"
                placeholder="Holiday Name (e.g. Diwali, Ganesh Chaturthi)"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="text-xs flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900 font-medium"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddHoliday}
                disabled={!holidayDate}
                className="bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 font-bold"
              >
                Add Holiday
              </Button>
            </div>

            {formData.holidays.length > 0 && (
              <div className="space-y-1">
                {formData.holidays.map((h, i) => (
                  <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white border border-amber-200 text-xs font-semibold text-slate-900">
                    <span><strong>{h.name}</strong> ({formatDayAndDate(h.holidayDate || h.date)})</span>
                    <button type="button" onClick={() => handleRemoveHoliday(i)} className="text-rose-600 hover:font-bold">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              {editingWeek ? 'Update Week' : 'Save Work Week'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Work Week"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmText="Delete Week"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}
