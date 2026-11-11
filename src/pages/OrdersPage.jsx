import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI, productAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import {
  ArrowDownUp, ArrowUp, ArrowDown, Loader2, MessageSquare, Link2, Search, ShoppingCart, Check, X, TrendingUp, Copy, Info,
  ChevronLeft, ChevronRight, ImageOff, PackageOpen, CreditCard, Plus, AlertTriangle,
} from 'lucide-react';
import AddTrackingModal from '../components/order/AddTrackingModal';
import OrderMessageSidebar from '../components/OrderMessageSidebar';
import OrderDetailModal from '../components/OrderDetailModal';
import EbayAccountSwitcher from '../components/EbayAccountSwitcher';
import TutorialVideoButton from '../components/TutorialVideoButton';
import { profitAPI } from '../services/api';
import { copyAddressToExtension } from '../utils/checkilaExtensionBridge';

const ORDERS_FILTER_STORAGE_KEY = 'checkila.ordersPage.filters.v1';
const ORDERS_LISTINGS_STORAGE_KEY = 'checkila.ordersPage.listings.v1';
// Persists the ASIN mappings the user has typed:  { [orderId]: asin }
const ORDERS_ASIN_MAP_STORAGE_KEY = 'checkila.ordersPage.asinMap.v1';

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

