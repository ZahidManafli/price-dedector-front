import React, { createContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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

      try {
        const response = await authAPI.verifyToken();
        setUser(response?.data?.user || null);
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
    isAuthenticated: !!user,
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
