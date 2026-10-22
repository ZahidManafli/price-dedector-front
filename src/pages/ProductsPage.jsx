import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Bell, Check, ExternalLink, FileSpreadsheet,
  Grid3X3, List, MoreVertical, PackageCheck, PackageX, Pencil, Plus, RefreshCw, Search, Send, Trash2,
  TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { ebayAPI, productAPI, settingsAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { ProductFormModal } from './ProductFormPage';
import ProductBulkImportModal from '../components/ProductBulkImportModal';
import TutorialVideoButton from '../components/TutorialVideoButton';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { buildAmazonProductUrl, calculateProfit, formatCurrency } from '../utils/helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// POST /products/bulk-import only starts the import in the background
// (fetching each row's real Amazon photo can take a while) and returns a
// jobId right away — this polls GET /products/bulk-import/:jobId until it's
// done or error. Lives here (not inside ProductBulkImportModal) specifically
// so closing that modal never stops it: this page stays mounted and keeps
// polling regardless, then refreshes the product list the moment it's done.
async function pollProductBulkImportJob(jobId, { intervalMs = 2000, maxConsecutiveFailures = 10 } = {}) {
  let consecutiveFailures = 0;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    let pollRes;
    try {
      pollRes = await productAPI.pollBulkImport(jobId);
      consecutiveFailures = 0;
    } catch (pollErr) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) throw pollErr;
      continue; // eslint-disable-line no-continue
    }
    const status = pollRes?.data?.status;
    if (status === 'done') return pollRes.data;
    if (status === 'error') throw new Error(pollRes?.data?.error || 'Fayl yüklənə bilmədi');
    // status === 'processing' -> keep polling
  }
}

function getProductStatus(p) {
  const amazon = Number(p.currentAmazonPrice || 0);
  if (!amazon) return 'out_of_stock';
  const profit = calculateProfit(p.currentEbayPrice, p.currentAmazonPrice, {
    taxRate: 0.06, fvfRate: 0.136,
    adRate: (parseFloat(p.adRate) || 0) / 100, fixedFee: 0.3,
  });
  if (profit < 0) return 'unprofitable';
  return 'active';
}

function priceTrendPct(current, old) {
  const c = Number(current || 0);
  const o = Number(old || 0);
  if (!o || !c || o === c) return null;
  return ((c - o) / o) * 100;
}

// Mirrors normalizeAmazonAvailabilityStatus on the backend, just for deciding
// which manual button (Restock / Mark out of stock) to show. Some automated
// paths (page-not-found, title-changed, "High price") persist the raw
// normalized value itself — e.g. the literal string "out_of_stock" — instead of
// a human-readable phrase, so underscores are folded to spaces before matching.
function normalizeAmazonAvailability(raw) {
  const lower = String(raw || '').trim().toLowerCase().replace(/_/g, ' ');
  if (!lower) return 'unknown';
  if (lower.includes('out of stock') || lower.includes('unavailable') || lower.includes('title changed')) {
    return 'out_of_stock';
  }
  if (lower.includes('in stock')) return 'in_stock';
  return 'unknown';
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  },
  unprofitable: {
    label: 'Unprofitable',
    dot: 'bg-rose-500',
    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  },
  out_of_stock: {
    label: 'No Price',
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
  },
};

