import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heart, History, LayoutGrid, List, RefreshCw, Search, SearchCheck, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import MarketSearchBar from '../components/MarketSearchBar';
import MarketItemCard from '../components/MarketItemCard';
import MarketComparePanel from '../components/MarketComparePanel';
import useBrowseSearch from '../hooks/useBrowseSearch';
import { calculateProfit, formatCurrency } from '../utils/helpers';
import { browseAPI, ebayAPI, settingsAPI } from '../services/api';
import ListOnEbayModal from '../components/ListOnEbayModal';
import PurchaseHistoryModal from '../components/PurchaseHistoryModal';
import { useTheme } from '../context/ThemeContext';
import { calculateLast7DaysSoldCount, calculateLast15DaysSoldCount, fetchPurchaseHistoryRows, normalizeNumericItemId } from '../utils/purchaseHistory';
// ── Bucket ────────────────────────────────────────────────────────────────────
import { useBucket, BucketTrigger, BucketDrawer, AddToBucketButton } from '../components/EbayBucket';

const RECENT_SEARCH_STORAGE_KEY = 'checkilaRecentSearches:v1';
const RECENT_SEARCH_LIMIT = 8;
const AMAZON_ICON_URL = 'https://www.amazon.com/favicon.ico';

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

function normalizeSellerName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
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

