import React, { createContext, useState, useEffect } from 'react';
import { authAPI, maintenanceAPI } from '../services/api';
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
  const [maintenance, setMaintenance] = useState(null);

  const clearStoredSession = () => {
    try {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    } catch {}
  };

  const handleMaintenanceLockout = (maintenanceInfo = null) => {
    clearStoredSession();
    setUser(null);
    setMaintenance(maintenanceInfo);
    setError('System is temporarily under maintenance');
    if (typeof window !== 'undefined' && window.location.pathname !== '/maintenance') {
      window.location.href = '/maintenance';
    }
  };

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
        setMaintenance(null);
        if (verifiedUser) {
          try {
            localStorage.setItem('authUser', JSON.stringify(verifiedUser));
          } catch {}
        }
      } catch (err) {
        const isMaintenance = err?.response?.status === 503 && err?.response?.data?.code === 'MAINTENANCE_MODE';
        if (isMaintenance) {
          handleMaintenanceLockout(err?.response?.data?.maintenance || null);
          return;
        }

        clearStoredSession();
        setUser(null);
        setError(err?.response?.data?.message || err?.response?.data?.error || err.message || 'Session expired');
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  useEffect(() => {
    if (!user || String(user.role || '').toLowerCase() === 'admin') {
      return undefined;
    }

    let cancelled = false;
    const checkMaintenance = async () => {
      try {
        const response = await maintenanceAPI.getStatus();
        if (!cancelled && response?.data?.active) {
          handleMaintenanceLockout(response?.data?.maintenance || null);
        }
      } catch {
        // Ignore status polling failures; auth-protected requests still enforce maintenance.
      }
    };

    checkMaintenance();
    const timer = setInterval(checkMaintenance, 60000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

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
    setMaintenance(null);
    setLoading(false);
  };

  // The cached authUser (and the sidebar's lock icons, which read it) only ever
  // gets refreshed from the server on full page load (see verifySession above) —
  // client-side navigation never re-checks it. So if an admin changes a plan's
  // visible tabs while a user's tab stays open, the sidebar can keep showing the
  // old, unlocked state even though every live API call already enforces the new
  // one, which looks exactly like "sidebar says allowed, page load says denied".
  // Call this with the response from GET /settings/limits (already fetched on
  // every Dashboard load) to keep the cached permissions in sync without forcing
  // a full re-login.
  const syncPermissionsFromLimits = (limitsData) => {
    if (!limitsData) return;
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        selectedPlanId: limitsData.plan?.id ?? prev.selectedPlanId,
        planCategory: limitsData.plan?.category ?? prev.planCategory,
        planExpiresAt: limitsData.plan?.expiresAt ?? prev.planExpiresAt,
        permissions: {
          ...prev.permissions,
          allowedTabs: Array.isArray(limitsData.permissions?.allowedTabs)
            ? limitsData.permissions.allowedTabs
            : prev.permissions?.allowedTabs,
        },
      };
      try {
        localStorage.setItem('authUser', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const logout = async () => {
    setError(null);
    try {
      await authAPI.logout();
    } catch {}

    try {
      clearStoredSession();
    } catch {}

    setUser(null);
    setMaintenance(null);
  };

  const isPlanExpired = !!(
    user &&
    String(user.role || '').toLowerCase() !== 'admin' &&
    user.planExpiresAt &&
    new Date(user.planExpiresAt).getTime() <= Date.now()
  );

  const value = {
    user,
    loading,
    error,
    logout,
    setSession,
    syncPermissionsFromLimits,
    maintenance,
    isAuthenticated: !!user,
    isPlanExpired,
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
