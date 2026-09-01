import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBxaB-8BRnCa5JXmMDZIBorwuFKL1ZViCQ",
  authDomain: "calender-a1426.firebaseapp.com",
  projectId: "calender-a1426",
  storageBucket: "calender-a1426.firebasestorage.app",
  messagingSenderId: "198966987406",
  appId: "1:198966987406:web:9bdbb6279d256bf0eed7df"
};

// Initialize Firebase App & Firestore Database only once
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export default app;
