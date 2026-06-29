import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, ExternalLink,
  Grid3X3, List, Pencil, Plus, RefreshCw, Search, Trash2,
  TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { ebayAPI, productAPI, settingsAPI } from '../services/api';
import ProductCard from '../components/ProductCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { ProductFormModal } from './ProductFormPage';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { calculateProfit, formatCurrency } from '../utils/helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [limits, setLimits] = useState(null);
  const [ebayFilter, setEbayFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New state
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('products_view') || 'grid');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [sortDropOpen, setSortDropOpen] = useState(false);
  const [inlineEditId, setInlineEditId] = useState(null);
  const [inlineValues, setInlineValues] = useState({});
  const [savingInline, setSavingInline] = useState(false);
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
    } catch {
      setEbayAccounts([]);
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

  const handleInlineSave = async (product) => {
    setSavingInline(true);
    try {
      const fd = new FormData();
      fd.append('productName', (inlineValues.productName ?? product.productName) || '');
      fd.append('adRate', (inlineValues.adRate ?? product.adRate ?? 0).toString());
      fd.append('amazonAsin', product.amazonAsin || '');
      fd.append('ebayItemId', product.ebayItemId || '');
      fd.append('currentAmazonPrice', product.currentAmazonPrice ?? '');
      fd.append('currentEbayPrice', product.currentEbayPrice ?? '');
      fd.append('userEmail', product.userEmail || '');
      await productAPI.update(product.id, fd);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                productName: (inlineValues.productName ?? p.productName) || p.productName,
                adRate: inlineValues.adRate ?? p.adRate,
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
          <button onClick={() => navigate('/market-analysis')} className="btn-secondary">
            {t('productsPage.openAnalysis')}
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
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className={`border-b ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <th className={`${thCls} w-14`}></th>
                  <th className={thCls}>
                    <button onClick={() => handleTableSort('productName')} className="flex items-center gap-1.5 hover:opacity-80 transition">
                      Product <SortIcon active={sortKey === 'productName'} dir={sortDir} />
                    </button>
                  </th>
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
                  const profit = calculateProfit(product.currentEbayPrice, product.currentAmazonPrice, {
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
                      {/* Thumbnail */}
                      <td className={tdCls}>
                        {image ? (
                          <img src={image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[11px] font-bold ${
                            isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {(product.productName || 'P')[0].toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* Product name + IDs */}
                      <td className={`${tdCls} max-w-[240px]`}>
                        {isEditing ? (
                          <input
                            value={inlineValues.productName ?? product.productName}
                            onChange={(e) => setInlineValues((v) => ({ ...v, productName: e.target.value }))}
                            className={inputCls}
                            autoFocus
                          />
                        ) : (
                          <div>
                            <p className="font-medium leading-tight truncate" title={product.productName}>
                              {product.productName}
                            </p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {[product.amazonAsin && `ASIN: ${product.amazonAsin}`, product.ebayItemId && `eBay: ${product.ebayItemId}`]
                                .filter(Boolean).join(' · ')}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className={tdCls}>
                        <StatusBadge status={status} />
                      </td>

                      {/* Amazon price + trend */}
                      <td className={tdCls}>
                        <p className="font-semibold tabular-nums">{formatCurrency(product.currentAmazonPrice)}</p>
                        {amazonTrend !== null && <TrendBadge pct={amazonTrend} invert />}
                      </td>

                      {/* eBay price + trend */}
                      <td className={tdCls}>
                        <p className="font-semibold tabular-nums">{formatCurrency(product.currentEbayPrice)}</p>
                        {ebayTrend !== null && <TrendBadge pct={ebayTrend} />}
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
                                onClick={() => { setInlineEditId(product.id); setInlineValues({ productName: product.productName, adRate: product.adRate ?? 0 }); }}
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
                              <button
                                onClick={() => handleDelete(product.id)}
                                title="Delete"
                                className={`h-8 w-8 rounded-lg border flex items-center justify-center transition ${
                                  isDark ? 'border-rose-900/60 text-rose-400 hover:bg-rose-950/40' : 'border-rose-200 text-rose-500 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 size={13} />
                              </button>
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
