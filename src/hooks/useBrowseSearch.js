import { useCallback, useMemo, useState } from 'react';
import api, { browseAPI } from '../services/api';

const MARKET_ANALYSIS_STORAGE_KEY = 'marketAnalysisState:v1';

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getDefaultParams(initialParams = {}) {
  return {
    q: initialParams.q || '',
    categoryId: initialParams.categoryId || '',
    condition: initialParams.condition || 'ALL',
    minPrice: initialParams.minPrice || '',
    maxPrice: initialParams.maxPrice || '',
    sort: initialParams.sort || '',
    buyingOptions: initialParams.buyingOptions || '',
    sellerUsername: initialParams.sellerUsername || '',
    freeShipping: initialParams.freeShipping || false,
    autoCorrect: initialParams.autoCorrect || true,
    limit: initialParams.limit || 24,
    offset: initialParams.offset || 0,
    fieldgroups: initialParams.fieldgroups || 'MATCHING_ITEMS',
  };
}

function buildCacheKey(rawParams = {}) {
  const p = rawParams || {};
  return JSON.stringify({
    q: String(p.q || '').trim(),
    categoryId: String(p.categoryId || '').trim(),
    condition: String(p.condition || 'ALL').toUpperCase(),
    minPrice: String(p.minPrice ?? '').trim(),
    maxPrice: String(p.maxPrice ?? '').trim(),
    sort: String(p.sort || '').trim(),
    buyingOptions: String(p.buyingOptions || '').trim(),
    sellerUsername: String(p.sellerUsername || '').trim(),
    freeShipping: Boolean(p.freeShipping),
    autoCorrect: Boolean(p.autoCorrect),
    limit: Number(p.limit || 24),
    offset: Number(p.offset || 0),
    fieldgroups: String(p.fieldgroups || '').trim(),
  });
}

function parseNextOffset(nextValue) {
  if (!nextValue) return null;

  const text = String(nextValue).trim();
  if (!text) return null;

  try {
    const parsed = new URL(text, 'https://www.ebay.com');
    const offset = Number(parsed.searchParams.get('offset'));
    return Number.isFinite(offset) && offset >= 0 ? offset : null;
  } catch {
    const match = text.match(/[?&]offset=(\d+)/) || text.match(/offset=(\d+)/);
    if (!match?.[1]) return null;
    const offset = Number(match[1]);
    return Number.isFinite(offset) && offset >= 0 ? offset : null;
  }
}

const SELLER_PAGE_SIZE = 20;

function normalizeSellerKey(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getSellerWindowMatch(cacheEntry, nextParams) {
  if (!cacheEntry || !isPureSellerOnlySearch(nextParams)) return false;

  const cachedSeller = normalizeSellerKey(cacheEntry?.sellerUsername || cacheEntry?.params?.sellerUsername || cacheEntry?.searchPayload?.sellerUsername);
  const requestedSeller = normalizeSellerKey(nextParams?.sellerUsername);
  if (!cachedSeller || cachedSeller !== requestedSeller) return false;

  const windowStart = Number(cacheEntry?.sellerWindowStartOffset ?? 0);
  const windowSizeRaw = cacheEntry?.sellerWindowSize ?? (Array.isArray(cacheEntry?.results) ? cacheEntry.results.length : 0);
  const windowSize = Number(windowSizeRaw);
  const requestedOffset = Number(nextParams?.offset || 0);
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowSize) || windowSize <= 0) return false;
  return requestedOffset >= windowStart && requestedOffset < windowStart + windowSize;
}

function sliceSellerWindow(cacheEntry, nextParams) {
  const fullResults = Array.isArray(cacheEntry?.results) ? cacheEntry.results : [];
  const windowStart = Number(cacheEntry?.sellerWindowStartOffset ?? 0);
  const requestedOffset = Math.max(0, Number(nextParams?.offset || 0));
  const sliceStart = Math.max(0, requestedOffset - windowStart);
  const pageResults = fullResults.slice(sliceStart, sliceStart + SELLER_PAGE_SIZE);
  const nextOffset = pageResults.length === SELLER_PAGE_SIZE ? requestedOffset + SELLER_PAGE_SIZE : null;

  return {
    pageResults,
    nextOffset,
    windowStart,
    windowSize: Number(cacheEntry?.sellerWindowSize || fullResults.length || 0),
  };
}

