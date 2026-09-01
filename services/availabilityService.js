import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { AVAILABILITY_TYPES } from '@/lib/constants';

const COLLECTION_NAME = 'employeeAvailability';

export function subscribeEmployeeAvailability(callback, employeeId = null) {
  return subscribeCollection(COLLECTION_NAME, (avails) => {
    if (employeeId) {
      callback(avails.filter((a) => a.employeeId === employeeId));
    } else {
      callback(avails);
    }
  });
}

export async function getEmployeeAvailability(employeeId = null) {
  const avails = await fetchCollection(COLLECTION_NAME);
  return employeeId ? avails.filter((a) => a.employeeId === employeeId) : avails;
}

export async function setEmployeeAvailability(data, adminId = 'admin') {
  const customId = `avail_${data.employeeId}_${data.date}`;
  const payload = {
    employeeId: data.employeeId,
    employeeName: data.employeeName || '',
    date: data.date,
    availability: data.availability || AVAILABILITY_TYPES.AVAILABLE,
    customCapacityUnits: data.customCapacityUnits !== undefined ? Number(data.customCapacityUnits) : null,
    reason: (data.reason || '').trim(),
  };

  const saved = await saveDocument(COLLECTION_NAME, payload, customId);
  await logAuditAction({
    action: 'AVAILABILITY_UPDATED',
    entityType: 'availability',
    entityId: customId,
    description: `Set availability for ${data.employeeName || data.employeeId} on ${data.date}: ${payload.availability}`,
    adminId,
  });

  return saved;
}

export async function deleteEmployeeAvailability(id, adminId = 'admin') {
  await removeDocument(COLLECTION_NAME, id);
  return { success: true };
}