function buildAmazonSearchUrlFromTitle(title) {
  const query = String(title || '').trim();
  if (!query) return '';
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

function resolveLegacyListingId(source) {
  const candidates = [
    source?.legacyId,
    source?.legacyItemId,
    source?.raw?.legacyItemId,
    source?.itemId,
    source?.raw?.itemId,
    source?.id,
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
}

export default function MarketAnalysisPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    params,
    setParams,
    results,
    total,
    nextOffset,
    refinement,
    loading,
    error,
    setError,
    setResults,
    searchNow,
    clearCache,
    credits,
  } = useBrowseSearch({
    fieldgroups: 'ASPECT_REFINEMENTS,MATCHING_ITEMS',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [sortConfig, setSortConfig] = useState({ key: 'soldQuantity', direction: 'desc' });
  const [marketCreditsState, setMarketCreditsState] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const [savedSellers, setSavedSellers] = useState([]);
  const [savedSellersLoading, setSavedSellersLoading] = useState(false);
  const [savedSellersOpen, setSavedSellersOpen] = useState(false);
  const [savedSellerSaving, setSavedSellerSaving] = useState('');
  const [calcAmazonPrice, setCalcAmazonPrice] = useState('');
  const [calcEbayPrice, setCalcEbayPrice] = useState('');
  const [calcAdRate, setCalcAdRate] = useState('0');
  const [soldQuantityByKey, setSoldQuantityByKey] = useState({});
  const [soldQuantity15dByKey, setSoldQuantity15dByKey] = useState({});
  const [soldLoadingByKey, setSoldLoadingByKey] = useState({});
  const [ebayListModal, setEbayListModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const purchaseHistoryQueueRef = useRef(false);
  const { isDark } = useTheme();

  // ── Bucket state ─────────────────────────────────────────────────────────────
  const bucket = useBucket();
  const [bucketOpen, setBucketOpen] = useState(false);
  // Track which item ids are currently being scraped for the bucket
  const [scrapingIds, setScrapingIds] = useState(new Set());

  // handleListOnEbay is called when user clicks "List on eBay" button for a specific item.
  const handleListOnEbay = (item) => {
    setEbayListModal(item);
  };

  // ── Add to bucket: scrape then store ────────────────────────────────────────
  const handleAddToBucket = useCallback(async (item) => {
    const itemId = item?.id;
    if (!itemId) return;

    // Mark as scraping
    setScrapingIds((prev) => new Set([...prev, itemId]));

    try {
      let scrapedData = {
        title: item.title || '',
        price: item.priceValue || 0,
        pictureUrls: item.imageUrl ? [item.imageUrl] : [],
        categoryId: '',
        categoryName: '',
        itemSpecifics: [],
        conditionId: 1000,
        quantity: 1,
        currency: 'USD',
        freeShipping: true,
        dispatchTimeMax: 3,
      };

      // Attempt to scrape full item details from eBay listing page
      if (item.itemWebUrl) {
        try {
          const res = await ebayAPI.scrapeItemDetails(item.itemWebUrl );
          const scraped = res?.data || {};
          if (scraped.success) {
            scrapedData = {
              ...scrapedData,
              categoryId: scraped.categoryId || '',
              categoryName: scraped.categoryName || '',
              itemSpecifics: scraped.itemSpecifics || [],
              pictureUrls: scraped.pictureUrls?.length ? scraped.pictureUrls : scrapedData.pictureUrls,
            };
          }
        } catch (scrapeErr) {
          console.warn('[bucket] Scrape failed, using basic item data:', scrapeErr?.message);
          // Continue with basic data — don't block the user
        }
      }

      bucket.addToBucket(item, scrapedData);
      setBucketOpen(true); // Open bucket drawer to confirm add
    } finally {
      setScrapingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [bucket]);

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
        // Non-blocking
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

  const loadSavedSellers = useCallback(async () => {
    try {
      setSavedSellersLoading(true);
      const response = await ebayAPI.listSavedSellers();
      setSavedSellers(Array.isArray(response?.data?.savedSellers) ? response.data.savedSellers : []);
    } catch (loadError) {
      console.warn('[market-analysis] failed to load saved sellers:', loadError?.message || loadError);
    } finally {
      setSavedSellersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedSellers();
  }, [loadSavedSellers]);

  useEffect(() => {
    if (!savedSellersOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [savedSellersOpen]);

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

  const currentPageSize = Array.isArray(results) ? results.length : 0;
  const canNextPage =
    !loading &&
    (Number.isFinite(Number(nextOffset)) || currentPageSize >= Number(params.limit || 12) || params.offset + params.limit < (total || 0));

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

  const handleViewHistory = useCallback(async (item) => {
    const itemId = String(item?.id || '').trim().replace(/^v1\|/, '').replace(/\|0$/, '');
    if (!itemId) return;

    setHistoryModal({ loading: true, jobId: null, data: null, error: null });

    try {
      const data = await fetchPurchaseHistoryRows(itemId);
      setHistoryModal({
        loading: false,
        jobId: itemId,
        data: Array.isArray(data) ? data : [],
        soldQuantity7d: calculateLast7DaysSoldCount(data || []),
        soldQuantity15d: calculateLast15DaysSoldCount(data || []),
        error: null,
      });
    } catch (error) {
      setHistoryModal({
        loading: false,
        jobId: null,
        data: null,
        error: error?.response?.data?.error || error?.message || 'Request failed',
      });
    }
  }, []);

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

  const resolvePurchaseHistoryItemId = useCallback((item) => {
    const candidates = [
      item?.legacyId,
      item?.raw?.legacyItemId,
      item?.id,
      item?.raw?.itemId,
      item?.itemWebUrl,
      item?.raw?.itemWebUrl,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeNumericItemId(candidate);
      if (normalized) return normalized;
    }

    return '';
  }, []);

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
      limit: Math.max(1, Number(query.get('limit') || params.limit || 12)),
      offset: Math.max(0, Number(query.get('offset') || 0)),
    };

    setParams(nextParams);
    runSearch(nextParams, { force: true });
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
    if (!Array.isArray(results) || !results.length) return;
    if (purchaseHistoryQueueRef.current) return; // already running, don't restart
  
    const pending = [];
    for (const item of results) {
      const key = getResultKey(item);
      if (!key) continue;
      // Skip items already fetched OR currently loading
      if (
        Object.prototype.hasOwnProperty.call(soldQuantityByKey, key) ||
        soldLoadingByKey[key]
      ) continue;
  
      const itemId = resolvePurchaseHistoryItemId(item);
      if (!itemId) continue;
  
      pending.push({ key, itemId });
    }
  
    if (!pending.length) return;
  
    let cancelled = false;
    purchaseHistoryQueueRef.current = true;
  
    // Mark all pending as loading immediately
    setSoldLoadingByKey((prev) => {
      const next = { ...prev };
      for (const entry of pending) next[entry.key] = true;
      return next;
    });
  
    (async () => {
      for (const task of pending) {
        if (cancelled) break;
        try {
          const rows = await fetchPurchaseHistoryRows(task.itemId);
          const soldCount7d = calculateLast7DaysSoldCount(rows);
          const soldCount15d = calculateLast15DaysSoldCount(rows);
          
          if (!cancelled) {
            setSoldQuantityByKey((prev) => ({
              ...prev,
              [task.key]: soldCount7d,
            }));
          
            setSoldQuantity15dByKey((prev) => ({
              ...prev,
              [task.key]: soldCount15d,
            }));
          }
        } catch {
          if (!cancelled) {
            setSoldQuantityByKey((prev) => ({
              ...prev,
              [task.key]: 0,
            }));
            
            setSoldQuantity15dByKey((prev) => ({
              ...prev,
              [task.key]: 0,
            }));
          }
        } finally {
          if (!cancelled) {
            setSoldLoadingByKey((prev) => ({ ...prev, [task.key]: false }));
          }
        }
      }
      purchaseHistoryQueueRef.current = false;
    })().catch(() => {
      purchaseHistoryQueueRef.current = false;
    });
  
    return () => {
      cancelled = true;
      purchaseHistoryQueueRef.current = false;
    };
    // ✅ Remove soldQuantityByKey from deps — it was causing infinite re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, getResultKey, resolvePurchaseHistoryItemId]);

  // Confirm this is still in your hydratedResults (should be — don't change it):
  const hydratedResults = useMemo(() => {
    return (Array.isArray(results) ? results : []).map((item) => {
      const key = getResultKey(item);
      const hasOverride = Object.prototype.hasOwnProperty.call(soldQuantityByKey, key);
      return {
        ...item,
      
        soldQuantity: hasOverride
          ? soldQuantityByKey[key]
          : item.soldQuantity,
      
        soldQuantity15d:
          soldQuantity15dByKey[key] ??
          item.soldQuantity15d ??
          0,
      
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
        case 'title': return String(item.title || '').toLowerCase();
        case 'seller': return String(item.sellerName || '').toLowerCase();
        case 'soldQuantity': return Number(item.soldQuantity || 0);
        case 'priceValue': return Number(item.priceValue || 0);
        default: return '';
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
      return { averagePrice: 0, medianPrice: 0, minPrice: 0, maxPrice: 0, withFreeShipping: 0 };
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
    const query = new URLSearchParams({ openSearch: '1', sellerUsername: seller, offset: '0' });
    window.open(`/market-analysis?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleToggleSavedSeller = useCallback(async (sellerName) => {
    const seller = String(sellerName || '').replace(/\s+/g, ' ').trim();
    if (!seller) return;

    const sellerKey = normalizeSellerName(seller);
    setSavedSellerSaving(sellerKey);

    try {
      const response = await ebayAPI.toggleSavedSeller(seller);
      setSavedSellers(Array.isArray(response?.data?.savedSellers) ? response.data.savedSellers : []);
      setSavedSellersOpen(true);
    } catch (toggleError) {
      setError(toggleError?.response?.data?.error || toggleError?.message || 'Failed to update saved sellers');
    } finally {
      setSavedSellerSaving('');
    }
  }, [setError]);

  const handleOpenSavedSeller = (sellerName) => {
    const seller = String(sellerName || '').trim();
    if (!seller) return;
    handleSellerClick(seller);
  };

  const handleTitleSearch = (item) => {
    const titleQuery = String(item?.title || '').trim();
    if (!titleQuery) return;
    rememberRecentValue('titles', titleQuery);
    const nextParams = { ...params, q: titleQuery, sellerUsername: '', offset: 0 };
    openSearchInNewTab(nextParams);
  };

  const handleSellSimilar = async (source) => {
    const listingId = resolveLegacyListingId(source);
    if (!listingId) {
      setError('Sell Similar requires a live numeric eBay listing ID (Item ID).');
      return;
    }

    const result = await Swal.fire({
      title: t('marketListingDetailPage.openEbaySellSimilarTitle'),
      text: t('marketListingDetailPage.openEbaySellSimilarText'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('marketListingDetailPage.proceedToEbay'),
      cancelButtonText: t('marketListingDetailPage.cancel'),
      reverseButtons: true,
      focusCancel: true,
    });

    if (!result.isConfirmed) return;

    const url = `https://www.ebay.com/lstng?mode=SellLikeItem&itemId=${encodeURIComponent(listingId)}&sr=wn`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const onNextPage = () => {
    const nextPageOffset = Number.isFinite(Number(nextOffset))
      ? Number(nextOffset)
      : Number(params.offset || 0) + Number(params.limit || 12);
    const nextParams = {
      ...params,
      offset: nextPageOffset,
    };
    setParams(nextParams);
    runSearch(nextParams);
  };

  const onPrevPage = () => {
    const nextParams = {
      ...params,
      offset: Math.max(0, Number(params.offset || 0) - Number(params.limit || 12)),
    };
    setParams(nextParams);
    runSearch(nextParams);
  };

  // ── Bucket helpers ───────────────────────────────────────────────────────────
  const bucketItemIds = useMemo(() => new Set(bucket.items.map((b) => b.id)), [bucket.items]);
  const savedSellerKeys = useMemo(
    () => new Set(savedSellers.map((entry) => normalizeSellerName(entry.sellerName))),
    [savedSellers]
  );
  const sortedSavedSellers = useMemo(
    () => [...savedSellers].sort((a, b) => String(a.sellerName || '').localeCompare(String(b.sellerName || ''))),
    [savedSellers]
  );

  return (
    <div className="page-shell space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t('marketAnalysisPage.title')}</h1>
          <p className="page-subtitle">
            {t('marketAnalysisPage.subtitle')}
          </p>
        </div>
        <button type="button" onClick={() => searchNow(params)} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} />
          {t('marketAnalysisPage.refresh')}
        </button>
        <button type="button" onClick={clearCache} className="btn-secondary flex items-center gap-2">
          {t('marketAnalysisPage.clearCache')}
        </button>
        <button
          type="button"
          onClick={() => setSavedSellersOpen((prev) => !prev)}
          className="btn-secondary flex items-center gap-2"
        >
          <Heart size={14} fill="currentColor" className="text-rose-500" />
          {t('marketAnalysisPage.savedSellers')} ({savedSellers.length})
        </button>
      </header>

      {savedSellersOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setSavedSellersOpen(false)}
            aria-label={t('marketAnalysisPage.closeSavedSellers')}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-[420px] border-l border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {t('marketAnalysisPage.savedSellers')}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                    {t('marketAnalysisPage.savedSellersHint')}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                  onClick={() => setSavedSellersOpen(false)}
                  aria-label={t('marketAnalysisPage.closeSavedSellers')}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button type="button" className="btn-secondary" onClick={loadSavedSellers} disabled={savedSellersLoading}>
                    {savedSellersLoading ? t('marketAnalysisPage.savedSellersLoading') : t('marketAnalysisPage.refresh')}
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {savedSellers.length}
                  </span>
                </div>

                {savedSellersLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    {t('marketAnalysisPage.savedSellersLoading')}
                  </div>
                ) : sortedSavedSellers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    {t('marketAnalysisPage.savedSellersEmpty')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedSavedSellers.map((seller) => {
                      const sellerName = String(seller.sellerName || '').trim();
                      const sellerKey = normalizeSellerName(sellerName);
                      const isSaved = savedSellerKeys.has(sellerKey);
                      const busy = savedSellerSaving === sellerKey;
                      return (
                        <div
                          key={seller.id || sellerKey}
                          className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-[1px] hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSaved ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-300'}`}>
                            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} strokeWidth={2} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => handleOpenSavedSeller(sellerName)}
                              className="block w-full truncate text-left text-sm font-semibold text-blue-700 transition hover:underline dark:text-blue-400"
                              title={sellerName}
                            >
                              {sellerName}
                            </button>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {t('marketAnalysisPage.openSavedSeller')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleSavedSeller(sellerName)}
                            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition ${isSaved ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-950' : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-rose-300'}`}
                            aria-label={isSaved ? t('marketItemCard.unsaveSeller') : t('marketItemCard.saveSeller')}
                            title={isSaved ? t('marketItemCard.unsaveSeller') : t('marketItemCard.saveSeller')}
                            disabled={busy}
                          >
                            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} strokeWidth={2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {error && (
        <Alert
          type="error"
          message={error}
          autoClose={false}
          actionLabel={t('marketAnalysisPage.retrySearch')}
          onAction={() => searchNow(params)}
          onClose={() => setError(null)}
        />
      )}

      <div data-tour="market-analysis-search">
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
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketAnalysisPage.results')}</p>
          <p className="text-lg font-semibold">{filteredResults.length || 0}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketAnalysisPage.averageItem')}</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.averagePrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketAnalysisPage.median')}</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.medianPrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketAnalysisPage.range')}</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.minPrice)} - {formatCurrency(metrics.maxPrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketAnalysisPage.freeShipping')}</p>
          <p className="text-lg font-semibold">{metrics.withFreeShipping}%</p>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-12 space-y-4">
          <div className="flex justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 px-3 py-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 whitespace-nowrap">{t('marketAnalysisPage.profitCalc')}</span>
              <input
                type="number" min="0" step="0.01"
                value={calcAmazonPrice} onChange={(e) => setCalcAmazonPrice(e.target.value)}
                placeholder={t('marketAnalysisPage.profitAmazon')} className="input-base w-[96px] h-9 text-xs"
              />
              <input
                type="number" min="0" step="0.01"
                value={calcEbayPrice} onChange={(e) => setCalcEbayPrice(e.target.value)}
                placeholder={t('marketAnalysisPage.profitEbay')} className="input-base w-[96px] h-9 text-xs"
              />
              <input
                type="number" min="0" step="0.01"
                value={calcAdRate} onChange={(e) => setCalcAdRate(e.target.value)}
                placeholder={t('marketAnalysisPage.profitRate')} className="input-base w-[88px] h-9 text-xs"
              />
              <div className="min-w-[88px] text-xs font-semibold text-slate-900 dark:text-slate-100">
                {inlineProfit === null ? t('marketAnalysisPage.profitNone') : `${t('marketAnalysisPage.profitLabel')} ${formatCurrency(inlineProfit)}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`btn-secondary flex items-center gap-1 ${viewMode === 'card' ? 'ring-2 ring-blue-300' : ''}`}
            >
              <LayoutGrid size={14} /> Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`btn-secondary flex items-center gap-1 ${viewMode === 'list' ? 'ring-2 ring-blue-300' : ''}`}
            >
              <List size={14} /> List
            </button>
          </div>

          {loading ? (
            <LoadingSpinner message={t('marketAnalysisPage.loading')} />
          ) : sortedResults.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <SearchCheck size={28} className="mx-auto text-slate-400" />
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                {t('marketAnalysisPage.emptyResults')}
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
                      isSellerSaved={savedSellerKeys.has(normalizeSellerName(item.sellerName))}
                      onSelect={handleSelect}
                      onInspect={handleInspect}
                      onSellerClick={handleSellerClick}
                      onSearchTitle={handleTitleSearch}
                      onSellSimilar={handleSellSimilar}
                      onToggleSeller={handleToggleSavedSeller}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3">{t('marketAnalysisPage.imageHeader')}</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('title')} className="hover:underline">
                            {renderSortLabel(t('marketAnalysisPage.titleHeader'), 'title')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('seller')} className="hover:underline">
                            {renderSortLabel(t('marketAnalysisPage.sellerHeader'), 'seller')}
                          </button>
                        </th>
                        <th className="text-left p-3">F/Score</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('soldQuantity')} className="hover:underline">
                            {renderSortLabel('Last 7d', 'soldQuantity')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          Last 15d
                        </th>
                        <th className="text-left p-3">{t('marketAnalysisPage.historyHeader')}</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('priceValue')} className="hover:underline">
                            {renderSortLabel(t('marketAnalysisPage.priceHeader'), 'priceValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">{t('marketAnalysisPage.actionsHeader')}</th>
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
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">{t('marketAnalysisPage.noImage')}</div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 max-w-[220px] truncate text-xs">
                            <button
                              type="button"
                              onClick={() => item.itemWebUrl && window.open(item.itemWebUrl, '_blank', 'noopener,noreferrer')}
                              className="text-left hover:underline"
                              title={item.itemWebUrl ? t('marketAnalysisPage.openOnEbay') : t('marketAnalysisPage.ebayLinkUnavailable')}
                            >
                              {item.title}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleSellerClick(item.sellerName)}
                                className="text-blue-700 dark:text-blue-400 hover:underline"
                              >
                                {item.sellerName || t('marketAnalysisPage.unknownSeller')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleSavedSeller(item.sellerName)}
                                className={`inline-flex items-center justify-center rounded-full transition ${savedSellerKeys.has(normalizeSellerName(item.sellerName)) ? 'text-rose-600 hover:text-rose-700' : 'text-slate-400 hover:text-rose-600'}`}
                                aria-label={savedSellerKeys.has(normalizeSellerName(item.sellerName)) ? t('marketItemCard.unsaveSeller') : t('marketItemCard.saveSeller')}
                                title={savedSellerKeys.has(normalizeSellerName(item.sellerName)) ? t('marketItemCard.unsaveSeller') : t('marketItemCard.saveSeller')}
                                disabled={savedSellerSaving === normalizeSellerName(item.sellerName)}
                              >
                                <Heart size={14} fill={savedSellerKeys.has(normalizeSellerName(item.sellerName)) ? 'currentColor' : 'none'} strokeWidth={2} />
                              </button>
                              {renderSellerCountryFlag(item.sellerCountryCode)}
                            </div>
                          </td>
                          <td className="p-3 font-medium">{Number(item.sellerFeedback || 0)}</td>
                          <td className="p-3 font-medium">
                            {item?.soldLoading ? (
                              <span
                                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent align-middle"
                                aria-label={t('marketAnalysisPage.loadingSoldQuantity')}
                                title={t('marketAnalysisPage.loadingSoldQuantity')}
                              />
                            ) : (
                              Number(item.soldQuantity || 0)
                            )}
                          </td>
                          
                          <td className="p-3 font-medium">
                            {item?.soldLoading ? (
                              <span
                                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent align-middle"
                              />
                            ) : (
                              Number(item.soldQuantity15d || 0)
                            )}
                          </td>
                          <td className="p-3">
                            <button
                              type="button"
                              className="btn-secondary inline-flex items-center justify-center"
                              onClick={() => handleViewHistory(item)}
                              title={t('marketAnalysisPage.seeHistory')}
                              aria-label={t('marketAnalysisPage.seeHistory')}
                            >
                              <History size={14} />
                            </button>
                          </td>
                          <td className="p-3">{formatCurrency(item.priceValue)}</td>
                          <td className="p-3">
                            {(() => {
                              const amazonSearchUrl = buildAmazonSearchUrlFromTitle(item?.title);
                              return (
                                <div className="flex gap-2 flex-wrap items-center">
                                  {amazonSearchUrl && (
                                    <a
                                      href={amazonSearchUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="btn-secondary"
                                      title={t('marketAnalysisPage.searchOnAmazon')}
                                      aria-label={t('marketAnalysisPage.searchOnAmazon')}
                                    >
                                      <img src={AMAZON_ICON_URL} alt="Amazon" className="h-3.5 w-3.5" loading="lazy" />
                                    </a>
                                  )}

                                  <AddToBucketButton
                                    item={item}
                                    onAdd={handleAddToBucket}
                                    isDark={isDark}
                                    isInBucket={bucketItemIds.has(item.id)}
                                    isScraping={scrapingIds.has(item.id)}
                                  />

                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleTitleSearch(item)}
                                    title={t('marketAnalysisPage.searchTitleNewTab')}
                                  >
                                    <Search size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleSellSimilar(item)}
                                  >
                                    {t('marketListingDetailPage.sellSimilar')}
                                  </button>
                                  <button type="button" className="btn-primary" onClick={() => handleInspect(item)}>
                                    {t('marketAnalysisPage.details')}
                                  </button>
                                  <button type="button" className="btn-secondary" onClick={() => handleSelect(item)}>
                                    {selectedIds.includes(item.id) ? 'Selected' : 'Compare'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => handleListOnEbay(item)}
                                    title={t('marketAnalysisPage.listOnEbayTitle')}
                                  >
                                    {t('marketAnalysisPage.listOnEbay')}
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {t('marketAnalysisPage.showingResults', { count: sortedResults.length })}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" onClick={onPrevPage} disabled={params.offset <= 0}>
                    {t('marketAnalysisPage.previous')}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onNextPage}
                    disabled={!canNextPage}
                  >
                    {t('marketAnalysisPage.next')}
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

      {/* ── Single-item ListOnEbayModal (unchanged flow) ── */}
      {ebayListModal && (
        <ListOnEbayModal
          item={ebayListModal}
          isDark={isDark}
          onClose={() => setEbayListModal(null)}
        />
      )}

      {historyModal && (
        <PurchaseHistoryModal
          state={historyModal}
          onClose={() => setHistoryModal(null)}
        />
      )}

      {/* ── Floating bucket trigger ── */}
      <BucketTrigger
        count={bucket.items.length}
        onClick={() => setBucketOpen(true)}
        isDark={isDark}
      />

      {/* ── Bucket drawer ── */}
      <BucketDrawer
        open={bucketOpen}
        onClose={() => setBucketOpen(false)}
        items={bucket.items}
        successfulListings={bucket.successfulListings}
        onRemove={bucket.removeFromBucket}
        onClear={bucket.clearBucket}
        onAddSuccessfulListing={bucket.addSuccessfulListing}
        onUpdateItem={bucket.updateBucketItem}
        isDark={isDark}
      />
    </div>
  );
}
