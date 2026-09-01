'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check local storage for persistent demo admin session
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('bid_admin_user') : null;
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setLoading(false);
      } catch (e) {
        // ignore
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('bid_admin_user', JSON.stringify({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName || 'Agency Administrator',
          }));
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed' || err.code === 'auth/network-request-failed') {
        const fallbackUser = {
          uid: 'admin_local_1',
          email: email || 'admin@agency.com',
          displayName: 'Agency Administrator',
        };
        setUser(fallbackUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('bid_admin_user', JSON.stringify(fallbackUser));
        }
        return { user: fallbackUser };
      }
      throw err;
    }
  };

  const signup = async (email, password, displayName = 'Agency Admin') => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      return userCredential;
    } catch (err) {
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        const fallbackUser = {
          uid: 'admin_local_1',
          email,
          displayName,
        };
        setUser(fallbackUser);
        if (typeof window !== 'undefined') {
          localStorage.setItem('bid_admin_user', JSON.stringify(fallbackUser));
        }
        return { user: fallbackUser };
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bid_admin_user');
    }
    setUser(null);
    router.push('/login');
  };

  // Quick Demo Admin login helper
  const demoAdminLogin = async () => {
    const defaultEmail = 'admin@agency.com';
    const defaultPass = 'Admin@123456';

    try {
      return await login(defaultEmail, defaultPass);
    } catch (err) {
      const fallbackUser = {
        uid: 'admin_local_1',
        email: defaultEmail,
        displayName: 'Agency Administrator',
      };
      setUser(fallbackUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bid_admin_user', JSON.stringify(fallbackUser));
      }
      return { user: fallbackUser };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, demoAdminLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