function findSellerWindowCacheEntry(cache, nextParams) {
  const entries = Object.values(cache || {});
  return entries.find((entry) => getSellerWindowMatch(entry, nextParams)) || null;
}

function loadPersistedState(initialParams = {}) {
  const defaults = getDefaultParams(initialParams);
  if (typeof window === 'undefined') {
    return {
      params: defaults,
      cache: {},
      restored: null,
    };
  }

  const raw = window.localStorage.getItem(MARKET_ANALYSIS_STORAGE_KEY);
  if (!raw) {
    return {
      params: defaults,
      cache: {},
      restored: null,
    };
  }

  const parsed = safeJsonParse(raw, null);
  if (!parsed || typeof parsed !== 'object') {
    return {
      params: defaults,
      cache: {},
      restored: null,
    };
  }

  const persistedParams = {
    ...defaults,
    ...(parsed.params || {}),
  };
  const cache = parsed.cache && typeof parsed.cache === 'object' ? parsed.cache : {};
  let restored = cache[buildCacheKey(persistedParams)] || null;
  if (!restored && isPureSellerOnlySearch(persistedParams)) {
    const sellerWindowEntry = findSellerWindowCacheEntry(cache, persistedParams);
    if (sellerWindowEntry) {
      const sellerSlice = sliceSellerWindow(sellerWindowEntry, persistedParams);
      restored = {
        ...sellerWindowEntry,
        results: sellerSlice.pageResults,
        nextOffset: sellerSlice.nextOffset,
        sellerWindowStartOffset: sellerSlice.windowStart,
        sellerWindowSize: sellerSlice.windowSize,
      };
    }
  }

  return {
    params: persistedParams,
    cache,
    restored,
  };
}

function persistState(params, cache) {
  if (typeof window === 'undefined') return;
  const payload = {
    params,
    cache,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(MARKET_ANALYSIS_STORAGE_KEY, JSON.stringify(payload));
}

function trimCache(cache, maxEntries = 30) {
  const entries = Object.entries(cache || {});
  if (entries.length <= maxEntries) return cache;
  const sorted = entries.sort((a, b) => {
    const aTs = Number(a?.[1]?.savedAtMs || 0);
    const bTs = Number(b?.[1]?.savedAtMs || 0);
    return bTs - aTs;
  });
  return Object.fromEntries(sorted.slice(0, maxEntries));
}

function normalizeItem(summary, { shouldRefetchSoldOnZero = false, fallbackSellerName = '', fallbackSellerFeedback = null, forceSellerName = false } = {}) {
  const rawItemId = String(summary?.itemId || summary?.itemID || summary?.legacyItemId || '').trim();
  const normalizedId = rawItemId.replace(/^v1\|/, '').replace(/\|0$/, '');
  const soldRaw = summary?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity;
  const fastSold7d = Number(summary?.sevenDaysSales);
  const fastSold14d = Number(summary?.fourteenDaysSales);
  const fastPrice = Number(summary?.currentPrice);
  const soldQuantity =
    soldRaw === null || soldRaw === undefined || soldRaw === '' ? null : Number(soldRaw || 0);
  const soldQuantity7d = Number.isFinite(fastSold7d) ? Math.max(0, fastSold7d) : (soldQuantity === null ? null : (Number.isFinite(soldQuantity) ? soldQuantity : 0));
  const soldQuantity15d = Number.isFinite(fastSold14d)
    ? Math.max(0, fastSold14d)
    : (summary?.soldQuantity15d != null && summary.soldQuantity15d !== ''
      ? Number(summary.soldQuantity15d)
      : (soldQuantity === null ? null : (Number.isFinite(soldQuantity) ? soldQuantity : 0)));

  return {
    id: normalizedId || rawItemId,
    legacyId: summary?.legacyItemId || '',
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.thumbnailImages?.[0]?.imageUrl || summary?.ebayImage || '',
    priceValue: Number.isFinite(fastPrice) ? fastPrice : Number(summary?.price?.value || 0),
    priceCurrency: summary?.price?.currency || summary?.currency || 'USD',
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    soldQuantity: soldQuantity7d === null ? null : (Number.isFinite(soldQuantity7d) ? soldQuantity7d : 0),
    soldQuantity15d: soldQuantity15d === null ? null : (Number.isFinite(soldQuantity15d) ? soldQuantity15d : 0),
    condition: summary?.condition || 'Unknown',
    sellerName: (
      forceSellerName
        ? String(fallbackSellerName || '').trim()
        : (
          summary?.seller?.username ||
          summary?.sellerName ||
          summary?.sellerUsername ||
          summary?.raw?.sellerName ||
          summary?.raw?.sellerUsername ||
          String(fallbackSellerName || '').trim()
        )
    ) || 'Unknown seller',
    sellerFeedback: Number(summary?.seller?.feedbackScore || summary?.feedback || fallbackSellerFeedback || 0),
    sellerCountryCode:
      summary?.itemLocation?.country ||
      summary?.itemLocation?.countryCode ||
      summary?.seller?.location?.country ||
      summary?.seller?.countryCode ||
      summary?.countryCode ||
      '',
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || summary?.productUrl || '',
    shouldRefetchSoldOnZero: Boolean(shouldRefetchSoldOnZero),
    raw: summary,
  };
}

function forceDeferredSellerSold(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    soldQuantity: null,
  }));
}

