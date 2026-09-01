/**
 * Direct Firebase Firestore Sync Engine
 * Real-time synchronization with Firebase Firestore collections with instant LocalStorage cache fallback.
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

// Filter out hardcoded seed IDs (emp1, emp2, emp3, emp4) ONLY if they were legacy client seeds
function filterLegacySeedIds(items) {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item) => item && item.id !== 'emp1' && item.id !== 'emp2' && item.id !== 'emp3' && item.id !== 'emp4'
  );
}

function getLocal(key) {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return filterLegacySeedIds(parsed);
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
    const cleaned = filterLegacySeedIds(data);
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(cleaned));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

export function subscribeCollection(collectionName, callback, sortFn = null) {
  // 1. Instantly return local cached data to avoid loading wait
  const localItems = getLocal(collectionName);
  if (localItems && localItems.length > 0) {
    callback(sortFn ? [...localItems].sort(sortFn) : localItems);
  }

  // 2. Fetch directly from Firestore immediately via getDocs to guarantee fresh data
  fetchCollection(collectionName, sortFn).then((items) => {
    if (items && items.length > 0) {
      callback(items);
    }
  }).catch(() => {
    const currentLocal = getLocal(collectionName);
    if (currentLocal && currentLocal.length > 0) {
      callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
    }
  });

  // 3. Attach live real-time Firestore snapshot listener
  let unsubscribeFirestore = () => {};
  try {
    const colRef = collection(db, collectionName);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        if (!snapshot.empty) {
          const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          const cleaned = filterLegacySeedIds(items);
          setLocal(collectionName, cleaned);
          callback(sortFn ? [...cleaned].sort(sortFn) : cleaned);
        } else {
          // Keep using existing local cached items if snapshot is empty
          const currentLocal = getLocal(collectionName);
          if (currentLocal && currentLocal.length > 0) {
            callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
          } else {
            callback([]);
          }
        }
      },
      (err) => {
        // Fallback gracefully on permission blocks or offline state
        const currentLocal = getLocal(collectionName);
        if (currentLocal && currentLocal.length > 0) {
          callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
        }
      }
    );
  } catch (e) {
    const currentLocal = getLocal(collectionName);
    if (currentLocal && currentLocal.length > 0) {
      callback(sortFn ? [...currentLocal].sort(sortFn) : currentLocal);
    }
  }

  // 4. Listen for tab/component storage sync events
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
    if (!snap.empty) {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const cleaned = filterLegacySeedIds(items);
      setLocal(collectionName, cleaned);
      return sortFn ? [...cleaned].sort(sortFn) : cleaned;
    }
  } catch (e) {
    // Fallback to local items on permission blocks
  }
  const localItems = getLocal(collectionName);
  return sortFn ? [...localItems].sort(sortFn) : localItems;
}

export async function saveDocument(collectionName, payload, customId = null) {
  const id = customId || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newRecord = {
    id,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Save to LocalStorage immediately
  const localItems = getLocal(collectionName);
  const existingIdx = localItems.findIndex((item) => item.id === id);
  if (existingIdx >= 0) {
    localItems[existingIdx] = { ...localItems[existingIdx], ...newRecord };
  } else {
    localItems.push(newRecord);
  }
  setLocal(collectionName, localItems);
  notifyLocalChange(collectionName);

  // 2. Sync to Firebase Firestore
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, payload, { merge: true });
  } catch (e) {
    // Saved locally on permission error
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
    // Updated locally on permission error
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
    // Removed locally on permission error
  }

  return { success: true };
}

// Convenient Aliases to guarantee compatibility with any service call
export const syncSubscribe = subscribeCollection;
export const syncFetch = fetchCollection;
export const syncCreate = saveDocument;
export const syncUpdate = updateDocument;
export const syncDelete = removeDocument;
