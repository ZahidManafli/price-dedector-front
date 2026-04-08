import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browseAPI } from '../services/api';

function normalizeItem(summary) {
  return {
    id: summary?.itemId || '',
    legacyId: summary?.legacyItemId || '',
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.thumbnailImages?.[0]?.imageUrl || '',
    priceValue: Number(summary?.price?.value || 0),
    priceCurrency: summary?.price?.currency || 'USD',
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    condition: summary?.condition || 'Unknown',
    sellerName: summary?.seller?.username || 'Unknown seller',
    sellerFeedback: Number(summary?.seller?.feedbackScore || 0),
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || '',
    raw: summary,
  };
}

export default function useBrowseSearch(initialParams = {}) {
  const [params, setParams] = useState({
    q: initialParams.q || '',
    categoryId: initialParams.categoryId || '',
    condition: initialParams.condition || 'ALL',
    minPrice: initialParams.minPrice || '',
    maxPrice: initialParams.maxPrice || '',
    sort: initialParams.sort || '',
    buyingOptions: initialParams.buyingOptions || '',
    freeShipping: initialParams.freeShipping || false,
    autoCorrect: initialParams.autoCorrect || true,
    limit: initialParams.limit || 24,
    offset: initialParams.offset || 0,
    fieldgroups: initialParams.fieldgroups || 'MATCHING_ITEMS',
  });
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [refinement, setRefinement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);

  const canSearch = useMemo(() => {
    return Boolean(String(params.q || '').trim() || String(params.categoryId || '').trim());
  }, [params]);

  const searchNow = useCallback(async (nextParams = params) => {
    if (!String(nextParams.q || '').trim() && !String(nextParams.categoryId || '').trim()) {
      setResults([]);
      setTotal(0);
      setRefinement(null);
      setError(null);
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
      const itemSummaries = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : [];
      setResults(itemSummaries.map(normalizeItem));
      setTotal(Number(payload?.total || 0));
      setRefinement(payload?.refinement || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Market search failed');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchNow(params);
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
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
  };
}
