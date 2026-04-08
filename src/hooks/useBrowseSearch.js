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
    soldQuantity: Number(summary?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0),
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
    sellerUsername: initialParams.sellerUsername || '',
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
  const enrichRequestRef = useRef(0);

  const canSearch = useMemo(() => {
    return Boolean(
      String(params.q || '').trim() ||
      String(params.categoryId || '').trim() ||
      String(params.sellerUsername || '').trim()
    );
  }, [params]);

  const searchNow = useCallback(async (nextParams = params) => {
    if (
      !String(nextParams.q || '').trim() &&
      !String(nextParams.categoryId || '').trim() &&
      !String(nextParams.sellerUsername || '').trim()
    ) {
      setResults([]);
      setTotal(0);
      setRefinement(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const requestId = ++enrichRequestRef.current;
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
      const mappedItems = itemSummaries.map(normalizeItem);
      setResults(mappedItems);
      setTotal(Number(payload?.total || 0));
      setRefinement(payload?.refinement || null);

      // eBay search summaries often omit accurate sold quantity; enrich visible page from item details.
      const needEnrichment = mappedItems.some((item) => Number(item.soldQuantity || 0) <= 0);
      if (needEnrichment) {
        const chunkSize = 6;
        const updates = new Map();
        for (let i = 0; i < mappedItems.length; i += chunkSize) {
          if (enrichRequestRef.current !== requestId) return;
          const chunk = mappedItems.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(
            chunk.map(async (item) => {
              try {
                const detailRes = await browseAPI.getItem(item.id, 'PRODUCT');
                const detail = detailRes?.data?.data || {};
                const sold = Number(detail?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0);
                return { id: item.id, soldQuantity: Number.isFinite(sold) ? sold : item.soldQuantity };
              } catch {
                return { id: item.id, soldQuantity: item.soldQuantity };
              }
            })
          );

          chunkResults.forEach((entry) => updates.set(entry.id, entry.soldQuantity));
        }

        if (enrichRequestRef.current === requestId) {
          setResults((prev) =>
            prev.map((item) =>
              updates.has(item.id)
                ? { ...item, soldQuantity: Number(updates.get(item.id) || 0) }
                : item
            )
          );
        }
      }
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
