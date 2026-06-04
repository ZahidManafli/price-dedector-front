import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import { ArrowDownUp, Loader2, Package, Link2, Search, SlidersHorizontal, ShoppingCart, Check, X } from 'lucide-react';

const ORDERS_FILTER_STORAGE_KEY   = 'checkila.ordersPage.filters.v1';
const ORDERS_LISTINGS_STORAGE_KEY = 'checkila.ordersPage.listings.v1';
// Persists the ASIN mappings the user has typed:  { [orderId]: asin }
const ORDERS_ASIN_MAP_STORAGE_KEY = 'checkila.ordersPage.asinMap.v1';

// ─── Local-storage helpers ───────────────────────────────────────────────────

function readStoredOrdersFilters() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeStoredOrdersFilters(filters) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ORDERS_FILTER_STORAGE_KEY, JSON.stringify(filters)); } catch {}
}

function readStoredOrdersListings() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ORDERS_LISTINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

function writeStoredOrdersListings(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ORDERS_LISTINGS_STORAGE_KEY,
      JSON.stringify({ refreshedAt: new Date().toISOString(), items })
    );
  } catch {}
}

function readStoredAsinMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ORDERS_ASIN_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function writeStoredAsinMap(map) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ORDERS_ASIN_MAP_STORAGE_KEY, JSON.stringify(map)); } catch {}
}

// ─── Listing helpers ─────────────────────────────────────────────────────────

function resolveListingId(listing) {
  return String(listing?.listingId || listing?.listing?.listingId || listing?.offerId || listing?.sku || '').trim();
}

function resolveListingImageUrl(listing) {
  const directImage =
    listing?.listing?.image?.imageUrl ||
    listing?.listing?.thumbnailImages?.[0]?.imageUrl ||
    listing?.imageUrl ||
    listing?.thumbnailUrl ||
    listing?.listing?.imageUrl ||
    '';
  if (directImage) return directImage;

  const pictureUrls = Array.isArray(listing?.pictureUrls) ? listing.pictureUrls : [];
  if (pictureUrls.length > 0 && pictureUrls[0]) return pictureUrls[0];

  if (listing?.rawXml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(listing.rawXml, 'text/xml');
      const firstPicture = doc.querySelector('PictureDetails > PictureURL')?.textContent?.trim();
      if (firstPicture) return firstPicture;
    } catch { return ''; }
  }
  return '';
}

/**
 * Build the shipTo object the background script / content script needs
 * from an eBay order's fulfillmentStartInstructions.
 */
function buildShipTo(order) {
  const step = order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || {};
  const addr = step?.contactAddress || {};
  return {
    fullName:        String(step?.fullName                           || '').trim(),
    addressLine1:    String(addr?.addressLine1                       || '').trim(),
    addressLine2:    String(addr?.addressLine2                       || '').trim(),
    city:            String(addr?.city                               || '').trim(),
    stateOrProvince: String(addr?.stateOrProvince                    || '').trim(),
    postalCode:      String(addr?.postalCode                         || '').trim(),
    phone:           String(step?.primaryPhone?.phoneNumber          || '').trim(),
  };
}

// ─── ASIN cell component ─────────────────────────────────────────────────────

/**
 * Inline ASIN assignment + "Order on Amazon" button for one order row.
 * The ASIN is saved to localStorage so it persists across page reloads.
 */
