import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { convertTaskToCapacityUnits } from '@/lib/capacityCalculator';

const ALLOCATIONS_COLLECTION = 'allocations';
const SURPLUS_COLLECTION = 'surplusWork';

export function subscribeAllocations(callback, weekId = null) {
  return subscribeCollection(ALLOCATIONS_COLLECTION, (records) => {
    if (weekId) {
      callback(records.filter((a) => a.weekId === weekId));
    } else {
      callback(records);
    }
  });
}

export function subscribeSurplusWork(callback, weekId = null) {
  return subscribeCollection(SURPLUS_COLLECTION, (records) => {
    if (weekId) {
      callback(records.filter((s) => s.weekId === weekId));
    } else {
      callback(records);
    }
  });
}

export async function checkExistingAllocations(weekId, clientId = null) {
  const records = await fetchCollection(ALLOCATIONS_COLLECTION);
  return records.filter((a) => a.weekId === weekId && (!clientId || a.clientId === clientId));
}

export async function commitWeeklyAllocation({
  weekId,
  allocations = [],
  surplus = [],
  recalculate = false,
  clientId = null,
  adminId = 'admin'
}) {
  const clientsList = await fetchCollection('clients');

  // 1. Clean up existing automatic records for this week to prevent duplication
  const existingAlloc = await fetchCollection(ALLOCATIONS_COLLECTION);
  const existingSurplus = await fetchCollection(SURPLUS_COLLECTION);

  for (const a of existingAlloc) {
    if (a.weekId === weekId && (!clientId || a.clientId === clientId)) {
      await removeDocument(ALLOCATIONS_COLLECTION, a.id);
    }
  }

  for (const s of existingSurplus) {
    if (s.weekId === weekId && (!clientId || s.clientId === clientId)) {
      await removeDocument(SURPLUS_COLLECTION, s.id);
    }
  }

  // 2. Commit allocations with full clientName & employeeName
  for (const alloc of allocations) {
    const matchedClient = (clientsList || []).find((c) => c.id === alloc.clientId);
    const clientName = alloc.clientName || matchedClient?.name || '';

    await saveDocument(ALLOCATIONS_COLLECTION, {
      clientId: alloc.clientId,
      clientName: clientName,
      employeeId: alloc.employeeId,
      employeeName: alloc.employeeName || '',
      employeeCode: alloc.employeeCode || '',
      employeeRole: alloc.employeeRole || '',
      weekId: alloc.weekId || weekId,
      date: alloc.date || null,
      work: {
        posts: Number(alloc.work?.posts) || 0,
        reels: Number(alloc.work?.reels) || 0,
        stories: Number(alloc.work?.stories) || 0,
      },
      capacityUsed: Number(alloc.capacityUsed) || 0,
      assignmentType: alloc.assignmentType || 'automatic',
      manualOverride: Boolean(alloc.manualOverride),
      overrideReason: alloc.overrideReason || '',
    });
  }

  // 3. Commit surplus records
  for (const s of surplus) {
    const matchedClient = (clientsList || []).find((c) => c.id === s.clientId);
    await saveDocument(SURPLUS_COLLECTION, {
      clientId: s.clientId,
      clientName: s.clientName || matchedClient?.name || '',
      weekId: s.weekId || weekId,
      contentType: s.contentType,
      roleRequired: s.roleRequired,
      quantity: Number(s.quantity) || 0,
      reason: s.reason,
      reasonLabel: s.reasonLabel || s.reason,
      status: s.status || 'unassigned',
      assignedToEmployeeId: null,
      taskDisplayName: s.taskDisplayName || '',
    });
  }

  await logAuditAction({
    action: recalculate ? 'ALLOCATION_RECALCULATED' : 'AUTO_ALLOCATION_CREATED',
    entityType: 'allocation',
    entityId: weekId,
    description: `Committed allocation for week ${weekId}: ${allocations.length} records, ${surplus.length} surplus items`,
    adminId,
  });

  return {
    success: true,
    allocationCount: allocations.length,
    surplusCount: surplus.length,
  };
}

