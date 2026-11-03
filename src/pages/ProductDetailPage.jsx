import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI } from '../services/api';
import { buildAmazonProductUrl, extractAmazonAsin, formatCurrency } from '../utils/helpers';
import { formatLongDate, formatLongDateTime, formatShortDateTime } from '../utils/dateFormat';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { ProductFormModal } from './ProductFormPage';
import { useTheme } from '../context/ThemeContext';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  Clock3,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  Megaphone,
  Minus,
  Pencil,
  RefreshCw,
  ShoppingCart,
  Store,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const HISTORY_PAGE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANGES = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: 'all', days: null },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctChange(current, previous) {
  const c = num(current);
  const p = num(previous);
  if (!c || !p || c === p) return null;
  return Math.round(((c - p) / p) * 1000) / 10;
}

function availabilityOf(raw) {
  const lower = String(raw || '').trim().toLowerCase().replace(/_/g, ' ');
  if (!lower) return 'unknown';
  if (lower.includes('out of stock') || lower.includes('unavailable') || lower.includes('title changed')) return 'out';
  if (lower.includes('in stock')) return 'in';
  return 'unknown';
}

function relativeTime(value, t) {
  const time = new Date(value || '').getTime();
  if (!Number.isFinite(time)) return null;
  const mins = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (mins < 60) return t('productDetailPage.ui.minutesAgo', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 48) return t('productDetailPage.ui.hoursAgo', { count: hours });
  return t('productDetailPage.ui.daysAgo', { count: Math.round(hours / 24) });
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Chip({ tone = 'neutral', icon: Icon, isDark, children }) {
  const cls = {
    neutral: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600',
    success: isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
    danger: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700',
    warn: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700',
    info: isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {Icon ? <Icon size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

function Trend({ change, invert = false, isDark }) {
  if (change === null || change === undefined) return null;
  const up = change > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
      good ? (isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'
    }`}>
      <Icon size={12} />
      {Math.abs(change)}%
    </span>
  );
}

function KpiCard({ icon: Icon, accent, label, value, valueTone, sub, trend, isDark }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
            <Icon size={14} />
          </span>
          {label}
        </div>
        {trend}
      </div>
      <p className={`mt-3 text-2xl font-bold tracking-tight tabular-nums ${valueTone || (isDark ? 'text-white' : 'text-slate-900')}`}>{value}</p>
      {sub ? <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{sub}</p> : null}
    </div>
  );
}

function ChartTooltip({ active, payload, label, isDark, t }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className={`rounded-xl border px-3 py-2 text-xs shadow-lg ${isDark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}>
      <p className="mb-1.5 font-semibold">{label}</p>
      <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Amazon</span><b className="tabular-nums">{formatCurrency(row.amazon)}</b></p>
      <p className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />eBay</span><b className="tabular-nums">{formatCurrency(row.ebay)}</b></p>
      {row.profit !== null && (
        <p className={`mt-1 flex items-center justify-between gap-4 border-t pt-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
          <span>{t('productDetailPage.profit')}</span>
          <b className={`tabular-nums ${row.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(row.profit)}</b>
        </p>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { isDark } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareLoading, setCompareLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [range, setRange] = useState('30d');
  const [visibleRows, setVisibleRows] = useState(HISTORY_PAGE);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [imageBroken, setImageBroken] = useState(false);
  const [copied, setCopied] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const [productResponse, historyResponse] = await Promise.all([
        productAPI.getById(productId),
        productAPI.getPriceHistory(productId),
      ]);

      setProduct(productResponse.data);
      setHistory(historyResponse.data || []);
    } catch (error) {
      setAlert({ type: 'error', message: t('productDetailPage.failedLoad') });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // comparePrice now just queues a background job (Amazon scraping can take
  // up to ~90s across its own internal retries — too slow to risk as one
  // synchronous request) and returns a jobId right away; this polls it to
  // completion so the page can still show the result inline the way it
  // always has. A notification is also recorded server-side regardless, so
  // the user finds out even if they navigate away before this finishes.
  const handleCompare = async () => {
    if (compareLoading) return;
    try {
      setCompareLoading(true);
      const queueRes = await productAPI.comparePrice(productId);
      const jobId = queueRes?.data?.jobId;
      if (!jobId) throw new Error(t('productDetailPage.failedCompare'));

      setAlert({ type: 'info', message: t('productDetailPage.compareQueued') });

      const TIMEOUT_MS = 120000;
      const POLL_MS = 2000;
      const deadline = Date.now() + TIMEOUT_MS;
      let result = null;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const pollRes = await productAPI.pollJob(jobId);
        const { status, error: jobError, ...rest } = pollRes?.data || {};
        if (status === 'done') {
          result = rest;
          break;
        }
        if (status === 'error') {
          throw new Error(jobError || t('productDetailPage.failedCompare'));
        }
      }
      if (!result) {
        throw new Error(t('productDetailPage.compareTimedOut'));
      }

      // The backend can detect an Amazon price change and still fail (or skip)
      // pushing it to eBay — e.g. the eBay API call itself errored, or the
      // product has no linked/sync-enabled listing. Surface that instead of
      // always showing a blanket success message, which previously hid these
      // failures from the user entirely.
      if (result.hasDifference && result.autoUpdateError) {
        setAlert({
          type: 'error',
          message: t('productDetailPage.compareEbaySyncFailed', { error: result.autoUpdateError }),
        });
      } else if (result.hasDifference && result.autoUpdatedEbayPrice == null) {
        setAlert({
          type: 'warning',
          message: t('productDetailPage.compareEbayNotSynced'),
        });
      } else {
        setAlert({
          type: 'success',
          message: t('productDetailPage.compareTriggered'),
        });
      }
      // Refresh product data
      await fetchProductDetails();
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || t('productDetailPage.failedCompare') });
    } finally {
      setCompareLoading(false);
    }
  };

  const handleEditSaved = async (jobId) => {
    if (!jobId) {
      await fetchProductDetails();
      return;
    }
    setAlert({ type: 'info', message: t('productDetailPage.ui.savingChanges') });
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const { status, error } = (await productAPI.pollJob(jobId))?.data || {};
        if (status === 'done') break;
        if (status === 'error') {
          setAlert({ type: 'error', message: error || t('productDetailPage.ui.saveFailed') });
          return;
        }
      } catch {
        break;
      }
    }
    setAlert({ type: 'success', message: t('productDetailPage.ui.saved') });
    await fetchProductDetails();
  };

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(key);
      setTimeout(() => setCopied(''), 1500);
    } catch {
      // clipboard blocked — the value stays visible
    }
  };

  // Oldest → newest, numbers only.
  const timeline = useMemo(
    () =>
      [...history]
        .map((r) => ({
          time: new Date(r.timestamp).getTime(),
          amazon: num(r.amazonPrice),
          ebay: num(r.ebayPrice),
          profit: num(r.profit),
          diff: num(r.priceDifference),
        }))
        .filter((r) => Number.isFinite(r.time))
        .sort((a, b) => a.time - b.time),
    [history]
  );

  const chartData = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days;
    const from = days ? Date.now() - days * DAY_MS : -Infinity;
    return timeline
      .filter((r) => r.time >= from)
      .map((r) => ({ ...r, label: formatShortDateTime(r.time, lang) }));
  }, [timeline, range, lang]);

  const stats = useMemo(() => {
    const amazon = chartData.map((r) => r.amazon).filter((v) => v !== null && v > 0);
    if (!amazon.length) return null;
    let changes = 0;
    for (let i = 1; i < chartData.length; i += 1) {
      if (chartData[i].amazon !== chartData[i - 1].amazon || chartData[i].ebay !== chartData[i - 1].ebay) changes += 1;
    }
    return {
      min: Math.min(...amazon),
      max: Math.max(...amazon),
      avg: amazon.reduce((s, v) => s + v, 0) / amazon.length,
      changes,
    };
  }, [chartData]);

  // Newest first for the table, each row compared with the check before it.
  const tableRows = useMemo(() => {
    const rows = timeline.map((r, i) => {
      const prev = timeline[i - 1];
      return {
        ...r,
        amazonDelta: prev && r.amazon !== null && prev.amazon !== null ? r.amazon - prev.amazon : 0,
        ebayDelta: prev && r.ebay !== null && prev.ebay !== null ? r.ebay - prev.ebay : 0,
        first: !prev,
      };
    });
    const filtered = onlyChanges ? rows.filter((r) => r.first || Math.abs(r.amazonDelta) > 0.001 || Math.abs(r.ebayDelta) > 0.001) : rows;
    return filtered.reverse();
  }, [timeline, onlyChanges]);

  if (loading) return <LoadingSpinner />;

  if (!product) {
    return (
      <div className="page-shell text-center">
        <p className="text-xl text-slate-600">{t('productDetailPage.notFound')}</p>
        <button
          onClick={() => navigate('/products')}
          className="mt-4 btn-primary"
        >
          {t('productDetailPage.ui.backToProducts')}
        </button>
      </div>
    );
  }
  const amazonAsin = product.amazonAsin || extractAmazonAsin(product.amazonLink || '');
  const amazonUrl = buildAmazonProductUrl(amazonAsin) || product.amazonLink;
  const ebayItemId = String(product.ebayItemId || '').trim();
  const ebayUrl = ebayItemId ? `https://www.ebay.com/itm/${ebayItemId}` : product.ebayLink;

  const amazonPrice = num(product.currentAmazonPrice);
  const ebayPrice = num(product.currentEbayPrice);
  const profit = num(product.profit);
  const margin = profit !== null && ebayPrice ? Math.round((profit / ebayPrice) * 100) : null;
  const fees = ebayPrice && amazonPrice !== null && profit !== null ? Math.max(0, ebayPrice - amazonPrice - profit) : null;
  const availability = availabilityOf(product.amazonAvailabilityStatus);
  const image = !imageBroken && (product.productImage || (Array.isArray(product.productImages) ? product.productImages[0] : '')) || '';
  const adRate = num(product.adRate);
  const lastChecked = relativeTime(product.lastUpdated, t);

  const breakdown = fees !== null && ebayPrice > 0 ? [
    { key: 'fees', label: t('productDetailPage.ui.ebayFees'), value: fees, bar: 'bg-sky-500' },
    { key: 'cost', label: t('productDetailPage.ui.amazonCost'), value: amazonPrice, bar: 'bg-amber-400' },
    { key: 'profit', label: t('productDetailPage.profit'), value: Math.max(0, profit), bar: profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500' },
  ].map((s) => ({ ...s, pct: Math.max(0, Math.min(100, (s.value / Math.max(ebayPrice, fees + amazonPrice)) * 100)) })) : null;

  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const axis = isDark ? '#64748b' : '#94a3b8';
  const grid = isDark ? '#1e293b' : '#eef2f7';

  const linkPill = (key, icon, label, id, href) => (
    <div className={`inline-flex items-center overflow-hidden rounded-xl border text-sm ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-2 font-semibold transition ${isDark ? 'text-slate-100 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-50'}`}
      >
        {icon}
        {label}
        {id ? <span className={`font-mono text-xs font-medium ${muted}`}>{id}</span> : null}
        <ExternalLink size={13} className={muted} />
      </a>
      {id && (
        <button
          type="button"
          onClick={() => copy(key, id)}
          aria-label={t('productDetailPage.ui.copy')}
          className={`border-l px-2.5 py-2 transition ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
        >
          {copied === key ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-6xl">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate('/products')} className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft size={16} />
            {t('productDetailPage.ui.backToProducts')}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditOpen(true)} className="btn-secondary inline-flex items-center gap-2">
              <Pencil size={15} />
              {t('productDetailPage.editProduct')}
            </button>
            <button
              type="button"
              onClick={handleCompare}
              disabled={compareLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {compareLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {compareLoading ? t('productDetailPage.comparing') : t('productDetailPage.compareNow')}
            </button>
          </div>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
          </div>
        )}

        {/* Hero */}
        <section className={`${card} relative mb-5 overflow-hidden p-5 sm:p-6`}>
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row">
            <div className={`flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              {image ? (
                <img src={image} alt={product.productName} onError={() => setImageBroken(true)} className="h-full w-full object-contain p-2" />
              ) : (
                <ImageOff size={28} className="text-slate-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {availability === 'in' && <Chip tone="success" isDark={isDark}>{t('productDetailPage.ui.inStock')}</Chip>}
                {availability === 'out' && <Chip tone="danger" isDark={isDark}>{t('productDetailPage.ui.outOfStock')}</Chip>}
                {profit !== null && profit < 0 && <Chip tone="danger" icon={AlertTriangle} isDark={isDark}>{t('productDetailPage.ui.unprofitable')}</Chip>}
                {product.ebaySyncEnabled && <Chip tone="info" icon={RefreshCw} isDark={isDark}>{t('productDetailPage.ui.autoSync')}</Chip>}
                {adRate ? <Chip tone="neutral" icon={Megaphone} isDark={isDark}>{t('productDetailPage.ui.adRate', { rate: adRate })}</Chip> : null}
              </div>
              <h1 className={`mt-3 text-xl font-bold leading-snug sm:text-2xl ${strong}`}>{product.productName}</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {amazonUrl && linkPill('amazon', <ShoppingCart size={15} className="text-orange-500" />, 'Amazon', amazonAsin, amazonUrl)}
                {ebayUrl && linkPill('ebay', <Store size={15} className="text-blue-500" />, 'eBay', ebayItemId, ebayUrl)}
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            isDark={isDark}
            icon={ShoppingCart}
            accent={isDark ? 'bg-orange-500/15 text-orange-400' : 'bg-orange-50 text-orange-600'}
            label={t('productDetailPage.amazonPrice')}
            value={formatCurrency(amazonPrice)}
            trend={<Trend change={pctChange(amazonPrice, product.oldAmazonPrice)} invert isDark={isDark} />}
            sub={num(product.oldAmazonPrice) && num(product.oldAmazonPrice) !== amazonPrice ? t('productDetailPage.ui.was', { price: formatCurrency(product.oldAmazonPrice) }) : null}
          />
          <KpiCard
            isDark={isDark}
            icon={Store}
            accent={isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}
            label={t('productDetailPage.ebayPrice')}
            value={formatCurrency(ebayPrice)}
            trend={<Trend change={pctChange(ebayPrice, product.oldEbayPrice)} isDark={isDark} />}
            sub={num(product.oldEbayPrice) && num(product.oldEbayPrice) !== ebayPrice ? t('productDetailPage.ui.was', { price: formatCurrency(product.oldEbayPrice) }) : null}
          />
          <KpiCard
            isDark={isDark}
            icon={CircleDollarSign}
            accent={isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}
            label={t('productDetailPage.profit')}
            value={profit === null ? '—' : `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}`}
            valueTone={profit === null ? null : profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}
            sub={margin !== null ? t('productDetailPage.ui.margin', { margin }) : null}
          />
          <KpiCard
            isDark={isDark}
            icon={Clock3}
            accent={isDark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-600'}
            label={t('productDetailPage.lastUpdated')}
            value={<span className="text-lg">{lastChecked || '—'}</span>}
            sub={product.lastUpdated ? formatLongDateTime(product.lastUpdated, lang) : null}
          />
        </div>

        {/* Breakdown + sync */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className={`${card} p-5 lg:col-span-2`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className={`text-sm font-semibold ${strong}`}>{t('productDetailPage.ui.breakdownTitle')}</h2>
              {ebayPrice ? <p className={`text-xs ${muted}`}>{t('productDetailPage.ui.breakdownOf', { price: formatCurrency(ebayPrice) })}</p> : null}
            </div>
            {breakdown ? (
              <>
                <div className={`mt-4 flex h-3.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {breakdown.map((s) => (
                    <div key={s.key} className={`h-full ${s.bar}`} style={{ width: `${s.pct}%` }} title={`${s.label}: ${formatCurrency(s.value)}`} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {breakdown.map((s) => (
                    <div key={s.key}>
                      <p className={`flex items-center gap-1.5 text-xs font-semibold ${muted}`}>
                        <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                        {s.label}
                      </p>
                      <p className={`mt-1 text-base font-bold tabular-nums ${s.key === 'profit' ? (profit >= 0 ? 'text-emerald-500' : 'text-rose-500') : strong}`}>
                        {s.key === 'profit' ? `${profit >= 0 ? '+' : ''}${formatCurrency(profit)}` : formatCurrency(s.value)}
                      </p>
                      <p className={`text-[11px] ${muted}`}>{Math.round((s.key === 'profit' ? profit : s.value) / ebayPrice * 100)}%</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className={`mt-3 text-sm ${muted}`}>{t('productDetailPage.ui.noBreakdown')}</p>
            )}
          </section>

          <section className={`${card} p-5`}>
            <h2 className={`flex items-center gap-2 text-sm font-semibold ${strong}`}>
              <RefreshCw size={15} className="text-indigo-500" />
              {t('productDetailPage.ui.syncTitle')}
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className={muted}>{t('productDetailPage.ui.autoSync')}</dt>
                <dd>
                  <Chip tone={product.ebaySyncEnabled ? 'success' : 'neutral'} isDark={isDark}>
                    {product.ebaySyncEnabled ? t('productDetailPage.ui.on') : t('productDetailPage.ui.off')}
                  </Chip>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className={muted}>{t('productDetailPage.ui.lastSync')}</dt>
                <dd className={`font-medium ${strong}`}>{product.ebayLastSyncAt ? relativeTime(product.ebayLastSyncAt, t) : '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className={muted}>{t('productDetailPage.ui.tracking')}</dt>
                <dd className={`font-medium ${strong}`}>{t('productDetailPage.ui.checks', { count: timeline.length })}</dd>
              </div>
              {product.createdAt && (
                <div className="flex items-center justify-between gap-3">
                  <dt className={muted}>{t('productDetailPage.ui.since')}</dt>
                  <dd className={`font-medium ${strong}`}>{formatLongDate(product.createdAt, lang)}</dd>
                </div>
              )}
            </dl>
            {product.ebayLastSyncError && (
              <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span className="break-words">{product.ebayLastSyncError}</span>
              </p>
            )}
          </section>
        </div>

        {/* Chart */}
        {timeline.length > 1 && (
          <section className={`${card} mb-5 p-5`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className={`flex items-center gap-2 text-base font-semibold ${strong}`}>
                  <TrendingUp size={17} className="text-indigo-500" />
                  {t('productDetailPage.priceHistory')}
                </h2>
                <div className={`mt-1 flex flex-wrap items-center gap-3 text-xs ${muted}`}>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-500" />Amazon</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />eBay</span>
                </div>
              </div>
              <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} role="tablist">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="tab"
                    aria-selected={range === r.key}
                    onClick={() => setRange(r.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      range === r.key
                        ? isDark ? 'bg-slate-950 text-white shadow' : 'bg-white text-slate-900 shadow'
                        : muted
                    }`}
                  >
                    {t(`productDetailPage.ui.range.${r.key}`)}
                  </button>
                ))}
              </div>
            </div>

            {stats && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t('productDetailPage.ui.lowest'), formatCurrency(stats.min)],
                  [t('productDetailPage.ui.highest'), formatCurrency(stats.max)],
                  [t('productDetailPage.ui.average'), formatCurrency(stats.avg)],
                  [t('productDetailPage.ui.priceChanges'), stats.changes],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
                    <p className={`mt-0.5 text-sm font-bold tabular-nums ${strong}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 h-72">
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pd-ebay" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pd-amazon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={48} domain={['auto', 'auto']} />
                    <Tooltip content={<ChartTooltip isDark={isDark} t={t} />} cursor={{ stroke: axis, strokeDasharray: '4 4' }} />
                    <Area type="monotone" dataKey="ebay" stroke="#3b82f6" strokeWidth={2.5} fill="url(#pd-ebay)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive={false} />
                    <Area type="monotone" dataKey="amazon" stroke="#f97316" strokeWidth={2.5} fill="url(#pd-amazon)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex h-full items-center justify-center text-sm ${muted}`}>{t('productDetailPage.ui.noDataRange')}</div>
              )}
            </div>
          </section>
        )}

        {/* History table */}
        {timeline.length > 0 && (
          <section className={`${card} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <h2 className={`text-base font-semibold ${strong}`}>{t('productDetailPage.ui.checkHistory')}</h2>
              <label className={`inline-flex cursor-pointer items-center gap-2 text-xs font-semibold ${muted}`}>
                <input type="checkbox" checked={onlyChanges} onChange={(e) => { setOnlyChanges(e.target.checked); setVisibleRows(HISTORY_PAGE); }} className="h-4 w-4 rounded" />
                {t('productDetailPage.ui.onlyChanges')}
              </label>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isDark ? 'bg-slate-950/50 text-slate-400' : 'bg-slate-50 text-slate-500'}>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider">{t('productDetailPage.date')}</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">{t('productDetailPage.amazon')}</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">{t('productDetailPage.ebay')}</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">{t('productDetailPage.profit')}</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider">{t('productDetailPage.difference')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(0, visibleRows).map((row) => {
                    const delta = (value, invert) => {
                      if (!value || Math.abs(value) < 0.001) return null;
                      const good = invert ? value < 0 : value > 0;
                      const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
                      return <Icon size={13} className={`inline ${good ? 'text-emerald-500' : 'text-rose-500'}`} />;
                    };
                    const diffTone = !row.diff ? muted : row.diff > 0 ? 'text-emerald-500' : 'text-rose-500';
                    return (
                      <tr key={row.time} className={`border-t transition ${isDark ? 'border-slate-800 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <td className={`whitespace-nowrap px-5 py-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatLongDateTime(row.time, lang)}</td>
                        <td className={`whitespace-nowrap px-5 py-3 text-right tabular-nums ${strong}`}>{delta(row.amazonDelta, true)} {formatCurrency(row.amazon)}</td>
                        <td className={`whitespace-nowrap px-5 py-3 text-right tabular-nums ${strong}`}>{delta(row.ebayDelta, false)} {formatCurrency(row.ebay)}</td>
                        <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${row.profit === null ? muted : row.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(row.profit)}</td>
                        <td className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${diffTone}`}>
                          {!row.diff ? <Minus size={13} className="inline" /> : `${row.diff > 0 ? '+' : ''}${formatCurrency(row.diff)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tableRows.length > visibleRows ? (
              <div className={`border-t p-3 text-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <button type="button" onClick={() => setVisibleRows((n) => n + HISTORY_PAGE)} className="text-sm font-semibold text-indigo-500 hover:underline">
                  {t('productDetailPage.ui.showMore', { count: Math.min(HISTORY_PAGE, tableRows.length - visibleRows) })}
                </button>
              </div>
            ) : (
              <div className="h-2" />
            )}
          </section>
        )}
      </div>
      {editOpen && (
        <ProductFormModal productId={productId} onClose={() => setEditOpen(false)} onSuccess={(jobId) => handleEditSaved(jobId)} />
      )}
    </div>
  );
}
