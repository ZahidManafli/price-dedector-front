import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { profitAPI, ebayAPI } from '../services/api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import Swal from 'sweetalert2';
import {
  TrendingUp,
  Plus,
  Trash2,
  X,
  ChevronDown,
  Loader2,
  Info,
  Search,
  ArrowUpDown,
  Copy,
  Check,
  Wallet,
  DollarSign,
  Megaphone,
  ShoppingBag,
  Image as ImageIcon,
} from 'lucide-react';
import OrderDetailModal from '../components/OrderDetailModal';
import TutorialVideoButton from '../components/TutorialVideoButton';

// ─── Profit formula ────────────────────────────────────────────────────────────
// Net profit = eBay total due seller (the entry's ebay_payout — already net of eBay's
// Final Value Fee, per the real Finances API SALE transaction amount) - related
// Promoted Listings ad fee (matched to this order from real eBay finance transactions,
// see /ebay/finance/order-ad-fees) - Amazon cost.
//
// amazon_price is the TOTAL amount actually paid to Amazon for this purchase
// (not a per-unit price), so it must NOT be multiplied by count — count is
// purely informational here (how many units that Amazon order contained).
function calcProfit(ebayPayout, amazonPrice, relatedFee) {
  const salePrice = parseFloat(ebayPayout) || 0;
  const cogs = parseFloat(amazonPrice) || 0;
  const fee = parseFloat(relatedFee) || 0;
  if (salePrice === 0 || cogs === 0) return 0;
  return Math.round((salePrice - fee - cogs) * 100) / 100;
}

// ─── Extract image URL from a listing (mirrors ListingsPage.jsx logic) ────────
function extractListingThumb(offer) {
  // rawXml is the most reliable source (legacy Trading API format)
  if (offer?.rawXml && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(offer.rawXml, 'text/xml');
      const pics = Array.from(doc.querySelectorAll('PictureDetails > PictureURL'))
        .map((n) => n.textContent?.trim())
        .filter(Boolean);
      if (pics[0]) return pics[0];
    } catch {}
  }
  // REST / Inventory API fallbacks
  return (
    offer?.listing?.image?.imageUrl ||
    offer?.listing?.thumbnailImages?.[0]?.imageUrl ||
    offer?.imageUrl ||
    offer?.thumbnailUrl ||
    (Array.isArray(offer?.pictureUrls) ? offer.pictureUrls[0] : null) ||
    ''
  );
}

function extractListingTitle(offer) {
  return (
    offer?.listing?.title ||
    offer?.title ||
    offer?.product?.title ||
    ''
  );
}

function extractListingId(offer) {
  return (
    String(offer?.listingId || offer?.listing?.listingId || offer?.listing?.legacyItemId || offer?.offerId || offer?.sku || '')
      .trim()
  );
}

