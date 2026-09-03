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

export async function copyRequirementsBetweenWeeks({
  sourceWeekId,
  targetWeekId,
  overwrite = true,
  adminId = 'admin'
}) {
  if (!sourceWeekId || !targetWeekId) {
    throw new Error('Please select both a source week and a target week.');
  }
  if (sourceWeekId === targetWeekId) {
    throw new Error('Source and Target work weeks must be different.');
  }

  const allReqs = await fetchCollection(COLLECTION_NAME);
  const sourceReqs = allReqs.filter((r) => r.weekId === sourceWeekId);

  if (sourceReqs.length === 0) {
    throw new Error('No client requirements found in the selected source week.');
  }

  const targetReqs = allReqs.filter((r) => r.weekId === targetWeekId);

  // If overwrite is selected, clear existing requirements in the target week
  if (overwrite) {
    for (const tr of targetReqs) {
      await removeDocument(COLLECTION_NAME, tr.id);
    }
  }

  let copiedCount = 0;
  for (const sr of sourceReqs) {
    // If not overwriting, skip clients that already have entries in target week
    if (!overwrite && targetReqs.some((tr) => tr.clientId === sr.clientId)) {
      continue;
    }

    await saveDocument(COLLECTION_NAME, {
      clientId: sr.clientId,
      clientName: sr.clientName || '',
      weekId: targetWeekId,
      requirements: {
        posts: Number(sr.requirements?.posts) || 0,
        reels: Number(sr.requirements?.reels) || 0,
        stories: Number(sr.requirements?.stories) || 0,
      },
      notes: sr.notes || '',
      status: sr.status || 'submitted',
    });
    copiedCount++;
  }

  await logAuditAction({
    action: 'REQUIREMENTS_COPIED',
    entityType: 'requirement',
    entityId: targetWeekId,
    description: `Copied ${copiedCount} client requirements from week ${sourceWeekId} to week ${targetWeekId} (Overwrite: ${overwrite})`,
    adminId,
  });

  return { success: true, copiedCount };
}
