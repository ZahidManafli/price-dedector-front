import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { ebayAPI } from '../services/api';

const EbayDataContext = createContext();

// Runs the "site load" bootstrap: force-refreshes the user's active-eBay-account
// orders and cases (cancellations/cases/inquiries) from eBay, caches them in SQL
// (see GET /ebay/bootstrap), and exposes how many are new since the last run so the
// Sidebar can render its red badge counts. Orders/Cases pages then only ever read
// that SQL cache on mount — this context is the only thing that talks to eBay live
// for those two data sets.
export const EbayDataProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [newCasesCount, setNewCasesCount] = useState(0);
  const inFlightRef = useRef(false);

  const refreshEbayData = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await ebayAPI.bootstrap();
      const data = res?.data || {};
      if (!data.connected) {
        setNewOrdersCount(0);
        setNewCasesCount(0);
        return;
      }
      setNewOrdersCount(Math.max(0, Number(data?.orders?.newCount) || 0));
      setNewCasesCount(Math.max(0, Number(data?.cases?.newCount) || 0));
    } catch {
      // Best-effort background sync — a failed bootstrap just means no fresh
      // badge counts this round; Orders/Cases pages still work off whatever
      // was cached last time.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setNewOrdersCount(0);
      setNewCasesCount(0);
      return undefined;
    }

    refreshEbayData();

    // Fired by Orders/Settings/Tracking pages after switching the active eBay
    // account — re-run the bootstrap so counts reflect the newly-active store.
    const handleEbayUpdated = () => refreshEbayData();
    window.addEventListener('ebay:updated', handleEbayUpdated);
    return () => window.removeEventListener('ebay:updated', handleEbayUpdated);
  }, [isAuthenticated, refreshEbayData]);

  const clearOrdersBadge = useCallback(() => setNewOrdersCount(0), []);
  const clearCasesBadge = useCallback(() => setNewCasesCount(0), []);

  const value = {
    newOrdersCount,
    newCasesCount,
    refreshEbayData,
    clearOrdersBadge,
    clearCasesBadge,
  };

  return <EbayDataContext.Provider value={value}>{children}</EbayDataContext.Provider>;
};

export const useEbayData = () => {
  const context = useContext(EbayDataContext);
  if (!context) {
    throw new Error('useEbayData must be used within an EbayDataProvider');
  }
  return context;
};