// ─── Custom image dropdown ────────────────────────────────────────────────────
function ImageSelect({ value, onChange, options, isDark, placeholder, loadingImages }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
          isDark
            ? 'bg-slate-800 border-slate-600 text-slate-100 hover:border-slate-400'
            : 'bg-white border-slate-300 text-slate-900 hover:border-slate-400'
        }`}
      >
        {loadingImages ? (
          <span className={`flex items-center gap-2 flex-1 text-left text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            <Loader2 size={13} className="animate-spin" />
            Loading listing images…
          </span>
        ) : selected ? (
          <>
            <img
              src={selected.value}
              alt=""
              className="h-8 w-8 object-cover rounded flex-shrink-0 border"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <span className="truncate text-xs flex-1 text-left">{selected.label}</span>
          </>
        ) : (
          <span className={`flex-1 text-left text-sm ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
            {placeholder}
          </span>
        )}
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected image large preview */}
      {selected && !open && (
        <div className="mt-2 flex items-start gap-3">
          <img
            src={selected.value}
            alt=""
            className={`h-16 w-16 object-cover rounded-lg border flex-shrink-0 ${
              isDark ? 'border-slate-600' : 'border-slate-200'
            }`}
            onError={(e) => { e.target.parentElement.style.display = 'none'; }}
          />
          <span className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {selected.label}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 top-full left-0 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border shadow-2xl ${
              isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
            }`}
          >
            {/* Clear option */}
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs border-b ${
                !value
                  ? isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  : isDark ? 'text-slate-400 hover:bg-slate-700 border-slate-700' : 'text-slate-500 hover:bg-slate-50 border-slate-100'
              }`}
            >
              <span className="opacity-60">— {placeholder}</span>
            </button>

            {options.length === 0 && !loadingImages && (
              <div className={`px-3 py-6 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                No listing images found. Make sure your eBay account is connected.
              </div>
            )}

            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs transition-colors ${
                  value === opt.value
                    ? isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                    : isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <img
                  src={opt.value}
                  alt=""
                  className={`h-10 w-10 object-cover rounded flex-shrink-0 border ${
                    isDark ? 'border-slate-600' : 'border-slate-200'
                  }`}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span className="truncate text-left leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl">
      <p className="mb-0.5 text-slate-400">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${value < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
        {value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}
      </p>
    </div>
  );
}

// ─── Prepare chart data ───────────────────────────────────────────────────────
function prepareChartData(entries, range) {
  const now = new Date();

  if (range === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = d.toDateString();
      const profit = entries
        .filter((e) => new Date(e.created_at).toDateString() === dateStr)
        .reduce((s, e) => s + parseFloat(e.profit || 0), 0);
      return { label, profit: Math.round(profit * 100) / 100 };
    });
  }

  if (range === '30d') {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const dateStr = d.toDateString();
      const profit = entries
        .filter((e) => new Date(e.created_at).toDateString() === dateStr)
        .reduce((s, e) => s + parseFloat(e.profit || 0), 0);
      return { label, profit: Math.round(profit * 100) / 100 };
    });
  }

  if (range === '90d') {
    return Array.from({ length: 13 }, (_, i) => {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (12 - i) * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const label = weekStart.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const profit = entries
        .filter((e) => {
          const d = new Date(e.created_at);
          return d >= weekStart && d <= weekEnd;
        })
        .reduce((s, e) => s + parseFloat(e.profit || 0), 0);
      return { label, profit: Math.round(profit * 100) / 100 };
    });
  }

  if (range === '1y') {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const profit = entries
        .filter((e) => {
          const ed = new Date(e.created_at);
          return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
        })
        .reduce((s, e) => s + parseFloat(e.profit || 0), 0);
      return { label, profit: Math.round(profit * 100) / 100 };
    });
  }

  return [];
}

const EMPTY_FORM = {
  buyer_name: '',
  order_id: '',
  amazon_price: '',
  ebay_payout: '',
  ad_rate: '',
  count: '1',
  item_image_url: '',
};

const RANGE_OPTIONS = ['7d', '30d', '90d', '1y'];

// ─── Formatting ───────────────────────────────────────────────────────────────
const money = (v) => `$${Math.abs(Number(v) || 0).toFixed(2)}`;
const signedMoney = (v) => {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  if (n === 0) return '$0.00';
  return `${n > 0 ? '+' : '−'}${money(n)}`;
};
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const marginOf = (profit, payout) => {
  const p = Number(payout) || 0;
  return p > 0 ? (Number(profit) / p) * 100 : null;
};

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, hint, tone = 'neutral', loading, isDark }) {
  const tones = {
    positive: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
    negative: isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-50 text-rose-600',
    neutral: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600',
    accent: isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600',
  };
  const valueTone =
    tone === 'positive'
      ? isDark ? 'text-emerald-400' : 'text-emerald-600'
      : tone === 'negative'
      ? isDark ? 'text-rose-400' : 'text-rose-600'
      : isDark ? 'text-slate-100' : 'text-slate-900';
  return (
    <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tones[tone] || tones.neutral}`}>
          <Icon size={16} />
        </span>
        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      </div>
      <div className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${valueTone}`}>
        {loading ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : value}
      </div>
      {hint && <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{hint}</p>}
    </div>
  );
}

