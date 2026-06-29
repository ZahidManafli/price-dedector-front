import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ebayAPI } from '../services/api';
import Alert from '../components/Alert';
import {
  ArrowDownUp, Check, Loader2, Mail, Package, Link2,
  Pencil, Search, SlidersHorizontal, Trash2, AlertTriangle, X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ListingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // ── Core state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
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

  // ── Inline edit state ─────────────────────────────────────────────────────
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineValues, setInlineValues] = useState({});
  const [savingInline, setSavingInline] = useState(false);

  // ── Auto stock state ──────────────────────────────────────────────────────
  // autoStockMap: { [ebayListingId]: rule | null }
  const [autoStockMap, setAutoStockMap] = useState({});
  const [autoStockLoading, setAutoStockLoading] = useState({});
  // which row has the "assign" input open
  const [autoStockAssignId, setAutoStockAssignId] = useState(null);
  const [autoStockAssignValue, setAutoStockAssignValue] = useState('');
  const [savingAutoStock, setSavingAutoStock] = useState(false);
  const [removingAutoStock, setRemovingAutoStock] = useState('');

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);
        if (!status.connected) { setShowConnectModal(true); setLoading(false); return; }
        await loadListings();
      } catch {
        setShowConnectModal(true);
      } finally {
        setLoading(false);
      }
    };
    init();
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

  const normalizedItems = useMemo(
    () =>
      (items || []).map((offer) => {
        const id = offer?.offerId || offer?.listingId || offer?.listing?.listingId || offer?.sku || '-';
        const status = String(offer?.status || offer?.marketplaceId || '-');
        const title = offer?.listing?.title || offer?.title || offer?.product?.title || '(no title)';
        let rawQuantity = null, rawSold = null, rawThumb = '', rawStartTime = null;
        if (offer?.rawXml && typeof DOMParser !== 'undefined') {
          try {
            const doc = new DOMParser().parseFromString(offer.rawXml, 'text/xml');
            const getText = (sel) => doc.querySelector(sel)?.textContent?.trim() || '';
            const getAllText = (sel) => Array.from(doc.querySelectorAll(sel)).map((n) => n.textContent?.trim()).filter(Boolean);
            rawQuantity = parseNumberish(getText('Quantity'));
            rawSold = parseNumberish(getText('SellingStatus > QuantitySold'));
            rawThumb = getAllText('PictureDetails > PictureURL')[0] || '';
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
        const stockCount = rawQuantity != null ? Math.max(0, rawQuantity - Number(soldCount || 0)) : fallbackQuantity;
        const priceNumber = parseNumberish(offer?.pricingSummary?.price?.value);
        const daysSinceListed = rawStartTime ? Math.floor((Date.now() - rawStartTime.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const isDeadStock = soldCount === 0 && daysSinceListed !== null && daysSinceListed >= 30;
        return {
          ...offer,
          _id: id,
          _status: status,
          _title: title,
          _stock: stockCount ?? null,
          _sold: soldCount,
          _isDeadStock: isDeadStock,
          _daysSinceListed: daysSinceListed,
          _priceText: offer?.pricingSummary?.price?.value != null
            ? `${offer.pricingSummary.price.value} ${offer.pricingSummary.price.currency || ''}`.trim()
            : '-',
          _priceValue: priceNumber,
          _thumb: rawThumb,
        };
      }),
    [items]
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
  const sortLabel = (key, label) => (
    <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1">
      {label}
      <ArrowDownUp size={12} className={sortKey === key ? 'opacity-100' : 'opacity-40'} />
    </button>
  );

  const activeCount = useMemo(() => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'ACTIVE').length, [normalizedItems]);
  const completedCount = useMemo(() => normalizedItems.filter((i) => String(i._status).toUpperCase() === 'COMPLETED').length, [normalizedItems]);
  const deadStockCount = useMemo(() => normalizedItems.filter((i) => i._isDeadStock).length, [normalizedItems]);

  const getStatusPill = (statusRaw) => {
    const status = String(statusRaw || '-').toUpperCase();
    if (status.includes('ACTIVE')) return isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status.includes('COMPLETE')) return isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
    return isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  // Shared input style
  const inputCls = (extra = '') =>
    `rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
      isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900'
    } ${extra}`;

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
        <h1 className={`page-title flex items-center gap-2 ${isDark ? 'text-slate-100' : ''}`}>
          <Package size={18} />
          {t('listingsPage.title')}
        </h1>
        {ebayStatus.connected ? (
          <div className={`text-sm flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {(ebayStatus.activeAccountLabel || ebayStatus.accountId) && (
              <span className={`inline-flex items-center rounded-full px-3 py-2 text-md border ${isDark ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {t('listingsPage.active')}: <span className="ml-1 font-semibold">{ebayStatus.activeAccountLabel || ebayStatus.accountId}</span>
              </span>
            )}
            {typeof total === 'number' ? `${t('listingsPage.total')}: ${total}` : null}
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
          <div className={`rounded-xl p-6 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
            <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mb-4`}>{t('listingsPage.connectPrompt')}</p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} /> {t('listingsPage.connectButton')}
            </button>
          </div>
          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className={`w-full max-w-md p-6 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'glass-card'}`}>
                <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-slate-100' : ''}`}>{t('listingsPage.signinRequired')}</h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('listingsPage.signinDescription')}</p>
                <div className="flex gap-3 justify-end">
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
          {/* ── Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('listingsPage.showing')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{filteredItems.length}</p>
            </div>
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('listingsPage.activeLabel')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{activeCount}</p>
            </div>
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('listingsPage.completed')}</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{completedCount}</p>
            </div>
            <button
              type="button"
              onClick={() => { setStatusFilter('DEAD_STOCK'); setDeadStockBannerDismissed(false); }}
              className={`rounded-xl border p-4 text-left transition-colors ${
                deadStockCount > 0
                  ? isDark ? 'bg-amber-900/20 border-amber-700/60 hover:bg-amber-900/30' : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                  : isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
              }`}
            >
              <p className={`text-xs flex items-center gap-1 ${deadStockCount > 0 ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                {deadStockCount > 0 && <AlertTriangle size={11} />}
                Donmuş Stok
              </p>
              <p className={`text-2xl font-bold ${deadStockCount > 0 ? (isDark ? 'text-amber-300' : 'text-amber-700') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                {deadStockCount}
              </p>
            </button>
          </div>

          {/* ── Dead stock banner ── */}
          {deadStockCount > 0 && !deadStockBannerDismissed && (
            <div className={`mb-4 rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 ${isDark ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'}`}>
              <AlertTriangle size={18} className={`${isDark ? 'text-amber-400' : 'text-amber-600'} shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>{deadStockCount} listinqiniz 30+ gündür satılmayıb</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>Bu listinqlər üçün qiymət azaltmağı və ya silməyi nəzərə alın.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {deadStockEmailSent ? (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>Email göndərildi ✓</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendDeadStockEmail}
                    disabled={sendingDeadStockEmail}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${isDark ? 'border-amber-700 text-amber-300 hover:bg-amber-800/40 disabled:opacity-50' : 'border-amber-300 text-amber-700 hover:bg-amber-100 disabled:opacity-50'}`}
                  >
                    {sendingDeadStockEmail ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                    {sendingDeadStockEmail ? 'Göndərilir...' : 'Email göndər'}
                  </button>
                )}
                <button type="button" onClick={() => setDeadStockBannerDismissed(true)} className={`p-1 rounded ${isDark ? 'text-amber-500 hover:text-amber-300' : 'text-amber-500 hover:text-amber-700'}`} title="Bağla">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ── Filters ── */}
          <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="relative md:col-span-2">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('listingsPage.searchPlaceholder')}
                  className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                />
              </label>
              <label className="relative">
                <SlidersHorizontal size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                >
                  <option value="ALL">{t('listingsPage.allStatus')}</option>
                  <option value="ACTIVE">{t('listingsPage.statusActive')}</option>
                  <option value="COMPLETED">{t('listingsPage.statusCompleted')}</option>
                  <option value="DEAD_STOCK">⚠ Donmuş Stok (30+ gün)</option>
                </select>
              </label>
            </div>
          </div>

          {/* ── Table ── */}
          <div className={`p-0 overflow-hidden rounded-xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'glass-card'}`}>
            <div className="overflow-x-auto">
              <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
                <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                  <tr>
                    {['image', 'title', 'listingId', 'price', 'stockCount', 'sold', 'status', ''].map((col, i) => (
                      <th
                        key={i}
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                      >
                        {col === 'image' && t('listingsPage.image')}
                        {col === 'title' && sortLabel('title', t('listingsPage.title'))}
                        {col === 'listingId' && sortLabel('listingId', t('listingsPage.listingId'))}
                        {col === 'price' && sortLabel('price', t('listingsPage.price'))}
                        {col === 'stockCount' && sortLabel('quantity', t('listingsPage.stockCount'))}
                        {col === 'sold' && sortLabel('sold', t('listingsPage.sold'))}
                        {col === 'status' && sortLabel('status', t('listingsPage.status'))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
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

                    return (
                      <React.Fragment key={`${key}-${idx}`}>
                        <tr className={`${
                          isEditing
                            ? isDark ? 'bg-blue-950/30' : 'bg-blue-50/70'
                            : offer._isDeadStock
                              ? isDark ? 'bg-amber-950/20' : 'bg-amber-50/60'
                              : isDark ? 'bg-slate-900 hover:bg-slate-800/50' : 'bg-white hover:bg-slate-50/80'
                        } transition-colors`}>

                          {/* Image */}
                          <td className="px-4 py-3">
                            <div className={`w-12 h-12 rounded-md overflow-hidden border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                              {offer._thumb && <img src={offer._thumb} alt="" className="w-full h-full object-cover" />}
                            </div>
                          </td>

                          {/* Title */}
                          <td className={`px-4 py-3 text-sm max-w-[280px] ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {isEditing ? (
                              <input
                                value={inlineValues.title ?? offer._title}
                                onChange={(e) => setInlineValues((v) => ({ ...v, title: e.target.value }))}
                                maxLength={80}
                                className={inputCls('w-full')}
                                autoFocus
                              />
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="leading-tight">{offer._title}</span>
                                {offer._isDeadStock && (
                                  <span className={`inline-flex items-center gap-1 w-fit text-xs font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-amber-900/40 text-amber-300 border border-amber-700/60' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                    <AlertTriangle size={10} />
                                    Donmuş Stok · {offer._daysSinceListed} gün
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Listing ID */}
                          <td className={`px-4 py-3 text-sm font-mono ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {ebayListingId ? (
                              <a
                                href={`https://www.ebay.com/itm/${ebayListingId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                              >
                                {listingId}
                              </a>
                            ) : listingId}
                          </td>

                          {/* Price */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {isEditing ? (
                              <input
                                type="number"
                                min="0.01" step="0.01"
                                value={inlineValues.price ?? offer._priceValue ?? ''}
                                onChange={(e) => setInlineValues((v) => ({ ...v, price: e.target.value }))}
                                className={inputCls('w-24')}
                              />
                            ) : (
                              <span className="font-semibold tabular-nums">{offer._priceText}</span>
                            )}
                          </td>

                          {/* Stock + Auto Stock */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {/* Current stock (editable) */}
                            {isEditing ? (
                              <input
                                type="number"
                                min="1" step="1"
                                value={inlineValues.quantity ?? (offer._stock ?? '')}
                                onChange={(e) => setInlineValues((v) => ({ ...v, quantity: e.target.value }))}
                                className={inputCls('w-20')}
                              />
                            ) : (
                              <span className="font-semibold">{offer._stock ?? '-'}</span>
                            )}

                            {/* Auto stock section */}
                            {ebayListingId && (
                              <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                {isAutoStockLoading ? (
                                  <Loader2 size={12} className={`animate-spin ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                                ) : autoStockRule ? (
                                  /* ── Assigned ── */
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Auto stok</span>
                                      {isAssignOpen ? (
                                        /* Edit auto stock value */
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="1" step="1"
                                            value={autoStockAssignValue}
                                            onChange={(e) => setAutoStockAssignValue(e.target.value)}
                                            className={`w-16 rounded border px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/40 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleAssignAutoStock(ebayListingId)}
                                            disabled={savingAutoStock}
                                            className="h-5 w-5 rounded bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                                          >
                                            {savingAutoStock ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAutoStockAssignId(null)}
                                            className={`h-5 w-5 rounded flex items-center justify-center ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                          >
                                            <X size={9} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => { setAutoStockAssignId(ebayListingId); setAutoStockAssignValue(String(autoStockRule.assignedQuantity || '')); }}
                                          className={`text-xs font-bold hover:underline ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
                                        >
                                          {autoStockRule.assignedQuantity}
                                        </button>
                                      )}
                                    </div>
                                    {!isAssignOpen && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAutoStock(ebayListingId)}
                                        disabled={removingAutoStock === ebayListingId}
                                        className={`inline-flex items-center gap-0.5 text-[10px] font-medium transition ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-500 hover:text-rose-700'} disabled:opacity-50`}
                                      >
                                        {removingAutoStock === ebayListingId ? <Loader2 size={9} className="animate-spin" /> : <X size={9} />}
                                        Auto stoku sil
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  /* ── Not assigned ── */
                                  <div className="flex flex-col gap-1">
                                    {!isAssignOpen ? (
                                      <>
                                        <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Təyin edilməyib</span>
                                        <button
                                          type="button"
                                          onClick={() => { setAutoStockAssignId(ebayListingId); setAutoStockAssignValue(''); }}
                                          className={`inline-flex items-center gap-0.5 text-[10px] font-medium transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                                        >
                                          + Auto stok təyin et
                                        </button>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="1" step="1"
                                          value={autoStockAssignValue}
                                          onChange={(e) => setAutoStockAssignValue(e.target.value)}
                                          placeholder="Miqdar"
                                          className={`w-20 rounded border px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/40 ${isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900'}`}
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleAssignAutoStock(ebayListingId)}
                                          disabled={savingAutoStock}
                                          className="h-6 rounded bg-blue-600 text-white text-[10px] font-semibold px-2 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-0.5"
                                        >
                                          {savingAutoStock ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />}
                                          Saxla
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setAutoStockAssignId(null)}
                                          className={`h-6 w-6 rounded flex items-center justify-center ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Sold */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{offer._sold}</td>

                          {/* Status */}
                          <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getStatusPill(status)}`}>
                              {status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineSave(offer, ebayListingId)}
                                    disabled={savingInline}
                                    title="Save"
                                    className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-50"
                                  >
                                    {savingInline ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setInlineEditId(null); setInlineValues({}); }}
                                    title="Cancel"
                                    className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                  >
                                    <X size={13} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  {ebayListingId && (
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
                                      title="Edit"
                                      className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                      <Pencil size={13} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/listings/${encodeURIComponent(String(listingId))}`, { state: { listing: offer } })}
                                    className={`inline-flex items-center gap-1 text-sm ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                                  >
                                    {t('listingsPage.details')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteListing({ ebayListingId, internalSku, offerId })}
                                    disabled={deleteKey && deletingListingId === deleteKey}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${isDark ? 'border-red-900/50 text-red-300 hover:bg-red-950/40' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                                    title={t('listingsPage.deleteListing')}
                                  >
                                    <Trash2 size={14} />
                                    {deleteKey && deletingListingId === deleteKey ? t('listingsPage.deleting') : t('listingsPage.delete')}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {pagedItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('listingsPage.noListings')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                {t('listingsPage.page')} {page + 1}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => canPrev && setPage((p) => Math.max(0, p - 1))} disabled={!canPrev || fetchingPage} className="btn-secondary">
                  {t('listingsPage.previous')}
                </button>
                <button type="button" onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext || fetchingPage} className="btn-secondary">
                  {t('listingsPage.next')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
