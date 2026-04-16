import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, LayoutGrid, List, RefreshCw, Search, SearchCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import MarketSearchBar from '../components/MarketSearchBar';
import MarketItemCard from '../components/MarketItemCard';
import MarketComparePanel from '../components/MarketComparePanel';
import useBrowseSearch from '../hooks/useBrowseSearch';
import { calculateProfit, formatCurrency } from '../utils/helpers';
import { browseAPI, settingsAPI } from '../services/api';

const RECENT_SEARCH_STORAGE_KEY = 'checkilaRecentSearches:v1';
const RECENT_SEARCH_LIMIT = 8;

function loadRecentSearches() {
  if (typeof window === 'undefined') return { sellers: [], titles: [] };
  const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY);
  if (!raw) return { sellers: [], titles: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      sellers: Array.isArray(parsed?.sellers) ? parsed.sellers.filter(Boolean) : [],
      titles: Array.isArray(parsed?.titles) ? parsed.titles.filter(Boolean) : [],
    };
  } catch {
    return { sellers: [], titles: [] };
  }
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

export default function MarketAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    params,
    setParams,
    results,
    total,
    refinement,
    loading,
    error,
    setError,
    searchNow,
    clearCache,
    refreshFromEbay,
    credits,
    soldQuantityDeferred,
  } = useBrowseSearch({
    fieldgroups: 'ASPECT_REFINEMENTS,MATCHING_ITEMS',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [sortConfig, setSortConfig] = useState({ key: 'soldQuantity', direction: 'desc' });
  const [marketCreditsState, setMarketCreditsState] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const [calcAmazonPrice, setCalcAmazonPrice] = useState('');
  const [calcEbayPrice, setCalcEbayPrice] = useState('');
  const [calcAdRate, setCalcAdRate] = useState('0');
  const [soldQuantityByKey, setSoldQuantityByKey] = useState({});
  const [soldLoadingByKey, setSoldLoadingByKey] = useState({});

  const saveRecentSearches = useCallback((nextValue) => {
    setRecentSearches(nextValue);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(nextValue));
    }
  }, []);

  const rememberRecentValue = useCallback(
    (key, value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      const current = Array.isArray(recentSearches[key]) ? recentSearches[key] : [];
      const nextList = [normalized, ...current.filter((entry) => entry !== normalized)].slice(0, RECENT_SEARCH_LIMIT);
      saveRecentSearches({ ...recentSearches, [key]: nextList });
    },
    [recentSearches, saveRecentSearches]
  );

  const rememberSearch = useCallback(
    (nextParams) => {
      const seller = String(nextParams?.sellerUsername || '').trim();
      const title = String(nextParams?.q || '').trim();
      if (seller) rememberRecentValue('sellers', seller);
      if (title) rememberRecentValue('titles', title);
    },
    [rememberRecentValue]
  );

  useEffect(() => {
    const loadLimits = async () => {
      try {
        const limitsRes = await settingsAPI.getLimits();
        const market = limitsRes?.data?.marketAnalysis || null;
        if (market) {
          setMarketCreditsState({
            limit: market.creditsLimit,
            used: market.creditsUsed,
            remaining: market.creditsRemaining,
          });
        }
      } catch {
        // Non-blocking: Checkila Analysis can still run without this initial UI hint.
      }
    };
    loadLimits();
  }, []);

  useEffect(() => {
    if (!credits) return;
    setMarketCreditsState({
      limit: credits.limit,
      used: credits.used,
      remaining: credits.remaining,
    });
  }, [credits]);

  const searchCost = String(params.sellerUsername || '').trim() ? 2 : 1;

  const inlineProfit = useMemo(() => {
    const amazonPrice = Number.parseFloat(calcAmazonPrice);
    const ebayPrice = Number.parseFloat(calcEbayPrice);
    const adRate = Number.parseFloat(calcAdRate);
    if (!Number.isFinite(amazonPrice) || !Number.isFinite(ebayPrice)) return null;
    return calculateProfit(ebayPrice, amazonPrice, {
      adRate: Number.isFinite(adRate) ? adRate / 100 : 0,
    });
  }, [calcAmazonPrice, calcEbayPrice, calcAdRate]);

  const runSearch = async (nextParams, { force = false } = {}) => {
    rememberSearch(nextParams);
    await searchNow(nextParams, { force });
  };

  const serializeSearchParams = (nextParams = {}) => {
    const query = new URLSearchParams({ openSearch: '1' });
    const assign = (key, value) => {
      if (value === undefined || value === null) return;
      if (typeof value === 'string' && value.trim() === '') return;
      query.set(key, String(value));
    };

    assign('q', nextParams.q);
    assign('categoryId', nextParams.categoryId);
    assign('condition', nextParams.condition);
    assign('minPrice', nextParams.minPrice);
    assign('maxPrice', nextParams.maxPrice);
    assign('sort', nextParams.sort);
    assign('buyingOptions', nextParams.buyingOptions);
    assign('sellerUsername', nextParams.sellerUsername);
    assign('limit', nextParams.limit);
    assign('offset', nextParams.offset);
    if (nextParams.freeShipping === true) query.set('freeShipping', 'true');
    return query;
  };

  const openSearchInNewTab = (nextParams) => {
    const query = serializeSearchParams(nextParams);
    window.open(`/market-analysis?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const openDetailsInNewTab = (item) => {
    const itemId = String(
      item?.legacyId ||
        item?.legacyItemId ||
        item?.raw?.legacyItemId ||
        item?.raw?.itemId ||
        item?.id ||
        ''
    )
      .trim()
      .replace(/^v1\|/, '')
      .replace(/\|0$/, '');
    if (!itemId) return;
    window.open(`https://www.ebay.com/bin/purchasehistory?item=${encodeURIComponent(itemId)}`, '_blank', 'noopener,noreferrer');
  };

  function getFlagUrl(countryCode) {
    const code = String(countryCode || '').trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return '';
    return `https://flagcdn.com/24x18/${code}.png`;
  }

  const renderSellerCountryFlag = (countryCode) => {
    const flagUrl = getFlagUrl(countryCode);
    if (!flagUrl) return null;

    const label = String(countryCode || '').trim().toUpperCase();
    return (
      <img
        src={flagUrl}
        alt={label ? `${label} flag` : 'Country flag'}
        title={label}
        aria-label={`Seller country ${label}`}
        className="ml-2 inline-block align-middle h-[18px] w-6 rounded-[2px] border border-slate-200 dark:border-slate-700"
        loading="lazy"
      />
    );
  };

  useEffect(() => {
    const presetSearch = location.state?.presetSearch;
    if (!presetSearch) return;
    const nextParams = {
      ...params,
      q: String(presetSearch.q || '').trim(),
      categoryId: String(presetSearch.categoryId || ''),
      sellerUsername: String(presetSearch.sellerUsername || '').trim(),
      offset: 0,
    };
    setParams(nextParams);
    runSearch(nextParams);
    navigate(location.pathname, { replace: true, state: null });
    // Run once per preset search handoff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    const query = new URLSearchParams(location.search || '');
    if (query.get('openSearch') !== '1') return;

    const qFromQuery = String(query.get('q') || '').trim();
    const categoryFromQuery = String(query.get('categoryId') || '').trim();
    const sellerFromQuery = String(query.get('sellerUsername') || '').trim();
    const conditionFromQuery = String(query.get('condition') || '').trim();
    const minPriceFromQuery = String(query.get('minPrice') || '').trim();
    const maxPriceFromQuery = String(query.get('maxPrice') || '').trim();
    const sortFromQuery = String(query.get('sort') || '').trim();
    const buyingOptionsFromQuery = String(query.get('buyingOptions') || '').trim();
    const freeShippingFromQuery = query.get('freeShipping') === 'true';
    const isSellerOnlyHandoff =
      !!sellerFromQuery &&
      !qFromQuery &&
      !categoryFromQuery &&
      !conditionFromQuery &&
      !minPriceFromQuery &&
      !maxPriceFromQuery &&
      !sortFromQuery &&
      !buyingOptionsFromQuery &&
      !freeShippingFromQuery;

    const nextParams = {
      ...params,
      q: isSellerOnlyHandoff ? '' : qFromQuery,
      categoryId: isSellerOnlyHandoff ? '' : categoryFromQuery,
      condition: isSellerOnlyHandoff ? 'ALL' : String(conditionFromQuery || params.condition || 'ALL').trim(),
      minPrice: isSellerOnlyHandoff ? '' : minPriceFromQuery,
      maxPrice: isSellerOnlyHandoff ? '' : maxPriceFromQuery,
      sort: isSellerOnlyHandoff ? '' : sortFromQuery,
      buyingOptions: isSellerOnlyHandoff ? '' : buyingOptionsFromQuery,
      sellerUsername: sellerFromQuery,
      freeShipping: isSellerOnlyHandoff ? false : freeShippingFromQuery,
      limit: Math.max(1, Number(query.get('limit') || params.limit || 24)),
      offset: Math.max(0, Number(query.get('offset') || 0)),
    };

    setParams(nextParams);
    runSearch(nextParams, { force: !isSellerOnlyHandoff });
    // Execute once on new-tab handoff URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const getResultKey = useCallback((item) => {
    const rawId = String(item?.id || '').trim();
    const normalizedId = rawId.replace(/^v1\|/, '').replace(/\|0$/, '');
    const legacyId = String(item?.legacyId || item?.raw?.legacyItemId || '').trim();
    const webUrl = String(item?.itemWebUrl || item?.raw?.itemWebUrl || '').trim();
    const title = String(item?.title || '').trim();

    if (normalizedId && normalizedId !== '0') return `id:${normalizedId}`;
    if (legacyId) return `legacy:${legacyId}`;

    const urlMatch = webUrl.match(/\/itm\/(?:[^/]+\/)?(\d{8,})/);
    if (urlMatch?.[1]) return `url-id:${urlMatch[1]}`;

    return `title:${title}:${Number(item?.priceValue || 0).toFixed(2)}`;
  }, []);

  useEffect(() => {
    setSoldQuantityByKey({});
    setSoldLoadingByKey({});
  }, [soldQuantityDeferred, params, results.length]);

  useEffect(() => {
    if (!soldQuantityDeferred || !Array.isArray(results) || !results.length) return;

    let cancelled = false;
    const pending = [];

    const toNumericItemId = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      if (/^\d{8,}$/.test(raw)) return raw;
      const parts = raw.split('|');
      if (parts.length >= 2 && /^\d{8,}$/.test(parts[1])) return parts[1];
      const match = raw.match(/\/itm\/(?:[^/]+\/)?(\d{8,})/);
      return match?.[1] ? String(match[1]) : '';
    };

    for (const item of results) {
      const key = getResultKey(item);
      if (!key) continue;
      if (Object.prototype.hasOwnProperty.call(soldQuantityByKey, key)) continue;
      if (item?.soldQuantity !== null && item?.soldQuantity !== undefined) continue;

      const numericItemId =
        toNumericItemId(item?.legacyId) ||
        toNumericItemId(item?.raw?.legacyItemId) ||
        toNumericItemId(item?.id) ||
        toNumericItemId(item?.raw?.itemId);

      pending.push({
        key,
        itemId: numericItemId,
        legacyItemId: numericItemId,
        itemWebUrl: String(item?.itemWebUrl || item?.raw?.itemWebUrl || '').trim(),
      });
    }

    if (!pending.length) return;

    setSoldLoadingByKey((prev) => {
      const next = { ...prev };
      for (const entry of pending) next[entry.key] = true;
      return next;
    });

    (async () => {
      for (const task of pending) {
        if (cancelled) break;
        try {
          const response = await browseAPI.getSoldQuantity({
            itemId: task.itemId,
            legacyItemId: task.legacyItemId,
            itemWebUrl: task.itemWebUrl,
          });
          const soldCount = Number(response?.data?.data?.soldCount || 0);
          if (!cancelled) {
            setSoldQuantityByKey((prev) => ({
              ...prev,
              [task.key]: Number.isFinite(soldCount) ? soldCount : 0,
            }));
          }
        } catch {
          if (!cancelled) {
            setSoldQuantityByKey((prev) => ({
              ...prev,
              [task.key]: 0,
            }));
          }
        } finally {
          if (!cancelled) {
            setSoldLoadingByKey((prev) => ({
              ...prev,
              [task.key]: false,
            }));
          }
        }
      }
    })().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [soldQuantityDeferred, results, getResultKey]);

  const hydratedResults = useMemo(() => {
    return (Array.isArray(results) ? results : []).map((item) => {
      const key = getResultKey(item);
      const hasOverride = Object.prototype.hasOwnProperty.call(soldQuantityByKey, key);
      return {
        ...item,
        soldQuantity: hasOverride ? soldQuantityByKey[key] : item.soldQuantity,
        soldLoading: Boolean(soldLoadingByKey[key]),
      };
    });
  }, [results, soldQuantityByKey, soldLoadingByKey, getResultKey]);

  const filteredResults = useMemo(() => {
    const seller = String(params.sellerUsername || '').trim().toLowerCase();
    if (!seller) return hydratedResults;
    return hydratedResults.filter((item) => String(item.sellerName || '').toLowerCase().includes(seller));
  }, [params.sellerUsername, hydratedResults]);

  const selectedItems = useMemo(() => {
    const map = new Map(filteredResults.map((item) => [item.id, item]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [filteredResults, selectedIds]);

  const sortedResults = useMemo(() => {
    const seen = new Set();
    const data = filteredResults.filter((item) => {
      const stableKey = getResultKey(item);
      if (seen.has(stableKey)) return false;
      seen.add(stableKey);
      return true;
    });

    const { key, direction } = sortConfig;
    if (!key) return data;

    const getValue = (item) => {
      switch (key) {
        case 'title':
          return String(item.title || '').toLowerCase();
        case 'seller':
          return String(item.sellerName || '').toLowerCase();
        case 'condition':
          return String(item.condition || '').toLowerCase();
        case 'soldQuantity':
          return Number(item.soldQuantity || 0);
        case 'priceValue':
          return Number(item.priceValue || 0);
        default:
          return '';
      }
    };

    data.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return direction === 'asc' ? cmp : -cmp;
    });

    return data;
  }, [filteredResults, sortConfig, getResultKey]);

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSortLabel = (label, key) => {
    if (sortConfig.key !== key) return label;
    return `${label} ${sortConfig.direction !== 'asc' ? '▲' : '▼'}`;
  };

  const metrics = useMemo(() => {
    if (!filteredResults.length) {
      return {
        averagePrice: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        withFreeShipping: 0,
      };
    }
    const prices = filteredResults.map((r) => Number(r.priceValue || 0));
    const freeShippingCount = filteredResults.filter((r) => Number(r.shippingValue || 0) === 0).length;
    return {
      averagePrice: prices.reduce((sum, n) => sum + n, 0) / prices.length,
      medianPrice: median(prices),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      withFreeShipping: Math.round((freeShippingCount / filteredResults.length) * 100),
    };
  }, [filteredResults]);

  const handleSelect = (item) => {
    setSelectedIds((prev) => {
      if (prev.includes(item.id)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, item.id];
    });
  };

  const handleInspect = (item) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.sellerUsername) query.set('sellerUsername', params.sellerUsername);
    navigate(`/market-analysis/item/${encodeURIComponent(item.id)}${query.toString() ? `?${query.toString()}` : ''}`);
  };

  const handleSellerClick = (sellerName) => {
    const seller = String(sellerName || '').trim();
    if (!seller) return;
    rememberRecentValue('sellers', seller);
    const query = new URLSearchParams({
      openSearch: '1',
      sellerUsername: seller,
      offset: '0',
    });
    window.open(`/market-analysis?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleTitleSearch = (item) => {
    const titleQuery = String(item?.title || '').trim();
    if (!titleQuery) return;
    rememberRecentValue('titles', titleQuery);
    const nextParams = {
      ...params,
      q: titleQuery,
      sellerUsername: '',
      offset: 0,
    };
    openSearchInNewTab(nextParams);
  };

  const resolveLegacyListingId = (item) => {
    const candidates = [
      item?.legacyId,
      item?.raw?.legacyItemId,
      item?.raw?.itemId,
      item?.id,
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || '')
        .trim()
        .replace(/^v1\|/, '')
        .replace(/\|0$/, '');
      if (/^\d{9,15}$/.test(normalized)) {
        return normalized;
      }
    }
    return null;
  };

  const handleSellSimilar = async (item) => {
    const listingId = resolveLegacyListingId(item);
    if (!listingId) {
      setError('Sell Similar requires a live numeric eBay listing ID (Item ID).');
      return;
    }

    const result = await Swal.fire({
      title: 'Open eBay Sell Similar?',
      text: 'You are about to continue this action on eBay. For account safety and suspension prevention, please make sure your browser is currently using the correct eBay seller profile before proceeding.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Proceed to eBay',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) return;

    const url = `https://www.ebay.com/lstng?mode=SellLikeItem&itemId=${encodeURIComponent(listingId)}&sr=wn`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onNextPage = () => {
    const nextParams = {
      ...params,
      offset: Number(params.offset || 0) + Number(params.limit || 24),
    };
    setParams(nextParams);
    runSearch(nextParams);
  };

  const onPrevPage = () => {
    const nextParams = {
      ...params,
      offset: Math.max(0, Number(params.offset || 0) - Number(params.limit || 24)),
    };
    setParams(nextParams);
    runSearch(nextParams);
  };

  return (
    <div className="page-shell space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Checkila Analysis</h1>
          <p className="page-subtitle">
            Discover market listings with Checkila Analysis and compare pricing opportunities before adding products.
          </p>
        </div>
        <button
          type="button"
          onClick={() => searchNow(params)}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          onClick={() => refreshFromEbay(params)}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh From eBay
        </button>
        <button
          type="button"
          onClick={clearCache}
          className="btn-secondary flex items-center gap-2"
        >
          Clear Cache
        </button>
      </header>

      {error && (
        <Alert
          type="error"
          message={error}
          autoClose={false}
          actionLabel="Retry Search"
          onAction={() => searchNow(params)}
          onClose={() => setError(null)}
        />
      )}

      <MarketSearchBar
        params={params}
        onChange={setParams}
        onSubmit={() => runSearch(params, { force: true })}
        disabled={loading}
        marketCreditsRemaining={marketCreditsState?.remaining ?? null}
        searchCost={searchCost}
        recentSellers={recentSearches.sellers}
        recentTitles={recentSearches.titles}
      />

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Results</p>
          <p className="text-lg font-semibold">{filteredResults.length || 0}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Average Item</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.averagePrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Median</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.medianPrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Range</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.minPrice)} - {formatCurrency(metrics.maxPrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Free Shipping</p>
          <p className="text-lg font-semibold">{metrics.withFreeShipping}%</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-12 space-y-4">
          <div className="flex justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 px-3 py-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 whitespace-nowrap">Profit calc</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={calcAmazonPrice}
                onChange={(e) => setCalcAmazonPrice(e.target.value)}
                placeholder="Amazon"
                className="input-base w-[96px] h-9 text-xs"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={calcEbayPrice}
                onChange={(e) => setCalcEbayPrice(e.target.value)}
                placeholder="eBay"
                className="input-base w-[96px] h-9 text-xs"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={calcAdRate}
                onChange={(e) => setCalcAdRate(e.target.value)}
                placeholder="Add %"
                className="input-base w-[88px] h-9 text-xs"
              />
              <div className="min-w-[88px] text-xs font-semibold text-slate-900 dark:text-slate-100">
                {inlineProfit === null ? 'Profit —' : `Profit ${formatCurrency(inlineProfit)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`btn-secondary flex items-center gap-1 ${viewMode === 'card' ? 'ring-2 ring-blue-300' : ''}`}
            >
              <LayoutGrid size={14} />
              Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`btn-secondary flex items-center gap-1 ${viewMode === 'list' ? 'ring-2 ring-blue-300' : ''}`}
            >
              <List size={14} />
              List
            </button>
            
          </div>

          {loading ? (
            <LoadingSpinner message="Searching eBay marketplace listings..." />
          ) : sortedResults.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <SearchCheck size={28} className="mx-auto text-slate-400" />
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                No listings found for your current filters.
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sortedResults.map((item, index) => (
                    <MarketItemCard
                      key={getResultKey(item, index)}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onSelect={handleSelect}
                      onInspect={handleInspect}
                      onSellerClick={handleSellerClick}
                      onSearchTitle={handleTitleSearch}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3">Image</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('title')} className="hover:underline">
                            {renderSortLabel('Title', 'title')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('seller')} className="hover:underline">
                            {renderSortLabel('Seller', 'seller')}
                          </button>
                        </th>
                        <th className="text-left p-3">Feedback Score</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('condition')} className="hover:underline">
                            {renderSortLabel('Condition', 'condition')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('soldQuantity')} className="hover:underline">
                            {renderSortLabel('Sold Qty', 'soldQuantity')}
                          </button>
                        </th>
                        <th className="text-left p-3">See History</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('priceValue')} className="hover:underline">
                            {renderSortLabel('Item Price', 'priceValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((item, index) => (
                        <tr key={getResultKey(item, index)} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-3">
                            <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">N/A</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 max-w-[220px] truncate text-xs">
                            <button
                              type="button"
                              onClick={() => item.itemWebUrl && window.open(item.itemWebUrl, '_blank', 'noopener,noreferrer')}
                              className="text-left hover:underline"
                              title={item.itemWebUrl ? 'Open on eBay' : 'eBay link unavailable'}
                            >
                              {item.title}
                            </button>
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleSellerClick(item.sellerName)}
                              className="text-blue-700 dark:text-blue-400 hover:underline"
                            >
                              {item.sellerName || 'Unknown'}
                            </button>
                            {renderSellerCountryFlag(item.sellerCountryCode)}
                          </td>
                          <td className="p-3 font-medium">{Number(item.sellerFeedback || 0)}</td>
                          <td className="p-3">{item.condition}</td>
                          <td className="p-3 font-medium">
                            {item?.soldLoading ? (
                              <span
                                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent align-middle"
                                aria-label="Loading sold quantity"
                                title="Loading sold quantity"
                              />
                            ) : (
                              Number(item.soldQuantity || 0)
                            )}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              className="btn-secondary inline-flex items-center justify-center"
                              onClick={() => openDetailsInNewTab(item)}
                              title="See history"
                              aria-label="See history"
                            >
                              <History size={14} />
                            </button>
                          </td>
                          <td className="p-3">{formatCurrency(item.priceValue)}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button type="button" className="btn-secondary" onClick={() => handleSelect(item)}>
                                {selectedIds.includes(item.id) ? 'Selected' : 'Compare'}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleTitleSearch(item)}
                                title="Search this title in new tab"
                              >
                                <Search size={14} />
                              </button>
                              <button type="button" className="btn-primary" onClick={() => handleInspect(item)}>
                                Details
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSellSimilar(item)}
                              >
                                Sell Similar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Showing {sortedResults.length} result(s)
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={onPrevPage} disabled={params.offset <= 0}>
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onNextPage}
                    disabled={params.offset + params.limit >= (total || 0)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <MarketComparePanel
        items={selectedItems}
        onRemove={(id) => setSelectedIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
}
