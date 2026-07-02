import React, { useState, useCallback, useEffect } from 'react';
import {
  RefreshCw, Zap, Globe, Search, Flame, Tag, Users, ShoppingBag, AlertCircle,
} from 'lucide-react';
import { zikAPI } from '../services/api';
import AmazonFinderSidebar from '../components/AmazonFinderSidebar';
import UpcomingEventsCalendar from '../components/UpcomingEventsCalendar';
import { countryCodeToFlagEmoji } from '../utils/helpers';

const AMAZON_ICON_URL = 'https://www.amazon.com/favicon.ico';

const fmtCurrency = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
};

const fmtNum = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

function SkeletonRow({ hasImage = false }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 animate-pulse">
      {hasImage && (
        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      )}
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-2/5" />
      </div>
      <div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg" />
    </div>
  );
}

function FireBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-500 dark:text-orange-400 border border-orange-200 dark:border-orange-800 flex-shrink-0">
      <Flame size={10} />
      Hot
    </span>
  );
}

function Panel({ title, subtitle, icon, topColor, count, loading, children, maxHeight = 340 }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className={`h-0.5 w-full ${topColor}`} />
      <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{title}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">{subtitle}</p>
          </div>
        </div>
        {!loading && count != null && (
          <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto" style={{ maxHeight }}>
        {children}
      </div>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <AlertCircle size={28} className="mb-2 opacity-50" />
      <p className="text-sm">No data available</p>
    </div>
  );
}

export default function MarketInsightPage() {
  const [fastMode, setFastMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [eventsLoading, setEventsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [eventsError, setEventsError] = useState(null);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const jobRes = await zikAPI.requestMarketInsights();
      const jobId = jobRes.data?.jobId;
      if (!jobId) throw new Error('Failed to create market insights job');

      const TIMEOUT_MS = 45_000;
      const POLL_MS = 2_000;
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pollRes = await zikAPI.pollJob(jobId);
        const { status, data: jobData, error: jobError } = pollRes.data;
        if (status === 'done') { setData(jobData); return; }
        if (status === 'error') throw new Error(jobError || 'Market insights job failed');
      }

      throw new Error('Timed out — make sure the Checkila extension is running and connected.');
    } catch (err) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load market insights'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const jobRes = await zikAPI.requestUpcomingEvents('US');
      const jobId = jobRes.data?.jobId;
      if (!jobId) throw new Error('Failed to create upcoming events job');

      const TIMEOUT_MS = 45_000;
      const POLL_MS = 2_000;
      const deadline = Date.now() + TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const pollRes = await zikAPI.pollJob(jobId);
        const { status, data: jobData, error: jobError } = pollRes.data;
        if (status === 'done') { setEvents(Array.isArray(jobData) ? jobData : (jobData?.events || [])); return; }
        if (status === 'error') throw new Error(jobError || 'Upcoming events job failed');
      }

      throw new Error('Timed out — make sure the Checkila extension is running and connected.');
    } catch (err) {
      setEventsError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load upcoming events'
      );
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Hands the search off to the Market Analysis page (same openSearch=1 query
  // contract it already reads on mount — see MarketAnalysisPage.jsx) instead of
  // linking straight out to ZIK/eBay, so results stay inside our own app.
  const openSearch = (type, value) => {
    let query;
    if (type === 'keyword' || type === 'product') {
      const q = type === 'keyword' ? String(value || '').trim() : String(value?.title || '').trim();
      if (!q) return;
      query = new URLSearchParams({
        openSearch: '1',
        q,
        condition: 'ALL',
        limit: '20',
        offset: '0',
        type: fastMode ? 'fast' : 'slow',
      });
    } else if (type === 'seller') {
      const seller = String(value || '').trim();
      if (!seller) return;
      query = new URLSearchParams({ openSearch: '1', sellerUsername: seller, offset: '0' });
    }
    if (query) window.open(`/market-analysis?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const niches = data?.niches || [];
  const products = data?.products || [];
  const sellers = data?.sellers || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-4 md:p-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Market Insight</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Live eBay trending data — keywords, products &amp; sellers
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mode toggle */}
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
            <button
              onClick={() => setFastMode(true)}
              className={`flex items-center gap-1.5 px-3 py-2 transition ${
                fastMode
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Fast mode — opens ZIK Analytics"
            >
              <Zap size={12} />
              Fast
            </button>
            <button
              onClick={() => setFastMode(false)}
              className={`flex items-center gap-1.5 px-3 py-2 transition ${
                !fastMode
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Slow mode — opens eBay"
            >
              <Globe size={12} />
              Slow
            </button>
          </div>

          <button
            onClick={() => { loadData(); loadEvents(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ─── Left column: Niches + Dropshippers ─── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <Panel
            title="Trending eBay Niches"
            subtitle="Top eBay niche keywords this week"
            icon={<Tag size={15} />}
            topColor="bg-gradient-to-r from-blue-500 to-indigo-500"
            count={niches.length || undefined}
            loading={loading}
            maxHeight={300}
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : niches.length === 0 ? (
              <EmptyPanel />
            ) : (
              niches.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-2 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <span className="text-xs text-slate-400 w-5 text-right flex-shrink-0 font-mono">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">
                      {item.keywords}
                    </p>
                    <p className="text-xs text-emerald-500 font-semibold mt-0.5">
                      {fmtCurrency(item.salesEarning)} revenue
                    </p>
                  </div>
                  {item.isFire && <FireBadge />}
                  <button
                    onClick={() => openSearch('keyword', item.keywords)}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition opacity-0 group-hover:opacity-100"
                  >
                    <Search size={11} />
                    Search
                  </button>
                </div>
              ))
            )}
          </Panel>

          <Panel
            title="Trending Dropshippers"
            subtitle="Active eBay dropshippers this week"
            icon={<Users size={15} />}
            topColor="bg-gradient-to-r from-cyan-500 to-teal-500"
            count={sellers.length || undefined}
            loading={loading}
            maxHeight={300}
          >
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : sellers.length === 0 ? (
              <EmptyPanel />
            ) : (
              sellers.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      {(item.sellerName?.[0] || '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate leading-tight">
                        {item.sellerName}
                      </p>
                      {item.sellerLocation && (
                        <span className="text-xs flex-shrink-0" title={item.sellerLocation}>
                          {countryCodeToFlagEmoji(item.sellerLocation) || item.sellerLocation}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">
                        ⭐ {fmtNum(item.feedback)} fb
                      </span>
                      <span className="text-xs text-emerald-500 font-semibold">
                        {fmtNum(item.sales)} sales
                      </span>
                    </div>
                  </div>
                  {item.isFire && <FireBadge />}
                  <button
                    onClick={() => openSearch('seller', item.sellerName)}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition opacity-0 group-hover:opacity-100"
                  >
                    <Search size={11} />
                    Search
                  </button>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* ─── Middle column: Trending Products ─── */}
        <div className="lg:col-span-6">
          <Panel
            title="Trending eBay Products"
            subtitle="Hot eBay dropshipping products, last 7 days"
            icon={<ShoppingBag size={15} />}
            topColor="bg-gradient-to-r from-violet-500 to-purple-500"
            count={products.length || undefined}
            loading={loading}
            maxHeight={720}
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} hasImage />)
            ) : products.length === 0 ? (
              <EmptyPanel />
            ) : (
              products.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-3 px-3 py-3 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-100 dark:border-slate-700">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag size={14} className="text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate leading-snug">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {item.sales != null && (
                        <span className="text-xs text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">{fmtNum(item.sales)}</span> sales
                        </span>
                      )}
                      {item.totalSold != null && (
                        <span className="text-xs text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">{fmtNum(item.totalSold)}</span> sold
                        </span>
                      )}
                      {item.price != null && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          ${Number(item.price).toFixed(2)}
                        </span>
                      )}
                      {item.profit != null && (
                        <span
                          className={`text-xs font-semibold ${
                            item.profit >= 0 ? 'text-emerald-500' : 'text-red-400'
                          }`}
                        >
                          {item.profit >= 0 ? '+' : ''}${Number(item.profit).toFixed(2)} profit
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {item.isFire && <FireBadge />}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      {item.asin && item.itemId && (
                        <button
                          onClick={() => setSelectedProduct(item)}
                          className="flex items-center justify-center p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition"
                          title="Find this product on Amazon"
                        >
                          <img src={AMAZON_ICON_URL} alt="Amazon" className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => openSearch('product', { title: item.title, itemId: item.itemId })}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition"
                      >
                        <Search size={11} />
                        Search
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* ─── Right column: Upcoming Events ─── */}
        <div className="lg:col-span-3">
          <UpcomingEventsCalendar
            events={events}
            loading={eventsLoading}
            error={eventsError}
            onRetry={loadEvents}
            onKeywordSearch={(kw) => openSearch('keyword', kw)}
          />
        </div>
      </div>

      {selectedProduct && (
        <AmazonFinderSidebar
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
