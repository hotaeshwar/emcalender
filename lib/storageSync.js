/**
 * Hybrid Storage Engine:
 * Reads and writes directly with Firebase Firestore with zero hardcoded seeds.
 * Also syncs with LocalStorage for instant 0ms offline capability.
 */

import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot
} from 'firebase/firestore';

const LOCAL_STORAGE_PREFIX = 'bid_store_';

// Remove legacy hardcoded seed IDs (emp1, emp2, emp3, emp4, c1..c12) from LocalStorage
function cleanLegacySeeds(key, items) {
  if (!Array.isArray(items)) return [];
  if (key === 'employees') {
    return items.filter(
      (item) =>
        item.id !== 'emp1' &&
        item.id !== 'emp2' &&
        item.id !== 'emp3' &&
        item.id !== 'emp4' &&
        item.name?.toUpperCase() !== 'NEHA' &&
        item.name?.toUpperCase() !== 'KARAN'
    );
  }
  return items;
}

function getLocal(key) {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return cleanLegacySeeds(key, parsed);
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

function setLocal(key, data) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = cleanLegacySeeds(key, data);
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(cleaned));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

export function subscribeCollection(collectionName, callback, sortFn = null) {
  // 1. Immediately provide any local cached data
  const localData = getLocal(collectionName);
  callback(sortFn ? [...localData].sort(sortFn) : localData);

  // 2. Attach live Firestore listener
  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, collectionName);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const cleaned = cleanLegacySeeds(collectionName, items);
        setLocal(collectionName, cleaned);
        callback(sortFn ? [...cleaned].sort(sortFn) : cleaned);
      },
      (err) => {
        console.warn(`Firestore listener note for ${collectionName}:`, err.message);
        const currentLocal = getLocal(collectionName);
        callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
      }
    );
  } catch (e) {
    const currentLocal = getLocal(collectionName);
    callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
  }

  // 3. Listen to local storage changes from other components/tabs
  const handleStorageEvent = (e) => {
    if (e.key === LOCAL_STORAGE_PREFIX + collectionName || e.type === 'bid_data_updated') {
      const updated = getLocal(collectionName);
      callback(sortFn ? [...updated].sort(sortFn) : updated);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('bid_data_updated', handleStorageEvent);
  }

  return () => {
    unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('bid_data_updated', handleStorageEvent);
    }
  };
}

function notifyLocalChange(collectionName) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bid_data_updated'));
  }
}

export async function fetchCollection(collectionName, sortFn = null) {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const cleaned = cleanLegacySeeds(collectionName, items);
    setLocal(collectionName, cleaned);
    return sortFn ? [...cleaned].sort(sortFn) : cleaned;
  } catch (e) {
    console.warn(`Firestore fetch note for ${collectionName}: using local cache`, e.message);
    const localItems = getLocal(collectionName);
    return sortFn ? [...localItems].sort(sortFn) : localItems;
  }
}

export async function saveDocument(collectionName, payload, customId = null) {
  const id = customId || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newRecord = {
    id,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Immediately save to LocalStorage
  const localItems = getLocal(collectionName);
  const existingIdx = localItems.findIndex((item) => item.id === id);
  if (existingIdx >= 0) {
    localItems[existingIdx] = { ...localItems[existingIdx], ...newRecord };
  } else {
    localItems.push(newRecord);
  }
  setLocal(collectionName, localItems);
  notifyLocalChange(collectionName);

  // 2. Sync to Firestore
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    console.warn(`Firestore sync note: saved locally (${collectionName}/${id})`);
  }

  return newRecord;
}

export async function updateDocument(collectionName, id, updatePayload) {
  const localItems = getLocal(collectionName);
  const idx = localItems.findIndex((item) => item.id === id);
  let updatedRecord = { id, ...updatePayload, updatedAt: new Date().toISOString() };

  if (idx >= 0) {
    updatedRecord = { ...localItems[idx], ...updatePayload, updatedAt: new Date().toISOString() };
    localItems[idx] = updatedRecord;
    setLocal(collectionName, localItems);
    notifyLocalChange(collectionName);
  }

  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, updatePayload);
  } catch (e) {
    console.warn(`Firestore sync note: updated locally (${collectionName}/${id})`);
  }

  return updatedRecord;
}

export async function removeDocument(collectionName, id) {
  const localItems = getLocal(collectionName);
  const filtered = localItems.filter((item) => item.id !== id);
  setLocal(collectionName, filtered);
  notifyLocalChange(collectionName);

  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn(`Firestore sync note: removed locally (${collectionName}/${id})`);
  }

  return { success: true };
}

// Convenient Aliases to guarantee compatibility with any service call
export const syncSubscribe = subscribeCollection;
export const syncFetch = fetchCollection;
export const syncCreate = saveDocument;
export const syncUpdate = updateDocument;
export const syncDelete = removeDocument;
