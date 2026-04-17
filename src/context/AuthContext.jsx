import React, { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { getAllowedTabs, hasTabAccess as checkTabAccess } from '../utils/planAccess';

export const AuthContext = createContext();

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('authUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifySession = async () => {
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const storedUser = readStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }

      try {
        const response = await authAPI.verifyToken();
        const verifiedUser = response?.data?.user || null;
        setUser(verifiedUser);
        if (verifiedUser) {
          try {
            localStorage.setItem('authUser', JSON.stringify(verifiedUser));
          } catch {}
        }
      } catch (err) {
        try {
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        } catch {}
        setUser(null);
        setError(err?.response?.data?.message || err?.response?.data?.error || err.message || 'Session expired');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const setSession = (nextUser, nextToken) => {
    try {
      if (nextToken) {
        localStorage.setItem('authToken', nextToken);
      }
      if (nextUser) {
        localStorage.setItem('authUser', JSON.stringify(nextUser));
      }
    } catch {}
    setUser(nextUser || null);
    setError(null);
    setLoading(false);
  };

  const logout = async () => {
    setError(null);
    try {
      await authAPI.logout();
    } catch {}

    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    } catch {}

    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    logout,
    setSession,
    isAuthenticated: !!user,
    allowedTabs: getAllowedTabs(user),
    hasTabAccess: (tabKey) => checkTabAccess(user, tabKey),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
