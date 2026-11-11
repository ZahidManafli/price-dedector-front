import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';
import {
  ArrowDownUp, ArrowDown, ArrowUp, Check, Loader2, Mail, MessageSquare, Package, Link2,
  Pencil, RotateCcw, Search, Trash2, AlertTriangle, X, Plus, ExternalLink,
  ChevronLeft, ChevronRight, Megaphone, Boxes, Eye, Clock, BellRing, ImageOff,
} from 'lucide-react';
import FeedbackSidebar from '../components/FeedbackSidebar';
import ScheduledListingsPanel from '../components/ScheduledListingsPanel';
import EbayAccountSwitcher from '../components/EbayAccountSwitcher';
import TutorialVideoButton from '../components/TutorialVideoButton';
import { useTheme } from '../context/ThemeContext';

export default function ListingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // ── Core state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [switchingEbayAccount, setSwitchingEbayAccount] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(undefined);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [fetchingPage, setFetchingPage] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [sortKey, setSortKey] = useState('title');
  const [sortDir, setSortDir] = useState('asc');
  const [deletingListingId, setDeletingListingId] = useState('');
  const [deadStockBannerDismissed, setDeadStockBannerDismissed] = useState(false);
  const [sendingDeadStockEmail, setSendingDeadStockEmail] = useState(false);
  const [deadStockEmailSent, setDeadStockEmailSent] = useState(false);
  const listingsRequestRef = useRef(0);
  // Ended listings (relist candidates) come from a separate endpoint and are
  // only fetched once the user looks at ended/all listings.
  const [endedItems, setEndedItems] = useState(null);
  const [endedLoading, setEndedLoading] = useState(false);
  const endedRequestRef = useRef(0);

  // ── Relist frequency ──────────────────────────────────────────────────────
  const [relistFrequencyInput, setRelistFrequencyInput] = useState('');
  const [savingRelistFrequency, setSavingRelistFrequency] = useState(false);
  const [relistFrequencySaved, setRelistFrequencySaved] = useState(false);
  const relistFrequencySavedTimeoutRef = useRef(null);

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineValues, setInlineValues] = useState({});
  const [savingInline, setSavingInline] = useState(false);

  // ── Feedback sidebar state ────────────────────────────────────────────────
  const [feedbackListing, setFeedbackListing] = useState(null);

  // ── Auto stock state ──────────────────────────────────────────────────────
  // autoStockMap: { [ebayListingId]: rule | null }
  const [autoStockMap, setAutoStockMap] = useState({});
  const [autoStockLoading, setAutoStockLoading] = useState({});
  // which row has the "assign" input open
  const [autoStockAssignId, setAutoStockAssignId] = useState(null);
  const [autoStockAssignValue, setAutoStockAssignValue] = useState('');
  const [savingAutoStock, setSavingAutoStock] = useState(false);
  const [removingAutoStock, setRemovingAutoStock] = useState('');

  // ── Promoted listings ad rate state ───────────────────────────────────────
  // adRateMap: { [ebayListingId]: { adId, bidPercentage } | undefined }
  const [adRateMap, setAdRateMap] = useState({});
  const [adRateLoading, setAdRateLoading] = useState({});
  const [adRateEditId, setAdRateEditId] = useState(null);
  const [adRateEditValue, setAdRateEditValue] = useState('');
  const [savingAdRate, setSavingAdRate] = useState(false);
  const [removingAdRate, setRemovingAdRate] = useState('');
  const [adRateScopeError, setAdRateScopeError] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  const loadRelistFrequency = (ebayAccountId) => {
    ebayAPI
      .getRelistFrequency(ebayAccountId)
      .then((res) => {
        const days = res?.data?.relistFrequencyDays;
        setRelistFrequencyInput(days ? String(days) : '');
      })
      .catch(() => {});
  };

  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);
        setEbayAccounts(Array.isArray(status.ebayAccounts) ? status.ebayAccounts : []);
        setActiveEbayAccountId(status.activeEbayAccountId || null);
        if (!status.connected) { setShowConnectModal(true); setLoading(false); return; }
        await loadListings();
        loadRelistFrequency(status.activeEbayAccountId || null);
      } catch {
        setShowConnectModal(true);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => clearTimeout(relistFrequencySavedTimeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listings loading ──────────────────────────────────────────────────────
  const applyListingsPayload = (data = {}, pageIndex = 0) => {
    setItems(data.items || []);
    setTotal(typeof data.total === 'number' ? data.total : undefined);
    setPage(pageIndex);
  };

  const loadListings = async ({ forceRefresh = false } = {}) => {
    const requestId = ++listingsRequestRef.current;
    try {
      setFetchingPage(true);
      const res = await ebayAPI.getListings(0, 200, forceRefresh ? { refresh: true } : undefined);
      const data = res?.data || {};
      if (requestId !== listingsRequestRef.current) return;
      applyListingsPayload(data, 0);
      if (data?.from_cache && !forceRefresh) {
        ebayAPI
          .getListings(0, 200, { refresh: true })
          .then((refreshRes) => {
            if (requestId !== listingsRequestRef.current) return;
            applyListingsPayload(refreshRes?.data || {}, 0);
          })
          .catch(() => {});
      }
    } catch (err) {
      if (requestId !== listingsRequestRef.current) return;
      setError(err?.response?.data?.error || t('listingsPage.failedLoad'));
    } finally {
      if (requestId === listingsRequestRef.current) setFetchingPage(false);
    }
  };

  // Switching the store here also switches the system's active eBay account
  // (same action Settings/Tracking pages' switcher performs), since listings
  // are always fetched against whichever account is currently active.
  const handleEbayAccountChange = async (accountId) => {
    if (!accountId || accountId === activeEbayAccountId) return;
    setActiveEbayAccountId(accountId);
    setSwitchingEbayAccount(true);
    try {
      await ebayAPI.setActiveAccount(accountId);
      window.dispatchEvent(new Event('ebay:updated'));
      setRelistFrequencyInput('');
      loadRelistFrequency(accountId);
      setEndedItems(null);
      await loadListings({ forceRefresh: true });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to switch active eBay account');
    } finally {
      setSwitchingEbayAccount(false);
    }
  };

  const handleSaveRelistFrequency = async () => {
    const trimmed = relistFrequencyInput.trim();
    const days = trimmed ? Number.parseInt(trimmed, 10) : null;
    if (trimmed && (!Number.isFinite(days) || days <= 0)) return;

    setSavingRelistFrequency(true);
    try {
      await ebayAPI.saveRelistFrequency(days, activeEbayAccountId);
      setRelistFrequencySaved(true);
      clearTimeout(relistFrequencySavedTimeoutRef.current);
      relistFrequencySavedTimeoutRef.current = setTimeout(() => setRelistFrequencySaved(false), 2000);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to save relist frequency');
    } finally {
      setSavingRelistFrequency(false);
    }
  };

  const loadEndedListings = async () => {
    const requestId = ++endedRequestRef.current;
    setEndedLoading(true);
    try {
      const res = await ebayAPI.getEndedListings();
      if (requestId !== endedRequestRef.current) return;
      setEndedItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (err) {
      if (requestId !== endedRequestRef.current) return;
      setEndedItems([]);
      setError(err?.response?.data?.error || t('listingsPage.failedLoadEnded'));
    } finally {
      if (requestId === endedRequestRef.current) setEndedLoading(false);
    }
  };

  useEffect(() => {
    if (!ebayStatus.connected || endedItems !== null || endedLoading) return;
    if (statusFilter === 'COMPLETED' || statusFilter === 'ALL') loadEndedListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, ebayStatus.connected, endedItems]);

  // ── Delete listing ────────────────────────────────────────────────────────
  const handleDeleteListing = async ({ ebayListingId = null, internalSku = null, offerId = null } = {}) => {
    const rawEbayListingId = String(ebayListingId || '').trim();
    const rawSku = String(internalSku || '').trim();
    const rawOfferId = String(offerId || '').trim();
    const deleteId = rawEbayListingId || rawSku || rawOfferId;
    if (!deleteId) return;
    if (!window.confirm(t('listingsPage.deleteConfirm'))) return;
    try {
      setDeletingListingId(deleteId);
      await ebayAPI.deleteListing(deleteId, {
        ...(rawOfferId ? { offerId: rawOfferId } : {}),
        ...(rawSku ? { sku: rawSku } : {}),
        ...(rawEbayListingId ? { ebayItemId: rawEbayListingId } : {}),
        ...(!rawEbayListingId ? { inventoryOnly: 'true' } : {}),
      });
      await loadListings({ forceRefresh: true });
    } catch (err) {
      setError(err?.response?.data?.error || t('listingsPage.failedDelete'));
    } finally {
      setDeletingListingId('');
    }
  };

  // ── Inline save (title / price / stock) ───────────────────────────────────
  const handleInlineSave = async (offer, ebayListingId) => {
    if (!ebayListingId) return;
    setSavingInline(true);
    try {
      const payload = {};
      if (inlineValues.title !== undefined && inlineValues.title !== offer._title) {
        payload.title = String(inlineValues.title).trim();
      }
      if (inlineValues.price !== undefined) {
        const n = Number(inlineValues.price);
        if (Number.isFinite(n) && n > 0) payload.price = n;
      }
      if (inlineValues.quantity !== undefined) {
        const q = parseInt(inlineValues.quantity, 10);
        if (Number.isFinite(q) && q > 0) payload.quantity = q;
      }
      if (Object.keys(payload).length === 0) { setInlineEditId(null); return; }
      await ebayAPI.updateListing(ebayListingId, payload);
      // Update local state optimistically
      setItems((prev) =>
        prev.map((item) => {
          const itemEbayId = String(item?.listingId || item?.listing?.listingId || item?.listing?.legacyItemId || '').trim();
          if (itemEbayId !== ebayListingId) return item;
          const next = { ...item };
          if (payload.title) {
            next.title = payload.title;
            if (next.listing) next.listing = { ...next.listing, title: payload.title };
          }
          if (payload.price !== undefined) {
            next.pricingSummary = {
              ...(next.pricingSummary || {}),
              price: { ...(next.pricingSummary?.price || {}), value: payload.price },
            };
          }
          return next;
        })
      );
      setInlineEditId(null);
      setInlineValues({});
      // Refresh after stock change since stock derives from rawXml
      if (payload.quantity) loadListings({ forceRefresh: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update listing');
    } finally {
      setSavingInline(false);
    }
  };

  // ── Auto stock ────────────────────────────────────────────────────────────
  const fetchAutoStockForIds = async (ids) => {
    const toFetch = ids.filter((id) => id && autoStockMap[id] === undefined);
    if (toFetch.length === 0) return;
    setAutoStockLoading((prev) => {
      const next = { ...prev };
      toFetch.forEach((id) => { next[id] = true; });
      return next;
    });
    const results = await Promise.allSettled(
      toFetch.map((id) => ebayAPI.getListingAutoStockRule(id))
    );
    const mapUpdates = {};
    const loadUpdates = {};
    results.forEach((r, i) => {
      const id = toFetch[i];
      mapUpdates[id] = r.status === 'fulfilled' ? (r.value?.data?.data || null) : null;
      loadUpdates[id] = false;
    });
    setAutoStockMap((prev) => ({ ...prev, ...mapUpdates }));
    setAutoStockLoading((prev) => ({ ...prev, ...loadUpdates }));
  };

  const handleAssignAutoStock = async (ebayListingId) => {
    const qty = parseInt(autoStockAssignValue, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Auto stock quantity must be a positive whole number');
      return;
    }
    setSavingAutoStock(true);
    try {
      const res = await ebayAPI.saveListingAutoStockRule(ebayListingId, { assignedQuantity: qty });
      setAutoStockMap((prev) => ({ ...prev, [ebayListingId]: res.data?.data || { assignedQuantity: qty } }));
      setAutoStockAssignId(null);
      setAutoStockAssignValue('');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to assign auto stock');
    } finally {
      setSavingAutoStock(false);
    }
  };

  const handleRemoveAutoStock = async (ebayListingId) => {
    if (!window.confirm('Remove auto stock rule for this listing?')) return;
    setRemovingAutoStock(ebayListingId);
    try {
      await ebayAPI.deleteListingAutoStockRule(ebayListingId);
      setAutoStockMap((prev) => ({ ...prev, [ebayListingId]: null }));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove auto stock');
    } finally {
      setRemovingAutoStock('');
    }
  };

  // ── Promoted listings ad rate ─────────────────────────────────────────────
  const fetchAdRatesForIds = async (ids) => {
    const toFetch = ids.filter((id) => id && adRateMap[id] === undefined);
    if (toFetch.length === 0) return;
    setAdRateLoading((prev) => {
      const next = { ...prev };
      toFetch.forEach((id) => { next[id] = true; });
      return next;
    });
    try {
      const res = await ebayAPI.getAdRates(toFetch);
      const adRates = res?.data?.adRates || {};
      const mapUpdates = {};
      toFetch.forEach((id) => { mapUpdates[id] = adRates[id] || null; });
      setAdRateMap((prev) => ({ ...prev, ...mapUpdates }));
    } catch {
      // Silent — ad rates are a secondary/optional display, don't block the page on failure.
    } finally {
      setAdRateLoading((prev) => {
        const next = { ...prev };
        toFetch.forEach((id) => { next[id] = false; });
        return next;
      });
    }
  };

  const handleSaveAdRate = async (ebayListingId) => {
    const bidPercentage = Number(adRateEditValue);
    if (!Number.isFinite(bidPercentage) || bidPercentage < 2 || bidPercentage > 100) {
      setError(t('listingsPage.adRateInvalid'));
      return;
    }
    setSavingAdRate(true);
    try {
      await ebayAPI.setAdRate(ebayListingId, bidPercentage);
      setAdRateMap((prev) => ({ ...prev, [ebayListingId]: { ...(prev[ebayListingId] || {}), bidPercentage } }));
      setAdRateEditId(null);
      setAdRateEditValue('');
    } catch (err) {
      if (err?.response?.data?.code === 'EBAY_MARKETING_SCOPE_REQUIRED') {
        setAdRateScopeError(true);
      } else {
        setError(err?.response?.data?.error || t('listingsPage.failedSaveAdRate'));
      }
    } finally {
      setSavingAdRate(false);
    }
  };

  const handleRemoveAdRate = async (ebayListingId) => {
    if (!window.confirm(t('listingsPage.removeAdRateConfirm'))) return;
    setRemovingAdRate(ebayListingId);
    try {
      await ebayAPI.removeAdRate(ebayListingId);
      setAdRateMap((prev) => ({ ...prev, [ebayListingId]: null }));
    } catch (err) {
      setError(err?.response?.data?.error || t('listingsPage.failedRemoveAdRate'));
    } finally {
      setRemovingAdRate('');
    }
  };

  // ── Pagination / filter reset ─────────────────────────────────────────────
  useEffect(() => { setPage(0); }, [query, statusFilter, sortKey, sortDir]);

  // ── Connect ───────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    try {
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      setError(err?.response?.data?.error || t('listingsPage.failedConnect'));
    }
  };

  const handleSendDeadStockEmail = async () => {
    try {
      setSendingDeadStockEmail(true);
      await ebayAPI.sendDeadStockNotify();
      setDeadStockEmailSent(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Email göndərilə bilmədi');
    } finally {
      setSendingDeadStockEmail(false);
    }
  };

  // ── Normalize items ───────────────────────────────────────────────────────
  const parseNumberish = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const allItems = useMemo(() => {
    const live = items || [];
    if (!endedItems?.length) return live;
    const seen = new Set(live.map((o) => String(o?.listingId || o?.listing?.legacyItemId || '')).filter(Boolean));
    return [...live, ...endedItems.filter((o) => !seen.has(String(o?.listingId || '')))];
  }, [items, endedItems]);

  const normalizedItems = useMemo(
    () =>
      allItems.map((offer) => {
        const id = offer?.offerId || offer?.listingId || offer?.listing?.listingId || offer?.sku || '-';
        const rawStatus = String(offer?.status || offer?.marketplaceId || '-');
        // Trading reports ended listings as "Completed" or "Ended" — show both as Completed.
        const status = /^(completed|ended)$/i.test(rawStatus) ? 'Completed' : rawStatus;
        const title = offer?.listing?.title || offer?.title || offer?.product?.title || '(no title)';
        let rawQuantity = null, rawSold = null, rawThumb = '', rawStartTime = null, rawWatchCount = null;
        if (offer?.rawXml && typeof DOMParser !== 'undefined') {
          try {
            const doc = new DOMParser().parseFromString(offer.rawXml, 'text/xml');
            const getText = (sel) => doc.querySelector(sel)?.textContent?.trim() || '';
            const getAllText = (sel) => Array.from(doc.querySelectorAll(sel)).map((n) => n.textContent?.trim()).filter(Boolean);
            rawQuantity = parseNumberish(getText('Quantity'));
            rawSold = parseNumberish(getText('SellingStatus > QuantitySold'));
            rawThumb = getAllText('PictureDetails > PictureURL')[0] || '';
            rawWatchCount = parseNumberish(getText('WatchCount'));
            const st = getText('StartTime');
            if (st) { const d = new Date(st); if (!isNaN(d)) rawStartTime = d; }
          } catch { /* silent */ }
        }
        if (!rawStartTime && offer?.startTime) {
          const d = new Date(offer.startTime);
          if (!isNaN(d)) rawStartTime = d;
        }
        const fallbackQuantity =
          parseNumberish(offer?.availableQuantity) ??
          parseNumberish(offer?.quantity) ??
          parseNumberish(offer?.availability?.shipToLocationAvailability?.quantity) ??
          null;
        const soldCount = rawSold ?? parseNumberish(offer?.quantitySold) ?? parseNumberish(offer?.sellingStatus?.quantitySold) ?? 0;
        const watchCount = rawWatchCount ?? parseNumberish(offer?.watchCount) ?? 0;
        const stockCount = rawQuantity != null ? Math.max(0, rawQuantity - Number(soldCount || 0)) : fallbackQuantity;
        const priceNumber = parseNumberish(offer?.pricingSummary?.price?.value);
        const daysSinceListed = rawStartTime ? Math.floor((Date.now() - rawStartTime.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const isDeadStock = status !== 'Completed' && soldCount === 0 && daysSinceListed !== null && daysSinceListed >= 30;
        return {
          ...offer,
          _id: id,
          _status: status,
          _title: title,
          _stock: stockCount ?? null,
          _sold: soldCount,
          _watchCount: watchCount,
          _isDeadStock: isDeadStock,
          _daysSinceListed: daysSinceListed,
          _priceText: offer?.pricingSummary?.price?.value != null
            ? `${offer.pricingSummary.price.value} ${offer.pricingSummary.price.currency || ''}`.trim()
            : '-',
          _priceValue: priceNumber,
          _thumb: rawThumb,
          _isEnded: status === 'Completed',
        };
      }),
    [allItems]
  );

  const filteredItems = useMemo(() => {
    const base = normalizedItems.filter((offer) => {
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || offer._title.toLowerCase().includes(q) || String(offer._id).toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'DEAD_STOCK'
        ? offer._isDeadStock
        : statusFilter === 'ALL' || offer._status.toUpperCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
    const compareNum = (a, b) => {
      if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
      if (!Number.isFinite(a)) return 1;
      if (!Number.isFinite(b)) return -1;
      return a - b;
    };
    const compare = (a, b) => {
      if (sortKey === 'title') return String(a._title || '').localeCompare(String(b._title || ''));
      if (sortKey === 'listingId') return String(a._id || '').localeCompare(String(b._id || ''));
      if (sortKey === 'price') return compareNum(a._priceValue, b._priceValue);
      if (sortKey === 'quantity') return compareNum(a._stock, b._stock);
      if (sortKey === 'sold') return compareNum(a._sold, b._sold);
      if (sortKey === 'watchCount') return compareNum(a._watchCount, b._watchCount);
      if (sortKey === 'status') return String(a._status || '').localeCompare(String(b._status || ''));
      return 0;
    };
    return sortDir === 'desc' ? [...base].sort(compare).reverse() : [...base].sort(compare);
  }, [normalizedItems, query, statusFilter, sortKey, sortDir]);

  const pagedItems = useMemo(() => {
    const start = page * limit;
    return filteredItems.slice(start, start + limit);
  }, [filteredItems, page, limit]);

  // Fetch auto stock for the current page
  useEffect(() => {
    if (!ebayStatus.connected) return;
    const ids = pagedItems.map((o) => {
      const id = String(o?.listingId || o?.listing?.listingId || o?.listing?.legacyItemId || '').trim();
      return /^\d{9,15}$/.test(id) ? id : null;
    }).filter(Boolean);
    fetchAutoStockForIds(ids);
    fetchAdRatesForIds(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedItems, ebayStatus.connected]);

  const canPrev = page > 0;
  const canNext = (page + 1) * limit < filteredItems.length;

  const onSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); return prev; }
      setSortDir('asc');
      return key;
    });
  };

  const activeCount = useMemo(() => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'ACTIVE').length, [normalizedItems]);
  const completedCount = useMemo(() => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'COMPLETED').length, [normalizedItems]);
  const deadStockCount = useMemo(() => normalizedItems.filter((i) => i._isDeadStock).length, [normalizedItems]);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputCls = (extra = '') =>
    `rounded-lg border px-2.5 py-1.5 text-sm outline-none transition focus:ring-2 ${
      isDark
        ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/30'
        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-100'
    } ${extra}`;
  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const iconBtn = `inline-flex h-8 w-8 items-center justify-center rounded-lg transition ${
    isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
  }`;

  // Sortable column header with a clear direction arrow.
  const sortLabel = (key, label, align = 'left') => {
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

  // Small inline number editor shared by auto stock and ad rate.
  const renderInlineEditor = ({ value, onChange, onSave, onCancel, saving, min, max, step, placeholder, tone = 'indigo' }) => (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className={inputCls('w-16 px-2 py-1 text-xs')}
        autoFocus
      />
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        title={t('listingsPage.save')}
        className={`flex h-6 w-6 items-center justify-center rounded-md text-white disabled:opacity-50 ${
          tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
      </button>
      <button type="button" onClick={onCancel} title={t('listingsPage.cancel')} className={`flex h-6 w-6 items-center justify-center rounded-md ${faint} hover:opacity-80`}>
        <X size={11} />
      </button>
    </div>
  );

  // A filled chip for an active setting (click = edit, × = remove) or a dashed
  // "+ add" chip when nothing is set.
  const renderSettingChip = ({ active, label, onEdit, onRemove, removing, removeTitle, addLabel, onAdd }) =>
    active ? (
      <span
        className={`inline-flex items-center overflow-hidden rounded-md border text-xs font-semibold ${
          isDark ? 'border-emerald-800/70 bg-emerald-500/10 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}
      >
        <button type="button" onClick={onEdit} className="px-2 py-0.5 hover:underline">
          {label}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          title={removeTitle}
          className={`border-l px-1.5 py-0.5 transition disabled:opacity-50 ${
            isDark ? 'border-emerald-800/70 hover:bg-rose-500/20 hover:text-rose-300' : 'border-emerald-200 hover:bg-rose-50 hover:text-rose-600'
          }`}
        >
          {removing ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={onAdd}
        className={`inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs font-medium transition ${
          isDark ? 'border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-300' : 'border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
        }`}
      >
        <Plus size={11} />
        {addLabel}
      </button>
    );

  const getStatusPill = (statusRaw) => {
    const status = String(statusRaw || '-').toUpperCase();
    if (status.includes('ACTIVE')) return isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700';
    if (status.includes('COMPLETE')) return isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600';
    return isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-700';
  };
  const statusDot = (statusRaw) => {
    const status = String(statusRaw || '-').toUpperCase();
    if (status.includes('ACTIVE')) return 'bg-emerald-500';
    if (status.includes('COMPLETE')) return 'bg-slate-400';
    return 'bg-indigo-500';
  };

  const statusTabs = [
    { key: 'ALL', label: t('listingsPage.allTab'), count: normalizedItems.length },
    { key: 'ACTIVE', label: t('listingsPage.statusActive'), count: activeCount },
    { key: 'COMPLETED', label: t('listingsPage.statusCompleted'), count: endedLoading && endedItems === null ? null : completedCount },
    { key: 'DEAD_STOCK', label: t('listingsPage.deadStock'), count: deadStockCount, warn: true },
  ];

  const rangeFrom = filteredItems.length ? page * limit + 1 : 0;
  const rangeTo = Math.min(filteredItems.length, (page + 1) * limit);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / limit));

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
              <Package size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`text-2xl font-semibold tracking-tight ${strong}`}>{t('listingsPage.title')}</h1>
                {typeof total === 'number' && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {total}
                  </span>
                )}
              </div>
              <p className={`text-sm ${muted}`}>{t('listingsPage.subtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TutorialVideoButton />
            {ebayStatus.connected && (ebayStatus.activeAccountLabel || ebayStatus.accountId) && (
              <EbayAccountSwitcher
                accounts={ebayAccounts}
                activeAccountId={activeEbayAccountId}
                activeAccountLabel={ebayStatus.activeAccountLabel || ebayStatus.accountId}
                onChange={handleEbayAccountChange}
                disabled={switchingEbayAccount}
                label={t('listingsPage.active')}
                isDark={isDark}
              />
            )}
            {ebayStatus.connected && <ScheduledListingsPanel isDark={isDark} variant="inline" />}
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

        {adRateScopeError && (
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${isDark ? 'border-amber-800 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              {t('listingsPage.reconnectForPromotedListings')}
            </span>
            <button type="button" onClick={handleConnect} className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              {t('listingsPage.reconnectEbay')}
            </button>
          </div>
        )}

        {!ebayStatus.connected ? (
          <>
            <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
              <span className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                <Link2 size={24} />
              </span>
              <p className={`mb-5 max-w-md text-sm ${muted}`}>{t('listingsPage.connectPrompt')}</p>
              <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
                <Link2 size={16} /> {t('listingsPage.connectButton')}
              </button>
            </div>
            {showConnectModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}>
                  <h2 className={`mb-2 text-lg font-semibold ${strong}`}>{t('listingsPage.signinRequired')}</h2>
                  <p className={`mb-5 text-sm ${muted}`}>{t('listingsPage.signinDescription')}</p>
                  <div className="flex justify-end gap-3">
                    <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>{t('common.close')}</button>
                    <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={handleConnect}>
                      <Link2 size={16} /> {t('listingsPage.connectButton')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ── Dead stock banner ── */}
            {deadStockCount > 0 && !deadStockBannerDismissed && (
              <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${isDark ? 'border-amber-800/60 bg-amber-950/20' : 'border-amber-200 bg-amber-50'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                  <AlertTriangle size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                    {t('listingsPage.deadStockBannerTitle', { count: deadStockCount })}
                  </p>
                  <p className={`mt-0.5 text-xs ${isDark ? 'text-amber-300/80' : 'text-amber-800/80'}`}>{t('listingsPage.deadStockBannerText')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {statusFilter !== 'DEAD_STOCK' && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('DEAD_STOCK')}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      {t('listingsPage.showDeadStock')}
                    </button>
                  )}
                  {deadStockEmailSent ? (
                    <span className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                      <Check size={12} /> {t('listingsPage.emailSent')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendDeadStockEmail}
                      disabled={sendingDeadStockEmail}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${isDark ? 'border-amber-700 text-amber-300 hover:bg-amber-900/40' : 'border-amber-300 text-amber-800 hover:bg-amber-100'}`}
                    >
                      {sendingDeadStockEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      {sendingDeadStockEmail ? t('listingsPage.sending') : t('listingsPage.sendEmail')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeadStockBannerDismissed(true)}
                    title={t('listingsPage.dismiss')}
                    aria-label={t('listingsPage.dismiss')}
                    className={`rounded-lg p-1.5 ${isDark ? 'text-amber-400 hover:bg-amber-900/40' : 'text-amber-600 hover:bg-amber-100'}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* ── Listings card ── */}
            <div className={`${card} overflow-hidden`}>
              {/* Status tabs */}
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
                  {statusTabs.map((tab) => {
                    const active = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition ${
                          active
                            ? tab.warn
                              ? 'border-amber-500 text-amber-600'
                              : isDark ? 'border-indigo-400 text-slate-100' : 'border-indigo-600 text-slate-900'
                            : `border-transparent ${muted} ${isDark ? 'hover:text-slate-200' : 'hover:text-slate-800'}`
                        }`}
                      >
                        {tab.warn && tab.count > 0 && <AlertTriangle size={13} className="text-amber-500" />}
                        {tab.label}
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            tab.warn && tab.count > 0
                              ? isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'
                              : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tab.count == null ? <Loader2 size={10} className="inline animate-spin" /> : tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Relist reminder frequency (per active store) */}
                <label
                  className={`mb-2 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}
                  title={t('listingsPage.relistFrequencyHint')}
                >
                  <BellRing size={13} className={faint} />
                  <span className="font-medium">{t('listingsPage.relistReminder')}:</span>
                  {t('listingsPage.relistFrequencyEvery')}
                  <input
                    type="number"
                    min="1"
                    value={relistFrequencyInput}
                    onChange={(e) => setRelistFrequencyInput(e.target.value)}
                    onBlur={handleSaveRelistFrequency}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    placeholder="-"
                    className={inputCls('w-12 px-1 py-0.5 text-center text-xs')}
                  />
                  {t('listingsPage.relistFrequencyDaysSuffix')}
                  {savingRelistFrequency ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : relistFrequencySaved ? (
                    <Check size={12} className="text-emerald-500" />
                  ) : null}
                </label>
              </div>

              {/* Search */}
              <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <label className="relative block">
                  <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${faint}`} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('listingsPage.searchPlaceholder')}
                    className={inputCls('w-full py-2 pl-9 pr-9')}
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label={t('listingsPage.cancel')}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 ${faint} hover:opacity-80`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                      <th className="px-4 py-3 text-left">{sortLabel('title', t('listingsPage.colListing'))}</th>
                      <th className="px-4 py-3 text-right">{sortLabel('price', t('listingsPage.price'), 'right')}</th>
                      <th className="px-4 py-3 text-left">{sortLabel('quantity', t('listingsPage.stockCount'))}</th>
                      <th className="px-4 py-3 text-right">{sortLabel('sold', t('listingsPage.sold'), 'right')}</th>
                      <th className="px-4 py-3 text-right">{sortLabel('watchCount', t('listingsPage.watchCount'), 'right')}</th>
                      <th className="px-4 py-3 text-left">{t('listingsPage.adRate')}</th>
                      <th className="px-4 py-3 text-left">{sortLabel('status', t('listingsPage.status'))}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                    {pagedItems.map((offer, idx) => {
                      const key = offer._id;
                      const status = offer?._status || '-';
                      const ebayCandidateId = String(offer?.listingId || offer?.listing?.listingId || offer?.listing?.legacyItemId || '').trim() || null;
                      const ebayListingId = ebayCandidateId && /^\d{9,15}$/.test(ebayCandidateId) ? ebayCandidateId : null;
                      const internalSku = String(offer?.sku || offer?.listing?.sku || '').trim() || null;
                      const offerId = String(offer?.offerId || '').trim() || null;
                      const listingId = ebayListingId || internalSku || offerId || ebayCandidateId || '-';
                      const deleteKey = ebayListingId || internalSku || offerId || '';

                      const isEditing = inlineEditId === key;
                      const autoStockRule = ebayListingId ? autoStockMap[ebayListingId] : undefined;
                      const isAutoStockLoading = ebayListingId ? !!autoStockLoading[ebayListingId] : false;
                      const isAssignOpen = autoStockAssignId === ebayListingId;

                      const adRate = ebayListingId ? adRateMap[ebayListingId] : undefined;
                      const isAdRateLoading = ebayListingId ? !!adRateLoading[ebayListingId] : false;
                      const isAdRateEditOpen = adRateEditId === ebayListingId;
                      const openDetails = () => navigate(`/listings/${encodeURIComponent(String(listingId))}`, { state: { listing: offer } });

                      return (
                        <tr
                          key={`${key}-${idx}`}
                          className={`group align-middle transition-colors ${
                            isEditing
                              ? isDark ? 'bg-indigo-950/30' : 'bg-indigo-50/60'
                              : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Listing: image + title + id */}
                          <td className="px-4 py-3">
                            <div className="flex min-w-[300px] max-w-[460px] items-center gap-3">
                              <button
                                type="button"
                                onClick={openDetails}
                                className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}
                              >
                                {offer._thumb ? (
                                  <img src={offer._thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <span className={`flex h-full w-full items-center justify-center ${faint}`}><ImageOff size={16} /></span>
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                {isEditing ? (
                                  <input
                                    value={inlineValues.title ?? offer._title}
                                    onChange={(e) => setInlineValues((v) => ({ ...v, title: e.target.value }))}
                                    maxLength={80}
                                    className={inputCls('w-full')}
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={openDetails}
                                    title={offer._title}
                                    className={`line-clamp-2 text-left font-medium leading-snug hover:underline ${strong}`}
                                  >
                                    {offer._title}
                                  </button>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                  {ebayListingId ? (
                                    <a
                                      href={`https://www.ebay.com/itm/${ebayListingId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={t('listingsPage.openOnEbay')}
                                      className={`inline-flex items-center gap-1 font-mono ${isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-800'}`}
                                    >
                                      {listingId}
                                      <ExternalLink size={11} />
                                    </a>
                                  ) : (
                                    <span className={`font-mono ${faint}`}>{listingId}</span>
                                  )}
                                  {offer._isDeadStock && (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                                      <Clock size={10} />
                                      {t('listingsPage.deadStockDays', { days: offer._daysSinceListed })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Price */}
                          <td className={`whitespace-nowrap px-4 py-3 text-right ${body}`}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={inlineValues.price ?? offer._priceValue ?? ''}
                                onChange={(e) => setInlineValues((v) => ({ ...v, price: e.target.value }))}
                                className={inputCls('w-24 text-right')}
                              />
                            ) : (
                              <span className={`font-semibold tabular-nums ${strong}`}>{offer._priceText}</span>
                            )}
                          </td>

                          {/* Stock + auto stock */}
                          <td className={`px-4 py-3 ${body}`}>
                            <div className="flex flex-col items-start gap-1.5">
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={inlineValues.quantity ?? (offer._stock ?? '')}
                                  onChange={(e) => setInlineValues((v) => ({ ...v, quantity: e.target.value }))}
                                  className={inputCls('w-20')}
                                />
                              ) : (
                                <span
                                  className={`font-semibold tabular-nums ${
                                    offer._stock === 0 ? 'text-rose-500' : strong
                                  }`}
                                >
                                  {offer._stock ?? '—'}
                                </span>
                              )}
                              {ebayListingId && !offer._isEnded && (
                                isAutoStockLoading ? (
                                  <Loader2 size={12} className={`animate-spin ${faint}`} />
                                ) : isAssignOpen ? (
                                  renderInlineEditor({
                                    value: autoStockAssignValue,
                                    onChange: setAutoStockAssignValue,
                                    onSave: () => handleAssignAutoStock(ebayListingId),
                                    onCancel: () => setAutoStockAssignId(null),
                                    saving: savingAutoStock,
                                    min: 1,
                                    step: 1,
                                    placeholder: t('listingsPage.quantity'),
                                    tone: 'emerald',
                                  })
                                ) : (
                                  renderSettingChip({
                                    active: !!autoStockRule,
                                    label: autoStockRule ? `${t('listingsPage.autoStock')}: ${autoStockRule.assignedQuantity}` : '',
                                    onEdit: () => { setAutoStockAssignId(ebayListingId); setAutoStockAssignValue(String(autoStockRule?.assignedQuantity || '')); },
                                    onRemove: () => handleRemoveAutoStock(ebayListingId),
                                    removing: removingAutoStock === ebayListingId,
                                    removeTitle: t('listingsPage.autoStockRemove'),
                                    addLabel: t('listingsPage.autoStockAdd'),
                                    onAdd: () => { setAutoStockAssignId(ebayListingId); setAutoStockAssignValue(''); },
                                  })
                                )
                              )}
                            </div>
                          </td>

                          {/* Sold */}
                          <td className={`px-4 py-3 text-right tabular-nums ${offer._sold > 0 ? strong : faint}`}>
                            <span className={offer._sold > 0 ? 'font-semibold' : ''}>{offer._sold}</span>
                          </td>

                          {/* Watchers */}
                          <td className={`px-4 py-3 text-right tabular-nums ${offer._watchCount > 0 ? body : faint}`}>
                            <span className="inline-flex items-center gap-1">
                              {offer._watchCount > 0 && <Eye size={12} className={faint} />}
                              {offer._watchCount}
                            </span>
                          </td>

                          {/* Ad rate */}
                          <td className="px-4 py-3">
                            {ebayListingId && !offer._isEnded && (
                              isAdRateLoading ? (
                                <Loader2 size={12} className={`animate-spin ${faint}`} />
                              ) : isAdRateEditOpen ? (
                                renderInlineEditor({
                                  value: adRateEditValue,
                                  onChange: setAdRateEditValue,
                                  onSave: () => handleSaveAdRate(ebayListingId),
                                  onCancel: () => setAdRateEditId(null),
                                  saving: savingAdRate,
                                  min: 2,
                                  max: 100,
                                  step: 0.1,
                                  placeholder: '%',
                                  tone: 'emerald',
                                })
                              ) : (
                                renderSettingChip({
                                  active: adRate?.bidPercentage != null,
                                  label: adRate?.bidPercentage != null ? (
                                    <span className="inline-flex items-center gap-1"><Megaphone size={11} />{adRate.bidPercentage}%</span>
                                  ) : '',
                                  onEdit: () => { setAdRateEditId(ebayListingId); setAdRateEditValue(String(adRate.bidPercentage)); },
                                  onRemove: () => handleRemoveAdRate(ebayListingId),
                                  removing: removingAdRate === ebayListingId,
                                  removeTitle: t('listingsPage.removeAdRate'),
                                  addLabel: t('listingsPage.promote'),
                                  onAdd: () => { setAdRateEditId(ebayListingId); setAdRateEditValue(''); },
                                })
                              )
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getStatusPill(status)}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                              {status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineSave(offer, ebayListingId)}
                                    disabled={savingInline}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                                  >
                                    {savingInline ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    {t('listingsPage.save')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setInlineEditId(null); setInlineValues({}); }}
                                    title={t('listingsPage.cancel')}
                                    aria-label={t('listingsPage.cancel')}
                                    className={iconBtn}
                                  >
                                    <X size={15} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {offer._isEnded && ebayListingId && (
                                    offer.relistedItemId ? (
                                      <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2 text-xs ${muted}`}>
                                        <Check size={12} />
                                        {t('listingsPage.alreadyRelisted')}
                                      </span>
                                    ) : offer.canRelist !== false ? (
                                      <button
                                        type="button"
                                        onClick={() => navigate(`/listings/${encodeURIComponent(String(listingId))}`, { state: { listing: offer, openRelist: true } })}
                                        className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700"
                                        title={t('listingsPage.relistHint')}
                                      >
                                        <RotateCcw size={13} />
                                        {t('listingsPage.relist')}
                                      </button>
                                    ) : null
                                  )}
                                  {ebayListingId && !offer._isEnded && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInlineEditId(key);
                                        setInlineValues({
                                          title: offer._title,
                                          price: offer._priceValue ?? '',
                                          quantity: offer._stock ?? '',
                                        });
                                      }}
                                      title={t('listingsPage.edit')}
                                      aria-label={t('listingsPage.edit')}
                                      className={iconBtn}
                                    >
                                      <Pencil size={15} />
                                    </button>
                                  )}
                                  {ebayListingId && (
                                    <button
                                      type="button"
                                      onClick={() => setFeedbackListing({ offer, ebayListingId })}
                                      title={t('listingsPage.feedback')}
                                      aria-label={t('listingsPage.feedback')}
                                      className={iconBtn}
                                    >
                                      <MessageSquare size={15} />
                                    </button>
                                  )}
                                  {!offer._isEnded && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteListing({ ebayListingId, internalSku, offerId })}
                                      disabled={deleteKey && deletingListingId === deleteKey}
                                      title={t('listingsPage.deleteListing')}
                                      aria-label={t('listingsPage.deleteListing')}
                                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-50 ${isDark ? 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-300' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}
                                    >
                                      {deleteKey && deletingListingId === deleteKey ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={openDetails}
                                    className={`ml-1 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border px-3 text-xs font-semibold transition ${
                                      isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    {t('listingsPage.details')}
                                    <ChevronRight size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedItems.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center">
                          {endedLoading && statusFilter === 'COMPLETED' ? (
                            <span className={`inline-flex items-center gap-2 text-sm ${muted}`}>
                              <Loader2 size={14} className="animate-spin" />
                              {t('listingsPage.loadingEnded')}
                            </span>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                                <Boxes size={20} />
                              </span>
                              <p className={`text-sm ${muted}`}>{t('listingsPage.noListings')}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className={`text-sm tabular-nums ${muted}`}>
                  {t('listingsPage.rangeOf', { from: rangeFrom, to: rangeTo, total: filteredItems.length })}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${faint}`}>
                    {t('listingsPage.page')} {page + 1} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => canPrev && setPage((p) => Math.max(0, p - 1))}
                    disabled={!canPrev || fetchingPage}
                    aria-label={t('listingsPage.previous')}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    <ChevronLeft size={14} /> {t('listingsPage.previous')}
                  </button>
                  <button
                    type="button"
                    onClick={() => canNext && setPage((p) => p + 1)}
                    disabled={!canNext || fetchingPage}
                    aria-label={t('listingsPage.next')}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                  >
                    {t('listingsPage.next')} <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {feedbackListing && (
        <FeedbackSidebar
          listing={feedbackListing.offer}
          ebayListingId={feedbackListing.ebayListingId}
          onClose={() => setFeedbackListing(null)}
        />
      )}
    </div>
  );
}
