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
  copyRequirementsBetweenWeeks
} from '@/services/requirementService';
import { subscribeClients } from '@/services/clientService';
import { subscribeWorkWeeks } from '@/services/weekService';
import {
  ClipboardList,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Sparkles,
  Calendar,
  Building2
} from 'lucide-react';

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Copy Week Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copyData, setCopyData] = useState({
    sourceWeekId: '',
    targetWeekId: '',
    overwrite: true,
  });
  const [isCopying, setIsCopying] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubClients = subscribeClients(setClients);
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data);
      if (data.length > 0 && selectedWeekFilter === 'all') {
        setSelectedWeekFilter(data[0].id);
      }
    });

    const unsubReqs = subscribeWorkRequirements((data) => {
      setRequirements(data);
      setLoading(false);
    });

    return () => {
      if (unsubClients) unsubClients();
      if (unsubWeeks) unsubWeeks();
      if (unsubReqs) unsubReqs();
    };
  }, []);

  const openCreateModal = () => {
    setEditingReq(null);
    const defaultWeek = selectedWeekFilter !== 'all' ? selectedWeekFilter : (weeks[0]?.id || '');
    const defaultClient = clientFilter !== 'all' ? clientFilter : (clients[0]?.id || '');

    setFormData({
      clientId: defaultClient,
      weekId: defaultWeek,
      requirements: {
        posts: 0,
        reels: 0,
        stories: 0,
      },
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
        posts: Number(req.requirements?.posts) || 0,
        reels: Number(req.requirements?.reels) || 0,
        stories: Number(req.requirements?.stories) || 0,
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

    setErrors({});
    setIsSaving(true);

    try {
      const clientObj = clients.find((c) => c.id === formData.clientId);
      const payload = {
        ...formData,
        clientName: clientObj?.name || '',
      };

      if (editingReq) {
        await updateWorkRequirement(editingReq.id, payload);
        success(`Updated deliverables for ${payload.clientName}.`);
      } else {
        await createWorkRequirement(payload);
        success(`Added work requirement for ${payload.clientName}.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      error('Failed to save requirements.');
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

  const openCopyModal = (prefilledSourceId = null) => {
    const src = prefilledSourceId || (selectedWeekFilter !== 'all' ? selectedWeekFilter : (weeks[0]?.id || ''));
    const remainingWeeks = weeks.filter((w) => w.id !== src);
    const target = remainingWeeks[0]?.id || '';

    setCopyData({
      sourceWeekId: src,
      targetWeekId: target,
      overwrite: true,
    });
    setIsCopyModalOpen(true);
  };

  const handleCopy = async (e) => {
    e.preventDefault();
    if (!copyData.sourceWeekId || !copyData.targetWeekId) {
      error('Please select both a Source Week and Target Week.');
      return;
    }
    if (copyData.sourceWeekId === copyData.targetWeekId) {
      error('Source Week and Target Week must be different.');
      return;
    }

    setIsCopying(true);
    try {
      const res = await copyRequirementsBetweenWeeks(copyData);
      const targetWk = weeks.find((w) => w.id === copyData.targetWeekId);
      success(`Successfully copied ${res.copiedCount} client deliverables to ${targetWk?.name || 'Target Week'}!`, 'Week Copied');
      setIsCopyModalOpen(false);
      setSelectedWeekFilter(copyData.targetWeekId);
    } catch (err) {
      console.error(err);
      error(err.message || 'Failed to copy requirements.');
    } finally {
      setIsCopying(false);
    }
  };

  const filteredRequirements = requirements.filter((r) => {
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
      subtitle="Define weekly deliverables (Posts, Reels, Stories) requested by clients"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Filter by Week:
            </span>
            <div className="w-64">
              <Select
                value={selectedWeekFilter}
                onChange={(e) => setSelectedWeekFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Weeks' },
                  ...weeks.map((w) => ({ value: w.id, label: `${w.name} (${w.startDate})` })),
                ]}
              />
            </div>

            {/* Quick Copy Action from selected week */}
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() => openCopyModal(selectedWeekFilter !== 'all' ? selectedWeekFilter : null)}
              disabled={weeks.length < 2 || requirements.length === 0}
              className="text-slate-700 hover:text-slate-900 border-slate-300 font-semibold"
            >
              Copy Week Requirements
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
                Reset
              </button>
            )}
          </div>

          <div className="text-xs font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            Showing {filteredRequirements.length} of {requirements.length} Requirements
          </div>
        </div>

        {/* Warning if No Masters */}
        {(clients.length === 0 || weeks.length === 0) && !loading && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-3">
            <span>
              <strong>Setup Required:</strong> You need at least 1 active Client and 1 Work Week before adding requirements.
            </span>
          </div>
        )}

        {/* Requirements Table */}
        {loading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredRequirements.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={searchQuery || clientFilter !== 'all' || selectedWeekFilter !== 'all' ? 'No Matching Requirements' : 'No Requirements Entered'}
            description={
              searchQuery || clientFilter !== 'all' || selectedWeekFilter !== 'all'
                ? 'Try resetting the search query or week/client filters.'
                : 'Add deliverable requirements for your clients for this week.'
            }
            actionLabel={searchQuery || clientFilter !== 'all' ? 'Clear Filters' : 'Add Requirement'}
            onAction={() => {
              if (searchQuery || clientFilter !== 'all') {
                setSearchQuery('');
                setClientFilter('all');
              } else {
                openCreateModal();
              }
            }}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Client</th>
                    <th className="py-3.5 px-6">Work Week</th>
                    <th className="py-3.5 px-6">Posts</th>
                    <th className="py-3.5 px-6">Reels</th>
                    <th className="py-3.5 px-6">Stories</th>
                    <th className="py-3.5 px-6">Notes</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredRequirements.map((req) => {
                    const client = clients.find((c) => c.id === req.clientId);
                    const week = weeks.find((w) => w.id === req.weekId);

                    return (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs">
                              {client?.name ? client.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {client?.name || req.clientName || 'Unknown Client'}
                              </p>
                              {client?.clientCode && (
                                <p className="text-[11px] font-mono text-slate-400">{client.clientCode}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6 font-medium text-slate-700">
                          {week?.name || 'Week ' + req.weekId}
                        </td>

                        <td className="py-4 px-6 font-bold text-blue-600">
                          {req.requirements?.posts || 0}
                        </td>

                        <td className="py-4 px-6 font-bold text-purple-600">
                          {req.requirements?.reels || 0}
                        </td>

                        <td className="py-4 px-6 font-bold text-amber-600">
                          {req.requirements?.stories || 0}
                        </td>

                        <td className="py-4 px-6 text-xs text-slate-500 max-w-xs truncate">
                          {req.notes || '—'}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit2}
                              onClick={() => openEditModal(req)}
                              className="text-slate-600 hover:text-slate-900"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => setDeleteTarget(req)}
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
        title={editingReq ? 'Edit Work Requirement' : 'Add Client Deliverables'}
        subtitle="Specify requested deliverables for automated capacity allocation"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Client"
            name="clientId"
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            options={clients.map((c) => ({ value: c.id, label: `${c.name} (${c.clientCode || 'No Code'})` }))}
            error={errors.clientId}
            required
          />

          <Select
            label="Target Work Week"
            name="weekId"
            value={formData.weekId}
            onChange={(e) => setFormData({ ...formData, weekId: e.target.value })}
            options={weeks.map((w) => ({ value: w.id, label: `${w.name} (${w.startDate})` }))}
            error={errors.weekId}
            required
          />

          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <Input
              label="Posts"
              name="posts"
              type="number"
              min="0"
              value={formData.requirements.posts}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, posts: Number(e.target.value) || 0 },
                })
              }
              error={errors['requirements.posts']}
            />
            <Input
              label="Reels"
              name="reels"
              type="number"
              min="0"
              value={formData.requirements.reels}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, reels: Number(e.target.value) || 0 },
                })
              }
              error={errors['requirements.reels']}
            />
            <Input
              label="Stories"
              name="stories"
              type="number"
              min="0"
              value={formData.requirements.stories}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  requirements: { ...formData.requirements, stories: Number(e.target.value) || 0 },
                })
              }
              error={errors['requirements.stories']}
            />
          </div>

          <Textarea
            label="Deliverable Notes / Focus (Optional)"
            name="notes"
            placeholder="e.g. Festival campaigns, carousel heavy, reel video editing emphasis..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
              {editingReq ? 'Update Deliverables' : 'Save Deliverables'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Requirement"
        message="Are you sure you want to remove this client requirement?"
        confirmText="Delete Requirement"
        isLoading={isDeleting}
      />

      {/* Copy Week Requirements Modal */}
      {isCopyModalOpen && (
        <Modal
          isOpen={isCopyModalOpen}
          onClose={() => !isCopying && setIsCopyModalOpen(false)}
          title="Copy Week Requirements"
          subtitle="Clone all client deliverables from one work week into another work week"
        >
          <form onSubmit={handleCopy} className="space-y-4">
            <Select
              label="Source Work Week (Copy From)"
              value={copyData.sourceWeekId}
              onChange={(e) => setCopyData({ ...copyData, sourceWeekId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Source Week --' },
                ...weeks.map((w) => {
                  const count = requirements.filter((r) => r.weekId === w.id).length;
                  return {
                    value: w.id,
                    label: `${w.name} (${w.startDate}) • ${count} Client Deliverables`,
                  };
                }),
              ]}
              required
            />

            <Select
              label="Target Work Week (Copy To)"
              value={copyData.targetWeekId}
              onChange={(e) => setCopyData({ ...copyData, targetWeekId: e.target.value })}
              options={[
                { value: '', label: '-- Choose Target Week --' },
                ...weeks
                  .filter((w) => w.id !== copyData.sourceWeekId)
                  .map((w) => {
                    const count = requirements.filter((r) => r.weekId === w.id).length;
                    return {
                      value: w.id,
                      label: `${w.name} (${w.startDate}) • currently ${count} items`,
                    };
                  }),
              ]}
              required
            />

            {/* Info Preview */}
            {copyData.sourceWeekId && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>Source Deliverables:</span>
                  <span className="font-extrabold text-slate-900">
                    {requirements.filter((r) => r.weekId === copyData.sourceWeekId).length} Client Requirements
                  </span>
                </div>
                {copyData.targetWeekId && (
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>Target Week Current Items:</span>
                    <span className="font-bold text-slate-700">
                      {requirements.filter((r) => r.weekId === copyData.targetWeekId).length} Existing Items
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Overwrite Toggle */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyData.overwrite}
                  onChange={(e) => setCopyData({ ...copyData, overwrite: e.target.checked })}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs text-indigo-950 font-bold block">
                    Overwrite existing deliverables in target week
                  </span>
                  <span className="text-[11px] text-indigo-800 block mt-0.5 leading-relaxed">
                    If checked, existing requirements in the target week will be replaced with the cloned source requirements. If unchecked, existing client entries are preserved.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsCopyModalOpen(false)}
                disabled={isCopying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isCopying}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
              >
                Copy & Apply Deliverables
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
