import React, { createContext, useState, useEffect } from 'react';
import { auth, onAuthStateChanged, signOut } from '../services/firebase';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setError(null);
      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setUser(currentUser);

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await authAPI.verifyToken();
        const verifiedUser = response?.data?.user;
        if (verifiedUser) {
          // Merge Firebase user fields with backend user profile (role/limits/etc).
          setUser({ ...currentUser, ...verifiedUser });
        }
      } catch (err) {
        // If verify fails, keep Firebase user so app can still operate with auth token checks.
        console.warn('AuthContext verifyToken failed:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err) {
      setError(err.message);
      console.error('Logout error:', err);
    }
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