const SORT_OPTIONS = [
  { key: 'createdAt', dir: 'desc', label: 'Newest first' },
  { key: 'createdAt', dir: 'asc', label: 'Oldest first' },
  { key: 'productName', dir: 'asc', label: 'Name A → Z' },
  { key: 'productName', dir: 'desc', label: 'Name Z → A' },
  { key: 'currentAmazonPrice', dir: 'asc', label: 'Amazon price ↑' },
  { key: 'currentAmazonPrice', dir: 'desc', label: 'Amazon price ↓' },
  { key: 'currentEbayPrice', dir: 'asc', label: 'eBay price ↑' },
  { key: 'currentEbayPrice', dir: 'desc', label: 'eBay price ↓' },
  { key: 'profit', dir: 'desc', label: 'Best profit first' },
  { key: 'profit', dir: 'asc', label: 'Lowest profit first' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TrendBadge({ pct, invert = false }) {
  if (pct === null) return <span className="text-slate-400 text-[11px]">—</span>;
  const up = pct > 0;
  // For Amazon price: up = cost went up = bad (rose). For eBay: up = revenue went up = good (emerald).
  const color = invert
    ? (up ? 'text-rose-500' : 'text-emerald-500')
    : (up ? 'text-emerald-500' : 'text-rose-500');
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function SortIcon({ active, dir }) {
  if (!active) return <ArrowUpDown size={13} className="opacity-40" />;
  return dir === 'asc' ? <ArrowUp size={13} className="text-blue-500" /> : <ArrowDown size={13} className="text-blue-500" />;
}

// Which product fields feed each toggle, and the i18n keys for its label/hint.
// checkXEnabled defaults to true client-side too (mirrors the backend's "NULL/legacy
// row = enabled" rule) so a product fetched before its first check-settings save
// still renders every box checked.
const CHECK_TOGGLES = [
  { key: 'checkPriceEnabled', labelKey: 'priceLabel', hintKey: 'priceHint' },
  { key: 'checkStockEnabled', labelKey: 'stockLabel', hintKey: 'stockHint' },
  { key: 'checkTitleEnabled', labelKey: 'titleLabel', hintKey: 'titleHint' },
  { key: 'checkHighPriceEnabled', labelKey: 'highPriceLabel', hintKey: 'highPriceHint' },
];

// Per-row "⋮" popover on the Products page table — lets the user pick which of the
// four checks (price / stock / title / "High price") the cron job and manual
// Compare should perform for THIS product, then persists them on Save via the
// dedicated check-settings endpoint (not the full product-edit form).
function CheckSettingsPopover({ product, isDark, t, onClose, onSave }) {
  const [draft, setDraft] = useState(() =>
    CHECK_TOGGLES.reduce((acc, { key }) => {
      acc[key] = product[key] !== false;
      return acc;
    }, {})
  );
  const [saving, setSaving] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(product, draft);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div
      ref={popoverRef}
      className={`absolute right-0 top-full mt-1 w-72 rounded-xl border shadow-xl z-30 p-3 text-left ${
        isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {t('productChecks.popoverTitle')}
      </p>
      <div className="space-y-2.5">
        {CHECK_TOGGLES.map(({ key, labelKey, hintKey }) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 rounded border-slate-400 text-blue-600 focus:ring-blue-500/40"
            />
            <span>
              <span className={`block text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                {t(`productChecks.${labelKey}`)}
              </span>
              <span className={`block text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t(`productChecks.${hintKey}`)}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-700/20">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? t('productChecks.saving') : t('productChecks.save')}
        </button>
      </div>
    </div>
  );
}

// Same link LandingPage.jsx's marketing CTA uses — there is no deep-link/
// token handshake for connecting Telegram in this app; linking happens
// entirely inside the bot conversation itself (DM it, press "Log in", type
// your Checkila email/password). This button just gets the user into that
// chat.
const TELEGRAM_BOT_URL = 'https://t.me/Checkila_bot';

function ToggleSwitch({ checked, onChange, disabled, isDark }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        disabled
          ? isDark ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-200 cursor-not-allowed'
          : checked ? 'bg-blue-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked && !disabled ? 'translate-x-4' : 'translate-x-0.5'
        } ${disabled ? 'opacity-70' : ''}`}
      />
    </button>
  );
}

// Page-level (not per-product) settings for whether the automated price/
// stock/title check system (runPriceCheckJob cron job + the manual Compare
// button — see backend utils/productCheckNotifications.js) is allowed to
// email/Telegram-message this user at all. Reuses the SAME users.preferences
// "Email on price change" toggle that already existed on the Settings page
// (that one just had no backend effect until now) — this is a second,
// more convenient place to reach it, not a separate setting. The Telegram
// toggle is additionally gated on having linked Telegram at all; when not
// linked, it's shown disabled with a button into the bot chat instead.
function NotificationSettingsModal({ isDark, t, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({ emailOnPriceChange: true, telegramOnPriceChange: true, telegramConnected: false });
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    settingsAPI
      .getPreferences()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};
        setPrefs({
          emailOnPriceChange: data.emailOnPriceChange !== false,
          telegramOnPriceChange: data.telegramOnPriceChange !== false,
          telegramConnected: !!data.telegramConnected,
        });
      })
      .catch(() => { if (!cancelled) setError(t('productsPage.notificationSettingsLoadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePref = async (key, value) => {
    const previous = prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaving(true);
    setError(null);
    try {
      await settingsAPI.updatePreferences({ [key]: value });
    } catch {
      setPrefs((prev) => ({ ...prev, [key]: previous }));
      setError(t('productsPage.notificationSettingsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const telegramToggleDisabled = loading || saving || !prefs.telegramConnected || !prefs.emailOnPriceChange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className={`w-full max-w-md rounded-2xl border p-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {t('productsPage.notificationSettingsTitle')}
          </h2>
          <button type="button" onClick={onClose} className={isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <RefreshCw size={20} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-4">
            {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {t('productsPage.notificationEmailLabel')}
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('productsPage.notificationEmailHint')}
                </p>
              </div>
              <ToggleSwitch
                checked={prefs.emailOnPriceChange}
                disabled={loading || saving}
                isDark={isDark}
                onChange={(value) => updatePref('emailOnPriceChange', value)}
              />
            </div>

            <div className={`pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                    {t('productsPage.notificationTelegramLabel')}
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {!prefs.telegramConnected
                      ? t('productsPage.notificationTelegramNotConnectedHint')
                      : !prefs.emailOnPriceChange
                        ? t('productsPage.notificationTelegramNeedsMasterHint')
                        : t('productsPage.notificationTelegramHint')}
                  </p>
                </div>
                <ToggleSwitch
                  checked={prefs.telegramOnPriceChange}
                  disabled={telegramToggleDisabled}
                  isDark={isDark}
                  onChange={(value) => updatePref('telegramOnPriceChange', value)}
                />
              </div>

              {!prefs.telegramConnected && (
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-3 py-1.5 transition"
                >
                  <Send size={13} />
                  {t('productsPage.notificationConnectTelegram')}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [bulkImportModalOpen, setBulkImportModalOpen] = useState(false);
  const [bulkImportJob, setBulkImportJob] = useState(null); // { jobId, status, result, error } or null
  const [limits, setLimits] = useState(null);
  const [ebayFilter, setEbayFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New state
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('products_view') || 'table');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineValues, setInlineValues] = useState({});
  const [savingInline, setSavingInline] = useState(false);
  const [checkSettingsOpenId, setCheckSettingsOpenId] = useState(null);
  const [notificationSettingsOpen, setNotificationSettingsOpen] = useState(false);
  const sortDropRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchLimits();
    fetchEbayAccounts();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setSortDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keeps polling a started bulk-import job to completion regardless of
  // whether ProductBulkImportModal (which only kicks the job off) is still
  // open — this effect lives on the page itself, so closing the modal early
  // can never leave the product list stuck showing stale data until a manual
  // page refresh.
  useEffect(() => {
    const jobId = bulkImportJob?.jobId;
    if (!jobId || bulkImportJob.status !== 'processing') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const finished = await pollProductBulkImportJob(jobId);
        if (cancelled) return;
        setBulkImportJob({ jobId, status: 'done', result: finished });
        fetchProducts();
        fetchLimits();
        setAlert({
          type: 'success',
          message: t('productBulkImport.resultSummary', { created: finished?.created || 0, total: finished?.totalRows || 0 }),
        });
      } catch (pollError) {
        if (cancelled) return;
        setBulkImportJob({ jobId, status: 'error', error: pollError?.message || t('productBulkImport.uploadFailed') });
        setAlert({ type: 'error', message: pollError?.message || t('productBulkImport.uploadFailed') });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkImportJob?.jobId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await productAPI.getAll();
      setProducts(res.data || []);
    } catch {
      setAlert({ type: 'error', message: t('productsPage.failedLoad') });
    } finally {
      setLoading(false);
    }
  };

  const fetchLimits = async () => {
    try {
      const res = await settingsAPI.getLimits();
      setLimits(res.data || null);
    } catch {
      setLimits(null);
    }
  };

  const fetchEbayAccounts = async () => {
    try {
      const res = await ebayAPI.getStatus();
      setEbayAccounts(Array.isArray(res?.data?.ebayAccounts) ? res.data.ebayAccounts : []);
      setActiveEbayAccountId(res?.data?.activeEbayAccountId || null);
    } catch {
      setEbayAccounts([]);
      setActiveEbayAccountId(null);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm(t('productsPage.deleteConfirm'))) return;
    try {
      await productAPI.delete(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setAlert({ type: 'success', message: t('productsPage.deleted') });
      fetchLimits();
    } catch {
      setAlert({ type: 'error', message: t('productsPage.failedDelete') });
    }
  };

  const [availabilityActionId, setAvailabilityActionId] = useState(null);
  const handleAvailabilityAction = async (product, action) => {
    setAvailabilityActionId(product.id);
    try {
      const res = action === 'restock'
        ? await productAPI.restock(product.id)
        : await productAPI.markOutOfStock(product.id);
      const { amazonAvailabilityStatus } = res?.data || {};
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, amazonAvailabilityStatus } : p))
      );
      setAlert({
        type: 'success',
        message: action === 'restock'
          ? 'Product restocked — eBay quantity set to 1 and user notified by email.'
          : 'Product marked out of stock — eBay quantity set to 0 and user notified by email.',
      });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err?.response?.data?.error || (action === 'restock' ? 'Failed to restock product' : 'Failed to mark product out of stock'),
      });
    } finally {
      setAvailabilityActionId(null);
    }
  };

  const handleInlineSave = async (product) => {
    setSavingInline(true);
    try {
      const fd = new FormData();
      fd.append('productName', (inlineValues.productName ?? product.productName) || '');
      fd.append('adRate', (inlineValues.adRate ?? product.adRate ?? 0).toString());
      fd.append('amazonAsin', (inlineValues.amazonAsin ?? product.amazonAsin) || '');
      fd.append('ebayItemId', (inlineValues.ebayItemId ?? product.ebayItemId) || '');
      fd.append('currentAmazonPrice', (inlineValues.currentAmazonPrice ?? product.currentAmazonPrice ?? '').toString());
      fd.append('currentEbayPrice', (inlineValues.currentEbayPrice ?? product.currentEbayPrice ?? '').toString());
      fd.append('userEmail', product.userEmail || '');
      await productAPI.update(product.id, fd);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                productName: (inlineValues.productName ?? p.productName) || p.productName,
                adRate: inlineValues.adRate ?? p.adRate,
                amazonAsin: (inlineValues.amazonAsin ?? p.amazonAsin) || p.amazonAsin,
                ebayItemId: (inlineValues.ebayItemId ?? p.ebayItemId) || p.ebayItemId,
                currentAmazonPrice: inlineValues.currentAmazonPrice ?? p.currentAmazonPrice,
                currentEbayPrice: inlineValues.currentEbayPrice ?? p.currentEbayPrice,
              }
            : p
        )
      );
      setInlineEditId(null);
      setInlineValues({});
      setAlert({ type: 'success', message: 'Product updated' });
    } catch {
      setAlert({ type: 'error', message: 'Failed to update product' });
    } finally {
      setSavingInline(false);
    }
  };

  const handleSaveCheckSettings = async (product, draft) => {
    try {
      const res = await productAPI.updateCheckSettings(product.id, draft);
      const saved = res?.data || {};
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                checkPriceEnabled: saved.checkPriceEnabled ?? draft.checkPriceEnabled,
                checkStockEnabled: saved.checkStockEnabled ?? draft.checkStockEnabled,
                checkTitleEnabled: saved.checkTitleEnabled ?? draft.checkTitleEnabled,
                checkHighPriceEnabled: saved.checkHighPriceEnabled ?? draft.checkHighPriceEnabled,
              }
            : p
        )
      );
      setAlert({ type: 'success', message: t('productChecks.saved') });
      return true;
    } catch {
      setAlert({ type: 'error', message: t('productChecks.failedSave') });
      return false;
    }
  };

  const handleTableSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const switchView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('products_view', mode);
  };

  const productsRemaining = limits?.products?.remaining;
  const isProductQuotaReached =
    productsRemaining !== null && productsRemaining !== undefined && productsRemaining <= 0;

  const filteredProducts = useMemo(() => {
    const matchesAccount = (product, account) => {
      const pIds = [product?.ebayAccountId, product?.ebayAccountInternalId, product?.ebayTradingAccountId, product?.ebayProfileUserId]
        .filter(Boolean).map((v) => String(v).trim());
      const aIds = [account?.id, account?.accountId, account?.tradingAccountId, account?.profileUserId, account?.username, account?.connectionName]
        .filter(Boolean).map((v) => String(v).trim());
      return aIds.some((id) => pIds.includes(id));
    };

    const accountFiltered = products.filter((p) => {
      if (ebayFilter === 'ALL') return true;
      const selectedAccount = ebayAccounts.find((a) =>
        [a?.id, a?.accountId, a?.tradingAccountId, a?.profileUserId, a?.username]
          .filter(Boolean).map((v) => String(v).trim()).includes(ebayFilter)
      );
      if (!selectedAccount) return true;
      return matchesAccount(p, selectedAccount);
    });

    const q = searchQuery.trim().toLowerCase();
    if (!q) return accountFiltered;
    return accountFiltered.filter((p) =>
      [p?.productName, p?.title, p?.ebayItemId, p?.asin, p?.amazonAsin, p?.amazonASIN]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [products, ebayAccounts, ebayFilter, searchQuery]);

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === 'productName') {
        av = (a.productName || '').toLowerCase();
        bv = (b.productName || '').toLowerCase();
      } else if (sortKey === 'createdAt') {
        av = new Date(a.createdAt || 0).getTime();
        bv = new Date(b.createdAt || 0).getTime();
      } else if (sortKey === 'profit') {
        const opts = (p) => ({ taxRate: 0.06, fvfRate: 0.136, adRate: (parseFloat(p.adRate) || 0) / 100, fixedFee: 0.3 });
        av = calculateProfit(a.currentEbayPrice, a.currentAmazonPrice, opts(a));
        bv = calculateProfit(b.currentEbayPrice, b.currentAmazonPrice, opts(b));
      } else {
        av = Number(a[sortKey] || 0);
        bv = Number(b[sortKey] || 0);
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredProducts, sortKey, sortDir]);

  const accountFilterOptions = useMemo(
    () =>
      ebayAccounts
        .map((a) => ({
          id: String(a.id || a.accountId || a.tradingAccountId || a.profileUserId || a.username || '').trim(),
          label: a.connectionName || a.username || a.profileUserId || t('productsPage.unknownAccount'),
        }))
        .filter((o) => o.id),
    [ebayAccounts, t]
  );

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortKey && o.dir === sortDir)?.label || 'Sort';

  const thCls = `px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`;
  const tdCls = `px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`;
  const inputCls = `w-full rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
  }`;

  return (
    <div className="page-shell">
      {isFormOpen && (
        <ProductFormModal
          productId={editingProductId}
          onClose={() => { setIsFormOpen(false); setEditingProductId(null); }}
          onSuccess={() => { fetchProducts(); fetchLimits(); }}
        />
      )}

      {bulkImportModalOpen && (
        <ProductBulkImportModal
          ebayAccounts={ebayAccounts}
          activeEbayAccountId={activeEbayAccountId}
          isDark={isDark}
          job={bulkImportJob}
          onJobStarted={(jobId) => setBulkImportJob({ jobId, status: 'processing' })}
          onClose={() => setBulkImportModalOpen(false)}
        />
      )}

      {notificationSettingsOpen && (
        <NotificationSettingsModal isDark={isDark} t={t} onClose={() => setNotificationSettingsOpen(false)} />
      )}

      {alert && (
        <div className="mb-5">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h1 className="page-title">{t('productsPage.title')}</h1>
          <p className="page-subtitle">{t('productsPage.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TutorialVideoButton />
          <button onClick={() => navigate('/market-analysis')} className="btn-secondary">
            {t('productsPage.openAnalysis')}
          </button>
          <button
            onClick={() => {
              if (isProductQuotaReached) {
                setAlert({ type: 'warning', message: t('productsPage.quotaReached') });
                return;
              }
              setBulkImportModalOpen(true);
            }}
            disabled={isProductQuotaReached}
            className="btn-secondary flex items-center gap-1.5 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={14} />
            {t('productsPage.bulkImportButton')}
          </button>
          <button
            data-tour="products-add-button"
            onClick={() => {
              if (isProductQuotaReached) {
                setAlert({ type: 'warning', message: t('productsPage.quotaReached') });
                return;
              }
              setEditingProductId(null);
              setIsFormOpen(true);
            }}
            disabled={isProductQuotaReached}
            className="btn-primary flex items-center gap-1.5 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {t('productsPage.addProduct')}
            {productsRemaining === null || productsRemaining === undefined ? (
              <span className="ml-1 text-[11px] bg-white/20 px-2 py-0.5 rounded-full">{t('productsPage.unlimited')}</span>
            ) : (
              <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${isProductQuotaReached ? 'bg-red-500/80' : 'bg-white/20'}`}>
                {productsRemaining} {t('productsPage.left')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className={`rounded-2xl border p-3 mb-5 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('productsPage.searchPlaceholder')}
            className={`w-full rounded-xl border pl-9 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
            }`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative" ref={sortDropRef}>
          <button
            onClick={() => setSortDropOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
            }`}
          >
            <ArrowUpDown size={14} />
            {currentSortLabel}
          </button>
          {sortDropOpen && (
            <div className={`absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-xl z-20 py-1 ${
              isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.key && sortDir === opt.dir;
                return (
                  <button
                    key={`${opt.key}_${opt.dir}`}
                    onClick={() => { setSortKey(opt.key); setSortDir(opt.dir); setSortDropOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition ${
                      active
                        ? isDark ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-50 text-blue-700'
                        : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                    {active && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Account filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setEbayFilter('ALL')}
            className={`rounded-full px-3 py-1.5 text-xs border font-medium transition ${
              ebayFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600'
                : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
            }`}
          >
            All
          </button>
          {accountFilterOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setEbayFilter(opt.id)}
              className={`rounded-full px-3 py-1.5 text-xs border font-medium transition ${
                ebayFilter === opt.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className={`hidden sm:block w-px self-stretch ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />

        {/* View toggle */}
        <div className={`flex rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={() => switchView('grid')}
            title="Grid view"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-white'
            }`}
          >
            <Grid3X3 size={14} />
            <span className="hidden sm:inline">Grid</span>
          </button>
          <button
            onClick={() => switchView('table')}
            title="Table view"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-white'
            }`}
          >
            <List size={14} />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>

        {/* Notification settings — whether the price/stock/title check
            system (cron + manual Compare) emails/Telegram-messages this
            user; see NotificationSettingsModal above. */}
        <button
          type="button"
          onClick={() => setNotificationSettingsOpen(true)}
          title={t('productsPage.notificationSettingsTitle')}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
            isDark ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
          }`}
        >
          <Bell size={14} />
          <span className="hidden sm:inline">{t('productsPage.notificationSettingsButton')}</span>
        </button>
      </div>

      {/* ── Count row ── */}
      {!loading && sortedProducts.length > 0 && (
        <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      )}

      {/* ── Content ── */}
      {loading ? (
        <LoadingSpinner />
      ) : products.length === 0 ? (
        <div className={`rounded-2xl border text-center py-14 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <p className={`text-lg font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('productsPage.noProductsYet')}</p>
          <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Add your first product to start tracking prices</p>
          <button
            onClick={() => { if (!isProductQuotaReached) { setEditingProductId(null); setIsFormOpen(true); } }}
            disabled={isProductQuotaReached}
            className="btn-primary disabled:cursor-not-allowed"
          >
            {isProductQuotaReached ? t('productsPage.quotaReachedLabel') : t('productsPage.addFirstProduct')}
          </button>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className={`rounded-2xl border text-center py-10 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <p className={`text-base font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {searchQuery ? t('productsPage.noProductsMatchSearch') : t('productsPage.noProductsMatchFilter')}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="btn-secondary">{t('productsPage.clearSearch')}</button>
            )}
            {ebayFilter !== 'ALL' && (
              <button onClick={() => setEbayFilter('ALL')} className="btn-secondary">{t('productsPage.showAllProducts')}</button>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {sortedProducts.map((product) => {
            const status = getProductStatus(product);
            const amazonTrend = priceTrendPct(product.currentAmazonPrice, product.oldAmazonPrice);
            const ebayTrend = priceTrendPct(product.currentEbayPrice, product.oldEbayPrice);
            return (
              <div key={product.id} className="relative">
                {/* Status badge overlay */}
                <div className="absolute top-2 left-2 z-20">
                  <StatusBadge status={status} />
                </div>
                {/* Price trend overlay */}
                {(amazonTrend !== null || ebayTrend !== null) && (
                  <div className="absolute bottom-[108px] left-0 right-0 z-20 px-3 flex items-center gap-2">
                    {amazonTrend !== null && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isDark ? 'bg-slate-900/90' : 'bg-white/90'
                      }`}>
                        AMZ <TrendBadge pct={amazonTrend} invert />
                      </span>
                    )}
                    {ebayTrend !== null && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isDark ? 'bg-slate-900/90' : 'bg-white/90'
                      }`}>
                        eBay <TrendBadge pct={ebayTrend} />
                      </span>
                    )}
                  </div>
                )}
                <ProductCard
                  product={product}
                  onEdit={(id) => { setEditingProductId(id); setIsFormOpen(true); }}
                  onDelete={handleDelete}
                  onCompare={(id) => navigate(`/product/${id}`)}
                  onRestock={() => handleAvailabilityAction(product, 'restock')}
                  onMarkOutOfStock={() => handleAvailabilityAction(product, 'out_of_stock')}
                  availabilityActionLoading={availabilityActionId === product.id}
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px]">
              <thead>
                <tr className={`border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <th className={`${thCls} w-16`}></th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('productName')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Product <SortIcon active={sortKey === 'productName'} dir={sortDir} />
                    </button>
                  </th>
                  <th className={thCls}>ASIN / eBay ID</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('currentAmazonPrice')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Amazon <SortIcon active={sortKey === 'currentAmazonPrice'} dir={sortDir} />
                    </button>
                  </th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('currentEbayPrice')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      eBay <SortIcon active={sortKey === 'currentEbayPrice'} dir={sortDir} />
                    </button>
                  </th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('profit')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Profit <SortIcon active={sortKey === 'profit'} dir={sortDir} />
                    </button>
                  </th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('createdAt')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Added <SortIcon active={sortKey === 'createdAt'} dir={sortDir} />
                    </button>
                  </th>
                  <th className={`${thCls} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((product, idx) => {
                  const isEditing = inlineEditId === product.id;
                  const status = getProductStatus(product);
                  const amazonTrend = priceTrendPct(product.currentAmazonPrice, product.oldAmazonPrice);
                  const ebayTrend = priceTrendPct(product.currentEbayPrice, product.oldEbayPrice);
                  const liveEbayPrice = isEditing ? (inlineValues.currentEbayPrice ?? product.currentEbayPrice) : product.currentEbayPrice;
                  const liveAmazonPrice = isEditing ? (inlineValues.currentAmazonPrice ?? product.currentAmazonPrice) : product.currentAmazonPrice;
                  const profit = calculateProfit(liveEbayPrice, liveAmazonPrice, {
                    taxRate: 0.06, fvfRate: 0.136,
                    adRate: (parseFloat(isEditing ? (inlineValues.adRate ?? product.adRate) : product.adRate) || 0) / 100,
                    fixedFee: 0.3,
                  });
                  const image = product.productImage || (Array.isArray(product.productImages) ? product.productImages[0] : null);

                  return (
                    <tr
                      key={product.id}
                      className={`border-t transition-colors ${
                        isDark ? 'border-slate-800' : 'border-slate-100'
                      } ${
                        isEditing
                          ? isDark ? 'bg-blue-950/30' : 'bg-blue-50/70'
                          : idx % 2 === 0
                            ? isDark ? 'bg-transparent hover:bg-slate-900/40' : 'bg-white hover:bg-slate-50/80'
                            : isDark ? 'bg-slate-900/20 hover:bg-slate-900/40' : 'bg-slate-50/40 hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Thumbnail — most Amazon product photos are shot on a plain
                          white background with the product itself a narrow object
                          (a pen, a single stick, a roll of bags), so against this
                          table's own white rows a plain cropped <img> made the square
                          frame invisible and only the thin product silhouette showed,
                          looking like a badly-shaped sliver instead of a thumbnail.
                          A visible card background + border always shows the square
                          boundary, and object-contain guarantees the whole photo is
                          visible (never cropped) regardless of its own aspect ratio. */}
                      <td className={tdCls}>
                        {image ? (
                          <div className={`w-16 h-16 rounded-lg border overflow-hidden flex items-center justify-center p-1 ${
                            isDark ? 'bg-white border-slate-700' : 'bg-white border-slate-200'
                          }`}>
                            <img src={image} alt="" className="max-w-full max-h-full object-contain" />
                          </div>
                        ) : (
                          <div className={`w-16 h-16 rounded-lg border flex items-center justify-center text-base font-bold ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}>
                            {(product.productName || 'P')[0].toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* Product name */}
                      <td className={`${tdCls} max-w-[200px]`}>
                        {isEditing ? (
                          <input
                            value={inlineValues.productName ?? product.productName}
                            onChange={(e) => setInlineValues((v) => ({ ...v, productName: e.target.value }))}
                            className={inputCls}
                            autoFocus
                          />
                        ) : (
                          <p className="font-medium leading-tight truncate" title={product.productName}>
                            {product.productName}
                          </p>
                        )}
                      </td>

                      {/* ASIN / eBay ID with links */}
                      <td className={`${tdCls} min-w-[160px]`}>
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] w-10 shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>ASIN</span>
                              <input
                                value={inlineValues.amazonAsin ?? product.amazonAsin ?? ''}
                                onChange={(e) => setInlineValues((v) => ({ ...v, amazonAsin: e.target.value }))}
                                placeholder="B0..."
                                className={`${inputCls} text-xs`}
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] w-10 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>eBay</span>
                              <input
                                value={inlineValues.ebayItemId ?? product.ebayItemId ?? ''}
                                onChange={(e) => setInlineValues((v) => ({ ...v, ebayItemId: e.target.value }))}
                                placeholder="Item ID"
                                className={`${inputCls} text-xs`}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {product.amazonAsin ? (
                              <a
                                href={buildAmazonProductUrl(product.amazonAsin)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-[11px] font-mono hover:underline ${isDark ? 'text-orange-400' : 'text-orange-600'}`}
                                title="Open on Amazon"
                              >
                                <ExternalLink size={10} />
                                {product.amazonAsin}
                              </a>
                            ) : (
                              <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                            )}
                            {product.ebayItemId ? (
                              <a
                                href={`https://www.ebay.com/itm/${product.ebayItemId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-[11px] font-mono hover:underline ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                                title="Open on eBay"
                              >
                                <ExternalLink size={10} />
                                {product.ebayItemId}
                              </a>
                            ) : (
                              <span className={`text-[11px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className={tdCls}>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={status} />
                          {(() => {
                            const amazonAvailability = normalizeAmazonAvailability(product.amazonAvailabilityStatus);
                            if (amazonAvailability === 'unknown') return null;
                            return (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  amazonAvailability === 'out_of_stock'
                                    ? isDark ? 'bg-rose-900/40 text-rose-300' : 'bg-rose-100 text-rose-700'
                                    : isDark ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                                }`}
                                title={product.amazonAvailabilityStatus || ''}
                              >
                                {amazonAvailability === 'out_of_stock' ? 'Amazon: OOS' : 'Amazon: In stock'}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Amazon price + trend */}
                      <td className={tdCls}>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0" step="0.01"
                            value={inlineValues.currentAmazonPrice ?? product.currentAmazonPrice ?? ''}
                            onChange={(e) => setInlineValues((v) => ({ ...v, currentAmazonPrice: e.target.value }))}
                            className={`w-24 rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 ${
                              isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        ) : (
                          <>
                            <p className="font-semibold tabular-nums">{formatCurrency(product.currentAmazonPrice)}</p>
                            {amazonTrend !== null && <TrendBadge pct={amazonTrend} invert />}
                          </>
                        )}
                      </td>

                      {/* eBay price + trend */}
                      <td className={tdCls}>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0" step="0.01"
                            value={inlineValues.currentEbayPrice ?? product.currentEbayPrice ?? ''}
                            onChange={(e) => setInlineValues((v) => ({ ...v, currentEbayPrice: e.target.value }))}
                            className={`w-24 rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
                              isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                            }`}
                          />
                        ) : (
                          <>
                            <p className="font-semibold tabular-nums">{formatCurrency(product.currentEbayPrice)}</p>
                            {ebayTrend !== null && <TrendBadge pct={ebayTrend} />}
                          </>
                        )}
                      </td>

                      {/* Profit + Ad Rate edit */}
                      <td className={tdCls}>
                        <p className={`font-bold tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatCurrency(profit)}
                        </p>
                        {isEditing ? (
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ad%</span>
                            <input
                              type="number"
                              min="0" max="100" step="0.1"
                              value={inlineValues.adRate ?? product.adRate ?? 0}
                              onChange={(e) => setInlineValues((v) => ({ ...v, adRate: e.target.value }))}
                              className={`w-16 rounded-lg border px-1.5 py-0.5 text-xs outline-none ${
                                isDark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                              }`}
                            />
                          </div>
                        ) : (
                          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Ad: {product.adRate || 0}%
                          </p>
                        )}
                      </td>

                      {/* Date added */}
                      <td className={`${tdCls} whitespace-nowrap`}>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {new Date(product.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </p>
                        {product.lastUpdated && product.lastUpdated !== product.createdAt && (
                          <p className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            upd {new Date(product.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className={`${tdCls} text-right`}>
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleInlineSave(product)}
                                disabled={savingInline}
                                title="Save"
                                className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-50"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => { setInlineEditId(null); setInlineValues({}); }}
                                title="Cancel"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setInlineEditId(product.id);
                                  setInlineValues({
                                    productName: product.productName,
                                    adRate: product.adRate ?? 0,
                                    amazonAsin: product.amazonAsin ?? '',
                                    ebayItemId: product.ebayItemId ?? '',
                                    currentAmazonPrice: product.currentAmazonPrice ?? '',
                                    currentEbayPrice: product.currentEbayPrice ?? '',
                                  });
                                }}
                                title="Quick edit"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => navigate(`/product/${product.id}`)}
                                title="View details"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <ExternalLink size={13} />
                              </button>
                              <button
                                onClick={() => { setEditingProductId(product.id); setIsFormOpen(true); }}
                                title="Edit full form"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <RefreshCw size={13} />
                              </button>
                              {normalizeAmazonAvailability(product.amazonAvailabilityStatus) === 'out_of_stock' && (
                                <button
                                  onClick={() => handleAvailabilityAction(product, 'restock')}
                                  disabled={availabilityActionId === product.id}
                                  title="Restock — sets eBay quantity to 1 and marks Amazon availability as In Stock"
                                  className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 transition disabled:opacity-50"
                                >
                                  <PackageCheck size={13} />
                                </button>
                              )}
                              {normalizeAmazonAvailability(product.amazonAvailabilityStatus) === 'in_stock' && (
                                <button
                                  onClick={() => handleAvailabilityAction(product, 'out_of_stock')}
                                  disabled={availabilityActionId === product.id}
                                  title="Mark out of stock — sets eBay quantity to 0 and marks Amazon availability as Out of Stock"
                                  className="h-8 w-8 rounded-lg bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition disabled:opacity-50"
                                >
                                  <PackageX size={13} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(product.id)}
                                title="Delete"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-rose-900/60 text-rose-400 hover:bg-rose-950/40' : 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 size={13} />
                              </button>
                              <div className="relative">
                                <button
                                  onClick={() => setCheckSettingsOpenId((cur) => (cur === product.id ? null : product.id))}
                                  title={t('productChecks.menuTitle')}
                                  className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  <MoreVertical size={13} />
                                </button>
                                {checkSettingsOpenId === product.id && (
                                  <CheckSettingsPopover
                                    product={product}
                                    isDark={isDark}
                                    t={t}
                                    onClose={() => setCheckSettingsOpenId(null)}
                                    onSave={handleSaveCheckSettings}
                                  />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className={`px-4 py-3 border-t flex items-center justify-between ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-100 bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-3">
              {[
                { key: 'active', count: sortedProducts.filter((p) => getProductStatus(p) === 'active').length },
                { key: 'unprofitable', count: sortedProducts.filter((p) => getProductStatus(p) === 'unprofitable').length },
                { key: 'out_of_stock', count: sortedProducts.filter((p) => getProductStatus(p) === 'out_of_stock').length },
              ].filter((s) => s.count > 0).map((s) => (
                <span key={s.key} className={`inline-flex items-center gap-1 text-xs ${STATUS_CONFIG[s.key].cls} rounded-full px-2 py-0.5`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[s.key].dot}`} />
                  {STATUS_CONFIG[s.key].label}: {s.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
