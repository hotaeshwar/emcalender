'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import Card, { CardHeader } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import ConfirmModal from '@/components/common/ConfirmModal';
import DownloadExcelButton from '@/components/common/DownloadExcelButton';
import { SkeletonTable } from '@/components/common/LoadingSkeleton';
import EmptyState from '@/components/common/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { subscribeAuditLogs } from '@/services/auditService';
import { seedDefaultCapacityRules } from '@/services/capacityService';
import { exportToCSV } from '@/lib/exportExcel';
import {
  Settings,
  Shield,
  RotateCcw,
  Sparkles,
  Database,
  FileText,
  Clock,
  User,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

export default function SettingsPage() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeAuditLogs((data) => {
      setAuditLogs(data || []);
      setLoading(false);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleSeedRules = async () => {
    setIsSeeding(true);
    try {
      await seedDefaultCapacityRules();
      success('Default capacity rules populated successfully.');
      setShowSeedConfirm(false);
    } catch (err) {
      console.error('Error seeding rules:', err);
      error('Failed to seed capacity rules.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportAuditExcel = () => {
    if (auditLogs.length === 0) {
      error('No audit logs available to export.');
      return;
    }

    const rows = auditLogs.map((log) => ({
      Action: log.action || 'UNKNOWN',
      Description: log.description || '',
      EntityType: log.entityType || '',
      EntityID: log.entityId || '',
      User: log.adminId || 'admin',
      Timestamp: log.createdAt || '',
    }));

    exportToCSV('Bid_System_Audit_Trail', rows);
    success('Color-coded audit log spreadsheet downloaded successfully!');
  };

  return (
    <AppLayout
      title="Settings & System Audit Trail"
      subtitle="System maintenance, capacity rule seeders, and real-time operational audit logs"
    >
      <div className="space-y-6 bg-white">
        {/* Top Control Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rules Seeder Card */}
          <Card>
            <CardHeader
              title="Capacity Rules Baseline"
              subtitle="Reset or populate default productivity rules for Graphic Designers and Video Editors"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => setShowSeedConfirm(true)}
                  isLoading={isSeeding}
                  className="font-bold text-slate-800"
                >
                  Reset Defaults
                </Button>
              }
            />
            <div className="space-y-3 text-xs text-slate-700 font-medium">
              <p>
                <strong>Graphic Designer:</strong> 3 Posts/day (1x weight), 1 Reel/day (3x post-effort weight), 1 Story/day (1x weight) = <strong>7 Units/day</strong>.
              </p>
              <p>
                <strong>Video Editor:</strong> 3 Reels/day (1x weight), 1 Story/day (1x weight) = <strong>4 Units/day</strong>.
              </p>
              <p className="text-[11px] text-slate-500">
                You can further customize these numbers per rule in the Capacity Rules page.
              </p>
            </div>
          </Card>

          {/* Database Status */}
          <Card>
            <CardHeader
              title="Database & Storage Engine"
              subtitle="calender-a1426.firebaseapp.com"
              action={
                <span className="flex items-center gap-1.5 text-xs text-emerald-800 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Hybrid Sync Online
                </span>
              }
            />
            <div className="space-y-2 text-xs text-slate-700 font-medium">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Primary Database:</span>
                <span className="font-bold text-slate-900">Google Cloud Firestore</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Offline Resilience:</span>
                <span className="font-bold text-slate-900">Persistent LocalStorage Cache</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">Batch Transactions:</span>
                <span className="font-bold text-emerald-700">Enabled (Atomic Commits)</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Real-Time Audit Logs Table */}
        <Card>
          <CardHeader
            title="System Audit Logs"
            subtitle="Immutable activity trail tracking client creation, employee edits, and automated allocation runs"
            action={
              <div className="flex items-center gap-3">
                <DownloadExcelButton
                  onExport={handleExportAuditExcel}
                  label="Download Audit Logs (Excel)"
                  size="sm"
                />
                <Badge variant="purple" size="sm">
                  {auditLogs.length} Logged Events
                </Badge>
              </div>
            }
          />

          {loading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : auditLogs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Audit Logs Recorded Yet"
              description="Actions performed across the application will be automatically logged here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {auditLogs.map((log) => {
                    let badgeStyle = 'default';
                    if (log.action?.includes('CREATED') || log.action?.includes('ADD')) badgeStyle = 'success';
                    if (log.action?.includes('DELETED') || log.action?.includes('REMOVE')) badgeStyle = 'danger';
                    if (log.action?.includes('UPDATED') || log.action?.includes('EDIT')) badgeStyle = 'warning';
                    if (log.action?.includes('ALLOCATION')) badgeStyle = 'purple';

                    const timeDisplay = log.createdAt
                      ? new Date(log.createdAt).toLocaleString()
                      : 'Just now';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <Badge variant={badgeStyle} size="sm">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-slate-900 max-w-md">
                          {log.description}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-500 font-medium">
                          {log.entityType} {log.entityId ? `(${log.entityId.substring(0, 6)}...)` : ''}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 font-semibold">
                          {log.adminId || 'admin'}
                        </td>
                        <td className="py-3 px-4 text-xs text-right text-slate-500 font-mono">
                          {timeDisplay}
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

      {/* Seed Rules Confirmation */}
      <ConfirmModal
        isOpen={showSeedConfirm}
        onClose={() => !isSeeding && setShowSeedConfirm(false)}
        onConfirm={handleSeedRules}
        title="Seed Default Capacity Rules"
        message="This will overwrite capacity rules with the recommended agency baseline. Do you wish to continue?"
        confirmText="Populate Rules"
        variant="brand"
        isLoading={isSeeding}
      />
    </AppLayout>
  );
}
