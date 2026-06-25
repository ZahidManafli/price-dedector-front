import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI, productAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import { ArrowDownUp, Loader2, Package, Link2, Search, SlidersHorizontal, ShoppingCart, Check, X, CreditCard, Pencil, TrendingUp } from 'lucide-react';
import { profitAPI } from '../services/api';

const ORDERS_FILTER_STORAGE_KEY = 'checkila.ordersPage.filters.v1';
const ORDERS_LISTINGS_STORAGE_KEY = 'checkila.ordersPage.listings.v1';
// Persists the ASIN mappings the user has typed:  { [orderId]: asin }
const ORDERS_ASIN_MAP_STORAGE_KEY = 'checkila.ordersPage.asinMap.v1';
// Persists the user's Amazon card last-4 digits for auto-order
const AMAZON_CARD_LAST4_STORAGE_KEY = 'checkila.amazonCardLast4';

function readStoredCardLast4() {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(AMAZON_CARD_LAST4_STORAGE_KEY) || '').trim();
  } catch { return ''; }
}

function writeStoredCardLast4(value) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = String(value || '').replace(/\D/g, '').slice(0, 4);
    if (cleaned) {
      window.localStorage.setItem(AMAZON_CARD_LAST4_STORAGE_KEY, cleaned);
    } else {
      window.localStorage.removeItem(AMAZON_CARD_LAST4_STORAGE_KEY);
    }
  } catch {}
}

function readStoredOrdersFilters() {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(ORDERS_FILTER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredOrdersFilters(filters) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ORDERS_FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
}

function readStoredOrdersListings() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(ORDERS_LISTINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeStoredOrdersListings(items) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      ORDERS_LISTINGS_STORAGE_KEY,
      JSON.stringify({
        refreshedAt: new Date().toISOString(),
        items,
      })
    );
  } catch {
    // Ignore storage quota and privacy mode failures.
  }
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
    } catch {
      return '';
    }
  }

  return '';
}

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

