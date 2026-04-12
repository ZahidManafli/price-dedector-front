import { useCallback, useMemo, useState } from 'react';
import { browseAPI } from '../services/api';

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
  const restored = cache[buildCacheKey(persistedParams)] || null;

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

function normalizeItem(summary) {
  return {
    id: summary?.itemId || '',
    legacyId: summary?.legacyItemId || '',
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.thumbnailImages?.[0]?.imageUrl || '',
    priceValue: Number(summary?.price?.value || 0),
    priceCurrency: summary?.price?.currency || 'USD',
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    soldQuantity: Number(summary?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0),
    condition: summary?.condition || 'Unknown',
    sellerName: summary?.seller?.username || 'Unknown seller',
    sellerFeedback: Number(summary?.seller?.feedbackScore || 0),
    sellerCountryCode:
      summary?.itemLocation?.country ||
      summary?.itemLocation?.countryCode ||
      summary?.seller?.location?.country ||
      summary?.seller?.countryCode ||
      '',
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || '',
    raw: summary,
  };
}

export default function useBrowseSearch(initialParams = {}) {
  const persisted = useMemo(() => loadPersistedState(initialParams), []);

  const [params, setParamsState] = useState(persisted.params);
  const [cache, setCache] = useState(persisted.cache || {});
  const [results, setResults] = useState(Array.isArray(persisted.restored?.results) ? persisted.restored.results : []);
  const [total, setTotal] = useState(Number(persisted.restored?.total || 0));
  const [refinement, setRefinement] = useState(persisted.restored?.refinement || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [credits, setCredits] = useState(persisted.restored?.credits || null);

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
    if (
      !String(nextParams.q || '').trim() &&
      !String(nextParams.categoryId || '').trim() &&
      !String(nextParams.sellerUsername || '').trim()
    ) {
      setResults([]);
      setTotal(0);
      setRefinement(null);
      setError(null);
      persistState(nextParams, cache);
      return;
    }

    const cacheKey = buildCacheKey(nextParams);
    if (!force && cache[cacheKey]) {
      const cached = cache[cacheKey];
      setResults(Array.isArray(cached.results) ? cached.results : []);
      setTotal(Number(cached.total || 0));
      setRefinement(cached.refinement || null);
      setCredits(cached.credits || null);
      setError(null);
      setParamsState(nextParams);
      persistState(nextParams, cache);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const requestParams = Object.fromEntries(
        Object.entries(nextParams).filter(([key, value]) => {
          if (value === undefined || value === null) return false;
          if (typeof value === 'string' && value.trim() === '') return false;
          if (typeof value === 'boolean') return value;
          if (key === 'condition' && String(value).toUpperCase() === 'ALL') return false;
          return true;
        })
      );

      const response = await browseAPI.search(requestParams);
      const payload = response?.data?.data || {};
      const nextCredits = response?.data?.credits || null;
      const itemSummaries = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
      const normalized = itemSummaries.map(normalizeItem);
      const nextTotal = Number(payload?.total || 0);
      const nextRefinement = payload?.refinement || null;

      setResults(normalized);
      setTotal(nextTotal);
      setRefinement(nextRefinement);
      setCredits(nextCredits);
      setParamsState(nextParams);

      setCache((prev) => {
        const nextCache = trimCache({
          ...prev,
          [cacheKey]: {
            results: normalized,
            total: nextTotal,
            refinement: nextRefinement,
            credits: nextCredits,
            savedAtMs: Date.now(),
          },
        });
        persistState(nextParams, nextCache);
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
    results,
    total,
    refinement,
    loading,
    error,
    setError,
    canSearch,
    searchNow,
    clearCache,
    refreshFromEbay,
    credits,
  };
}
