import { saveDocument, subscribeCollection } from '@/lib/storageSync';

const COLLECTION = 'auditLogs';

/**
 * Logs an administrative or automated action to the system audit trail.
 */
export async function logAuditAction({
  action,
  entityType,
  entityId,
  description,
  adminId = 'admin',
  metadata = {}
}) {
  try {
    return await saveDocument(COLLECTION, {
      action: action || 'UNKNOWN_ACTION',
      entityType: entityType || 'SYSTEM',
      entityId: entityId || '',
      description: description || '',
      adminId: adminId || 'admin',
      metadata,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Audit logging error:', err);
    return null;
  }
}

/**
 * Subscribes to real-time audit logs, sorted with newest first.
 */
export function subscribeAuditLogs(callback) {
  return subscribeCollection(COLLECTION, (logs) => {
    const sorted = [...(logs || [])].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    callback(sorted);
  });
}
