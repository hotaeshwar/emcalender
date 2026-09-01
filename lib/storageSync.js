/**
 * Pure Firebase Firestore Engine
 * Stores, updates, deletes, and fetches all application data directly via Firebase Firestore.
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

/**
 * Real-time subscription to a Firebase Firestore collection
 */
export function subscribeCollection(collectionName, callback, sortFn = null) {
  let unsubscribeFirestore = () => {};

  try {
    const colRef = collection(db, collectionName);
    unsubscribeFirestore = onSnapshot(
      colRef,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(sortFn ? [...items].sort(sortFn) : items);
      },
      (err) => {
        console.error(`Firebase Firestore subscription error for ${collectionName}:`, err.message);
        callback([]);
      }
    );
  } catch (e) {
    console.error(`Firebase Firestore connection error for ${collectionName}:`, e.message);
    callback([]);
  }

  return () => {
    unsubscribeFirestore();
  };
}

/**
 * Fetch all documents from a Firebase Firestore collection once
 */
export async function fetchCollection(collectionName, sortFn = null) {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return sortFn ? [...items].sort(sortFn) : items;
  } catch (e) {
    console.error(`Firebase Firestore fetch error for ${collectionName}:`, e.message);
    return [];
  }
}

/**
 * Save a document directly to Firebase Firestore
 */
export async function saveDocument(collectionName, payload, customId = null) {
  const id = customId || 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const newRecord = {
    id,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, collectionName, id);
  await setDoc(docRef, newRecord, { merge: true });
  return newRecord;
}

/**
 * Update a document directly in Firebase Firestore
 */
export async function updateDocument(collectionName, id, updatePayload) {
  const updatedRecord = {
    ...updatePayload,
    updatedAt: new Date().toISOString(),
  };

  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, updatedRecord);
  return { id, ...updatedRecord };
}

/**
 * Delete a document directly from Firebase Firestore
 */
export async function removeDocument(collectionName, id) {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
  return { success: true };
}

// Convenient Aliases
export const syncSubscribe = subscribeCollection;
export const syncFetch = fetchCollection;
export const syncCreate = saveDocument;
export const syncUpdate = updateDocument;
export const syncDelete = removeDocument;
