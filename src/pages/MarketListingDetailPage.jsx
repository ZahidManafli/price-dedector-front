import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, ExternalLink, History, LayoutGrid, List, Search, Store } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import ListOnEbayModal from '../components/ListOnEbayModal';
import { useBucket, BucketTrigger, BucketDrawer, AddToBucketButton } from '../components/EbayBucket';
import { useTheme } from '../context/ThemeContext';
import { browseAPI, ebayAPI } from '../services/api';
import PurchaseHistoryModal from '../components/PurchaseHistoryModal';
import { calculateLast7DaysSoldCount, calculateLast15DaysSoldCount, fetchPurchaseHistoryRows, normalizeNumericItemId } from '../utils/purchaseHistory';
import { countryCodeToFlagEmoji, formatCurrency } from '../utils/helpers';

function normalizeSoldQuantity(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizeSummary(summary) {
  const salesRaw = summary?.sales ?? summary?.raw?.sales;
  const sales = typeof salesRaw === 'number' ? salesRaw : Number(salesRaw);
  const totalQuantitySold = summary?.totalQuantitySold ?? summary?.totalSoldQuantity ?? summary?.quantitySold;
  return {
    id: summary?.itemId || summary?.itemID || summary?.legacyItemId || '',
    legacyItemId: normalizeNumericItemId(summary?.legacyItemId || summary?.itemId || summary?.itemID),
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.imageUrl || summary?.images || summary?.thumbnailImages?.[0]?.imageUrl || summary?.ebayImage || '',
    priceValue: Number(summary?.price?.value ?? summary?.currentPrice ?? summary?.price ?? 0),
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    soldQuantity: normalizeSoldQuantity(summary?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity ?? summary?.sevenDaysSales ?? sales),
    soldQuantity14d: normalizeSoldQuantity(summary?.fourteenDaysSales),
    soldQuantity30d: normalizeSoldQuantity(summary?.thirtyDaysSales),
    totalSoldQuantity: normalizeSoldQuantity(totalQuantitySold),
    condition: summary?.condition || 'Unknown',
    sellerName: summary?.seller?.username || summary?.sellerName || summary?.sellerUsername || '',
    sellerFeedback: Number(summary?.seller?.feedbackScore || summary?.feedbackScore || summary?.feedBackScore || summary?.feedback || 0),
    sellerCountryCode: summary?.itemLocation?.country || summary?.itemLocation?.countryCode || summary?.seller?.location?.country || summary?.seller?.countryCode || summary?.shippingCountry || summary?.countryCode || '',
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || summary?.productUrl || '',
  };
}

function getSellerListingRows(payload, { isFastMode = false } = {}) {
  const candidates = [
    payload?.rows,
    payload?.itemSummaries,
    payload?.result?.data,
    payload?.raw?.result?.data,
    payload?.raw?.result?.sellers,
    payload?.result?.sellers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }

  if (isFastMode && Array.isArray(payload?.raw?.result?.data)) {
    return payload.raw.result.data;
  }

  return [];
}

function getSellerListingTotal(payload, fallbackCount = 0, { isFastMode = false } = {}) {
  const candidates = isFastMode
    ? [
        payload?.raw?.result?.recordsFiltered,
        payload?.raw?.result?.recordsTotal,
        payload?.total,
        payload?.result?.recordsFiltered,
        payload?.result?.recordsTotal,
      ]
    : [
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
    if (Number.isFinite(value) && value >= 0) return value;
  }

  return fallbackCount;
}

const AMAZON_ICON_URL = 'https://www.amazon.com/favicon.ico';

function buildAmazonSearchUrlFromTitle(title) {
  const query = String(title || '').trim();
  if (!query) return '';
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

export default function MarketListingDetailPage() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchType = String(searchParams.get('type') || '').trim().toLowerCase();
  const isFastMode = searchType === 'fast';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerError, setSellerError] = useState(null);
  const [sellerListings, setSellerListings] = useState([]);
  const [sellerTotal, setSellerTotal] = useState(0);
  const [sellerOffset, setSellerOffset] = useState(0);
  const [sellerLimit] = useState(12);
  const [sellerViewMode, setSellerViewMode] = useState('list');
  const [sellerSortConfig, setSellerSortConfig] = useState({ key: 'soldQuantity', direction: 'desc' });
  const [sellerSoldQuantityDeferred, setSellerSoldQuantityDeferred] = useState(false);
  const [sellerPendingSoldItems, setSellerPendingSoldItems] = useState([]);
  const [sellerSoldStatsByItemId, setSellerSoldStatsByItemId] = useState({});
  const [sellerSoldLoadingByItemId, setSellerSoldLoadingByItemId] = useState({});
  const [ebayListModal, setEbayListModal] = useState(null);
  const sellerPurchaseHistoryQueueRef = useRef(false);
  const bucket = useBucket();
  const [historyModal, setHistoryModal] = useState(null);
// shape: null | { loading: bool, jobId: string|null, data: array|null, error: string|null }
  const [bucketOpen, setBucketOpen] = useState(false);
  const [scrapingIds, setScrapingIds] = useState(new Set());

  const backQuery = useMemo(() => {
    const q = searchParams.get('q') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const sellerUsername = searchParams.get('sellerUsername') || '';
    const type = searchParams.get('type') || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categoryId) params.set('categoryId', categoryId);
    if (sellerUsername) params.set('sellerUsername', sellerUsername);
    if (type) params.set('type', type);
    return params.toString();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await browseAPI.getItem(itemId, 'PRODUCT,ADDITIONAL_SELLER_DETAILS');
        if (!cancelled) {
          setDetail(res?.data?.data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Failed to load listing details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (itemId) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const sold = Number(detail?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0);
  const available = Number(detail?.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity || 0);
  const totalQty = sold + available;
  const successRate = totalQty > 0 ? Math.round((sold / totalQty) * 100) : null;
  const purchaseHistoryItemId = useMemo(() => {
    const legacy = String(detail?.legacyItemId || '').trim();
    if (legacy) return legacy;
    const fromDetail = String(detail?.itemId || '').trim();
    if (fromDetail.includes('|')) {
      const splitId = fromDetail.split('|')?.[1] || '';
      if (splitId) return splitId;
    }
    const fromParam = String(itemId || '').trim();
    if (fromParam.includes('|')) {
      const splitId = fromParam.split('|')?.[1] || '';
      if (splitId) return splitId;
    }
    return fromParam;
  }, [detail, itemId]);

  const sellerCountryFlag = countryCodeToFlagEmoji(
    detail?.itemLocation?.country ||
      detail?.itemLocation?.countryCode ||
      detail?.seller?.location?.country ||
      detail?.seller?.countryCode ||
      ''
  );
  const detailAmazonSearchUrl = buildAmazonSearchUrlFromTitle(detail?.title);
  const selectedSellerUsername = String(searchParams.get('sellerUsername') || detail?.seller?.username || '').trim();
  const sellerSortOptions = [
    { value: 'soldQuantity', label: t('marketListingDetailPage.soldQty') },
    { value: 'title', label: t('marketListingDetailPage.title') },
    { value: 'priceValue', label: t('marketListingDetailPage.itemPrice') },
  ];

  const handleListOnEbay = useCallback((item) => {
    setEbayListModal(item);
  }, []);

  const handleAddToBucket = useCallback(async (item) => {
    const itemIdValue = item?.id;
    if (!itemIdValue) return;

    setScrapingIds((prev) => new Set([...prev, itemIdValue]));

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

      if (item.itemWebUrl) {
        try {
          const res = await browseAPI.scrapeItemDetails(item.itemWebUrl);
          const scraped = res?.data || {};
          if (scraped?.success) {
            scrapedData = {
              ...scrapedData,
              categoryId: scraped.categoryId || '',
              categoryName: scraped.categoryName || '',
              itemSpecifics: scraped.itemSpecifics || [],
              pictureUrls: scraped.pictureUrls?.length ? scraped.pictureUrls : scrapedData.pictureUrls,
            };
          }
        } catch (scrapeErr) {
          console.warn('[market-detail bucket] scrape failed, using basic data:', scrapeErr?.message);
        }
      }

      bucket.addToBucket(item, scrapedData);
      setBucketOpen(true);
    } finally {
      setScrapingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemIdValue);
        return next;
      });
    }
  }, [bucket]);

  const openExternalItem = (url) => {
    const next = String(url || '').trim();
    if (!next) return;
    window.open(next, '_blank', 'noopener,noreferrer');
  };

  const resolveLegacyListingId = (source) => {
    const candidates = [
      source?.legacyItemId,
      source?.raw?.legacyItemId,
      source?.itemId,
      source?.raw?.itemId,
      source?.id,
      itemId,
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

  const handleLoadSellerListings = async (nextOffset = 0) => {
    const sellerUsername = selectedSellerUsername;
    if (!sellerUsername) {
      setSellerError(t('marketListingDetailPage.sellerUsernameUnavailable'));
      return;
    }

    try {
      setSellerLoading(true);
      setSellerError(null);
      const sellerSearchLimit = isFastMode ? 20 : sellerLimit;
      const response = await browseAPI.search({
        sellerUsername,
        ...(isFastMode ? { type: 'fast', autoCorrect: true } : { categoryId: '0' }),
        limit: sellerSearchLimit,
        offset: nextOffset,
        fieldgroups: isFastMode ? 'ASPECT_REFINEMENTS,MATCHING_ITEMS' : 'EXTENDED',
        ...(isFastMode ? {} : { type: 'slow' }),
      });
      const payload = response?.data?.data || {};
      const rows = getSellerListingRows(payload, { isFastMode });
      const normalizedRows = rows.map(normalizeSummary);
      setSellerListings(normalizedRows);
      setSellerSoldQuantityDeferred(false);
      setSellerPendingSoldItems(isFastMode ? [] : normalizedRows);
      setSellerSoldStatsByItemId({});
      setSellerSoldLoadingByItemId({});
      setSellerTotal(getSellerListingTotal(payload, normalizedRows.length, { isFastMode }));
      setSellerOffset(nextOffset);
    } catch (err) {
      setSellerError(err?.response?.data?.error || err?.message || t('marketListingDetailPage.failedToLoadSellerListings'));
      setSellerListings([]);
      setSellerSoldQuantityDeferred(false);
      setSellerPendingSoldItems([]);
      setSellerSoldStatsByItemId({});
      setSellerSoldLoadingByItemId({});
      setSellerTotal(0);
      setSellerOffset(0);
    } finally {
      setSellerLoading(false);
    }
  };

  const handleSearchItem = (item) => {
    const titleQuery = String(item?.title || '').trim();
    if (!titleQuery) return;

    const query = new URLSearchParams({
      openSearch: '1',
      q: titleQuery,
      offset: '0',
      categoryId: '',
      sellerUsername: '',
    });
    window.open(`/market-analysis?${query.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const resolvePurchaseHistoryItemIdFromItem = (item) => {
    const directLegacy = normalizeNumericItemId(item?.legacyItemId || item?.id);
    if (directLegacy) return directLegacy;

    const fromUrl = normalizeNumericItemId(item?.itemWebUrl || '');
    if (fromUrl) return fromUrl;

    return '';
  };

  const handleSellerItemHistory = useCallback(async (item) => {
    const resolvedItemId = resolvePurchaseHistoryItemIdFromItem(item);
    if (!resolvedItemId) return;
  
    setHistoryModal({ loading: true, jobId: null, data: null, error: null });
  
    try {
      const rows = await fetchPurchaseHistoryRows(resolvedItemId);
      setHistoryModal({
        loading: false,
        jobId: resolvedItemId,
        data: Array.isArray(rows) ? rows : [],
        error: null,
      });
    } catch (err) {
      setHistoryModal({
        loading: false,
        jobId: null,
        data: null,
        error: err?.response?.data?.error || err?.message || 'Request failed',
      });
    }
  }, []);

  const sortedSellerListings = useMemo(() => {
    const hydratedSellerListings = sellerListings.map((item) => {
      const key = String(item?.id || '').trim();
      const stats = sellerSoldStatsByItemId[key];
      const fastRow7d = item?.soldQuantity ?? item?.sold7d ?? 0;
      const fastRow14d = item?.soldQuantity14d ?? item?.sold14d ?? 0;
      const fastRow30d = item?.soldQuantity30d ?? item?.sold30d ?? 0;
      const fastRowTotal = item?.totalSoldQuantity ?? 0;

      return {
        ...item,
        sold7d: isFastMode ? fastRow7d : (stats?.sold7d ?? 0),
        sold14d: isFastMode ? fastRow14d : (stats?.sold15d ?? 0),
        sold30d: isFastMode ? fastRow30d : 0,
        totalSoldQuantity: isFastMode ? fastRowTotal : 0,
        soldLoading: isFastMode ? false : Boolean(sellerSoldLoadingByItemId[key]),
      };
    });

    const data = [...hydratedSellerListings];
    const { key, direction } = sellerSortConfig;
    if (!key) return data;

    const getValue = (item) => {
      switch (key) {
        case 'title':
          return String(item.title || '').toLowerCase();
        case 'soldQuantity':
          return Number(item.sold7d || 0);
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
  }, [sellerListings, sellerSortConfig, sellerSoldStatsByItemId, sellerSoldLoadingByItemId, isFastMode]);

  const toggleSellerSort = (key) => {
    setSellerSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const renderSellerSortLabel = (label, key) => {
    if (sellerSortConfig.key !== key) return label;
    return `${label} ${sellerSortConfig.direction !== 'asc' ? '▲' : '▼'}`;
  };

  const handleSellerSortFieldChange = (key) => {
    if (!key) return;
    setSellerSortConfig((prev) => ({
      key,
      direction: prev.key === key ? prev.direction : 'asc',
    }));
  };

  const toggleSellerSortDirection = () => {
    setSellerSortConfig((prev) => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  useEffect(() => {
    if (!selectedSellerUsername) return;
    handleLoadSellerListings(0);
  }, [selectedSellerUsername, isFastMode]);

  useEffect(() => {
    if (isFastMode) return undefined;
    if (!Array.isArray(sellerPendingSoldItems) || !sellerPendingSoldItems.length) return;
    if (sellerPurchaseHistoryQueueRef.current) return;
  
    let cancelled = false;
    sellerPurchaseHistoryQueueRef.current = true;
  
    const loadingMap = {};
    for (const item of sellerPendingSoldItems) {
      if (item?.id) loadingMap[item.id] = true;
    }
    if (Object.keys(loadingMap).length) {
      setSellerSoldLoadingByItemId(loadingMap);
    }
  
    (async () => {
      for (const item of sellerPendingSoldItems) {
        if (cancelled) break;
        const key = String(item?.id || '').trim();
        const resolvedId =
          normalizeNumericItemId(item?.id) ||
          normalizeNumericItemId(item?.legacyItemId) ||
          normalizeNumericItemId(item?.itemWebUrl);
  
        if (!resolvedId) {
          if (key) setSellerSoldLoadingByItemId((prev) => ({ ...prev, [key]: false }));
          continue;
        }
  
        try {
          const rows = await fetchPurchaseHistoryRows(resolvedId);
          const sold7d = calculateLast7DaysSoldCount(rows);
          const sold15d = calculateLast15DaysSoldCount(rows);
          
          if (!cancelled && key) {
            setSellerSoldStatsByItemId((prev) => ({
              ...prev,
              [key]: {
                sold7d,
                sold15d,
              },
            }));
          }
        } catch {
          if (!cancelled && key) {
            setSellerSoldStatsByItemId((prev) => ({
              ...prev,
              [key]: {
                sold7d: 0,
                sold15d: 0,
              },
            }));
          }
        } finally {
          if (!cancelled && key) {
            setSellerSoldLoadingByItemId((prev) => ({ ...prev, [key]: false }));
          }
        }
      }
  
      if (!cancelled) {
        setSellerPendingSoldItems([]);
        setSellerSoldQuantityDeferred(false);
      }
      sellerPurchaseHistoryQueueRef.current = false;
    })().catch(() => {
      sellerPurchaseHistoryQueueRef.current = false;
    });
  
    return () => {
      cancelled = true;
      sellerPurchaseHistoryQueueRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerPendingSoldItems, isFastMode]);

  const renderSellerSoldValue = (item, type = '7d') => {
    const key = String(item?.id || '').trim();
    const isLoading = !!sellerSoldLoadingByItemId[key];
  
    if (isLoading || sellerSoldQuantityDeferred) {
      return (
        <span className="inline-flex items-center justify-center w-4 h-4">
          <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        </span>
      );
    }
  
    if (type === '14d') {
      return String(Number(item?.soldQuantity14d ?? item?.sold15d ?? 0));
    }

    if (type === '30d') {
      return String(Number(item?.soldQuantity30d || 0));
    }

    if (type === 'total') {
      return String(Number(item?.totalSoldQuantity || 0));
    }
  
    return String(Number(item?.soldQuantity || item?.sold7d || 0));
  };

  if (loading) {
    return <LoadingSpinner message={t('marketListingDetailPage.loadingListingDetails')} />;
  }

  return (
    <div className="page-shell space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(backQuery ? `/market-analysis?${backQuery}` : '/market-analysis')}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={14} />
          {t('marketListingDetailPage.backToAnalysis')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleSellSimilar(detail)}
          >
            {t('marketListingDetailPage.sellSimilar')}
          </button>
          {detailAmazonSearchUrl && (
            <a
              href={detailAmazonSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary flex items-center gap-2"
              title={t('marketListingDetailPage.searchOnAmazon')}
              aria-label={t('marketListingDetailPage.searchOnAmazon')}
            >
              <img src={AMAZON_ICON_URL} alt="Amazon" className="h-4 w-4" loading="lazy" />
              Amazon
            </a>
          )}
            {detail?.itemWebUrl && (
            <a href={detail.itemWebUrl} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2">
              {t('marketListingDetailPage.openOnEbay')}
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
      )}

      {detail && (
        <>
          <section className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600/10 to-emerald-600/10 p-5 border-b border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => openExternalItem(detail?.itemWebUrl)}
                className="text-left text-xl font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 hover:underline"
                title={detail?.itemWebUrl ? t('marketListingDetailPage.openOnEbay') : t('marketListingDetailPage.ebayLinkUnavailable')}
              >
                {detail.title}
              </button>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{detail.shortDescription || t('marketListingDetailPage.detailSubtitle')}</p>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {detail?.image?.imageUrl ? (
                    <img src={detail.image.imageUrl} alt={detail.title} className="w-full h-[300px] object-cover" />
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">{t('marketListingDetailPage.noImage')}</div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.itemPrice')}</p>
                  <p className="text-xl font-semibold">{formatCurrency(Number(detail?.price?.value || 0))}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.condition')}</p>
                  <p className="text-xl font-semibold">{detail?.condition || 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.seller')}</p>
                  <button
                    type="button"
                    onClick={handleLoadSellerListings}
                    className="mt-1 text-left text-xl font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {detail?.seller?.username || t('marketListingDetailPage.unknownSeller')}
                  </button>
                  {sellerCountryFlag ? <span className="ml-2 align-middle">{sellerCountryFlag}</span> : null}
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.soldCount')}</p>
                  <p className="text-xl font-semibold">{sold}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.sellingSuccess')}</p>
                  <p className="text-xl font-semibold">{successRate !== null ? `${successRate}%` : 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 md:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.sellingHistory')}</p>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 mt-2"
                    disabled={!purchaseHistoryItemId}
                    onClick={async () => {
                      if (!purchaseHistoryItemId) return;
                      setHistoryModal({ loading: true, jobId: null, data: null, error: null });
                      try {
                        const rows = await fetchPurchaseHistoryRows(purchaseHistoryItemId);
                        setHistoryModal({
                          loading: false,
                          jobId: purchaseHistoryItemId,
                          data: Array.isArray(rows) ? rows : [],
                          error: null,
                        });
                      } catch (err) {
                        setHistoryModal({
                          loading: false,
                          jobId: null,
                          data: null,
                          error: err?.response?.data?.error || err?.message || 'Request failed',
                        });
                      }
                    }}
                  >
                    <History size={14} />
                    {t('marketListingDetailPage.seeSellingHistory')}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Store size={18} />
                {t('marketListingDetailPage.sellerListings')}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellerViewMode('list')}
                  className={`btn-secondary flex items-center gap-1 ${sellerViewMode === 'list' ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <List size={14} />
                  {t('marketListingDetailPage.list')}
                </button>
                <button
                  type="button"
                  onClick={() => setSellerViewMode('card')}
                  className={`btn-secondary flex items-center gap-1 ${sellerViewMode === 'card' ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <LayoutGrid size={14} />
                  {t('marketListingDetailPage.card')}
                </button>
                <select
                  className="input-base w-[160px]"
                  value={sellerSortConfig.key}
                  onChange={(e) => handleSellerSortFieldChange(e.target.value)}
                >
                  {sellerSortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={toggleSellerSortDirection}
                  title={sellerSortConfig.direction === 'asc' ? t('marketListingDetailPage.sortDescending') : t('marketListingDetailPage.sortAscending')}
                >
                  {sellerSortConfig.direction === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleLoadSellerListings(0)}>
                  {t('marketListingDetailPage.loadSellerListings')}
                </button>
              </div>
            </div>

            {sellerError && (
              <div className="mb-3">
                <Alert type="warning" message={sellerError} onClose={() => setSellerError(null)} autoClose={false} />
              </div>
            )}

            {sellerLoading ? (
              <LoadingSpinner message={t('marketListingDetailPage.loadingSellerListings')} />
            ) : sortedSellerListings.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">{t('marketListingDetailPage.emptySellerListings')}</p>
            ) : (
              sellerViewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sortedSellerListings.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-400 transition"
                    >
                      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">{t('marketListingDetailPage.noImage')}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openExternalItem(item.itemWebUrl)}
                        className="text-left text-sm font-semibold line-clamp-2 text-slate-900 dark:text-slate-100 hover:underline"
                        title={item.itemWebUrl ? t('marketListingDetailPage.openOnEbay') : t('marketListingDetailPage.ebayLinkUnavailable')}
                      >
                              {item.title}
                      </button>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{item.condition || t('marketListingDetailPage.na')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        {t('marketListingDetailPage.soldQty')}: <span className="font-semibold">{renderSellerSoldValue(item, '7d')}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        14D Sold: <span className="font-semibold">{renderSellerSoldValue(item, '14d')}</span>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        30D Sold: <span className="font-semibold">{renderSellerSoldValue(item, '30d')}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.priceValue)}
                        </p>
                        {buildAmazonSearchUrlFromTitle(item?.title) && (
                          <a
                            href={buildAmazonSearchUrlFromTitle(item?.title)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary text-xs px-2 py-1"
                            title={t('marketListingDetailPage.searchOnAmazon')}
                            aria-label={t('marketListingDetailPage.searchOnAmazon')}
                          >
                            <img src={AMAZON_ICON_URL} alt="Amazon" className="h-3.5 w-3.5" loading="lazy" />
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          onClick={() => handleSellerItemHistory(item)}
                          title={t('marketListingDetailPage.seeHistory')}
                          aria-label={t('marketListingDetailPage.seeHistory')}
                          disabled={!resolvePurchaseHistoryItemIdFromItem(item)}
                        >
                          <History size={14} />
                        </button>
                        <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => handleSearchItem(item)} title={t('marketListingDetailPage.searchThisTitle')}>
                          <Search size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3">{t('marketListingDetailPage.image')}</th>
                              <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('title')} className="hover:underline">
                            {renderSellerSortLabel(t('marketListingDetailPage.title'), 'title')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button
                            type="button"
                            onClick={() => toggleSellerSort('soldQuantity')}
                            className="hover:underline"
                          >
                            7D Sold
                          </button>
                        </th>
                        <th className="text-left p-3">
                          14D Sold
                        </th>
                        <th className="text-left p-3">
                          30D Sold
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('priceValue')} className="hover:underline">
                            {renderSellerSortLabel(t('marketListingDetailPage.itemPrice'), 'priceValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">{t('marketListingDetailPage.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSellerListings.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
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
                              onClick={() => openExternalItem(item.itemWebUrl)}
                              className="text-left hover:underline"
                              title={item.itemWebUrl ? 'Open on eBay' : 'eBay link unavailable'}
                            >
                              {item.title}
                            </button>
                          </td>
                          <td className="p-3 font-medium">
                            {renderSellerSoldValue(item, '7d')}
                          </td>
                          <td className="p-3 font-medium">
                            {renderSellerSoldValue(item, '14d')}
                          </td>
                          <td className="p-3 font-medium">
                            {renderSellerSoldValue(item, '30d')}
                          </td>
                          <td className="p-3">{formatCurrency(item.priceValue)}</td>
                          <td className="p-3">
                            <div className="flex gap-2 flex-wrap">
                              <Link
                                to={`/market-analysis/item/${encodeURIComponent(item.id)}?sellerUsername=${encodeURIComponent(selectedSellerUsername || '')}${isFastMode ? '&type=fast' : ''}`}
                                className="btn-primary"
                              >
                                {t('marketListingDetailPage.details')}
                              </Link>
                              <AddToBucketButton
                                item={item}
                                onAdd={handleAddToBucket}
                                isDark={isDark}
                                isInBucket={bucket.items.some((b) => b.id === item.id)}
                                isScraping={scrapingIds.has(item.id)}
                              />
                              {buildAmazonSearchUrlFromTitle(item?.title) && (
                                <a
                                  href={buildAmazonSearchUrlFromTitle(item?.title)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-secondary"
                                  title={t('marketListingDetailPage.searchOnAmazon')}
                                  aria-label={t('marketListingDetailPage.searchOnAmazon')}
                                >
                                  <img src={AMAZON_ICON_URL} alt="Amazon" className="h-3.5 w-3.5" loading="lazy" />
                                </a>
                              )}
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleSellerItemHistory(item)}
                                title={t('marketListingDetailPage.seeHistory')}
                                aria-label={t('marketListingDetailPage.seeHistory')}
                                disabled={!resolvePurchaseHistoryItemIdFromItem(item)}
                              >
                                <History size={14} />
                              </button>
                              <button type="button" className="btn-secondary" onClick={() => handleSearchItem(item)} title={t('marketListingDetailPage.searchThisTitle')}>
                                <Search size={14} />
                              </button>
                              <button type="button" className="btn-secondary" onClick={() => handleSellSimilar(item)}>
                                {t('marketListingDetailPage.sellSimilar')}
                              </button>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleListOnEbay(item)}
                                title={t('marketListingDetailPage.listOnEbayTitle')}
                              >
                                {t('marketListingDetailPage.listOnEbay')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <p className="text-sm text-slate-500 dark:text-slate-300">
                {t('marketListingDetailPage.showingResults', { count: sellerListings.length })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleLoadSellerListings(Math.max(0, sellerOffset - sellerLimit))}
                  disabled={sellerLoading || sellerOffset <= 0}
                >
                  {t('marketListingDetailPage.previous')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleLoadSellerListings(sellerOffset + sellerLimit)}
                  disabled={sellerLoading || sellerOffset + sellerLimit >= (sellerTotal || 0)}
                >
                  {t('marketListingDetailPage.next')}
                </button>
              </div>
            </div>
          </section>
        </>
      )}

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

      <BucketTrigger count={bucket.items.length} onClick={() => setBucketOpen(true)} isDark={isDark} />

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