// "Copy address" button per order row — sends the same buyer shipTo shape
// buildShipTo() already produces for the "Order on Amazon" auto-order flow to
// the Checkila extension (via copyAddressToExtension), so the extension's
// "Checkila Fill" button on Amazon's delivery address form can fill it in.
// Mirrors OrderDetailPage's "Copy address" button — same shared helper, same
// success/error/unavailable states — just triggered from the orders table
// instead of requiring a trip into the order detail page first.
function CopyAddressButton({ order, isDark, t }) {
  const [status, setStatus] = useState(null); // null | 'copying' | 'success' | 'error' | 'unavailable'

  const handleClick = async () => {
    const shipTo = buildShipTo(order);
    if (!shipTo.addressLine1 && !shipTo.fullName) return;

    setStatus('copying');
    const result = await copyAddressToExtension({ shipTo, orderId: order?.orderId });
    setStatus(result.unavailable ? 'unavailable' : result.success ? 'success' : 'error');
    setTimeout(() => setStatus(null), 4000);
  };

  // Compact icon button; the result shows on the icon itself and in its tooltip
  // so the row layout never jumps.
  const message =
    status === 'success'
      ? t('ordersPage.table.copyAddressSuccess')
      : status === 'error'
      ? t('ordersPage.table.copyAddressError')
      : status === 'unavailable'
      ? t('ordersPage.table.copyAddressUnavailable')
      : status === 'copying'
      ? t('ordersPage.table.copyingAddress')
      : t('ordersPage.table.copyAddress');
  const tone =
    status === 'success'
      ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
      : status === 'error' || status === 'unavailable'
      ? isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'
      : isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900';

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'copying'}
        title={message}
        aria-label={message}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:cursor-not-allowed ${tone}`}
      >
        {status === 'copying' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={15} />
        ) : status === 'error' || status === 'unavailable' ? (
          <X size={15} />
        ) : (
          <Copy size={15} />
        )}
      </button>
      {status && status !== 'copying' && (
        <span
          role="status"
          className={`pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug shadow-lg ${
            status === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {message}
        </span>
      )}
    </span>
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
          ebayOrderId: orderId,
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
      {true && asin && !editing && !isCancelled && !isInProfit && (
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
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [switchingEbayAccount, setSwitchingEbayAccount] = useState(false);
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

  // ── Message Panel state ───────────────────────────────────────────────────
  const [messagePanelOrder, setMessagePanelOrder] = useState(null);
  const [infoOrderId, setInfoOrderId] = useState(null);

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
        setEbayAccounts(Array.isArray(status.ebayAccounts) ? status.ebayAccounts : []);
        setActiveEbayAccountId(status.activeEbayAccountId || null);

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
      // No follow-up live eBay refresh when this came from cache: the app-level
      // bootstrap (see EbayDataContext) already force-refreshed orders into SQL on
      // site load / active-account switch, so this page can just trust the cache.
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

  // Switching the store here also switches the system's active eBay account
  // (same action Settings/Tracking pages' switcher performs), since orders are
  // always fetched against whichever account is currently active. Page cursors
  // are account-specific, so reset back to page 0 on switch.
  const handleEbayAccountChange = async (accountId) => {
    if (!accountId || accountId === activeEbayAccountId) return;
    setActiveEbayAccountId(accountId);
    setSwitchingEbayAccount(true);
    try {
      await ebayAPI.setActiveAccount(accountId);
      window.dispatchEvent(new Event('ebay:updated'));
      setPageCursors([null]);
      await loadPage(0, { forceRefresh: true });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to switch active eBay account');
    } finally {
      setSwitchingEbayAccount(false);
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

  // ── Presentation helpers ───────────────────────────────────────────────────
  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const fieldCls = `rounded-lg border text-sm outline-none transition focus:ring-2 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/30'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-100'
  }`;
  const iconBtn = `inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
    isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
  }`;

  const sortHeader = (key, label, align = 'left') => {
    const active = sortKey === key;
    const Arrow = !active ? ArrowDownUp : sortDir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition ${align === 'right' ? 'flex-row-reverse' : ''} ${
          active ? (isDark ? 'text-slate-100' : 'text-slate-900') : ''
        }`}
      >
        {label}
        <Arrow size={12} className={active ? 'opacity-100' : 'opacity-40'} />
      </button>
    );
  };

  // Human-readable status chips instead of raw eBay enums.
  const statusChip = (value) => {
    const v = String(value || '').toUpperCase();
    const tones = {
      good: isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
      warn: isDark ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700',
      bad: isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700',
      info: isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700',
      neutral: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600',
    };
    const dots = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500', info: 'bg-indigo-500', neutral: 'bg-slate-400' };
    const tone =
      v === 'PAID' || v === 'FULFILLED'
        ? 'good'
        : v === 'NOT_STARTED' || v === 'PENDING'
        ? 'warn'
        : v.includes('REFUND') || v === 'ORDER_CANCELLED' || v === 'FAILED'
        ? 'bad'
        : v === 'IN_PROGRESS'
        ? 'info'
        : 'neutral';
    const label = v && v !== '-' ? t(`ordersPage.status.${v}`, { defaultValue: v.replace(/_/g, ' ').toLowerCase() }) : '—';
    return (
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
        {label}
      </span>
    );
  };

  const formatOrderDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // ── Tracking per order (backend POST /ebay/orders/tracking-summary) ─────────
  const [trackingByOrderId, setTrackingByOrderId] = useState({});
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [addTrackingOrder, setAddTrackingOrder] = useState(null);
  const [copiedTracking, setCopiedTracking] = useState(null);

  useEffect(() => {
    const ids = (orders || []).map((o) => String(o?.orderId || '')).filter(Boolean);
    if (!ids.length) {
      setTrackingByOrderId({});
      return undefined;
    }
    let cancelled = false;
    setTrackingLoading(true);
    ebayAPI
      .getOrdersTrackingSummary(ids)
      .then((res) => { if (!cancelled) setTrackingByOrderId(res?.data?.tracking || {}); })
      .catch(() => { if (!cancelled) setTrackingByOrderId({}); })
      .finally(() => { if (!cancelled) setTrackingLoading(false); });
    return () => { cancelled = true; };
  }, [orders]);

  const handleTrackingSaved = (orderId, tracking) => {
    setTrackingByOrderId((prev) => ({ ...prev, [orderId]: tracking }));
    // eBay now has a shipment for it — reflect that in the row without a reload.
    setOrders((prev) =>
      prev.map((o) => (String(o?.orderId) === String(orderId) ? { ...o, orderFulfillmentStatus: 'FULFILLED' } : o))
    );
  };

  const copyTracking = async (orderId, number) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedTracking(orderId);
      setTimeout(() => setCopiedTracking((cur) => (cur === orderId ? null : cur)), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  // Same Ordered -> Shipped -> Delivered stages as the Tracking page.
  const renderTrackingCell = (order, shipmentStatus) => {
    const orderId = String(order?.orderId || '');
    const info = trackingByOrderId[orderId];
    const canAdd = shipmentStatus === 'NOT_STARTED' && !isOrderCancelled(order);

    if (!info || !info.trackingNumber) {
      if (trackingLoading && !info) return <Loader2 size={13} className={`animate-spin ${faint}`} />;
      const stage = info?.fulfillmentStatus;
      return (
        <div className="flex flex-col items-start gap-1.5">
          {stage && stage !== 'ordered' && trackingStage(stage)}
          {canAdd ? (
            <button
              type="button"
              onClick={() => setAddTrackingOrder(order)}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed px-2 py-1 text-xs font-medium transition ${
                isDark ? 'border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-indigo-300' : 'border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              <Plus size={12} />
              {t('ordersPage.tracking.add')}
            </button>
          ) : (
            !stage && <span className={faint}>—</span>
          )}
        </div>
      );
    }

    return (
      <div className="flex min-w-[170px] flex-col items-start gap-1.5">
        <div className="flex items-center gap-1.5">
          {info.carrier && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              {info.carrier}
            </span>
          )}
          <button
            type="button"
            onClick={() => copyTracking(orderId, info.trackingNumber)}
            title={copiedTracking === orderId ? t('ordersPage.tracking.copied') : t('ordersPage.tracking.copy')}
            className={`inline-flex items-center gap-1 font-mono text-xs ${isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-800'}`}
          >
            {info.trackingNumber}
            {copiedTracking === orderId ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} className="opacity-60" />}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {trackingStage(info.fulfillmentStatus)}
          {!info.uploadedToEbay && (
            <span className={`text-[11px] ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{t('ordersPage.tracking.notOnEbay')}</span>
          )}
        </div>
        {info.deliveryIssue && info.fulfillmentStatus !== 'delivered' && (
          <span
            title={info.deliveryIssue.message || ''}
            className={`inline-flex max-w-[220px] items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}
          >
            <AlertTriangle size={11} className="shrink-0" />
            <span className="truncate">{info.deliveryIssue.message || info.deliveryIssue.type}</span>
          </span>
        )}
      </div>
    );
  };

  // Ordered -> Shipped -> Delivered mini stepper.
  function trackingStage(status) {
    const steps = ['ordered', 'shipped', 'delivered'];
    const current = Math.max(0, steps.indexOf(status === 'shipped' || status === 'delivered' ? status : 'ordered'));
    const labels = [t('ordersPage.tracking.statusOrdered'), t('ordersPage.tracking.statusShipped'), t('ordersPage.tracking.statusDelivered')];
    const done = current === 2;
    return (
      <span className="inline-flex items-center gap-1.5" title={labels[current]}>
        <span className="inline-flex items-center">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span className={`h-0.5 w-2.5 ${i <= current ? 'bg-emerald-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />}
              <span
                className={`h-2 w-2 rounded-full ${
                  done || i < current ? 'bg-emerald-500' : i === current ? 'bg-blue-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                }`}
              />
            </React.Fragment>
          ))}
        </span>
        <span className={`text-xs font-medium ${done ? 'text-emerald-500' : isDark ? 'text-slate-300' : 'text-slate-600'}`}>{labels[current]}</span>
      </span>
    );
  }

  // Shipment tabs (drive fulfillmentFilter); counts are for the loaded page.
  const shipmentCounts = useMemo(() => {
    const counts = { ALL: orders.length, NOT_STARTED: 0, FULFILLED: 0, ORDER_CANCELLED: 0 };
    orders.forEach((o) => {
      const s = getDerivedShipmentStatus(o);
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);
  const shipmentTabs = [
    { key: 'ALL', label: t('ordersPage.tabs.all') },
    { key: 'NOT_STARTED', label: t('ordersPage.tabs.toShip'), warn: true },
    { key: 'FULFILLED', label: t('ordersPage.tabs.shipped') },
    { key: 'ORDER_CANCELLED', label: t('ordersPage.tabs.cancelled') },
  ];

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
              <ShoppingCart size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`text-2xl font-semibold tracking-tight ${strong}`}>{t('ordersPage.title')}</h1>
                {typeof total === 'number' && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {total}
                  </span>
                )}
              </div>
              <p className={`text-sm ${muted}`}>{t('ordersPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TutorialVideoButton />
            {ebayStatus.connected && (ebayStatus.activeAccountLabel || ebayStatus.accountId) ? (
              <EbayAccountSwitcher
                accounts={ebayAccounts}
                activeAccountId={activeEbayAccountId}
                activeAccountLabel={ebayStatus.activeAccountLabel || ebayStatus.accountId}
                onChange={handleEbayAccountChange}
                disabled={switchingEbayAccount}
                label={t('ordersPage.activeAccount')}
                isDark={isDark}
              />
            ) : null}
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {!ebayStatus.connected ? (
          <>
            <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
              <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                <Link2 size={24} />
              </span>
              <p className={`mb-5 max-w-md text-sm ${muted}`}>{t('ordersPage.connectPrompt')}</p>
              <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
                <Link2 size={16} />
                {t('ordersPage.connectButton')}
              </button>
            </div>

            {showConnectModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}>
                  <h2 className={`mb-2 text-lg font-semibold ${strong}`}>{t('ordersPage.signinRequired')}</h2>
                  <p className={`mb-5 text-sm ${muted}`}>{t('ordersPage.signinDescription')}</p>
                  <div className="flex justify-end gap-3">
                    <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>
                      {t('listingModal.close')}
                    </button>
                    <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={handleConnect}>
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
            {/* ── To-ship nudge ── */}
            {shipmentCounts.NOT_STARTED > 0 && fulfillmentFilter !== 'NOT_STARTED' && (
              <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${isDark ? 'border-amber-800/60 bg-amber-950/20' : 'border-amber-200 bg-amber-50'}`}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  <PackageOpen size={16} />
                </span>
                <p className={`flex-1 text-sm font-medium ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                  {t('ordersPage.toShipBanner', { count: shipmentCounts.NOT_STARTED })}
                </p>
                <button
                  type="button"
                  onClick={() => setFulfillmentFilter('NOT_STARTED')}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  {t('ordersPage.showToShip')}
                </button>
              </div>
            )}

            <div className={`${card} overflow-hidden`}>
              {/* Shipment tabs */}
              <div className={`flex gap-1 overflow-x-auto border-b px-4 pt-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`} role="tablist">
                {shipmentTabs.map((tab) => {
                  const active = String(fulfillmentFilter || 'ALL').toUpperCase() === tab.key;
                  const count = shipmentCounts[tab.key];
                  const highlight = tab.warn && count > 0;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFulfillmentFilter(tab.key)}
                      className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition ${
                        active
                          ? highlight
                            ? 'border-amber-500 text-amber-600'
                            : isDark ? 'border-indigo-400 text-slate-100' : 'border-indigo-600 text-slate-900'
                          : `border-transparent ${muted} ${isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'}`
                      }`}
                    >
                      {tab.label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                          highlight
                            ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'
                            : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Toolbar */}
              <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <label className="relative min-w-[220px] flex-1">
                  <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('ordersPage.searchPlaceholder')}
                    className={`${fieldCls} w-full py-2 pl-9 pr-9`}
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="Clear" className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${faint} hover:opacity-80`}>
                      <X size={14} />
                    </button>
                  )}
                </label>
                <label className="relative">
                  <CreditCard size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`} />
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className={`${fieldCls} py-2 pl-8 pr-8`}
                  >
                    <option value="ALL">{t('ordersPage.paymentAll')}</option>
                    <option value="PAID">{t('ordersPage.status.PAID')}</option>
                    <option value="FULLY_REFUNDED">{t('ordersPage.status.FULLY_REFUNDED')}</option>
                  </select>
                </label>
                <span className={`ml-auto text-xs ${muted}`}>{t('ordersPage.onThisPage', { count: filteredOrders.length })}</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                      <th className="px-4 py-3 text-left">{sortHeader('creationDate', t('ordersPage.colOrder'))}</th>
                      <th className="px-4 py-3 text-left">{t('ordersPage.table.buyer')}</th>
                      <th className="px-4 py-3 text-left">{sortHeader('fulfillment', t('ordersPage.colStatus'))}</th>
                      <th className="px-4 py-3 text-left">{t('ordersPage.tracking.colTracking')}</th>
                      <th className="px-4 py-3 text-right">{sortHeader('total', t('ordersPage.table.total'), 'right')}</th>
                      <th className="px-4 py-3 text-left">Amazon</th>
                      <th className="px-4 py-3 text-left">{t('ordersPage.colProfit')}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                    {filteredOrders.map((order) => {
                      const id = order.orderId;
                      const listingId = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
                      const listingImageUrl = listingId ? listingImageById.get(listingId) || '' : '';
                      const payment = order.orderPaymentStatus || '-';
                      const shipmentStatus = getDerivedShipmentStatus(order);
                      const totalValue = order?.pricingSummary?.total?.value;
                      const totalCurrency = order?.pricingSummary?.total?.currency;
                      const buyer = getBuyerDisplay(order);
                      const username = String(order?.buyer?.username || '').trim();
                      const fullName = String(order?.buyer?.buyerRegistrationAddress?.fullName || '').trim();
                      const itemTitle = order?.lineItems?.[0]?.title || '';
                      const quantity = Number(order?.lineItems?.[0]?.quantity || 1);
                      const matchedProduct = listingId ? productByItemId.get(listingId) : null;
                      const toShip = shipmentStatus === 'NOT_STARTED';
                      const openDetails = () => navigate(`/orders/${encodeURIComponent(String(id))}`, { state: { order } });

                      return (
                        <tr
                          key={id}
                          className={`group align-middle transition-colors ${
                            toShip
                              ? isDark ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.08]' : 'bg-amber-50/40 hover:bg-amber-50/80'
                              : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Order: image + item + id + date */}
                          <td className="px-4 py-3">
                            <div className="flex min-w-[280px] max-w-[420px] items-center gap-3">
                              <button
                                type="button"
                                onClick={openDetails}
                                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
                              >
                                {listingImageUrl ? (
                                  <img src={listingImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <span className={`flex h-full w-full items-center justify-center ${faint}`}><ImageOff size={16} /></span>
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={openDetails}
                                  title={itemTitle}
                                  className={`line-clamp-2 text-left font-medium leading-snug hover:underline ${strong}`}
                                >
                                  {itemTitle || id}
                                </button>
                                <div className={`mt-1 flex flex-wrap items-center gap-x-2 text-xs ${faint}`}>
                                  <span className={`font-mono ${muted}`}>{id}</span>
                                  {quantity > 1 && (
                                    <span className={`rounded px-1.5 font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>×{quantity}</span>
                                  )}
                                  {order?.creationDate && <span>{formatOrderDate(order.creationDate)}</span>}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Buyer */}
                          <td className="px-4 py-3">
                            <div className="min-w-[140px] max-w-[220px]">
                              <p className={`truncate font-medium ${strong}`} title={buyer}>{fullName || username || '—'}</p>
                              {fullName && username && <p className={`truncate text-xs ${muted}`}>@{username}</p>}
                            </div>
                          </td>

                          {/* Status: shipment + payment */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              {statusChip(shipmentStatus)}
                              {statusChip(payment)}
                            </div>
                          </td>

                          {/* Tracking (from the Tracking page's records) */}
                          <td className="px-4 py-3">{renderTrackingCell(order, shipmentStatus)}</td>

                          {/* Total */}
                          <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${strong}`}>
                            {totalValue != null ? `${totalValue} ${totalCurrency || ''}`.trim() : '—'}
                          </td>

                          {/* Amazon ASIN + auto-order */}
                          <td className={`px-4 py-3 ${body}`}>
                            <AsinCell
                              order={order}
                              isDark={isDark}
                              autoAsin={productAsinMap.get(listingId) || ''}
                              allOrders={orders}
                              isCancelled={isOrderCancelled(order)}
                              isInProfit={profitOrderIds.has(String(id))}
                            />
                          </td>

                          {/* Send to profit table */}
                          <td className="px-4 py-3">
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

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setInfoOrderId(String(id))}
                                title={t('ordersPage.table.viewDetails', { defaultValue: 'View order details' })}
                                aria-label={t('ordersPage.table.viewDetails', { defaultValue: 'View order details' })}
                                className={iconBtn}
                              >
                                <Info size={15} />
                              </button>
                              <CopyAddressButton order={order} isDark={isDark} t={t} />
                              {listingId && (
                                <button
                                  type="button"
                                  onClick={() => setMessagePanelOrder(order)}
                                  title={t('ordersPage.messages')}
                                  aria-label={t('ordersPage.messages')}
                                  className={iconBtn}
                                >
                                  <MessageSquare size={15} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={openDetails}
                                className={`ml-1 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition ${
                                  isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {t('ordersPage.table.details')}
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          <div className="flex flex-col items-center">
                            <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                              <PackageOpen size={20} />
                            </span>
                            <p className={`text-sm ${muted}`}>{t('ordersPage.empty')}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination (cursor-based: previous / next) */}
              <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm ${muted}`}>{t('ordersPage.pagination.page', { page: page + 1 })}</span>
                <div className="flex items-center gap-2">
                  {fetchingPage && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                  <button
                    type="button"
                    onClick={() => page > 0 && loadPage(page - 1)}
                    disabled={page <= 0 || fetchingPage}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <ChevronLeft size={14} /> {t('ordersPage.pagination.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={() => canNext && loadPage(page + 1)}
                    disabled={!canNext || fetchingPage}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {t('ordersPage.pagination.next')} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {messagePanelOrder && (
        <OrderMessageSidebar
          order={messagePanelOrder}
          onClose={() => setMessagePanelOrder(null)}
        />
      )}

      {addTrackingOrder && (
        <AddTrackingModal
          order={addTrackingOrder}
          isDark={isDark}
          onClose={() => setAddTrackingOrder(null)}
          onSaved={handleTrackingSaved}
        />
      )}

      {infoOrderId && (
        <OrderDetailModal orderId={infoOrderId} onClose={() => setInfoOrderId(null)} />
      )}
    </div>
  );
}
