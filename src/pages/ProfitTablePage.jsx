import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { profitAPI, ebayAPI } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Swal from 'sweetalert2';
import { TrendingUp, Plus, Trash2, X, ChevronDown, Loader2 } from 'lucide-react';

// ─── Profit formula (mirrors backend profitCalculator.js) ─────────────────────
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
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="font-semibold mb-0.5">{label}</p>
      <p className="text-emerald-400">
        ${Number(payload[0]?.value ?? 0).toFixed(2)}
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
  const [listingImages, setListingImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(true);

  // ── Derived profit ─────────────────────────────────────────────────────────
  const previewProfit = useMemo(
    () => calcProfit(form.ebay_payout, form.amazon_price, form.ad_rate, form.count),
    [form.ebay_payout, form.amazon_price, form.ad_rate, form.count]
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

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = useMemo(() => prepareChartData(entries, range), [entries, range]);
  const totalProfit = useMemo(
    () => entries.reduce((s, e) => s + parseFloat(e.profit || 0), 0),
    [entries]
  );

  // ── Form handlers ──────────────────────────────────────────────────────────
  const handleFormChange = (field) => (e) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
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
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadEntries(range);
    } catch {
      // ignore
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

  // ─────────────────────────────────────────────────────────────────────────
  const inputCls = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 focus:ring-indigo-500'
      : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-400'
  }`;

  const rangeLabelMap = {
    '7d': t('profitTablePage.range7d'),
    '30d': t('profitTablePage.range30d'),
    '90d': t('profitTablePage.range90d'),
    '1y': t('profitTablePage.range1y'),
  };

  const profitColor = (v) => {
    const n = parseFloat(v);
    if (isNaN(n) || n === 0) return isDark ? 'text-slate-400' : 'text-slate-500';
    return n > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600');
  };

  return (
    <div className="page-shell">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-2">
          <TrendingUp size={18} />
          {t('profitTablePage.title')}
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="btn-primary inline-flex items-center gap-2"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t('profitTablePage.cancelAdd') : t('profitTablePage.addEntry')}
        </button>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <div
          className={`mb-6 rounded-xl border p-5 ${
            isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <h2 className={`text-base font-semibold mb-4 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
            {t('profitTablePage.formTitle')}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Buyer name */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.buyerName')}
                </label>
                <input
                  className={inputCls}
                  value={form.buyer_name}
                  onChange={handleFormChange('buyer_name')}
                  placeholder={t('profitTablePage.buyerNamePlaceholder')}
                />
              </div>

              {/* Order ID */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.orderId')}
                </label>
                <input
                  className={inputCls}
                  value={form.order_id}
                  onChange={handleFormChange('order_id')}
                  placeholder={t('profitTablePage.orderIdPlaceholder')}
                />
              </div>

              {/* Amazon price */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.amazonPrice')} ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.amazon_price}
                  onChange={handleFormChange('amazon_price')}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Count */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.count')}
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className={inputCls}
                  value={form.count}
                  onChange={handleFormChange('count')}
                  placeholder="1"
                  required
                />
              </div>

              {/* eBay payout */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.ebayPayout')} ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputCls}
                  value={form.ebay_payout}
                  onChange={handleFormChange('ebay_payout')}
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Ad rate */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.adRate')} (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className={inputCls}
                  value={form.ad_rate}
                  onChange={handleFormChange('ad_rate')}
                  placeholder="0"
                />
              </div>

              {/* Item image */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.itemImage')}
                </label>
                <ImageSelect
                  value={form.item_image_url}
                  onChange={(v) => setForm((p) => ({ ...p, item_image_url: v }))}
                  options={listingImages}
                  isDark={isDark}
                  placeholder={t('profitTablePage.selectImage')}
                  loadingImages={loadingImages}
                />
              </div>

              {/* Preview profit */}
              <div className="flex flex-col justify-end">
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('profitTablePage.profit')}
                </label>
                <div
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    isDark ? 'bg-slate-800/60 border-slate-600' : 'bg-slate-50 border-slate-200'
                  } ${profitColor(previewProfit)}`}
                >
                  {previewProfit > 0 ? '+' : ''}{previewProfit.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
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

      {/* ── Range filter + Total ── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              range === r
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : isDark
                ? 'border-slate-600 text-slate-300 hover:border-slate-400'
                : 'border-slate-300 text-slate-600 hover:border-slate-400'
            }`}
          >
            {rangeLabelMap[r]}
          </button>
        ))}
        <div className={`ml-auto text-sm font-semibold ${profitColor(totalProfit)}`}>
          {t('profitTablePage.totalProfit')}: {totalProfit > 0 ? '+' : ''}{totalProfit.toFixed(2)} $
        </div>
      </div>

      {/* ── Line chart ── */}
      <div
        className={`rounded-xl border mb-6 p-4 ${
          isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        <h2 className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {t('profitTablePage.chartTitle')}
        </h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              interval={range === '30d' ? 4 : 0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="profit"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Table ── */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="overflow-x-auto">
          <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
            <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
              <tr>
                {[
                  t('profitTablePage.colImage'),
                  t('profitTablePage.colBuyer'),
                  t('profitTablePage.colOrderId'),
                  t('profitTablePage.colAmazonPrice'),
                  t('profitTablePage.colEbayPayout'),
                  t('profitTablePage.colAdRate'),
                  t('profitTablePage.colCount'),
                  t('profitTablePage.colCreatedAt'),
                  t('profitTablePage.colProfit'),
                  '',
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDark ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                  >
                    {t('profitTablePage.empty')}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const profit = parseFloat(entry.profit ?? 0);
                  const profitBadge =
                    profit > 0
                      ? isDark
                        ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : profit < 0
                      ? isDark
                        ? 'bg-rose-900/40 text-rose-300 border-rose-700'
                        : 'bg-rose-50 text-rose-700 border-rose-300'
                      : isDark
                      ? 'bg-slate-700/40 text-slate-300 border-slate-600'
                      : 'bg-slate-100 text-slate-600 border-slate-300';

                  return (
                    <tr key={entry.id} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                      {/* Image */}
                      <td className="px-4 py-3">
                        <div
                          className={`h-12 w-12 rounded-lg border overflow-hidden flex-shrink-0 ${
                            isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          {entry.item_image_url ? (
                            <img
                              src={entry.item_image_url}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div
                              className={`flex h-full w-full items-center justify-center text-[10px] ${
                                isDark ? 'text-slate-500' : 'text-slate-400'
                              }`}
                            >
                              —
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Buyer */}
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {entry.buyer_name || '—'}
                      </td>

                      {/* Order ID */}
                      <td className={`px-4 py-3 text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {entry.order_id || '—'}
                      </td>

                      {/* Amazon price */}
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        ${parseFloat(entry.amazon_price ?? 0).toFixed(2)}
                      </td>

                      {/* eBay payout */}
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        ${parseFloat(entry.ebay_payout ?? 0).toFixed(2)}
                      </td>

                      {/* Ad rate */}
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        {parseFloat(entry.ad_rate ?? 0).toFixed(2)}%
                      </td>

                      {/* Count */}
                      <td className={`px-4 py-3 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                        ×{parseInt(entry.count ?? 1)}
                      </td>

                      {/* Created at */}
                      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {entry.created_at
                          ? new Date(entry.created_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>

                      {/* Profit */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold border ${profitBadge}`}
                        >
                          {profit > 0 ? '+' : ''}
                          {profit.toFixed(2)}
                        </span>
                      </td>

                      {/* Delete */}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          title={t('profitTablePage.delete')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isDark
                              ? 'text-rose-400 hover:bg-rose-900/30'
                              : 'text-rose-500 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
