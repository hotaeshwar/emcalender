import {
  subscribeCollection,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument
} from '@/lib/storageSync';
import { logAuditAction } from './auditService';

const COLLECTION_NAME = 'clients';

export function subscribeClients(callback) {
  return subscribeCollection(COLLECTION_NAME, callback, (a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getClients() {
  return fetchCollection(COLLECTION_NAME, (a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getClientById(id) {
  const clients = await getClients();
  return clients.find((c) => c.id === id) || null;
}

export async function createClient(clientData, adminId = 'admin') {
  const payload = {
    name: clientData.name.trim(),
    clientCode: (clientData.clientCode || '').trim().toUpperCase(),
    description: (clientData.description || '').trim(),
    status: clientData.status || 'active',
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'CLIENT_CREATED',
    entityType: 'client',
    entityId: created.id,
    description: `Created client: ${payload.name} (${payload.clientCode || 'No code'})`,
    adminId,
  });

  return created;
}

export async function updateClient(id, clientData, adminId = 'admin') {
  const payload = {
    name: clientData.name.trim(),
    clientCode: (clientData.clientCode || '').trim().toUpperCase(),
    description: (clientData.description || '').trim(),
    status: clientData.status || 'active',
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'CLIENT_UPDATED',
    entityType: 'client',
    entityId: id,
    description: `Updated client: ${payload.name}`,
    adminId,
  });

  return updated;
}

export async function deleteClient(id, clientName, adminId = 'admin') {
  await removeDocument(COLLECTION_NAME, id);
  await logAuditAction({
    action: 'CLIENT_DELETED',
    entityType: 'client',
    entityId: id,
    description: `Deleted client: ${clientName || id}`,
    adminId,
  });

  return { success: true };
}