export async function assignSurplusWorkManually({
  surplusId,
  employee,
  quantity,
  manualOverride = false,
  overrideReason = '',
  capacityRules = [],
  adminId = 'admin'
}) {
  const surplusList = await fetchCollection(SURPLUS_COLLECTION);
  const surplusData = surplusList.find((s) => s.id === surplusId);
  if (!surplusData) throw new Error('Surplus record not found');

  const clientsList = await fetchCollection('clients');
  const matchedClient = clientsList.find((c) => c.id === surplusData.clientId);

  const assignQty = Number(quantity) || surplusData.quantity;

  const capacityUsed = convertTaskToCapacityUnits(
    surplusData.contentType,
    employee.role,
    assignQty,
    capacityRules
  );

  const workPayload = { posts: 0, reels: 0, stories: 0 };
  if (surplusData.contentType === 'post') workPayload.posts = assignQty;
  if (surplusData.contentType === 'reel') workPayload.reels = assignQty;
  if (surplusData.contentType === 'story') workPayload.stories = assignQty;

  // Create manual allocation
  await saveDocument(ALLOCATIONS_COLLECTION, {
    clientId: surplusData.clientId,
    clientName: surplusData.clientName || matchedClient?.name || '',
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.employeeCode,
    employeeRole: employee.role,
    weekId: surplusData.weekId,
    date: null,
    work: workPayload,
    capacityUsed,
    assignmentType: 'manual',
    manualOverride: Boolean(manualOverride),
    overrideReason: overrideReason.trim(),
  });

  // Update surplus item
  if (assignQty >= surplusData.quantity) {
    await updateDocument(SURPLUS_COLLECTION, surplusId, {
      status: 'assigned',
      assignedToEmployeeId: employee.id,
      assignedToEmployeeName: employee.name,
    });
  } else {
    await updateDocument(SURPLUS_COLLECTION, surplusId, {
      quantity: surplusData.quantity - assignQty,
      status: 'partially_assigned',
    });
  }

  await logAuditAction({
    action: 'SURPLUS_ASSIGNED',
    entityType: 'surplusWork',
    entityId: surplusId,
    description: `Manually assigned ${assignQty} ${surplusData.contentType}s to ${employee.name} (Override: ${manualOverride})`,
    adminId,
  });

  return { success: true };
}

export async function createSurplusWorkRecord({
  clientId,
  clientName = '',
  weekId,
  contentType,
  roleRequired,
  quantity,
  reason = 'MANUAL_ENTRY',
  reasonLabel = 'Manually logged surplus deliverable',
  adminId = 'admin'
}) {
  const clientsList = await fetchCollection('clients');
  const matchedClient = (clientsList || []).find((c) => c.id === clientId);

  const res = await saveDocument(SURPLUS_COLLECTION, {
    clientId,
    clientName: clientName || matchedClient?.name || '',
    weekId,
    contentType,
    roleRequired,
    quantity: Number(quantity) || 1,
    reason,
    reasonLabel,
    status: 'unassigned',
    assignedToEmployeeId: null,
  });

  await logAuditAction({
    action: 'SURPLUS_MANUAL_CREATED',
    entityType: 'surplusWork',
    entityId: res.id,
    description: `Manually added surplus deliverable for client ${clientName || clientId}: ${quantity} ${contentType}`,
    adminId,
  });

  return res;
}

export async function createDirectManualAllocation({
  clientId,
  clientName = '',
  employeeId,
  weekId,
  work = { posts: 0, reels: 0, stories: 0 },
  manualOverride = false,
  overrideReason = '',
  capacityRules = [],
  adminId = 'admin'
}) {
  const clientsList = await fetchCollection('clients');
  const employeesList = await fetchCollection('employees');
  const matchedClient = (clientsList || []).find((c) => c.id === clientId);
  const employee = (employeesList || []).find((e) => e.id === employeeId);

  if (!employee) throw new Error('Employee not found');

  const postsUnits = convertTaskToCapacityUnits('post', employee.role, work.posts || 0, capacityRules);
  const reelsUnits = convertTaskToCapacityUnits('reel', employee.role, work.reels || 0, capacityRules);
  const storiesUnits = convertTaskToCapacityUnits('story', employee.role, work.stories || 0, capacityRules);
  const capacityUsed = postsUnits + reelsUnits + storiesUnits;

  const res = await saveDocument(ALLOCATIONS_COLLECTION, {
    clientId,
    clientName: clientName || matchedClient?.name || '',
    employeeId: employee.id,
    employeeName: employee.name,
    employeeCode: employee.employeeCode || '',
    employeeRole: employee.role || '',
    weekId,
    date: null,
    work: {
      posts: Number(work.posts) || 0,
      reels: Number(work.reels) || 0,
      stories: Number(work.stories) || 0,
    },
    capacityUsed,
    assignmentType: 'manual',
    manualOverride: Boolean(manualOverride),
    overrideReason: overrideReason.trim(),
  });

  await logAuditAction({
    action: 'DIRECT_ALLOCATION_CREATED',
    entityType: 'allocation',
    entityId: res.id,
    description: `Direct manual allocation created for ${employee.name}: ${work.posts}P, ${work.reels}R, ${work.stories}S`,
    adminId,
  });

  return res;
}

export async function deleteAllocation(id, adminId = 'admin') {
  await removeDocument(ALLOCATIONS_COLLECTION, id);
  await logAuditAction({
    action: 'ALLOCATION_DELETED',
    entityType: 'allocation',
    entityId: id,
    description: `Deleted allocation ${id}`,
    adminId,
  });
  return { success: true };
}
