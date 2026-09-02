import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';
import { ROLES, normalizeRole } from '@/lib/constants';

const COLLECTION_NAME = 'employees';

export function subscribeEmployees(callback) {
  return subscribeCollection(COLLECTION_NAME, callback, (a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getEmployees() {
  return fetchCollection(COLLECTION_NAME, (a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getEmployeeById(id) {
  const employees = await getEmployees();
  return employees.find((e) => e.id === id) || null;
}

export async function createEmployee(empData, adminId = 'admin') {
  const code = (empData.employeeCode || '').trim().toUpperCase();
  const normalizedRole = normalizeRole(empData.role, code);

  const payload = {
    employeeCode: code,
    name: empData.name.trim(),
    role: normalizedRole || ROLES.GRAPHIC_DESIGNER,
    customCapacityRuleId: empData.customCapacityRuleId || null,
    status: empData.status || 'active',
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'EMPLOYEE_CREATED',
    entityType: 'employee',
    entityId: created.id,
    description: `Added team member: ${payload.name} (${payload.role})`,
    adminId,
  });

  return created;
}

export async function updateEmployee(id, empData, adminId = 'admin') {
  const code = (empData.employeeCode || '').trim().toUpperCase();
  const normalizedRole = normalizeRole(empData.role, code);

  const payload = {
    employeeCode: code,
    name: empData.name.trim(),
    role: normalizedRole || ROLES.GRAPHIC_DESIGNER,
    customCapacityRuleId: empData.customCapacityRuleId || null,
    status: empData.status || 'active',
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'EMPLOYEE_UPDATED',
    entityType: 'employee',
    entityId: id,
    description: `Updated employee: ${payload.name}`,
    adminId,
  });

  return updated;
}

export async function deleteEmployee(id, employeeName, adminId = 'admin') {
  await removeDocument(COLLECTION_NAME, id);
  await logAuditAction({
    action: 'EMPLOYEE_DELETED',
    entityType: 'employee',
    entityId: id,
    description: `Deleted employee: ${employeeName || id}`,
    adminId,
  });

  return { success: true };
}
