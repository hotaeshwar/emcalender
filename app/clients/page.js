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
import { validateClient } from '@/lib/validators';
import {
  subscribeClients,
  createClient,
  updateClient,
  deleteClient
} from '@/services/clientService';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Filter,
  CheckCircle,
  XCircle,
  Briefcase
} from 'lucide-react';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    clientCode: '',
    description: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error, warning } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeClients((data) => {
      setClients(data || []);
      setLoading(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      clientCode: '',
      description: '',
      status: 'active',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      clientCode: client.clientCode || '',
      description: client.description || '',
      status: client.status || 'active',
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validation = validateClient(formData, clients, editingClient?.id);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSaving(true);

    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
        success(`Client "${formData.name}" updated successfully.`);
      } else {
        await createClient(formData);
        success(`Client "${formData.name}" created successfully.`);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving client:', err);
      if (err.message && err.message.includes('Client Code')) {
        setErrors({ clientCode: err.message });
      } else {
        error(err.message || 'Failed to save client. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deleteClient(deleteTarget.id, deleteTarget.name);
      success(`Client "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting client:', err);
      error('Failed to delete client.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.clientCode && c.clientCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout
      title="Client Management"
      subtitle="Manage agency client accounts, codes, and active status"
    >
      <div className="space-y-6 bg-white">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Input
                placeholder="Search clients by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active Only' },
                  { value: 'inactive', label: 'Inactive Only' },
                ]}
              />
            </div>
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={openCreateModal}
            className="flex-shrink-0 bg-slate-900 hover:bg-slate-800 text-white font-extrabold"
          >
            Add New Client
          </Button>
        </div>

        {/* Clients Table / Cards */}
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={searchQuery || statusFilter !== 'all' ? 'No matching clients' : 'No clients added yet'}
            description={
              searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search query or filter options.'
                : 'Create your first client to start assigning work requirements.'
            }
            actionLabel={searchQuery || statusFilter !== 'all' ? null : 'Add Client'}
            onAction={openCreateModal}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Client Name</th>
                    <th className="py-3.5 px-6">Unique Client Code</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Description</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-800 font-extrabold flex items-center justify-center text-xs border border-indigo-200">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900">
                              {client.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono font-semibold">
                              ID: {client.id.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs font-bold text-slate-800">
                        {client.clientCode ? (
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 border border-slate-300 font-extrabold">
                            {client.clientCode}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">None</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant={client.status === 'active' ? 'success' : 'default'} size="sm">
                          {client.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600 font-medium max-w-xs truncate">
                        {client.description || '—'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit2}
                            onClick={() => openEditModal(client)}
                            className="text-slate-700 hover:text-slate-900 font-bold"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setDeleteTarget(client)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredClients.map((client) => (
                <div key={client.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">
                        {client.name}
                      </h4>
                      {client.clientCode && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-extrabold">
                          {client.clientCode}
                        </span>
                      )}
                    </div>
                    <Badge variant={client.status === 'active' ? 'success' : 'default'} size="sm">
                      {client.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {client.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {client.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Edit2}
                      onClick={() => openEditModal(client)}
                      className="flex-1 font-bold"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setDeleteTarget(client)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        subtitle="Clients will dynamically appear in work allocation dropdowns"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Client Name"
            name="name"
            placeholder="e.g. Acme Marketing, XYZ Corp"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={errors.name}
            required
          />

          <Input
            label="Client Code (Optional - Must be unique across all clients)"
            name="clientCode"
            placeholder="e.g. ACME, CHUTNEY"
            value={formData.clientCode}
            onChange={(e) => setFormData({ ...formData, clientCode: e.target.value.toUpperCase() })}
            error={errors.clientCode}
            helperText="Short uppercase code. Must be unique. Same code cannot be used."
          />

          <Select
            label="Status"
            name="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active (Available for work allocations)' },
              { value: 'inactive', label: 'Inactive (Archived)' },
            ]}
          />

          <Textarea
            label="Description / Notes (Optional)"
            name="description"
            placeholder="Key account details, brand guidelines, industry notes..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
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
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              {editingClient ? 'Update Client' : 'Save Client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Client"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? Deleting will remove this client from dropdowns.`}
        confirmText="Delete Client"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}
