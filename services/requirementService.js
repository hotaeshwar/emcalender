import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';

const COLLECTION_NAME = 'workRequirements';

export function subscribeWorkRequirements(callback, weekId = null) {
  return subscribeCollection(COLLECTION_NAME, (reqs) => {
    if (weekId) {
      callback(reqs.filter((r) => r.weekId === weekId));
    } else {
      callback(reqs);
    }
  });
}

export async function getWorkRequirements(weekId = null) {
  const reqs = await fetchCollection(COLLECTION_NAME);
  return weekId ? reqs.filter((r) => r.weekId === weekId) : reqs;
}

export async function createWorkRequirement(data, adminId = 'admin') {
  const payload = {
    clientId: data.clientId,
    weekId: data.weekId,
    clientName: data.clientName || '',
    requirements: {
      posts: Number(data.requirements?.posts) || 0,
      reels: Number(data.requirements?.reels) || 0,
      stories: Number(data.requirements?.stories) || 0,
    },
    notes: (data.notes || '').trim(),
    status: data.status || 'submitted',
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'REQUIREMENT_CREATED',
    entityType: 'requirement',
    entityId: created.id,
    description: `Created requirements for client ${data.clientName || data.clientId} (${payload.requirements.posts}P, ${payload.requirements.reels}R, ${payload.requirements.stories}S)`,
    adminId,
  });

  return created;
}

export async function updateWorkRequirement(id, data, adminId = 'admin') {
  const payload = {
    clientId: data.clientId,
    weekId: data.weekId,
    clientName: data.clientName || '',
    requirements: {
      posts: Number(data.requirements?.posts) || 0,
      reels: Number(data.requirements?.reels) || 0,
      stories: Number(data.requirements?.stories) || 0,
    },
    notes: (data.notes || '').trim(),
    status: data.status || 'submitted',
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'REQUIREMENT_UPDATED',
    entityType: 'requirement',
    entityId: id,
    description: `Updated requirements for client ${payload.clientName || payload.clientId || id} in week ${payload.weekId} (${payload.requirements.posts}P, ${payload.requirements.reels}R, ${payload.requirements.stories}S)`,
    adminId,
  });

  return updated;
}

export async function deleteWorkRequirement(id, clientName, adminId = 'admin') {
  await removeDocument(COLLECTION_NAME, id);
  await logAuditAction({
    action: 'REQUIREMENT_DELETED',
    entityType: 'requirement',
    entityId: id,
    description: `Deleted requirement for client: ${clientName || id}`,
    adminId,
  });

  return { success: true };
}
