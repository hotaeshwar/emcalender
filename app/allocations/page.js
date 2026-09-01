'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Select from '@/components/common/Select';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ConfirmModal from '@/components/common/ConfirmModal';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { useToast } from '@/contexts/ToastContext';
import {
  subscribeAllocations,
  deleteAllocation
} from '@/services/allocationService';
import { subscribeWorkWeeks } from '@/services/weekService';
import { subscribeClients } from '@/services/clientService';
import { subscribeEmployees } from '@/services/employeeService';
import { subscribeSurplusWork } from '@/services/allocationService';
import { exportAllocationReport } from '@/lib/exportExcel';
import Link from 'next/link';
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
  FileSpreadsheet
} from 'lucide-react';
import { ROLES } from '@/lib/constants';

export default function AllocationsListPage() {
  const [allocations, setAllocations] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [surplusList, setSurplusList] = useState([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [loading, setLoading] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubWeeks = subscribeWorkWeeks((data) => {
      setWeeks(data || []);
      if (data && data.length > 0 && !selectedWeekId) {
        setSelectedWeekId(data[0].id);
      }
    });

    const unsubClients = subscribeClients(setClients);
    const unsubEmployees = subscribeEmployees(setEmployees);
    const unsubSurplus = subscribeSurplusWork(setSurplusList);

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
    };
  }, [selectedWeekId]);

  const filteredAllocations = selectedWeekId
    ? allocations.filter((a) => a.weekId === selectedWeekId)
    : allocations;

  const currentWeek = weeks.find((w) => w.id === selectedWeekId) || weeks[0];
  const currentSurplus = surplusList.filter((s) => s.weekId === selectedWeekId);

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

  const handleExportExcel = () => {
    if (filteredAllocations.length === 0 && currentSurplus.length === 0) {
      error('No allocation records found for this week to export.');
      return;
    }

    exportAllocationReport({
      week: currentWeek,
      allocations: filteredAllocations,
      surplus: currentSurplus,
      clients,
      employees,
    });
    success('Color-coded Excel allocation report downloaded successfully!');
  };

  return (
    <AppLayout
      title="Work Allocations"
      subtitle="View, manage, and export confirmed automatic and manual work allocations"
    >
      <div className="space-y-6 bg-white">
        {/* Controls Bar with Animated Download Excel Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Filter by Week:
            </span>
            <div className="w-64">
              <Select
                value={selectedWeekId}
                onChange={(e) => setSelectedWeekId(e.target.value)}
                options={weeks.map((w) => ({
                  value: w.id,
                  label: `${w.name} (${w.startDate})`,
                }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DownloadExcelButton
              onExport={handleExportExcel}
              label="Download Excel Sheet"
              size="sm"
            />

            <Link href="/allocations/new">
              <Button variant="primary" size="sm" icon={Sparkles} className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-sm">
                Generate New Allocation
              </Button>
            </Link>
          </div>
        </div>

        {/* Allocations Table */}
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

          {loading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : filteredAllocations.length === 0 ? (
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
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Allocation Record"
        message={`Are you sure you want to delete this allocation for ${deleteTarget?.employeeName}?`}
        confirmText="Delete Record"
        variant="danger"
        isLoading={isDeleting}
      />
    </AppLayout>
  );
}