// ─── Profit pill ──────────────────────────────────────────────────────────────
function ProfitPill({ profit, payout, isDark, t }) {
  const n = Number(profit) || 0;
  const cls =
    n > 0
      ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
      : n < 0
      ? isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700'
      : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600';
  const margin = marginOf(n, payout);
  return (
    <div className="flex flex-col items-end">
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums ${cls}`}>{signedMoney(n)}</span>
      {margin !== null && (
        <span className={`mt-0.5 text-[11px] tabular-nums ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {margin.toFixed(1)}% {t('profitTablePage.margin')}
        </span>
      )}
    </div>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────
function Thumb({ src, isDark, size = 'h-11 w-11' }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
      {src && !broken ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className={`flex h-full w-full items-center justify-center ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
          <ImageIcon size={16} />
        </div>
      )}
    </div>
  );
}

export default function ProfitTablePage() {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // ── State ──────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [listingImages, setListingImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [adFeesByOrderId, setAdFeesByOrderId] = useState({});
  const [loadingFees, setLoadingFees] = useState(true);
  const [infoEntry, setInfoEntry] = useState(null);
  const [search, setSearch] = useState('');
  const [profitFilter, setProfitFilter] = useState('all'); // all | profitable | loss
  const [sortBy, setSortBy] = useState('newest'); // newest | profitHigh | profitLow
  const [copiedId, setCopiedId] = useState(null);

  // ── Load real ad-fee-to-order matches from SQL-cached eBay finance transactions ──
  // This call also refreshes every connected eBay account's orders on the backend
  // (not just the active store), so it can take a few seconds for an account with
  // several stores — the Fee/Profit columns show a spinner below until it resolves.
  useEffect(() => {
    setLoadingFees(true);
    ebayAPI.getOrderAdFees()
      .then((res) => setAdFeesByOrderId(res?.data?.fees || {}))
      .catch(() => setAdFeesByOrderId({}))
      .finally(() => setLoadingFees(false));
  }, []);

  // ── Derived profit (live preview in the add form) ──────────────────────────
  const previewRelatedFee = adFeesByOrderId[String(form.order_id || '').trim()]?.amount ?? 0;
  const previewProfit = useMemo(
    () => calcProfit(form.ebay_payout, form.amazon_price, previewRelatedFee),
    [form.ebay_payout, form.amazon_price, previewRelatedFee]
  );

  // ── Load entries ───────────────────────────────────────────────────────────
  const loadEntries = useCallback(async (r) => {
    setLoading(true);
    try {
      const res = await profitAPI.list(r);
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(range); }, [range, loadEntries]);

  // ── Load active listing images for image select ───────────────────────────
  useEffect(() => {
    setLoadingImages(true);
    ebayAPI.getListings(0, 200)
      .then((res) => {
        const items = Array.isArray(res?.data?.items) ? res.data.items : [];
        const images = [];
        const seen = new Set();
        items.forEach((offer) => {
          const imgUrl = extractListingThumb(offer);
          if (!imgUrl || seen.has(imgUrl)) return;
          seen.add(imgUrl);
          const title = extractListingTitle(offer);
          const listingId = extractListingId(offer);
          const label = title
            ? `${title}${listingId ? ` (${listingId})` : ''}`
            : listingId || imgUrl;
          images.push({ value: imgUrl, label });
        });
        setListingImages(images);
      })
      .catch(() => {})
      .finally(() => setLoadingImages(false));
  }, []);

  // Esc closes the add-entry dialog.
  useEffect(() => {
    if (!showForm) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeForm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  // ── Entries with real related fee + recomputed profit ─────────────────────
  const entriesWithFee = useMemo(
    () =>
      entries.map((e) => {
        const relatedFee = adFeesByOrderId[String(e.order_id || '').trim()]?.amount ?? 0;
        const computedProfit = calcProfit(e.ebay_payout, e.amazon_price, relatedFee);
        return { ...e, _relatedFee: relatedFee, _computedProfit: computedProfit };
      }),
    [entries, adFeesByOrderId]
  );

  // ── Chart data + period totals (always the whole period, not the filtered table) ──
  const chartData = useMemo(
    () => prepareChartData(entriesWithFee.map((e) => ({ ...e, profit: e._computedProfit })), range),
    [entriesWithFee, range]
  );

  const totals = useMemo(() => {
    const sum = (fn) => entriesWithFee.reduce((s, e) => s + (fn(e) || 0), 0);
    const profit = sum((e) => parseFloat(e._computedProfit));
    const payout = sum((e) => parseFloat(e.ebay_payout));
    const amazon = sum((e) => parseFloat(e.amazon_price));
    const fees = sum((e) => parseFloat(e._relatedFee));
    const orders = entriesWithFee.length;
    const losses = entriesWithFee.filter((e) => e._computedProfit < 0).length;
    return {
      profit,
      payout,
      amazon,
      fees,
      orders,
      losses,
      margin: marginOf(profit, payout),
      avg: orders ? profit / orders : 0,
    };
  }, [entriesWithFee]);

  // ── Table view: search + filter + sort ─────────────────────────────────────
  const visibleEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = entriesWithFee.filter((e) => {
      if (profitFilter === 'profitable' && !(e._computedProfit > 0)) return false;
      if (profitFilter === 'loss' && !(e._computedProfit < 0)) return false;
      if (!term) return true;
      return [e.buyer_name, e.order_id].some((v) => String(v || '').toLowerCase().includes(term));
    });
    list = [...list].sort((a, b) => {
      if (sortBy === 'profitHigh') return b._computedProfit - a._computedProfit;
      if (sortBy === 'profitLow') return a._computedProfit - b._computedProfit;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    return list;
  }, [entriesWithFee, search, profitFilter, sortBy]);

  const visibleTotals = useMemo(
    () =>
      visibleEntries.reduce(
        (acc, e) => ({
          amazon: acc.amazon + (parseFloat(e.amazon_price) || 0),
          payout: acc.payout + (parseFloat(e.ebay_payout) || 0),
          fees: acc.fees + (parseFloat(e._relatedFee) || 0),
          count: acc.count + (parseInt(e.count, 10) || 1),
          profit: acc.profit + (parseFloat(e._computedProfit) || 0),
        }),
        { amazon: 0, payout: 0, fees: 0, count: 0, profit: 0 }
      ),
    [visibleEntries]
  );

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleFormChange = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      await profitAPI.create({
        buyer_name: form.buyer_name,
        order_id: form.order_id || '',
        amazon_price: parseFloat(form.amazon_price) || 0,
        ebay_payout: parseFloat(form.ebay_payout) || 0,
        ad_rate: parseFloat(form.ad_rate) || 0,
        count: Math.max(1, parseInt(form.count) || 1),
        item_image_url: form.item_image_url,
        profit: previewProfit,
      });
      closeForm();
      await loadEntries(range);
    } catch (err) {
      setFormError(err?.response?.data?.error || err?.message || 'Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: t('profitTablePage.deleteTitle'),
      text: t('profitTablePage.deleteText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: isDark ? '#475569' : '#94a3b8',
      confirmButtonText: t('profitTablePage.deleteConfirm'),
      cancelButtonText: t('profitTablePage.deleteCancel'),
      background: isDark ? '#1e293b' : '#fff',
      color: isDark ? '#e2e8f0' : '#0f172a',
    });
    if (!result.isConfirmed) return;
    try {
      await profitAPI.remove(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // ignore
    }
  };

  const copyOrderId = async (entry) => {
    try {
      await navigator.clipboard.writeText(entry.order_id);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId((cur) => (cur === entry.id ? null : cur)), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
    isDark
      ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500/30'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-100'
  }`;
  const labelCls = `mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';

  const rangeLabelMap = {
    '7d': t('profitTablePage.range7d'),
    '30d': t('profitTablePage.range30d'),
    '90d': t('profitTablePage.range90d'),
    '1y': t('profitTablePage.range1y'),
  };

  const segBtn = (active) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
      active
        ? isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
        : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
    }`;

  const profitTone = (n) => (n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');
  const chartColor = totals.profit < 0 ? '#f43f5e' : '#10b981';
  const filtersActive = Boolean(search.trim()) || profitFilter !== 'all';

  const renderFee = (entry) =>
    loadingFees ? <Loader2 size={14} className="inline animate-spin text-indigo-500" /> : entry._relatedFee > 0 ? `−${money(entry._relatedFee)}` : '—';

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[1520px] space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <TrendingUp size={22} />
            </span>
            <div>
              <h1 className={`text-2xl font-semibold tracking-tight ${strong}`}>{t('profitTablePage.title')}</h1>
              <p className={`text-sm ${muted}`}>{t('profitTablePage.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TutorialVideoButton />
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} />
              {t('profitTablePage.addEntry')}
            </button>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Wallet}
            label={t('profitTablePage.kpiNetProfit')}
            value={signedMoney(totals.profit)}
            hint={totals.margin !== null ? `${totals.margin.toFixed(1)}% ${t('profitTablePage.margin')}` : null}
            tone={profitTone(totals.profit)}
            loading={loading || loadingFees}
            isDark={isDark}
          />
          <KpiCard
            icon={DollarSign}
            label={t('profitTablePage.kpiRevenue')}
            value={money(totals.payout)}
            hint={`${t('profitTablePage.kpiAmazonCost')}: ${money(totals.amazon)}`}
            tone="accent"
            loading={loading}
            isDark={isDark}
          />
          <KpiCard
            icon={Megaphone}
            label={t('profitTablePage.kpiAdFees')}
            value={totals.fees > 0 ? `−${money(totals.fees)}` : '$0.00'}
            loading={loading || loadingFees}
            isDark={isDark}
          />
          <KpiCard
            icon={ShoppingBag}
            label={t('profitTablePage.kpiOrders')}
            value={totals.orders}
            hint={`${t('profitTablePage.kpiAvgPerOrder')}: ${signedMoney(totals.avg)}${
              totals.losses ? ` · ${totals.losses} ${t('profitTablePage.kpiLossOrders').toLowerCase()}` : ''
            }`}
            loading={loading || loadingFees}
            isDark={isDark}
          />
        </div>

        {/* ── Chart ── */}
        <div className={`${card} p-4 md:p-5`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className={`text-sm font-semibold ${strong}`}>{t('profitTablePage.chartTitle')}</h2>
              <p className={`text-xs ${muted}`}>
                {t('profitTablePage.totalProfit')}:{' '}
                <span className={`font-semibold ${totals.profit < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {loadingFees ? '…' : signedMoney(totals.profit)}
                </span>
              </p>
            </div>
            <div className={`inline-flex rounded-lg p-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`} role="tablist">
              {RANGE_OPTIONS.map((r) => (
                <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={segBtn(range === r)}>
                  {rangeLabelMap[r]}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: isDark ? '#64748b' : '#94a3b8' }}
                interval={range === '30d' ? 4 : 0}
                dy={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 11, fill: isDark ? '#64748b' : '#94a3b8' }}
                tickFormatter={(v) => `$${v}`}
              />
              <ReferenceLine y={0} stroke={isDark ? '#334155' : '#cbd5e1'} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: isDark ? '#475569' : '#cbd5e1', strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="profit"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#profitFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: chartColor }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Entries ── */}
        <div className={`${card} overflow-hidden`}>
          {/* Toolbar */}
          <div className={`flex flex-wrap items-center gap-3 border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="relative min-w-[200px] flex-1">
              <Search size={15} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('profitTablePage.searchPlaceholder')}
                className={`${inputCls} pl-9`}
              />
            </div>
            <div className={`inline-flex rounded-lg p-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
              {[
                ['all', t('profitTablePage.filterAll')],
                ['profitable', t('profitTablePage.filterProfitable')],
                ['loss', t('profitTablePage.filterLoss')],
              ].map(([key, text]) => (
                <button key={key} type="button" onClick={() => setProfitFilter(key)} className={segBtn(profitFilter === key)}>
                  {text}
                </button>
              ))}
            </div>
            <div className="relative">
              <ArrowUpDown size={14} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={`${inputCls} w-auto pl-8 pr-8`}>
                <option value="newest">{t('profitTablePage.sortNewest')}</option>
                <option value="profitHigh">{t('profitTablePage.sortProfitHigh')}</option>
                <option value="profitLow">{t('profitTablePage.sortProfitLow')}</option>
              </select>
            </div>
            <span className={`ml-auto text-xs ${muted}`}>{t('profitTablePage.entriesCount', { count: visibleEntries.length })}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-indigo-500" size={26} />
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-16 text-center">
              <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
                {filtersActive ? <Search size={20} /> : <TrendingUp size={20} />}
              </span>
              <p className={`text-sm font-semibold ${strong}`}>
                {filtersActive ? t('profitTablePage.emptySearch') : t('profitTablePage.emptyTitle')}
              </p>
              {!filtersActive && <p className={`mt-1 text-sm ${muted}`}>{t('profitTablePage.empty')}</p>}
              {!filtersActive && (
                <button type="button" onClick={() => setShowForm(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Plus size={15} /> {t('profitTablePage.emptyCta')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                      <th className="px-4 py-3 text-left">{t('profitTablePage.colProduct')}</th>
                      <th className="px-4 py-3 text-left">{t('profitTablePage.colOrderId')}</th>
                      <th className="px-4 py-3 text-right">{t('profitTablePage.colAmazonPrice')}</th>
                      <th className="px-4 py-3 text-right">{t('profitTablePage.colEbayPayout')}</th>
                      <th className="px-4 py-3 text-right">{t('profitTablePage.colFee')}</th>
                      <th className="px-4 py-3 text-center">{t('profitTablePage.colCount')}</th>
                      <th className="px-4 py-3 text-left">{t('profitTablePage.colCreatedAt')}</th>
                      <th className="px-4 py-3 text-right">{t('profitTablePage.colProfit')}</th>
                      <th className="w-12 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                    {visibleEntries.map((entry) => (
                      <tr key={entry.id} className={`group transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/70'}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Thumb src={entry.item_image_url} isDark={isDark} />
                            <span className={`font-medium ${strong}`}>{entry.buyer_name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {entry.order_id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInfoEntry(entry)}
                                title={t('profitTablePage.viewDetails')}
                                className={`font-mono text-xs underline-offset-2 hover:underline ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}
                              >
                                {entry.order_id}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyOrderId(entry)}
                                title={copiedId === entry.id ? t('profitTablePage.copied') : t('profitTablePage.copy')}
                                className={`rounded p-1 opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'}`}
                              >
                                {copiedId === entry.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          ) : (
                            <span className={muted}>—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums ${body}`}>{money(entry.amazon_price)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${body}`}>{money(entry.ebay_payout)}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${body}`}>
                          <div>{renderFee(entry)}</div>
                          <div className={`text-[11px] ${muted}`}>{parseFloat(entry.ad_rate ?? 0).toFixed(1)}%</div>
                        </td>
                        <td className={`px-4 py-3 text-center tabular-nums ${body}`}>×{parseInt(entry.count ?? 1, 10)}</td>
                        <td className={`whitespace-nowrap px-4 py-3 ${muted}`}>{formatDate(entry.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {loadingFees ? (
                            <Loader2 size={14} className="ml-auto animate-spin text-indigo-500" />
                          ) : (
                            <ProfitPill profit={entry._computedProfit} payout={entry.ebay_payout} isDark={isDark} t={t} />
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            title={t('profitTablePage.delete')}
                            aria-label={t('profitTablePage.delete')}
                            className={`rounded-lg p-1.5 opacity-60 transition group-hover:opacity-100 ${isDark ? 'text-rose-400 hover:bg-rose-500/10' : 'text-rose-500 hover:bg-rose-50'}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`border-t text-sm font-semibold ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50/80 text-slate-800'}`}>
                      <td className="px-4 py-3" colSpan={2}>{t('profitTablePage.totalsRow')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(visibleTotals.amazon)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(visibleTotals.payout)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{visibleTotals.fees > 0 ? `−${money(visibleTotals.fees)}` : '—'}</td>
                      <td className="px-4 py-3 text-center tabular-nums">×{visibleTotals.count}</td>
                      <td className="px-4 py-3" />
                      <td className={`px-4 py-3 text-right tabular-nums ${visibleTotals.profit < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {loadingFees ? '…' : signedMoney(visibleTotals.profit)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className={`divide-y md:hidden ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                {visibleEntries.map((entry) => (
                  <li key={entry.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <Thumb src={entry.item_image_url} isDark={isDark} size="h-12 w-12" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate font-medium ${strong}`}>{entry.buyer_name || '—'}</p>
                            {entry.order_id && (
                              <button type="button" onClick={() => setInfoEntry(entry)} className={`font-mono text-xs ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                {entry.order_id}
                              </button>
                            )}
                          </div>
                          {loadingFees ? (
                            <Loader2 size={14} className="animate-spin text-indigo-500" />
                          ) : (
                            <ProfitPill profit={entry._computedProfit} payout={entry.ebay_payout} isDark={isDark} t={t} />
                          )}
                        </div>
                        <dl className={`mt-2 grid grid-cols-3 gap-2 text-xs ${muted}`}>
                          <div><dt>{t('profitTablePage.colAmazonPrice')}</dt><dd className={`tabular-nums ${body}`}>{money(entry.amazon_price)}</dd></div>
                          <div><dt>{t('profitTablePage.colEbayPayout')}</dt><dd className={`tabular-nums ${body}`}>{money(entry.ebay_payout)}</dd></div>
                          <div><dt>{t('profitTablePage.colFee')}</dt><dd className={`tabular-nums ${body}`}>{renderFee(entry)}</dd></div>
                        </dl>
                        <div className={`mt-2 flex items-center justify-between text-xs ${muted}`}>
                          <span>{formatDate(entry.created_at)} · ×{parseInt(entry.count ?? 1, 10)}</span>
                          <button type="button" onClick={() => handleDelete(entry.id)} aria-label={t('profitTablePage.delete')} className="rounded-lg p-1.5 text-rose-500">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── Add entry dialog ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={closeForm}>
          <form
            onSubmit={handleSubmit}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profit-form-title"
            className={`flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}
          >
            <div className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <h2 id="profit-form-title" className={`text-base font-semibold ${strong}`}>{t('profitTablePage.formTitle')}</h2>
              <button type="button" onClick={closeForm} aria-label={t('profitTablePage.cancel')} className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                <X size={18} />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-5">
              <div className="space-y-4 md:col-span-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>{t('profitTablePage.buyerName')}</label>
                    <input className={inputCls} value={form.buyer_name} onChange={handleFormChange('buyer_name')} placeholder={t('profitTablePage.buyerNamePlaceholder')} autoFocus />
                  </div>
                  <div>
                    <label className={labelCls}>{t('profitTablePage.orderId')}</label>
                    <input className={inputCls} value={form.order_id} onChange={handleFormChange('order_id')} placeholder={t('profitTablePage.orderIdPlaceholder')} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('profitTablePage.amazonPrice')} ($)</label>
                    <input type="number" step="0.01" min="0" className={inputCls} value={form.amazon_price} onChange={handleFormChange('amazon_price')} placeholder="0.00" required />
                  </div>
                  <div>
                    <label className={labelCls}>{t('profitTablePage.ebayPayout')} ($)</label>
                    <input type="number" step="0.01" min="0" className={inputCls} value={form.ebay_payout} onChange={handleFormChange('ebay_payout')} placeholder="0.00" required />
                  </div>
                  <div>
                    <label className={labelCls}>{t('profitTablePage.adRate')} (%)</label>
                    <input type="number" step="0.01" min="0" max="100" className={inputCls} value={form.ad_rate} onChange={handleFormChange('ad_rate')} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelCls}>{t('profitTablePage.count')}</label>
                    <input type="number" step="1" min="1" className={inputCls} value={form.count} onChange={handleFormChange('count')} placeholder="1" required />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('profitTablePage.itemImage')}</label>
                  <ImageSelect
                    value={form.item_image_url}
                    onChange={(v) => setForm((p) => ({ ...p, item_image_url: v }))}
                    options={listingImages}
                    isDark={isDark}
                    placeholder={t('profitTablePage.selectImage')}
                    loadingImages={loadingImages}
                  />
                </div>
              </div>

              {/* Live breakdown */}
              <div className="md:col-span-2">
                <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${muted}`}>{t('profitTablePage.breakdownTitle')}</p>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className={muted}>{t('profitTablePage.ebayPayout')}</dt>
                      <dd className={`tabular-nums ${body}`}>{money(form.ebay_payout)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={muted}>{t('profitTablePage.colFee')}</dt>
                      <dd className={`tabular-nums ${body}`}>{previewRelatedFee > 0 ? `−${money(previewRelatedFee)}` : '$0.00'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className={muted}>{t('profitTablePage.amazonPrice')}</dt>
                      <dd className={`tabular-nums ${body}`}>−{money(form.amazon_price)}</dd>
                    </div>
                    <div className={`flex items-center justify-between border-t pt-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <dt className={`font-semibold ${strong}`}>{t('profitTablePage.breakdownNet')}</dt>
                      <dd className={`text-xl font-semibold tabular-nums ${previewProfit > 0 ? 'text-emerald-500' : previewProfit < 0 ? 'text-rose-500' : muted}`}>
                        {signedMoney(previewProfit)}
                      </dd>
                    </div>
                    {marginOf(previewProfit, form.ebay_payout) !== null && (
                      <p className={`text-right text-xs ${muted}`}>
                        {marginOf(previewProfit, form.ebay_payout).toFixed(1)}% {t('profitTablePage.margin')}
                      </p>
                    )}
                  </dl>
                  <p className={`mt-3 flex gap-1.5 text-[11px] leading-relaxed ${muted}`}>
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {t('profitTablePage.breakdownAdFeeHint')}
                  </p>
                </div>
              </div>
            </div>

            {formError && <p className="mx-5 mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{formError}</p>}

            <div className={`flex justify-end gap-2 border-t px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <button type="button" className="btn-secondary" onClick={closeForm}>
                {t('profitTablePage.cancel')}
              </button>
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={submitting}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {t('profitTablePage.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {infoEntry && (
        <OrderDetailModal
          orderId={infoEntry.order_id}
          relatedFee={infoEntry._relatedFee || 0}
          amazonPrice={parseFloat(infoEntry.amazon_price ?? 0)}
          count={parseInt(infoEntry.count ?? 1)}
          onClose={() => setInfoEntry(null)}
        />
      )}
    </div>
  );
}