function getSearchResultItems(payload) {
  const candidates = [
    payload?.itemSummaries,
    payload?.rows,
    payload?.result?.data,
    payload?.result?.sellers,
    payload?.raw?.result?.data,
    payload?.raw?.result?.sellers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

function getSearchResultTotal(payload, fallbackCount = 0) {
  const candidates = [
    payload?.total,
    payload?.recordsFiltered,
    payload?.recordsTotal,
    payload?.result?.recordsFiltered,
    payload?.result?.recordsTotal,
    payload?.raw?.result?.recordsFiltered,
    payload?.raw?.result?.recordsTotal,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return fallbackCount;
}

function isPureSellerOnlySearch(params = {}) {
  return (
    String(params?.sellerUsername || '').trim() !== '' &&
    String(params?.q || '').trim() === '' &&
    String(params?.categoryId || '').trim() === '' &&
    String(params?.condition || 'ALL').trim().toUpperCase() === 'ALL' &&
    String(params?.minPrice || '').trim() === '' &&
    String(params?.maxPrice || '').trim() === '' &&
    String(params?.buyingOptions || '').trim() === '' &&
    params?.freeShipping !== true
  );
}

function isPureTitleOnlySearch(params = {}) {
  return (
    String(params?.q || '').trim() !== '' &&
    String(params?.sellerUsername || '').trim() === '' &&
    String(params?.categoryId || '').trim() === '' &&
    String(params?.condition || 'ALL').trim().toUpperCase() === 'ALL' &&
    String(params?.minPrice || '').trim() === '' &&
    String(params?.maxPrice || '').trim() === '' &&
    String(params?.buyingOptions || '').trim() === '' &&
    params?.freeShipping !== true
  );
}

export default function useBrowseSearch(initialParams = {}) {
  const persisted = useMemo(() => loadPersistedState(initialParams), []);

  const [params, setParamsState] = useState(persisted.params);
  const [cache, setCache] = useState(persisted.cache || {});
  const [results, setResults] = useState(Array.isArray(persisted.restored?.results) ? persisted.restored.results : []);
  const [total, setTotal] = useState(Number(persisted.restored?.total || 0));
  const [nextOffset, setNextOffset] = useState(
    Number.isFinite(Number(persisted.restored?.nextOffset)) ? Number(persisted.restored.nextOffset) : null
  );
  const [refinement, setRefinement] = useState(persisted.restored?.refinement || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(persisted.restored?.credits || null);
  const [soldQuantityDeferred, setSoldQuantityDeferred] = useState(Boolean(persisted.restored?.soldQuantityDeferred));

  const setParams = useCallback((updater) => {
    setParamsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      persistState(next, cache);
      return next;
    });
  }, [cache]);

  const canSearch = useMemo(() => {
    return Boolean(
      String(params.q || '').trim() ||
      String(params.categoryId || '').trim() ||
      String(params.sellerUsername || '').trim()
    );
  }, [params]);

  const searchNow = useCallback(async (nextParams = params, { force = false } = {}) => {
    const sellerOnlySearch = isPureSellerOnlySearch(nextParams);
    const effectiveParams = sellerOnlySearch
      ? {
          ...nextParams,
          limit: SELLER_PAGE_SIZE,
        }
      : nextParams;

    if (
      !String(effectiveParams.q || '').trim() &&
      !String(effectiveParams.categoryId || '').trim() &&
      !String(effectiveParams.sellerUsername || '').trim()
    ) {
      setResults([]);
      setTotal(0);
      setNextOffset(null);
      setRefinement(null);
      setError(null);
      persistState(effectiveParams, cache);
      return;
    }

    const cacheKey = buildCacheKey(effectiveParams);
    const sellerWindowCache = sellerOnlySearch ? findSellerWindowCacheEntry(cache, effectiveParams) : null;

    if (!force && (cache[cacheKey] || sellerWindowCache)) {
      const cached = cache[cacheKey] || sellerWindowCache;
      const cachedQueryKind = String(cached?.queryKind || '').trim().toLowerCase();
      const searchType = String(effectiveParams?.type || '').trim().toLowerCase();
      const isFastMode = searchType === 'fast';

      // Seller-click handoff may use cache only when the cached query is also pure seller-only.
      if (sellerOnlySearch && cachedQueryKind !== 'seller_only') {
        // Fall through to backend fetch.
      } else {
        const sellerOnly = sellerOnlySearch;
        const cachedDataSource = String(cached.dataSource || '').trim().toLowerCase();
        const shouldForceDeferredSold = sellerOnly && !isFastMode && cachedDataSource !== 'sql';
        const cachedResults = Array.isArray(cached.results) ? cached.results : [];
        const shouldRefetchZeroSold = cachedResults.some((item) => item?.shouldRefetchSoldOnZero === true);
        const nextSoldQuantityDeferred = shouldForceDeferredSold
          ? true
          : (isFastMode ? false : (Boolean(cached.soldQuantityDeferred) || shouldRefetchZeroSold));
        const sellerSlice = sellerOnly
          ? sliceSellerWindow(cached, effectiveParams)
          : null;
        const displayedResults = sellerOnly ? (sellerSlice?.pageResults || []) : cachedResults;
        const nextPageOffset = sellerOnly
          ? sellerSlice?.nextOffset ?? null
          : (Number.isFinite(Number(cached.nextOffset)) ? Number(cached.nextOffset) : null);

        setResults(shouldForceDeferredSold ? forceDeferredSellerSold(displayedResults) : displayedResults);
        setTotal(Number(cached.total || displayedResults.length || 0));
        setNextOffset(nextPageOffset);
        setRefinement(cached.refinement || null);
        setCredits(cached.credits || null);
        setSoldQuantityDeferred(nextSoldQuantityDeferred);
        setError(null);
        setParamsState(effectiveParams);
        persistState(effectiveParams, cache);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const requestParams = Object.fromEntries(
        Object.entries(effectiveParams).filter(([key, value]) => {
          if (value === undefined || value === null) return false;
          if (typeof value === 'string' && value.trim() === '') return false;
          if (typeof value === 'boolean') return value;
          if (key === 'condition' && String(value).toUpperCase() === 'ALL') return false;
          return true;
        })
      );

      const response = await browseAPI.search(requestParams);

      // If backend accepted an async fast job, it returns 202 with jobId + pollUrl
      let payload = null;
      let nextCredits = null;
      if (response?.status === 202) {
        const jobId = response?.data?.jobId;
        const pollUrl = response?.data?.pollUrl || `/ebay/extension-scrape/${jobId}`;
        nextCredits = response?.data?.credits || null;

        // Poll for result (timeout after 20s)
        const start = Date.now();
        const TIMEOUT_MS = 20_000;
        const INTERVAL_MS = 1000;
        let polled = null;
        while (Date.now() - start < TIMEOUT_MS) {
          try {
            const pollResp = await api.get(pollUrl);
            if (pollResp?.data?.status === 'done') {
              polled = pollResp?.data?.data || {};
              break;
            }
            if (pollResp?.data?.status === 'error') {
              throw new Error(String(pollResp?.data?.error || 'Extension job failed'));
            }
          } catch (pollErr) {
            // ignore and retry until timeout
          }
          await new Promise((r) => setTimeout(r, INTERVAL_MS));
        }
        if (!polled) throw new Error('Timed out waiting for extension fast result');
        payload = polled || {};
      } else {
        payload = response?.data?.data || {};
        nextCredits = response?.data?.credits || null;
      }
      const itemSummaries = getSearchResultItems(payload);
      const rawPayload = payload?.raw?.result || payload?.result || null;
      const nextDataSource = String(payload?.dataSource || 'external').trim() || 'external';
      const nextNextOffset = Number.isFinite(Number(payload?.nextOffset))
        ? Number(payload.nextOffset)
        : parseNextOffset(payload?.next);
      const sellerOnly = sellerOnlySearch;
      const titleOnly = isPureTitleOnlySearch(effectiveParams);
      const searchType = String(effectiveParams?.type || '').trim().toLowerCase();
      const isFastMode = searchType === 'fast';
      const shouldForceDeferredSold = sellerOnly && !isFastMode && nextDataSource !== 'sql';
      const sellerFallbackName = sellerOnly ? String(effectiveParams.sellerUsername || '').trim() : '';
      const sellerFallbackFeedback = Number(rawPayload?.feedback || payload?.feedback || 0);
      const normalized = itemSummaries.map((summary) => {
        const baseItem = normalizeItem(summary, {
          fallbackSellerName: sellerFallbackName,
          fallbackSellerFeedback,
          forceSellerName: sellerOnly && isFastMode,
        });
        const shouldRefetchSoldOnZero = titleOnly && Number(baseItem?.soldQuantity || 0) === 0;
        return {
          ...baseItem,
          shouldRefetchSoldOnZero,
        };
      });
      const hydratedItems = shouldForceDeferredSold ? forceDeferredSellerSold(normalized) : normalized;
      const nextTotal = getSearchResultTotal(payload, hydratedItems.length || 0);
      const nextRefinement = payload?.refinement || null;
      const hasZeroSoldRefetch = normalized.some((item) => item?.shouldRefetchSoldOnZero === true);
      const nextSoldQuantityDeferred = shouldForceDeferredSold
        ? true
        : (isFastMode ? false : (Boolean(payload?.soldQuantityDeferred) || hasZeroSoldRefetch));
      const sellerWindowStartOffset = sellerOnly ? Number(effectiveParams.offset || 0) : null;
      const sellerWindowSize = sellerOnly ? hydratedItems.length : null;

      const displayedResults = sellerOnly ? hydratedItems.slice(0, SELLER_PAGE_SIZE) : hydratedItems;
      setResults(displayedResults);
      setTotal(nextTotal);
      setNextOffset(sellerOnly ? (displayedResults.length === SELLER_PAGE_SIZE ? Number(effectiveParams.offset || 0) + SELLER_PAGE_SIZE : null) : nextNextOffset);
      setRefinement(nextRefinement);
      setCredits(nextCredits);
      setSoldQuantityDeferred(nextSoldQuantityDeferred);
      setParamsState(effectiveParams);

      setCache((prev) => {
        const nextCache = trimCache({
          ...prev,
          [cacheKey]: {
            results: sellerOnly ? hydratedItems : displayedResults,
            total: nextTotal,
            nextOffset: sellerOnly
              ? (displayedResults.length === SELLER_PAGE_SIZE ? Number(effectiveParams.offset || 0) + SELLER_PAGE_SIZE : null)
              : nextNextOffset,
            refinement: nextRefinement,
            credits: nextCredits,
            soldQuantityDeferred: nextSoldQuantityDeferred,
            dataSource: nextDataSource,
            queryKind: sellerOnly ? 'seller_only' : 'general',
            sellerUsername: String(effectiveParams.sellerUsername || '').trim(),
            sellerWindowStartOffset,
            sellerWindowSize,
            raw: rawPayload,
            savedAtMs: Date.now(),
          },
        });
        persistState(effectiveParams, nextCache);
        return nextCache;
      });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Market search failed');
    } finally {
      setLoading(false);
    }
  }, [params, cache]);

  const clearCache = useCallback(() => {
    setCache({});
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(MARKET_ANALYSIS_STORAGE_KEY);
    }
  }, []);

  const refreshFromEbay = useCallback(async (nextParams = params) => {
    await searchNow(nextParams, { force: true });
  }, [params, searchNow]);

  return {
    params,
    setParams,
    setResults,
    results,
    total,
    nextOffset,
    refinement,
    loading,
    error,
    setError,
    canSearch,
    searchNow,
    clearCache,
    refreshFromEbay,
    credits,
    soldQuantityDeferred,
  };
}