function AsinCell({ order, isDark }) {
  const orderId = order?.orderId;
  const quantity = order?.lineItems?.[0]?.quantity ?? 1;

  // Saved ASIN for this order (persisted in localStorage)
  const [asin, setAsin] = useState(() => readStoredAsinMap()[orderId] || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderMsg, setOrderMsg] = useState(null); // { type: 'success'|'error', text }
  const inputRef = useRef(null);

  // Open the edit field
  const startEdit = useCallback(() => {
    setDraft(asin);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [asin]);

  // Save
  const saveAsin = useCallback(() => {
    const cleaned = String(draft).trim().toUpperCase();
    setAsin(cleaned);
    setEditing(false);
    const map = readStoredAsinMap();
    if (cleaned) {
      map[orderId] = cleaned;
    } else {
      delete map[orderId];
    }
    writeStoredAsinMap(map);
  }, [draft, orderId]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setDraft('');
    setEditing(false);
  }, []);

  // Trigger the Amazon auto-order flow via background script
  const handleOrderOnAmazon = useCallback(async () => {
    if (!asin) return;
    if (ordering) return;

    setOrdering(true);
    setOrderMsg(null);

    try {
      const shipTo = buildShipTo(order);

      // Check whether we're inside the Chrome extension context
      if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
        // Fallback: just open the Amazon product page
        window.open(`https://www.amazon.com/dp/${asin}`, '_blank');
        setOrderMsg({ type: 'success', text: 'Opened Amazon — please proceed manually.' });
        return;
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'AMAZON_AUTO_ORDER',
            payload: { asin, quantity, orderId, shipTo },
          },
          (res) => resolve(res)
        );
      });

      if (response?.success) {
        setOrderMsg({ type: 'success', text: 'Amazon tab opened — review & confirm manually.' });
      } else {
        setOrderMsg({ type: 'error', text: response?.error || 'Failed to start auto-order.' });
      }
    } catch (err) {
      setOrderMsg({ type: 'error', text: err?.message || 'Unexpected error.' });
    } finally {
      setOrdering(false);
      // Auto-hide message after 5 s
      setTimeout(() => setOrderMsg(null), 5000);
    }
  }, [asin, order, orderId, ordering, quantity]);

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      {/* ASIN row */}
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveAsin();
              if (e.key === 'Escape') cancelEdit();
            }}
            placeholder="e.g. B0D14XK56X"
            maxLength={12}
            className={`w-32 rounded px-2 py-1 text-xs font-mono border outline-none ${
              isDark
                ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-indigo-400'
                : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
            }`}
          />
          <button
            type="button"
            onClick={saveAsin}
            title="Save ASIN"
            className="text-green-500 hover:text-green-400"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            title="Cancel"
            className="text-slate-400 hover:text-slate-300"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title={asin ? `ASIN: ${asin} — click to change` : 'Assign Amazon ASIN'}
          className={`flex items-center gap-1 text-xs rounded px-2 py-1 border w-fit transition-colors ${
            asin
              ? isDark
                ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50'
                : 'border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              : isDark
              ? 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200'
              : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'
          }`}
        >
          <Link2 size={11} />
          <span className="font-mono">{asin || 'Add ASIN'}</span>
        </button>
      )}

      {/* Order on Amazon button — only shown when an ASIN is assigned */}
      {asin && !editing && (
        <button
          type="button"
          onClick={handleOrderOnAmazon}
          disabled={ordering}
          title={`Auto-order ASIN ${asin} on Amazon`}
          className={`flex items-center gap-1 text-xs rounded px-2 py-1 font-medium transition-colors w-fit ${
            ordering
              ? 'opacity-50 cursor-not-allowed'
              : ''
          } ${
            isDark
              ? 'bg-orange-600 hover:bg-orange-500 text-white'
              : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {ordering ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <ShoppingCart size={11} />
          )}
          Order on Amazon
        </button>
      )}

      {/* Feedback message */}
      {orderMsg && (
        <span
          className={`text-[11px] leading-tight ${
            orderMsg.type === 'success' ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {orderMsg.text}
        </span>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const getBuyerDisplay = (order) => {
    const username = String(order?.buyer?.username || '').trim();
    const fullName = String(order?.buyer?.buyerRegistrationAddress?.fullName || '').trim();
    if (username && fullName) return `${username} | ${fullName}`;
    return username || fullName || '-';
  };

  const isOrderCancelled = (order) => {
    const cancellation = order?.cancelStatus || order?.orderCancelStatus || order?.cancellation || {};
    const cancelState = String(cancellation?.cancelState || '').toUpperCase();
    return cancelState === 'CANCELED' || cancelState === 'CANCELLED';
  };

  const getDerivedShipmentStatus = (order) => {
    const fulfillmentRaw = String(order?.orderFulfillmentStatus || '').toUpperCase();
    if (fulfillmentRaw === 'NOT_STARTED' && isOrderCancelled(order)) return 'ORDER_CANCELLED';
    return fulfillmentRaw || '-';
  };

  const [loading, setLoading]             = useState(true);
  const [ebayStatus, setEbayStatus]       = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError]                 = useState(null);
  const [orders, setOrders]               = useState([]);
  const [page, setPage]                   = useState(0);
  const [pageCursors, setPageCursors]     = useState([null]);
  const [fetchingPage, setFetchingPage]   = useState(false);
  const [total, setTotal]                 = useState(null);
  const [listingCache, setListingCache]   = useState(() => readStoredOrdersListings());
  const storedFilters                     = useMemo(() => readStoredOrdersFilters(), []);
  const [query, setQuery]                 = useState(() => String(storedFilters.query || ''));
  const [fulfillmentFilter, setFulfillmentFilter] = useState(() => String(storedFilters.fulfillmentFilter || 'ALL'));
  const [paymentFilter, setPaymentFilter] = useState(() => String(storedFilters.paymentFilter || 'ALL'));
  const [sortKey, setSortKey]             = useState(() => String(storedFilters.sortKey || 'creationDate'));
  const [sortDir, setSortDir]             = useState(() => String(storedFilters.sortDir || 'desc'));
  const ordersRequestRef                  = useRef(0);

  const listingImageById = useMemo(() => {
    const map = new Map();
    (listingCache || []).forEach((listing) => {
      const listingId = resolveListingId(listing);
      if (!listingId || map.has(listingId)) return;
      const imageUrl = resolveListingImageUrl(listing);
      if (imageUrl) map.set(listingId, imageUrl);
    });
    return map;
  }, [listingCache]);

  const canNext = pageCursors[page + 1] != null;

  const filteredOrders = useMemo(() => {
    const base = (orders || []).filter((order) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        String(order?.orderId || '').toLowerCase().includes(q) ||
        String(order?.buyer?.username || '').toLowerCase().includes(q) ||
        String(order?.buyer?.buyerRegistrationAddress?.fullName || '').toLowerCase().includes(q) ||
        String(order?.lineItems?.[0]?.title || '').toLowerCase().includes(q);
      const matchFulfillment =
        fulfillmentFilter === 'ALL' || getDerivedShipmentStatus(order) === String(fulfillmentFilter || '').toUpperCase();
      const matchPayment = paymentFilter === 'ALL' || String(order?.orderPaymentStatus || '') === paymentFilter;
      return matchQuery && matchFulfillment && matchPayment;
    });

    const compare = (a, b) => {
      if (sortKey === 'orderId')    return String(a?.orderId || '').localeCompare(String(b?.orderId || ''));
      if (sortKey === 'payment')    return String(a?.orderPaymentStatus || '').localeCompare(String(b?.orderPaymentStatus || ''));
      if (sortKey === 'fulfillment') return getDerivedShipmentStatus(a).localeCompare(getDerivedShipmentStatus(b));
      if (sortKey === 'total') {
        return (Number(a?.pricingSummary?.total?.value) || 0) - (Number(b?.pricingSummary?.total?.value) || 0);
      }
      // default: creationDate
      return new Date(a?.creationDate || 0).getTime() - new Date(b?.creationDate || 0).getTime();
    };

    return [...base].sort((a, b) => (sortDir === 'asc' ? compare(a, b) : -compare(a, b)));
  }, [orders, query, fulfillmentFilter, paymentFilter, sortKey, sortDir]);

  // Persist filters
  useEffect(() => {
    writeStoredOrdersFilters({ query, fulfillmentFilter, paymentFilter, sortKey, sortDir });
  }, [query, fulfillmentFilter, paymentFilter, sortKey, sortDir]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  async function loadPage(targetPage) {
    setFetchingPage(true);
    const requestId = ++ordersRequestRef.current;
    try {
      const cursor = pageCursors[targetPage] || null;
      const res = await ebayAPI.getOrders({ cursor, limit: 50 });
      if (requestId !== ordersRequestRef.current) return;
      const newOrders = res?.orders || [];
      const nextCursor = res?.next ? (res?.nextOffset ?? null) : null;

      setOrders(newOrders);
      setPage(targetPage);
      setTotal(res?.total ?? null);
      setPageCursors((prev) => {
        const next = [...prev];
        next[targetPage + 1] = nextCursor;
        return next;
      });
    } catch (err) {
      if (requestId === ordersRequestRef.current) setError(err?.message || 'Failed to load orders');
    } finally {
      if (requestId === ordersRequestRef.current) setFetchingPage(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const status = await ebayAPI.getStatus?.();
        setEbayStatus(status || { connected: false });
        if (status?.connected) {
          await loadPage(0);
          // Load listing cache for images
          try {
            const listings = await ebayAPI.getListings?.({ limit: 200 });
            const items = listings?.itemSummaries || listings?.items || [];
            if (items.length) {
              setListingCache(items);
              writeStoredOrdersListings(items);
            }
          } catch {}
        }
      } catch (err) {
        setError(err?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Sort label helper ────────────────────────────────────────────────────

  const sortLabel = (key, label) => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortKey(key); setSortDir('desc'); }
      }}
      className="flex items-center gap-1 hover:opacity-80"
    >
      {label}
      <ArrowDownUp size={12} className={sortKey === key ? 'opacity-100' : 'opacity-30'} />
    </button>
  );

  // ─── Status pill ──────────────────────────────────────────────────────────

  const getPill = (value, type) => {
    if (type === 'payment') {
      if (value === 'PAID') return 'bg-green-100 text-green-700 border-green-200';
      if (value === 'FULLY_REFUNDED') return 'bg-red-100 text-red-700 border-red-200';
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    if (type === 'fulfillment') {
      if (value === 'FULFILLED') return 'bg-blue-100 text-blue-700 border-blue-200';
      if (value === 'NOT_STARTED') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      if (value === 'ORDER_CANCELLED') return 'bg-red-100 text-red-700 border-red-200';
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
          {t('ordersPage.title', 'Orders')}
          {total != null && (
            <span className={`ml-2 text-sm font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ({total} total)
            </span>
          )}
        </h1>
        {fetchingPage && <Loader2 size={18} className="animate-spin text-indigo-400" />}
      </div>

      {!ebayStatus?.connected ? (
        <div className={`rounded-xl p-8 text-center border ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
          <Package size={40} className={`mx-auto mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Connect your eBay account to view orders.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              <label className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('ordersPage.filter.search', 'Search…')}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </label>
              <label className="relative">
                <SlidersHorizontal size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">{t('ordersPage.filter.allPayment', 'All Payment')}</option>
                  <option value="PAID">{t('ordersPage.filter.paid', 'Paid')}</option>
                  <option value="FULLY_REFUNDED">{t('ordersPage.filter.fullyRefunded', 'Refunded')}</option>
                </select>
              </label>
              <label className="relative">
                <SlidersHorizontal size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={fulfillmentFilter}
                  onChange={(e) => setFulfillmentFilter(e.target.value)}
                  className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="ALL">{t('ordersPage.filter.allShipment', 'All Shipment')}</option>
                  <option value="NOT_STARTED">{t('ordersPage.filter.notStarted', 'Not Started')}</option>
                  <option value="ORDER_CANCELLED">{t('ordersPage.filter.orderCancelled', 'Cancelled')}</option>
                  <option value="FULFILLED">{t('ordersPage.filter.fulfilled', 'Fulfilled')}</option>
                </select>
              </label>
            </div>
          </div>

          {/* Table */}
          <div className={`glass-card p-0 overflow-hidden rounded-xl border ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
                <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                  <tr>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {sortLabel('orderId', t('ordersPage.table.orderId', 'Order ID'))}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {t('ordersPage.table.buyer', 'Buyer')}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {sortLabel('payment', t('ordersPage.table.payment', 'Payment'))}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {sortLabel('fulfillment', t('ordersPage.table.shipment', 'Shipment'))}
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      {sortLabel('total', t('ordersPage.table.total', 'Total'))}
                    </th>
                    {/* ─── NEW: Amazon column ─── */}
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                      Amazon
                    </th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                  {filteredOrders.map((order) => {
                    const id             = order.orderId;
                    const listingId      = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
                    const listingImageUrl = listingId ? listingImageById.get(listingId) || '' : '';
                    const payment        = order.orderPaymentStatus || '-';
                    const shipmentStatus = getDerivedShipmentStatus(order);
                    const totalValue     = order?.pricingSummary?.total?.value;
                    const totalCurrency  = order?.pricingSummary?.total?.currency;
                    const buyer          = getBuyerDisplay(order);

                    return (
                      <React.Fragment key={id}>
                        <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
                          {/* Order ID + thumbnail */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                                {listingImageUrl ? (
                                  <img src={listingImageUrl} alt={order?.lineItems?.[0]?.title || id} className="h-full w-full object-cover" />
                                ) : (
                                  <div className={`flex h-full w-full items-center justify-center text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{id}</div>
                                <div className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {order?.lineItems?.[0]?.title || '-'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Buyer */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{buyer}</td>

                          {/* Payment status */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(payment, 'payment')}`}>
                              {payment}
                            </span>
                          </td>

                          {/* Fulfillment status */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(shipmentStatus, 'fulfillment')}`}>
                              {shipmentStatus}
                            </span>
                          </td>

                          {/* Total */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {totalValue != null ? `${totalValue} ${totalCurrency || ''}`.trim() : '-'}
                          </td>

                          {/* ─── Amazon ASIN + auto-order button ─── */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <AsinCell order={order} isDark={isDark} />
                          </td>

                          {/* Details link */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/orders/${encodeURIComponent(String(id))}`, { state: { order } })
                              }
                              className={`inline-flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                            >
                              {t('ordersPage.table.details', 'Details')}
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={7} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('ordersPage.empty', 'No orders found.')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                {t('ordersPage.pagination.page', 'Page {{page}}', { page: page + 1 })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => page > 0 && loadPage(page - 1)}
                  disabled={page <= 0 || fetchingPage}
                  className="btn-secondary"
                >
                  {t('ordersPage.pagination.previous', 'Previous')}
                </button>
                <button
                  type="button"
                  onClick={() => canNext && loadPage(page + 1)}
                  disabled={!canNext || fetchingPage}
                  className="btn-secondary"
                >
                  {t('ordersPage.pagination.next', 'Next')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
