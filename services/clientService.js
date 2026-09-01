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

function generateUniqueClientCode(name, existingClients = []) {
  const cleanName = (name || 'CLT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  let baseCode = cleanName.substring(0, 4) || 'CLT';
  let candidate = baseCode;
  let counter = 1;

  const existingCodes = new Set(
    existingClients.map((c) => (c.clientCode || '').trim().toUpperCase()).filter(Boolean)
  );

  while (existingCodes.has(candidate)) {
    candidate = `${baseCode}${counter}`;
    counter++;
  }

  return candidate;
}

export async function createClient(clientData, adminId = 'admin') {
  const allClients = await getClients();
  let code = (clientData.clientCode || '').trim().toUpperCase();

  if (!code) {
    code = generateUniqueClientCode(clientData.name, allClients);
  } else {
    const duplicate = allClients.find(
      (c) => (c.clientCode || '').trim().toUpperCase() === code
    );
    if (duplicate) {
      throw new Error(`Client Code "${code}" is already used by ${duplicate.name}. Please enter a unique code.`);
    }
  }

  const payload = {
    name: clientData.name.trim(),
    clientCode: code,
    description: (clientData.description || '').trim(),
    status: clientData.status || 'active',
  };

  const created = await saveDocument(COLLECTION_NAME, payload);
  await logAuditAction({
    action: 'CLIENT_CREATED',
    entityType: 'client',
    entityId: created.id,
    description: `Created client: ${payload.name} (${payload.clientCode})`,
    adminId,
  });

  return created;
}

export async function updateClient(id, clientData, adminId = 'admin') {
  const allClients = await getClients();
  let code = (clientData.clientCode || '').trim().toUpperCase();

  if (code) {
    const duplicate = allClients.find(
      (c) => c.id !== id && (c.clientCode || '').trim().toUpperCase() === code
    );
    if (duplicate) {
      throw new Error(`Client Code "${code}" is already used by ${duplicate.name}. Please enter a unique code.`);
    }
  }

  const payload = {
    name: clientData.name.trim(),
    clientCode: code,
    description: (clientData.description || '').trim(),
    status: clientData.status || 'active',
  };

  const updated = await updateDocument(COLLECTION_NAME, id, payload);
  await logAuditAction({
    action: 'CLIENT_UPDATED',
    entityType: 'client',
    entityId: id,
    description: `Updated client: ${payload.name} (${payload.clientCode || 'No Code'})`,
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
