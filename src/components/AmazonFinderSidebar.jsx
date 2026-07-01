import React, { useCallback, useEffect, useState } from 'react';
import { X, ExternalLink, Star, ShoppingBag, AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { zikAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

const AMAZON_ICON_URL = 'https://www.amazon.com/favicon.ico';

function Thumb({ src, label, fallbackIcon }) {
  return (
    <div className="flex-1">
      <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
        {src ? (
          <img src={src} alt={label} className="w-full h-full object-contain" />
        ) : (
          fallbackIcon
        )}
      </div>
      <p className="text-center text-[11px] font-semibold text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function StatRow({ label, value, tone, help }) {
  const toneClasses = {
    neutral: 'text-slate-800 dark:text-slate-100',
    good: 'text-emerald-600 dark:text-emerald-400',
    bad: 'text-red-500 dark:text-red-400',
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${toneClasses[tone] || toneClasses.neutral}`}>
        {value}
        {help ? <span className="ml-1 text-xs font-normal text-slate-400">{help}</span> : null}
      </span>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse">
      <div className="flex gap-3">
        <div className="flex-1 aspect-square rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 aspect-square rounded-xl bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5 mt-4" />
      <div className="h-3 bg-slate-100 dark:bg-slate-800/70 rounded w-2/5 mt-2" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800/70 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function AmazonFinderSidebar({ product, onClose }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const asin = String(product?.asin || '').trim();
  const ebayId = String(product?.itemId || '').trim();

  const loadMatch = useCallback(async () => {
    if (!asin || !ebayId) {
      setError('This product is missing an Amazon ASIN or eBay item ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const jobRes = await zikAPI.requestAmazonFinder(asin, ebayId);
      const jobId = jobRes.data?.jobId;
      if (!jobId) throw new Error('Failed to create Amazon finder job');

      const TIMEOUT_MS = 45_000;
      const POLL_MS = 2_000;
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pollRes = await zikAPI.pollJob(jobId);
        const { status, data: jobData, error: jobError } = pollRes.data;
        if (status === 'done') { setResult(jobData); return; }
        if (status === 'error') throw new Error(jobError || 'Amazon finder job failed');
      }

      throw new Error('Timed out — make sure the Checkila extension is running and connected.');
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to find a matching Amazon product'
      );
    } finally {
      setLoading(false);
    }
  }, [asin, ebayId]);

  useEffect(() => { loadMatch(); }, [loadMatch]);

  const ebayProduct = result?.ebayProduct;
  const amazonProduct = result?.amazonProduct;
  const profit = amazonProduct?.profit;
  const profitIsGood = typeof profit === 'number' ? profit >= 0 : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className={`fixed right-0 top-0 h-full z-50 w-full sm:w-[420px] flex flex-col shadow-2xl ${
        isDark ? 'bg-slate-900 border-l border-slate-700' : 'bg-white border-l border-slate-200'
      }`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${
          isDark ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className={`p-2 rounded-lg flex-shrink-0 ${isDark ? 'bg-orange-900/30' : 'bg-orange-50'}`}>
            <img src={AMAZON_ICON_URL} alt="Amazon" className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-base truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Amazon Finder
            </h2>
            <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {product?.title || 'Matching eBay item to Amazon supplier'}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex items-center gap-1 px-5 pt-3 border-b flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 border-b-2 border-orange-500">
            <img src={AMAZON_ICON_URL} alt="" className="h-3 w-3" />
            Amazon
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <SkeletonBlock />}

          {!loading && error && (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
              <button
                onClick={loadMatch}
                className="self-start flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          )}

          {!loading && !error && result && (
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex gap-3">
                <Thumb
                  src={ebayProduct?.ebayImage}
                  label="eBay"
                  fallbackIcon={<ShoppingBag size={20} className="text-slate-400" />}
                />
                <Thumb
                  src={amazonProduct?.pictureUrl}
                  label="Amazon"
                  fallbackIcon={<img src={AMAZON_ICON_URL} alt="" className="h-6 w-6 opacity-50" />}
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-3 line-clamp-2 leading-snug">
                {amazonProduct?.title || ebayProduct?.ebayTitle || 'Untitled product'}
              </h3>

              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {amazonProduct?.rating != null && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                    <Star size={12} fill="currentColor" />
                    {Number(amazonProduct.rating).toFixed(1)}
                    <span className="text-slate-400 font-normal">
                      ({Number(amazonProduct.totalReviews || 0).toLocaleString()})
                    </span>
                  </span>
                )}
                {amazonProduct?.isPrime && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400">
                    Prime
                  </span>
                )}
              </div>

              <div className="mt-4">
                <StatRow
                  label="eBay Price"
                  value={ebayProduct?.currentPrice != null ? formatCurrency(ebayProduct.currentPrice) : '—'}
                />
                <StatRow
                  label="Amazon Price"
                  value={amazonProduct?.price != null ? formatCurrency(amazonProduct.price) : '—'}
                />
                <StatRow
                  label="Total Sold"
                  value={ebayProduct?.totalSold != null ? Number(ebayProduct.totalSold).toLocaleString() : '—'}
                />
              </div>

              <div className={`mt-2 rounded-lg px-3 py-2 flex items-center justify-between ${
                profitIsGood === false
                  ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900'
              }`}>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Profit Margin</span>
                <span className={`text-sm font-bold ${profitIsGood === false ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {profit != null ? formatCurrency(profit) : '—'}
                  {amazonProduct?.profitMarginPercentage != null && (
                    <span className="ml-1 text-xs font-semibold opacity-80">
                      ({Number(amazonProduct.profitMarginPercentage).toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>

              <StatRow
                label="ROI"
                value={amazonProduct?.roi != null ? `${Number(amazonProduct.roi).toFixed(1)}%` : '—'}
                tone={profitIsGood === false ? 'bad' : 'good'}
              />

              <div className="flex gap-2 mt-4">
                {ebayProduct?.url && (
                  <a
                    href={ebayProduct.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    <ExternalLink size={12} />
                    Open on eBay
                  </a>
                )}
                {amazonProduct?.url && (
                  <a
                    href={amazonProduct.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition"
                  >
                    <ExternalLink size={12} />
                    View on Amazon
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
