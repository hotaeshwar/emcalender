'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Textarea from '@/components/common/Textarea';
import Modal from '@/components/common/Modal';
import ConfirmModal from '@/components/common/ConfirmModal';
import Badge from '@/components/common/Badge';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { validateWorkRequirement } from '@/lib/validators';
import {
  subscribeWorkRequirements,
  createWorkRequirement,
  updateWorkRequirement,
  deleteWorkRequirement,
  copyRequirementsBetweenWeeks,
  copyRequirementsBetweenMonths
} from '@/services/requirementService';
import { subscribeClients } from '@/services/clientService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { groupWeeksByMonth, getActiveMonth } from '@/lib/monthUtils';
import {
  ClipboardList,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Sparkles,
  Calendar,
  Building2,
  Layers,
  RotateCcw
} from 'lucide-react';

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedMonthFilter, setSelectedMonthFilter] = useState('all');
  const [selectedWeekFilter, setSelectedWeekFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [formData, setFormData] = useState({
    clientId: '',
    weekId: '',
    requirements: {
      posts: 0,
      reels: 0,
      stories: 0,
    },
    notes: '',
    status: 'submitted',
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copy Week / Month Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyMode, setCopyMode] = useState('month'); // 'month' | 'week'
  const [copyData, setCopyData] = useState({
    sourceMonthKey: '',
    targetMonthKey: '',
    sourceWeekId: '',
    targetWeekId: '',
    overwrite: true,
  });
  const [isCopying, setIsCopying] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubClients = subscribeClients(setClients);
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      const grouped = groupWeeksByMonth(data || []);
      setMonths(grouped);
      const activeM = getActiveMonth(data || []);
      if (activeM && selectedMonthFilter === 'all') {
        setSelectedMonthFilter(activeM.monthKey);
      }
    });

    const unsubReqs = subscribeWorkRequirements((data) => {
      setRequirements(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubClients) unsubClients();
      if (unsubWeeks) unsubWeeks();
      if (unsubReqs) unsubReqs();
    };
  }, []);

  const currentMonthData = months.find((m) => m.monthKey === selectedMonthFilter) || months[0];
  const monthWeeks = currentMonthData?.weeks || weeks;

  const openCreateModal = () => {
    setEditingReq(null);
    setFormData({
      clientId: clients[0]?.id || '',
      weekId: selectedWeekFilter !== 'all' ? selectedWeekFilter : (monthWeeks[0]?.id || weeks[0]?.id || ''),
      requirements: { posts: 2, reels: 1, stories: 1 },
      notes: '',
      status: 'submitted',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (req) => {
    setEditingReq(req);
    setFormData({
      clientId: req.clientId,
      weekId: req.weekId,
      requirements: {
        posts: req.requirements?.posts || 0,
        reels: req.requirements?.reels || 0,
        stories: req.requirements?.stories || 0,
      },
      notes: req.notes || '',
      status: req.status || 'submitted',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validation = validateWorkRequirement(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    try {
      const client = clients.find((c) => c.id === formData.clientId);
      const payload = {
        ...formData,
        clientName: client?.name || '',
      };

      if (editingReq) {
        await updateWorkRequirement(editingReq.id, payload);
        success('Requirements updated successfully.');
      } else {
        await createWorkRequirement(payload);
        success('Requirements added successfully.');
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      error(err.message || 'Failed to save requirement.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const clientName = clients.find((c) => c.id === deleteTarget.clientId)?.name;
      await deleteWorkRequirement(deleteTarget.id, clientName);
      success('Requirement deleted successfully.');
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      error('Failed to delete requirement.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openCopyModal = () => {
    const srcM = selectedMonthFilter !== 'all' ? selectedMonthFilter : (months[0]?.monthKey || '');
    const remMonths = months.filter((m) => m.monthKey !== srcM);
    const targetM = remMonths[0]?.monthKey || '';

    const srcW = selectedWeekFilter !== 'all' ? selectedWeekFilter : (monthWeeks[0]?.id || weeks[0]?.id || '');
    const remWeeks = weeks.filter((w) => w.id !== srcW);
    const targetW = remWeeks[0]?.id || '';

    setCopyData({
      sourceMonthKey: srcM,
      targetMonthKey: targetM,
      sourceWeekId: srcW,
      targetWeekId: targetW,
      overwrite: true,
    });
    setCopyMode(selectedWeekFilter !== 'all' ? 'week' : 'month');
    setIsCopyModalOpen(true);
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    setIsCopying(true);
    try {
      if (copyMode === 'month') {
        if (!copyData.sourceMonthKey || !copyData.targetMonthKey) {
          error('Please select both a Source Month and Target Month.');
          return;
        }
        if (copyData.sourceMonthKey === copyData.targetMonthKey) {
          error('Source Month and Target Month must be different.');
          return;
        }
        const res = await copyRequirementsBetweenMonths({
          sourceMonthKey: copyData.sourceMonthKey,
          targetMonthKey: copyData.targetMonthKey,
          overwrite: copyData.overwrite,
        });
        const targetMLabel = months.find((m) => m.monthKey === copyData.targetMonthKey)?.monthLabel || copyData.targetMonthKey;
        success(`Successfully copied ${res.copiedCount} client deliverables to ${targetMLabel}!`, 'Month Copied');
        setSelectedMonthFilter(copyData.targetMonthKey);
      } else {
        if (!copyData.sourceWeekId || !copyData.targetWeekId) {
          error('Please select both a Source Week and Target Week.');
          return;
        }
        if (copyData.sourceWeekId === copyData.targetWeekId) {
          error('Source Week and Target Week must be different.');
          return;
        }
        const res = await copyRequirementsBetweenWeeks(copyData);
        const targetWk = weeks.find((w) => w.id === copyData.targetWeekId);
        success(`Successfully copied ${res.copiedCount} client deliverables to ${targetWk?.name || 'Target Week'}!`, 'Week Copied');
        setSelectedWeekFilter(copyData.targetWeekId);
      }
      setIsCopyModalOpen(false);
    } catch (err) {
      console.error(err);
      error(err.message || 'Failed to copy requirements.');
    } finally {
      setIsCopying(false);
    }
  };

  const filteredRequirements = requirements.filter((r) => {
    if (selectedMonthFilter !== 'all') {
      const matchMonth = monthWeeks.some((w) => w.id === r.weekId) || r.monthKey === selectedMonthFilter;
      if (!matchMonth) return false;
    }
    if (selectedWeekFilter !== 'all' && r.weekId !== selectedWeekFilter) return false;
    if (clientFilter !== 'all' && r.clientId !== clientFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchClient = (r.clientName || '').toLowerCase().includes(q) || (r.clientId || '').toLowerCase().includes(q);
      const matchNotes = (r.notes || '').toLowerCase().includes(q);
      if (!matchClient && !matchNotes) return false;
    }
    return true;
  });

  return (
    <AppLayout
      title="Client Work Requirements"
      subtitle="Define Month-Wise and Week-Wise deliverables (Posts, Reels, Stories) requested by clients"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Filter by Month:
            </span>
            <div className="w-56">
              <Select
                value={selectedMonthFilter}
                onChange={(e) => {
                  setSelectedMonthFilter(e.target.value);
                  setSelectedWeekFilter('all');
                }}
                options={[
                  { value: 'all', label: 'All Months' },
                  ...months.map((m) => ({ value: m.monthKey, label: `${m.monthLabel} (${m.weeks.length} Wks)` })),
                ]}
              />
            </div>

            {/* Quick Copy Action */}
            <Button
              variant="secondary"
              icon={Copy}
              onClick={openCopyModal}
              disabled={months.length < 2 && weeks.length < 2}
              className="text-slate-700 hover:text-slate-900 border-slate-300 font-semibold"
            >
              Copy Requirements
            </Button>
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreateModal}
            disabled={clients.length === 0 || weeks.length === 0}
            className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 text-white font-semibold"
          >
            Add Work Requirement
          </Button>
        </div>

        {/* Week Tabs Sub-Selector */}
        {selectedMonthFilter !== 'all' && monthWeeks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setSelectedWeekFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all ${
                selectedWeekFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Full {currentMonthData?.monthLabel || 'Month'} Combined</span>
            </button>

            {monthWeeks.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeekFilter(w.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                  selectedWeekFilter === w.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-900'
                }`}
              >
                {w.name} ({w.startDate})
              </button>
            ))}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search by client name or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>

            <div className="w-56">
              <Select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Clients' },
                  ...clients.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            {(searchQuery || clientFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setClientFilter('all');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="font-extrabold text-slate-900">{filteredRequirements.length}</span> deliverables
          </div>
        </div>

        {/* Requirements Table */}
        <Card>
          <CardHeader
            title={`Client Deliverable Requirements (${filteredRequirements.length})`}
            subtitle={`Configured deliverables for ${selectedMonthFilter !== 'all' ? currentMonthData?.monthLabel : 'All Months'}`}
          />

          {loading ? (
            <SkeletonTable rows={5} columns={6} />
          ) : filteredRequirements.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No Requirements Found"
              description="Add deliverables for your clients or copy from another month."
              actionLabel="Add Work Requirement"
              onAction={openCreateModal}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Work Week</th>
                    <th className="py-3 px-4 text-center">Posts</th>
                    <th className="py-3 px-4 text-center">Reels</th>
                    <th className="py-3 px-4 text-center">Stories</th>
                    <th className="py-3 px-4 text-center">Total Deliverables</th>
                    <th className="py-3 px-4">Notes</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequirements.map((req) => {
                    const client = clients.find((c) => c.id === req.clientId);
                    const week = weeks.find((w) => w.id === req.weekId);
                    const totalItems = (req.requirements?.posts || 0) + (req.requirements?.reels || 0) + (req.requirements?.stories || 0);

                    return (
                      <tr key={req.id} className="hover:bg-slate-50 transition-all">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {client?.name || req.clientName || req.clientId}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-medium">
                          {week?.name || req.weekId}
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-blue-700">
                          {req.requirements?.posts || 0}
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-purple-700">
                          {req.requirements?.reels || 0}
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-amber-700">
                          {req.requirements?.stories || 0}
                        </td>
                        <td className="py-3.5 px-4 text-center font-extrabold text-slate-900 bg-slate-50">
                          {totalItems} Deliverables
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                          {req.notes || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit2}
                            onClick={() => openEditModal(req)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setDeleteTarget(req)}
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
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingReq ? 'Edit Client Deliverables' : 'Add Client Deliverables'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Client"
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            options={clients.map((c) => ({ value: c.id, label: c.name }))}
            error={errors.clientId}
            required
          />

          <Select
            label="Work Week"
            value={formData.weekId}
            onChange={(e) => setFormData({ ...formData, weekId: e.target.value })}
            options={weeks.map((w) => ({ value: w.id, label: `${w.name} (${w.startDate})` }))}
            error={errors.weekId}
            required
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Posts"
              type="number"
              min="0"
              value={formData.requirements.posts}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, posts: Number(e.target.value) || 0 },
                })
              }
            />
            <Input
              label="Reels"
              type="number"
              min="0"
              value={formData.requirements.reels}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, reels: Number(e.target.value) || 0 },
                })
              }
            />
            <Input
              label="Stories"
              type="number"
              min="0"
              value={formData.requirements.stories}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, stories: Number(e.target.value) || 0 },
                })
              }
            />
          </div>

          <Textarea
            label="Notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={isSaving} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
              {editingReq ? 'Update Deliverables' : 'Save Deliverables'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Requirement"
        message="Are you sure you want to delete this deliverable requirement?"
        confirmText="Delete Requirement"
        isLoading={isDeleting}
      />

      {/* Copy Requirements Modal (Month or Week) */}
      {isCopyModalOpen && (
        <Modal
          isOpen={isCopyModalOpen}
          onClose={() => setIsCopyModalOpen(false)}
          title="Clone / Copy Client Deliverables"
          subtitle="Quickly replicate deliverables between Months or between specific Work Weeks"
        >
          <form onSubmit={handleCopy} className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCopyMode('month')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold ${
                  copyMode === 'month' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700'
                }`}
              >
                1. Copy Entire Month
              </button>
              <button
                type="button"
                onClick={() => setCopyMode('week')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold ${
                  copyMode === 'week' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700'
                }`}
              >
                2. Copy Single Week
              </button>
            </div>

            {copyMode === 'month' ? (
              <>
                <Select
                  label="Source Month (Copy From)"
                  value={copyData.sourceMonthKey}
                  onChange={(e) => setCopyData({ ...copyData, sourceMonthKey: e.target.value })}
                  options={[
                    { value: '', label: '-- Choose Source Month --' },
                    ...months.map((m) => ({
                      value: m.monthKey,
                      label: `${m.monthLabel} (${m.weeks.length} Weeks)`,
                    })),
                  ]}
                  required
                />

                <Select
                  label="Target Month (Copy To)"
                  value={copyData.targetMonthKey}
                  onChange={(e) => setCopyData({ ...copyData, targetMonthKey: e.target.value })}
                  options={[
                    { value: '', label: '-- Choose Target Month --' },
                    ...months
                      .filter((m) => m.monthKey !== copyData.sourceMonthKey)
                      .map((m) => ({
                        value: m.monthKey,
                        label: `${m.monthLabel} (${m.weeks.length} Weeks)`,
                      })),
                  ]}
                  required
                />
              </>
            ) : (
              <>
                <Select
                  label="Source Week (Copy From)"
                  value={copyData.sourceWeekId}
                  onChange={(e) => setCopyData({ ...copyData, sourceWeekId: e.target.value })}
                  options={[
                    { value: '', label: '-- Choose Source Week --' },
                    ...weeks.map((w) => ({
                      value: w.id,
                      label: `${w.name} (${w.startDate})`,
                    })),
                  ]}
                  required
                />

                <Select
                  label="Target Week (Copy To)"
                  value={copyData.targetWeekId}
                  onChange={(e) => setCopyData({ ...copyData, targetWeekId: e.target.value })}
                  options={[
                    { value: '', label: '-- Choose Target Week --' },
                    ...weeks
                      .filter((w) => w.id !== copyData.sourceWeekId)
                      .map((w) => ({
                        value: w.id,
                        label: `${w.name} (${w.startDate})`,
                      })),
                  ]}
                  required
                />
              </>
            )}

            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyData.overwrite}
                  onChange={(e) => setCopyData({ ...copyData, overwrite: e.target.checked })}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-indigo-950 font-bold">
                  Overwrite existing deliverables in target {copyMode === 'month' ? 'month' : 'week'}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setIsCopyModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary" isLoading={isCopying} className="bg-slate-900 hover:bg-slate-800 text-white font-bold">
                Copy Deliverables
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
