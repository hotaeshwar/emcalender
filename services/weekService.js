import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { calculateWorkingDays } from '@/lib/capacityCalculator';

const COLLECTION_NAME = 'workWeeks';

export function subscribeWorkWeeks(callback) {
  return subscribeCollection(COLLECTION_NAME, callback, (a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
}

export async function getWorkWeeks() {
  return fetchCollection(COLLECTION_NAME, (a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
}

export async function getWorkWeekById(id) {
  const weeks = await getWorkWeeks();
  return weeks.find((w) => w.id === id) || null;
}

export async function createWorkWeek(weekData, adminId = 'admin') {
  const workingDates = Array.isArray(weekData.workingDates) ? weekData.workingDates : [];
  const holidays = Array.isArray(weekData.holidays) ? weekData.holidays : [];
  const effectiveWorkingDays = calculateWorkingDays(workingDates, holidays);

  const payload = {
    weekNumber: Number(weekData.weekNumber) || 1,
    name: weekData.name?.trim() || `Week ${weekData.weekNumber || 1}`,
    startDate: weekData.startDate,
    endDate: weekData.endDate,
    workingDates,
    holidays,
    calculatedWorkingDays: effectiveWorkingDays,
    status: weekData.status || 'active',
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'WORK_WEEK_CREATED',
    entityType: 'workWeek',
    entityId: created.id,
    description: `Created work week: ${payload.name} (${effectiveWorkingDays} effective days)`,
    adminId,
  });

  return created;
}

export async function updateWorkWeek(id, weekData, adminId = 'admin') {
  const workingDates = Array.isArray(weekData.workingDates) ? weekData.workingDates : [];
  const holidays = Array.isArray(weekData.holidays) ? weekData.holidays : [];
  const effectiveWorkingDays = calculateWorkingDays(workingDates, holidays);

  const payload = {
    weekNumber: Number(weekData.weekNumber) || 1,
    name: weekData.name?.trim(),
    startDate: weekData.startDate,
    endDate: weekData.endDate,
    workingDates,
    holidays,
    calculatedWorkingDays: effectiveWorkingDays,
    status: weekData.status || 'active',
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'WORK_WEEK_UPDATED',
    entityType: 'workWeek',
    entityId: id,
    description: `Updated work week: ${payload.name}`,
    adminId,
  });

  return updated;
}

export async function deleteWorkWeek(id, weekName, adminId = 'admin') {
  await removeDocument(COLLECTION_NAME, id);
  await logAuditAction({
    action: 'WORK_WEEK_DELETED',
    entityType: 'workWeek',
    entityId: id,
    description: `Deleted work week: ${weekName || id}`,
    adminId,
  });

  return { success: true };
}

export async function duplicateWorkWeek(sourceWeekId, newWeekNumber, newStartDate, newEndDate, adminId = 'admin') {
  const source = await getWorkWeekById(sourceWeekId);
  if (!source) throw new Error('Source work week not found');

  return createWorkWeek({
    weekNumber: newWeekNumber,
    name: `Week ${newWeekNumber}`,
    startDate: newStartDate,
    endDate: newEndDate,
    workingDates: source.workingDates || [],
    holidays: [],
    status: 'draft',
  }, adminId);
}
