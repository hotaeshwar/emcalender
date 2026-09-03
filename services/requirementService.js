import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { getWeeksByMonth } from './weekService';

const COLLECTION_NAME = 'workRequirements';

export function subscribeWorkRequirements(callback, filter = null) {
  return subscribeCollection(COLLECTION_NAME, (reqs) => {
    if (!filter || filter === 'all') {
      callback(reqs);
      return;
    }
    if (typeof filter === 'string') {
      callback(reqs.filter((r) => r.weekId === filter || r.monthKey === filter));
      return;
    }
    if (typeof filter === 'object') {
      let res = reqs;
      if (filter.monthKey && filter.monthKey !== 'all') {
        res = res.filter((r) => r.monthKey === filter.monthKey);
      }
      if (filter.weekId && filter.weekId !== 'all') {
        res = res.filter((r) => r.weekId === filter.weekId);
      }
      callback(res);
      return;
    }
    callback(reqs);
  });
}

export async function getWorkRequirements(filter = null) {
  const reqs = await fetchCollection(COLLECTION_NAME);
  if (!filter || filter === 'all') return reqs;
  if (typeof filter === 'string') {
    return reqs.filter((r) => r.weekId === filter || r.monthKey === filter);
  }
  let res = reqs;
  if (filter.monthKey && filter.monthKey !== 'all') {
    res = res.filter((r) => r.monthKey === filter.monthKey);
  }
  if (filter.weekId && filter.weekId !== 'all') {
    res = res.filter((r) => r.weekId === filter.weekId);
  }
  return res;
}

export async function createWorkRequirement(data, adminId = 'admin') {
  const payload = {
    clientId: data.clientId,
    weekId: data.weekId,
    monthKey: data.monthKey || '',
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
    monthKey: data.monthKey || '',
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

export async function copyRequirementsBetweenMonths({
  sourceMonthKey,
  targetMonthKey,
  overwrite = true,
  adminId = 'admin'
}) {
  if (!sourceMonthKey || !targetMonthKey) {
    throw new Error('Please select both a source month and target month.');
  }
  if (sourceMonthKey === targetMonthKey) {
    throw new Error('Source and Target months must be different.');
  }

  const sourceWeeks = await getWeeksByMonth(sourceMonthKey);
  const targetWeeks = await getWeeksByMonth(targetMonthKey);

  if (sourceWeeks.length === 0) {
    throw new Error(`No work weeks configured for source month (${sourceMonthKey}).`);
  }
  if (targetWeeks.length === 0) {
    throw new Error(`No work weeks configured for target month (${targetMonthKey}).`);
  }

  const allReqs = await fetchCollection(COLLECTION_NAME);
  let totalCopied = 0;

  // Map each week in target month to corresponding week index in source month
  for (let i = 0; i < targetWeeks.length; i++) {
    const targetWk = targetWeeks[i];
    const sourceWk = sourceWeeks[i] || sourceWeeks[sourceWeeks.length - 1]; // fallback to last week if target has more weeks

    const srcWkReqs = allReqs.filter((r) => r.weekId === sourceWk.id);
    const trgWkReqs = allReqs.filter((r) => r.weekId === targetWk.id);

    if (overwrite) {
      for (const tr of trgWkReqs) {
        await removeDocument(COLLECTION_NAME, tr.id);
      }
    }

    for (const sr of srcWkReqs) {
      if (!overwrite && trgWkReqs.some((tr) => tr.clientId === sr.clientId)) {
        continue;
      }

      await saveDocument(COLLECTION_NAME, {
        clientId: sr.clientId,
        clientName: sr.clientName || '',
        weekId: targetWk.id,
        monthKey: targetMonthKey,
        requirements: {
          posts: Number(sr.requirements?.posts) || 0,
          reels: Number(sr.requirements?.reels) || 0,
          stories: Number(sr.requirements?.stories) || 0,
        },
        notes: sr.notes || '',
        status: 'submitted',
      });
      totalCopied++;
    }
  }

  await logAuditAction({
    action: 'MONTHLY_REQUIREMENTS_COPIED',
    entityType: 'requirement',
    entityId: targetMonthKey,
    description: `Copied ${totalCopied} client requirements from month ${sourceMonthKey} to month ${targetMonthKey}`,
    adminId,
  });

  return { success: true, copiedCount: totalCopied };
}
