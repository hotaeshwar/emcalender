import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { DEFAULT_CAPACITY_RULES } from '@/lib/constants';

const COLLECTION_NAME = 'capacityRules';

export function subscribeCapacityRules(callback) {
  return subscribeCollection(COLLECTION_NAME, async (rules) => {
    if (!rules || rules.length === 0) {
      // Auto seed default rules if empty
      await seedDefaultCapacityRules();
      return;
    }
    callback(rules);
  });
}

export async function getCapacityRules() {
  const rules = await fetchCollection(COLLECTION_NAME);
  if (!rules || rules.length === 0) {
    return seedDefaultCapacityRules();
  }
  return rules;
}

export async function createCapacityRule(ruleData, adminId = 'admin') {
  const payload = {
    role: ruleData.role,
    name: ruleData.name?.trim() || `${ruleData.role} Rule`,
    isDefault: Boolean(ruleData.isDefault),
    dailyLimits: {
      posts: Number(ruleData.dailyLimits?.posts) || 0,
      reels: Number(ruleData.dailyLimits?.reels) || 0,
      stories: Number(ruleData.dailyLimits?.stories) || 0,
    },
    weights: {
      posts: Number(ruleData.weights?.posts) || 1,
      reels: Number(ruleData.weights?.reels) || 1,
      stories: Number(ruleData.weights?.stories) || 1,
    },
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'CAPACITY_RULE_CREATED',
    entityType: 'capacityRule',
    entityId: created.id,
    description: `Created capacity rule for ${payload.role}`,
    adminId,
  });

  return created;
}

export async function updateCapacityRule(id, ruleData, adminId = 'admin') {
  const payload = {
    name: ruleData.name?.trim(),
    dailyLimits: {
      posts: Number(ruleData.dailyLimits?.posts) || 0,
      reels: Number(ruleData.dailyLimits?.reels) || 0,
      stories: Number(ruleData.dailyLimits?.stories) || 0,
    },
    weights: {
      posts: Number(ruleData.weights?.posts) || 1,
      reels: Number(ruleData.weights?.reels) || 1,
      stories: Number(ruleData.weights?.stories) || 1,
    },
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'CAPACITY_RULE_UPDATED',
    entityType: 'capacityRule',
    entityId: id,
    description: `Updated capacity rule: ${id}`,
    adminId,
  });

  return updated;
}

export async function seedDefaultCapacityRules(adminId = 'system') {
  for (const rule of DEFAULT_CAPACITY_RULES) {
    await saveDocument(COLLECTION_NAME, rule, `rule_${rule.role}`);
  }

  await logAuditAction({
    action: 'DEFAULT_RULES_SEEDED',
    entityType: 'capacityRule',
    entityId: 'defaults',
    description: 'Initialized default agency productivity rules for Graphic Designers and Video Editors',
    adminId,
  });

  return DEFAULT_CAPACITY_RULES;
}
