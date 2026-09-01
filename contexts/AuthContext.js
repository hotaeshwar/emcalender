'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

const DEFAULT_ADMIN_USER = {
  uid: 'admin_local_1',
  email: 'admin@buildingindia.com',
  displayName: 'Agency Administrator',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEFAULT_ADMIN_USER);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedUser = typeof window !== 'undefined' ? localStorage.getItem('bid_admin_user') : null;
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        setUser(DEFAULT_ADMIN_USER);
      }
    } else {
      setUser(DEFAULT_ADMIN_USER);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bid_admin_user', JSON.stringify(DEFAULT_ADMIN_USER));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const activeUser = {
      uid: 'admin_local_1',
      email: email || DEFAULT_ADMIN_USER.email,
      displayName: 'Agency Administrator',
    };
    setUser(activeUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bid_admin_user', JSON.stringify(activeUser));
    }
    return { user: activeUser };
  };

  const signup = async (email, password, displayName = 'Agency Admin') => {
    const activeUser = {
      uid: 'admin_local_1',
      email: email || DEFAULT_ADMIN_USER.email,
      displayName: displayName || DEFAULT_ADMIN_USER.displayName,
    };
    setUser(activeUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bid_admin_user', JSON.stringify(activeUser));
    }
    return { user: activeUser };
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bid_admin_user');
    }
    setUser(DEFAULT_ADMIN_USER);
  };

  const demoAdminLogin = async () => {
    return login(DEFAULT_ADMIN_USER.email, 'Admin@123456');
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