// ─── CARD LAST-4 BANNER ───────────────────────────────────────────────────────
// Shown at the top of the orders table. Lets the user set/change their Amazon
// card last-4 digits, which are saved to localStorage and sent with every auto-order.
function CardLast4Banner({ isDark }) {
  const [saved, setSaved] = useState(() => readStoredCardLast4());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const startEdit = () => {
    setDraft(saved);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const cleaned = String(draft).replace(/\D/g, '').slice(0, 4);
    writeStoredCardLast4(cleaned);
    setSaved(cleaned);
    setEditing(false);
  };

  const cancel = () => {
    setDraft('');
    setEditing(false);
  };

  const isValid = saved.length === 4;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-4 text-sm ${
        isValid
          ? isDark
            ? 'bg-emerald-900/20 border-emerald-700 text-emerald-200'
            : 'bg-emerald-50 border-emerald-300 text-emerald-800'
          : isDark
          ? 'bg-amber-900/20 border-amber-700 text-amber-200'
          : 'bg-amber-50 border-amber-300 text-amber-800'
      }`}
    >
      <CreditCard size={16} className="flex-shrink-0" />
      <span className="font-medium flex-shrink-0">Amazon card last 4:</span>

      {editing ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            placeholder="1234"
            maxLength={4}
            className={`w-16 rounded px-2 py-0.5 text-sm font-mono border outline-none ${
              isDark
                ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-indigo-400'
                : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
            }`}
          />
          <button type="button" onClick={save} title="Save" className="text-green-500 hover:text-green-400">
            <Check size={14} />
          </button>
          <button type="button" onClick={cancel} title="Cancel" className="text-slate-400 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="font-mono tracking-widest">••••&nbsp;{saved}</span>
          ) : (
            <span className="opacity-70 italic">Not set — auto-order will fill the form but stop before payment</span>
          )}
          <button
            type="button"
            onClick={startEdit}
            title={isValid ? 'Change card last 4' : 'Set card last 4'}
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            <Pencil size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function AsinCell({ order, isDark, autoAsin, allOrders, isInProfit, isCancelled }) {
  const orderId = order?.orderId;
  const quantity = order?.lineItems?.[0]?.quantity ?? 1;
  const orderTitle = String(order?.lineItems?.[0]?.title || '').trim();

  // Priority: stored manual value > auto-filled from product match
  const [asin, setAsin] = useState(() => {
    const stored = readStoredAsinMap()[orderId];
    if (stored) return stored;
    if (autoAsin) {
      const map = readStoredAsinMap();
      map[orderId] = autoAsin;
      writeStoredAsinMap(map);
      return autoAsin;
    }
    return '';
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderMsg, setOrderMsg] = useState(null); // { type: 'success'|'error', text }
  const inputRef = useRef(null);

  // If autoAsin arrives after first render (products loaded async), sync it in
  // only when there is no manually-stored value yet.
  useEffect(() => {
    if (!autoAsin) return;
    const stored = readStoredAsinMap()[orderId];
    if (stored) return;
    setAsin(autoAsin);
    const map = readStoredAsinMap();
    map[orderId] = autoAsin;
    writeStoredAsinMap(map);
  }, [autoAsin, orderId]);

  // Open the edit field
  const startEdit = useCallback(() => {
    setDraft(asin);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [asin]);

  // Save — also propagates ASIN to all orders sharing the same line-item title
  const saveAsin = useCallback(() => {
    const cleaned = String(draft).trim().toUpperCase();
    setAsin(cleaned);
    setEditing(false);
    const map = readStoredAsinMap();
    if (cleaned) {
      map[orderId] = cleaned;
      // Propagate to every order that shares the same item title
      if (orderTitle && Array.isArray(allOrders)) {
        allOrders.forEach((o) => {
          const oId = o?.orderId;
          const oTitle = String(o?.lineItems?.[0]?.title || '').trim();
          if (oId && oId !== orderId && oTitle === orderTitle && !map[oId]) {
            map[oId] = cleaned;
          }
        });
      }
    } else {
      delete map[orderId];
    }
    writeStoredAsinMap(map);
  }, [draft, orderId, orderTitle, allOrders]);

  // Cancel edit
  const cancelEdit = useCallback(() => {
    setDraft('');
    setEditing(false);
  }, []);

  // Trigger the Amazon auto-order flow via background script
  const handleOrderOnAmazon = useCallback(async () => {
    if (!asin || ordering) return;
  
    setOrdering(true);
    setOrderMsg(null);
  
    try {
      const shipTo = buildShipTo(order);
      const cardLast4 = readStoredCardLast4();
  
      const token = localStorage.getItem('authToken'); // or wherever you store it

      const res = await fetch("https://back.checkila.com/amazon/auto-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,   // 🔥 THIS IS MISSING
        },
        body: JSON.stringify({
          asin,
          quantity,
          shipTo,
          cardLast4,
        }),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data?.error || "Failed to start Amazon order");
      }
  
      setOrderMsg({
        type: "success",
        text: "Amazon order job sent to extension",
      });
  
    } catch (err) {
      setOrderMsg({
        type: "error",
        text: err.message || "Unexpected error",
      });
    } finally {
      setOrdering(false);
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

      {/* Order on Amazon button — disabled */}
      {false && asin && !editing && !isCancelled && !isInProfit && (
        String(order?.orderFulfillmentStatus || '').toUpperCase() === 'NOT_STARTED' ? (
          <button
            type="button"
            onClick={handleOrderOnAmazon}
            disabled={ordering}
            title={`Auto-order ASIN ${asin} on Amazon`}
            className={`flex items-center gap-1 text-xs rounded px-2 py-1 font-medium transition-colors w-fit ${
              ordering ? 'opacity-50 cursor-not-allowed' : ''
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
        ) : (
          <div
            className={`flex items-center gap-1 text-xs rounded px-2 py-1 font-medium w-fit ${
              isDark
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
            }`}
          >
            <Check size={11} />
            Ordered
          </div>
        )
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

function calcProfit(ebayPayout, amazonPrice, adRate, count = 1) {
  const salePrice = parseFloat(ebayPayout) || 0;
  const unitCost = parseFloat(amazonPrice) || 0;
  const qty = Math.max(1, parseInt(count) || 1);
  const cogs = unitCost * qty;
  if (salePrice === 0 || cogs === 0) return 0;
  const taxRate = 0.06;
  const fvfRate = 0.136;
  const adRateDecimal = (parseFloat(adRate) || 0) / 100;
  const fixedFee = 0.30;
  const grossAmount = salePrice * (1 + taxRate);
  const feeTotal = grossAmount * (fvfRate + adRateDecimal) + fixedFee;
  return Math.round((salePrice - cogs - feeTotal) * 100) / 100;
}

function SendToProfitCell({ order, matchedProduct, listingImageUrl, buyer, isDark, t, orderId, alreadySent, onSent }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const isAdded = sent || alreadySent;

  const handleSend = async () => {
    if (isAdded || sending) return;
    setSending(true);
    try {
      const ebayPayout = parseFloat(order?.pricingSummary?.total?.value ?? 0);
      const amazonPrice = parseFloat(matchedProduct?.currentAmazonPrice ?? 0);
      const adRate = parseFloat(matchedProduct?.adRate ?? 0);
      const count = Math.max(1, parseInt(order?.lineItems?.[0]?.quantity ?? 1));
      const profit = calcProfit(ebayPayout, amazonPrice, adRate, count);

      await profitAPI.create({
        order_id: orderId || '',
        buyer_name: buyer,
        amazon_price: amazonPrice,
        ebay_payout: ebayPayout,
        ad_rate: adRate,
        count,
        item_image_url: listingImageUrl || '',
        profit,
      });
      setSent(true);
      if (onSent && orderId) onSent(orderId);
    } catch {
      // ignore — silently fail
    } finally {
      setSending(false);
    }
  };

  if (isAdded) {
    return (
      <div className={`inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1 font-medium ${
        isDark ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
      }`}>
        <Check size={11} />
        {t('ordersPage.table.orderedSent')}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className={`inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1 font-medium border transition-colors ${
        sending ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        isDark
          ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300 hover:bg-indigo-900/50'
          : 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
      }`}
    >
      {sending ? <Loader2 size={11} className="animate-spin" /> : <TrendingUp size={11} />}
      {t('ordersPage.table.ordered')}
    </button>
  );
}

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
    // eBay uses "CANCELED" (US spelling) in the payload; accept both just in case.
    return cancelState === 'CANCELED' || cancelState === 'CANCELLED';
  };

  const getDerivedShipmentStatus = (order) => {
    const fulfillmentRaw = String(order?.orderFulfillmentStatus || '').toUpperCase();
    if (fulfillmentRaw === 'NOT_STARTED' && isOrderCancelled(order)) return 'ORDER_CANCELLED';
    return fulfillmentRaw || '-';
  };

  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]);
  const [fetchingPage, setFetchingPage] = useState(false);
  const [total, setTotal] = useState(null);
  const [listingCache, setListingCache] = useState(() => readStoredOrdersListings());
  // Map of ebayItemId -> amazonAsin built from the user's products
  const [productAsinMap, setProductAsinMap] = useState(() => new Map());
  // Map of ebayItemId -> full product object (for currentAmazonPrice)
  const [productByItemId, setProductByItemId] = useState(() => new Map());
  // Set of order IDs already added to the profit table
  const [profitOrderIds, setProfitOrderIds] = useState(() => new Set());
  const storedFilters = useMemo(() => readStoredOrdersFilters(), []);
  const [query, setQuery] = useState(() => String(storedFilters.query || ''));
  const [fulfillmentFilter, setFulfillmentFilter] = useState(() => String(storedFilters.fulfillmentFilter || 'ALL'));
  const [paymentFilter, setPaymentFilter] = useState(() => String(storedFilters.paymentFilter || 'ALL'));
  const [sortKey, setSortKey] = useState(() => String(storedFilters.sortKey || 'creationDate'));
  const [sortDir, setSortDir] = useState(() => String(storedFilters.sortDir || 'desc'));
  const ordersRequestRef = useRef(0);

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
    // When sorted by creationDate (the default), trust the backend order (newest-first).
    // The backend now always returns orders descending by creation date, so re-sorting
    // client-side would only risk corrupting the correct sequence.
    if (sortKey === 'creationDate') {
      // desc → backend already newest-first, return as-is
      // asc  → user wants oldest-first, reverse the backend order
      return sortDir === 'asc' ? [...base].reverse() : base;
    }

    const compare = (a, b) => {
      if (sortKey === 'orderId') return String(a?.orderId || '').localeCompare(String(b?.orderId || ''));
      if (sortKey === 'payment') {
        return String(a?.orderPaymentStatus || '').localeCompare(String(b?.orderPaymentStatus || ''));
      }
      if (sortKey === 'fulfillment') {
        return getDerivedShipmentStatus(a).localeCompare(getDerivedShipmentStatus(b));
      }
      if (sortKey === 'total') {
        return Number(a?.pricingSummary?.total?.value ?? -1) - Number(b?.pricingSummary?.total?.value ?? -1);
      }
      return 0;
    };
    const sorted = [...base].sort(compare);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [orders, query, fulfillmentFilter, paymentFilter, sortKey, sortDir]);
  const onSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      // creationDate naturally starts descending (newest first); everything else ascending
      setSortDir(key === 'creationDate' ? 'desc' : 'asc');
      return key;
    });
  };
  const sortLabel = (key, label) => (
    <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1">
      {label}
      <ArrowDownUp size={12} className={sortKey === key ? 'opacity-100' : 'opacity-40'} />
    </button>
  );
  const stats = useMemo(() => {
    const paid = orders.filter((o) => String(o?.orderPaymentStatus || '') === 'PAID').length;
    const refunded = orders.filter((o) => String(o?.orderPaymentStatus || '').includes('REFUNDED')).length;
    const fulfilled = orders.filter((o) => String(o?.orderFulfillmentStatus || '') === 'FULFILLED').length;
    return { paid, refunded, fulfilled };
  }, [orders]);
  const getPill = (value, type) => {
    const v = String(value || '');
    if (type === 'payment') {
      if (v.includes('REFUND')) return isDark ? 'bg-rose-900/30 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
      if (v === 'PAID') return isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (v === 'ORDER_CANCELLED') return isDark ? 'bg-rose-900/30 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
    if (v === 'FULFILLED') return isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (v === 'NOT_STARTED') return isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200';
    return isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  useEffect(() => {
    writeStoredOrdersFilters({
      query,
      fulfillmentFilter,
      paymentFilter,
      sortKey,
      sortDir,
    });
  }, [query, fulfillmentFilter, paymentFilter, sortKey, sortDir]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);

        if (!status.connected) {
          setShowConnectModal(true);
          return;
        }

        ebayAPI
          .getListings(0, 200)
          .then((res) => {
            const data = res?.data || {};
            const items = Array.isArray(data.items) ? data.items : [];
            setListingCache(items);
            writeStoredOrdersListings(items);

            if (data?.from_cache) {
              ebayAPI
                .getListings(0, 200, { refresh: true })
                .then((refreshRes) => {
                  const refreshData = refreshRes?.data || {};
                  const refreshItems = Array.isArray(refreshData.items) ? refreshData.items : [];
                  setListingCache(refreshItems);
                  writeStoredOrdersListings(refreshItems);
                })
                .catch((refreshErr) => {
                  const msg = refreshErr?.response?.data?.error || '';
                  if (msg) console.warn('Silent listings refresh failed:', msg);
                });
            }
          })
          .catch((listingsErr) => {
            const msg = listingsErr?.response?.data?.error || '';
            if (msg) console.warn('Orders page listings preload failed:', msg);
          });

        await loadPage(0);

        // Fetch products to auto-fill ASINs from ebayItemId matches
        productAPI.getAll().then((res) => {
          const products = Array.isArray(res?.data) ? res.data : [];
          const asinMap = new Map();
          const productMap = new Map();
          products.forEach((p) => {
            const itemId = String(p?.ebayItemId || '').trim();
            const asin   = String(p?.amazonAsin  || '').trim();
            if (itemId) {
              if (asin) asinMap.set(itemId, asin);
              productMap.set(itemId, p);
            }
          });
          setProductAsinMap(asinMap);
          setProductByItemId(productMap);
        }).catch(() => {/* non-critical — silently ignore */});
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || t('ordersPage.failedLoad'));
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch recent profit order IDs so we can mark already-added orders
  useEffect(() => {
    profitAPI.recentOrderIds()
      .then((res) => {
        const ids = Array.isArray(res.data) ? res.data : [];
        setProfitOrderIds(new Set(ids.filter(Boolean)));
      })
      .catch(() => {});
  }, []);

  const applyOrdersPayload = (data = {}, pageIndex = 0) => {
    setOrders(data.orders || []);
    setTotal(typeof data.total === 'number' ? data.total : null);
    const nextHref = typeof data.next === 'string' && data.next.trim() ? data.next.trim() : null;
    setPageCursors((prev) => {
      const next = [...prev];
      if (next[0] === undefined) next[0] = null;
      next[pageIndex + 1] = nextHref;
      return next;
    });
    setPage(pageIndex);
  };

  const loadPage = async (pageIndex, { forceRefresh = false, silent = false } = {}) => {
    const requestId = ++ordersRequestRef.current;
    try {
      if (!silent) setFetchingPage(true);
      const cursor = pageCursors[pageIndex] ?? null;
      const res = await ebayAPI.getOrders({
        ...(forceRefresh ? { refresh: true } : {}),
        ...(cursor ? { next: cursor } : {}),
      });
      const data = res?.data || {};
      if (requestId !== ordersRequestRef.current) return;

      if (data?.accessDenied) {
        setError(data?.accessDeniedErrorMessage || 'eBay shipment access denied');
        setOrders([]);
        setPageCursors((prev) => {
          const next = [...prev];
          next[pageIndex + 1] = null;
          return next;
        });
        setTotal(null);
        return;
      }

      applyOrdersPayload(data, pageIndex);

      if (data?.from_cache && !forceRefresh) {
        ebayAPI
          .getOrders({
            refresh: true,
            ...(cursor ? { next: cursor } : {}),
          })
          .then((refreshRes) => {
            const refreshData = refreshRes?.data || {};
            if (requestId !== ordersRequestRef.current) return;
            if (refreshData?.accessDenied) return;
            applyOrdersPayload(refreshData, pageIndex);
          })
          .catch((refreshErr) => {
            const msg = refreshErr?.response?.data?.error || '';
            if (msg) console.warn('Silent orders refresh failed:', msg);
          });
      }
    } catch (err) {
      if (requestId !== ordersRequestRef.current) return;
      setError(err?.response?.data?.error || err?.message || t('ordersPage.failedLoad'));
      setOrders([]);
      setPageCursors((prev) => {
        const next = [...prev];
        next[pageIndex + 1] = null;
        return next;
      });
    } finally {
      if (requestId === ordersRequestRef.current && !silent) {
        setFetchingPage(false);
      }
    }
  };

  const handleConnect = async () => {
    try {
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('ordersPage.failedConnect'));
    }
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} />
          {t('ordersPage.title')}
        </h1>
        {ebayStatus.connected ? (
          <div className={`text-sm flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {(ebayStatus.activeAccountLabel || ebayStatus.accountId) ? (
              <span className={`inline-flex items-center rounded-full px-3 py-2 text-md border ${isDark ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {t('ordersPage.activeAccount')}: <span className="ml-1 font-semibold">{ebayStatus.activeAccountLabel || ebayStatus.accountId}</span>
              </span>
            ) : null}
            {typeof total === 'number' ? `${t('ordersPage.table.total')}: ${total}` : null}
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {!ebayStatus.connected ? (
        <>
          <div
            className={`rounded-xl p-6 text-center border ${
              isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
              <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mb-4`}> 
              {t('ordersPage.connectPrompt')}
            </p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} />
              {t('ordersPage.connectButton')}
            </button>
          </div>

          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div
                className={`w-full max-w-md p-6 rounded-xl border ${
                  isDark ? 'bg-slate-900/80 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <h2 className="text-lg font-semibold mb-2" style={{ color: isDark ? '#e2e8f0' : undefined }}>
                  {t('ordersPage.signinRequired')}
                </h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('ordersPage.signinDescription')}
                </p>
                <div className="flex gap-3 justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>
                    {t('listingModal.close')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={handleConnect}
                  >
                    <Link2 size={16} />
                    {t('ordersPage.connectButton')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
        <CardLast4Banner isDark={isDark} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.showing')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{filteredOrders.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.paid')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{stats.paid}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.shipped')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{stats.fulfilled}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.refunded')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{stats.refunded}</p>
          </div>
        </div>
        <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative md:col-span-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ordersPage.searchPlaceholder')}
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
                <option value="ALL">{t('ordersPage.filter.allPayment')}</option>
                <option value="PAID">{t('ordersPage.filter.paid')}</option>
                <option value="FULLY_REFUNDED">{t('ordersPage.filter.fullyRefunded')}</option>
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
                <option value="ALL">{t('ordersPage.filter.allShipment')}</option>
                <option value="NOT_STARTED">{t('ordersPage.filter.notStarted')}</option>
                <option value="ORDER_CANCELLED">{t('ordersPage.filter.orderCancelled')}</option>
                <option value="FULFILLED">{t('ordersPage.filter.fulfilled')}</option>
              </select>
            </label>
          </div>
        </div>
        <div
              className={`glass-card p-0 overflow-hidden rounded-xl border ${
                isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('orderId', t('ordersPage.table.orderId'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {t('ordersPage.table.buyer')}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('payment', t('ordersPage.table.payment'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('fulfillment', t('ordersPage.table.shipment'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('total', t('ordersPage.table.total'))}
                  </th>
                  {/* ─── NEW: Amazon column ─── */}
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Amazon
                  </th>
                  {/* ─── Ordered / Send to Profit column ─── */}
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {t('ordersPage.table.ordered')}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {filteredOrders.map((order) => {
                  const id = order.orderId;
                  const listingId = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
                  const listingImageUrl = listingId ? listingImageById.get(listingId) || '' : '';
                  const payment = order.orderPaymentStatus || '-';
                  const shipmentStatus = getDerivedShipmentStatus(order);
                  const totalValue = order?.pricingSummary?.total?.value;
                  const totalCurrency = order?.pricingSummary?.total?.currency;
                  const buyer = getBuyerDisplay(order);
                  const createdAt = order?.creationDate ? new Date(order.creationDate).toLocaleString() : '-';

                  const matchedProduct = listingId ? productByItemId.get(listingId) : null;

                  return (
                    <React.Fragment key={id}>
                      <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border ${
                                isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
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
                              <div className={`text-[10px] truncate max-w-[160px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {order?.lineItems?.[0]?.title || t('ordersPage.table.orderId')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{buyer}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(payment, 'payment')}`}>
                            {payment}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(shipmentStatus, 'fulfillment')}`}>
                            {shipmentStatus}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {totalValue != null ? `${totalValue} ${totalCurrency || ''}`.trim() : '-'}
                        </td>
                        {/* ─── Amazon ASIN + auto-order button ─── */}
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <AsinCell
                            order={order}
                            isDark={isDark}
                            autoAsin={productAsinMap.get(String(order?.lineItems?.[0]?.legacyItemId || '').trim()) || ''}
                            allOrders={orders}
                            isCancelled={isOrderCancelled(order)}
                            isInProfit={profitOrderIds.has(String(id))}
                          />
                        </td>
                        {/* ─── Send to Profit button ─── */}
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <SendToProfitCell
                            order={order}
                            matchedProduct={matchedProduct}
                            listingImageUrl={listingImageUrl}
                            buyer={buyer}
                            isDark={isDark}
                            t={t}
                            orderId={String(id)}
                            alreadySent={profitOrderIds.has(String(id))}
                            onSent={(oid) => setProfitOrderIds((prev) => new Set([...prev, oid]))}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/orders/${encodeURIComponent(String(id))}`, {
                                state: { order },
                              })
                            }
                            className={`inline-flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                          >
                            {t('ordersPage.table.details')}
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                      <td colSpan={8} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('ordersPage.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('ordersPage.pagination.page', { page: page + 1 })}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => page > 0 && loadPage(page - 1)}
                disabled={page <= 0 || fetchingPage}
                className="btn-secondary"
              >
                {t('ordersPage.pagination.previous')}
              </button>
              <button
                type="button"
                onClick={() => canNext && loadPage(page + 1)}
                disabled={!canNext || fetchingPage}
                className="btn-secondary"
              >
                {t('ordersPage.pagination.next')}
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

