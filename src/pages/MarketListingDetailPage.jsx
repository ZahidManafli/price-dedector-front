import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowLeft, ArrowUpAZ, ExternalLink, LayoutGrid, List, Search, Store } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { browseAPI } from '../services/api';
import { countryCodeToFlagEmoji, formatCurrency } from '../utils/helpers';

function normalizeSoldQuantity(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function normalizeNumericItemId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{8,}$/.test(raw)) return raw;
  const parts = raw.split('|');
  if (parts.length >= 2 && /^\d{8,}$/.test(parts[1])) return parts[1];
  const match = raw.match(/\/itm\/(?:[^/]+\/)?(\d{8,})/);
  return match?.[1] ? String(match[1]) : '';
}

function normalizeSummary(summary) {
  return {
    id: summary?.itemId || '',
    legacyItemId: normalizeNumericItemId(summary?.legacyItemId || summary?.itemId),
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.thumbnailImages?.[0]?.imageUrl || '',
    priceValue: Number(summary?.price?.value || 0),
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    soldQuantity: normalizeSoldQuantity(summary?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity),
    condition: summary?.condition || 'Unknown',
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || '',
  };
}

const sellerSortOptions = [
  { value: 'soldQuantity', label: 'Sold Qty' },
  { value: 'title', label: 'Title' },
  { value: 'condition', label: 'Condition' },
  { value: 'priceValue', label: 'Item Price' },
];

export default function MarketListingDetailPage() {
  const MAX_SELLER_PAGES = 2;
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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
  const [sellerSoldLoadingByItemId, setSellerSoldLoadingByItemId] = useState({});

  const backQuery = useMemo(() => {
    const q = searchParams.get('q') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const sellerUsername = searchParams.get('sellerUsername') || '';
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categoryId) params.set('categoryId', categoryId);
    if (sellerUsername) params.set('sellerUsername', sellerUsername);
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

  const handleLoadSellerListings = async (nextOffset = 0) => {
    const safeNextOffset = Math.max(0, Number(nextOffset) || 0);
    const maxOffset = (MAX_SELLER_PAGES - 1) * sellerLimit;
    if (safeNextOffset > maxOffset) {
      return;
    }

    const sellerUsername = String(detail?.seller?.username || '').trim();
    if (!sellerUsername) {
      setSellerError('Seller username is not available for this listing.');
      return;
    }

    try {
      setSellerLoading(true);
      setSellerError(null);
      const response = await browseAPI.search({
        categoryId: '0',
        sellerUsername,
        limit: sellerLimit,
        offset: safeNextOffset,
        fieldgroups: 'EXTENDED',
      });
      const payload = response?.data?.data || {};
      const rows = Array.isArray(payload?.itemSummaries)
        ? payload.itemSummaries
        : [];
      const normalizedRows = rows.map(normalizeSummary);
      const deferred = !!payload?.soldQuantityDeferred;
      setSellerListings(normalizedRows);
      setSellerSoldQuantityDeferred(deferred);
      setSellerPendingSoldItems(deferred ? normalizedRows.filter((item) => item?.soldQuantity === null) : []);
      setSellerSoldLoadingByItemId({});
      setSellerTotal(Number(payload?.total || 0));
      setSellerOffset(safeNextOffset);
    } catch (err) {
      setSellerError(err?.response?.data?.error || err?.message || 'Failed to load seller listings');
      setSellerListings([]);
      setSellerSoldQuantityDeferred(false);
      setSellerPendingSoldItems([]);
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
    navigate('/market-analysis', {
      state: {
        presetSearch: {
          q: titleQuery,
          categoryId: '',
          sellerUsername: String(detail?.seller?.username || '').trim(),
        },
      },
    });
  };

  const sortedSellerListings = useMemo(() => {
    const data = [...sellerListings];
    const { key, direction } = sellerSortConfig;
    if (!key) return data;

    const getValue = (item) => {
      switch (key) {
        case 'title':
          return String(item.title || '').toLowerCase();
        case 'condition':
          return String(item.condition || '').toLowerCase();
        case 'soldQuantity':
          return item.soldQuantity === null ? -1 : Number(item.soldQuantity || 0);
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
  }, [sellerListings, sellerSortConfig]);

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
    if (!detail?.seller?.username) return;
    handleLoadSellerListings(0);
  }, [detail?.seller?.username]);

  useEffect(() => {
    let cancelled = false;

    const hydrateDeferredSold = async () => {
      if (!sellerSoldQuantityDeferred || !Array.isArray(sellerPendingSoldItems) || !sellerPendingSoldItems.length) {
        return;
      }

      const loadingMap = {};
      for (const item of sellerPendingSoldItems) {
        if (!item?.id) continue;
        loadingMap[item.id] = true;
      }
      if (Object.keys(loadingMap).length) {
        setSellerSoldLoadingByItemId(loadingMap);
      }

      for (const item of sellerPendingSoldItems) {
        if (cancelled) break;
        const key = String(item?.id || '').trim();
        const payload = {
          itemId: normalizeNumericItemId(item?.id),
          legacyItemId: normalizeNumericItemId(item?.legacyItemId),
          itemWebUrl: String(item?.itemWebUrl || '').trim(),
        };

        if (!payload.itemId && !payload.legacyItemId && !payload.itemWebUrl) {
          if (!cancelled && key) {
            setSellerSoldLoadingByItemId((prev) => ({ ...prev, [key]: false }));
          }
          continue;
        }

        try {
          const response = await browseAPI.getSoldQuantity(payload);
          const soldCount = normalizeSoldQuantity(response?.data?.data?.soldCount);
          if (!cancelled && key && soldCount !== null) {
            setSellerListings((prev) =>
              prev.map((row) =>
                String(row?.id || '') === key
                  ? {
                      ...row,
                      soldQuantity: soldCount,
                    }
                  : row
              )
            );
          }
        } catch {
          // Ignore per-row sold failures and keep the row nullable.
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
    };

    hydrateDeferredSold();

    return () => {
      cancelled = true;
    };
  }, [sellerPendingSoldItems, sellerSoldQuantityDeferred]);

  const renderSellerSoldValue = (item) => {
    const key = String(item?.id || '').trim();
    const isLoading = !!sellerSoldLoadingByItemId[key];
    const soldQuantity = item?.soldQuantity;

    if (soldQuantity !== null && soldQuantity !== undefined) {
      return String(Number(soldQuantity));
    }

    if (isLoading || sellerSoldQuantityDeferred) {
      return (
        <span className="inline-flex items-center justify-center w-4 h-4" aria-label="Loading sold quantity">
          <span className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        </span>
      );
    }

    return '0';
  };

  if (loading) {
    return <LoadingSpinner message="Loading listing details..." />;
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
          Back to Checkila Analysis
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleSellSimilar(detail)}
          >
            Sell Similar
          </button>
          {detail?.itemWebUrl && (
            <a href={detail.itemWebUrl} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2">
              Open on eBay
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
                title={detail?.itemWebUrl ? 'Open on eBay' : 'eBay link unavailable'}
              >
                {detail.title}
              </button>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{detail.shortDescription || 'Detailed market listing insights'}</p>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <div className="rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {detail?.image?.imageUrl ? (
                    <img src={detail.image.imageUrl} alt={detail.title} className="w-full h-[300px] object-cover" />
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-slate-400 text-sm">No image</div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Item Price</p>
                  <p className="text-xl font-semibold">{formatCurrency(Number(detail?.price?.value || 0))}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Condition</p>
                  <p className="text-xl font-semibold">{detail?.condition || 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Seller</p>
                  <button
                    type="button"
                    onClick={handleLoadSellerListings}
                    className="mt-1 text-left text-xl font-semibold text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    {detail?.seller?.username || 'Unknown seller'}
                  </button>
                  {sellerCountryFlag ? <span className="ml-2 align-middle">{sellerCountryFlag}</span> : null}
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Sold Count</p>
                  <p className="text-xl font-semibold">{sold}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Selling Success</p>
                  <p className="text-xl font-semibold">{successRate !== null ? `${successRate}%` : 'N/A'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 md:col-span-2">
                  <p className="text-xs text-slate-500 dark:text-slate-300">Selling History</p>
                  <a
                    href={`https://www.ebay.com/bin/purchasehistory?item=${encodeURIComponent(purchaseHistoryItemId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary inline-flex items-center gap-2 mt-2"
                  >
                    See selling history
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Store size={18} />
                Seller Listings
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellerViewMode('list')}
                  className={`btn-secondary flex items-center gap-1 ${sellerViewMode === 'list' ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <List size={14} />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setSellerViewMode('card')}
                  className={`btn-secondary flex items-center gap-1 ${sellerViewMode === 'card' ? 'ring-2 ring-blue-300' : ''}`}
                >
                  <LayoutGrid size={14} />
                  Card
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
                  title={`Sort ${sellerSortConfig.direction === 'asc' ? 'descending' : 'ascending'}`}
                >
                  {sellerSortConfig.direction === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleLoadSellerListings(0)}>
                  Load seller listings
                </button>
              </div>
            </div>

            {sellerError && (
              <div className="mb-3">
                <Alert type="warning" message={sellerError} onClose={() => setSellerError(null)} autoClose={false} />
              </div>
            )}

            {sellerLoading ? (
              <LoadingSpinner message="Loading seller listings..." />
            ) : sortedSellerListings.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Click seller name or "Load seller listings" to fetch matching seller inventory.</p>
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
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No image</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openExternalItem(item.itemWebUrl)}
                        className="text-left text-sm font-semibold line-clamp-2 text-slate-900 dark:text-slate-100 hover:underline"
                        title={item.itemWebUrl ? 'Open on eBay' : 'eBay link unavailable'}
                      >
                        {item.title}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{item.condition}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        Sold Qty: <span className="font-semibold">{renderSellerSoldValue(item)}</span>
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.priceValue)}
                        </p>
                        <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => handleSearchItem(item)} title="Search this title">
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
                        <th className="text-left p-3">Image</th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('title')} className="hover:underline">
                            {renderSellerSortLabel('Title', 'title')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('condition')} className="hover:underline">
                            {renderSellerSortLabel('Condition', 'condition')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('soldQuantity')} className="hover:underline">
                            {renderSellerSortLabel('Sold Qty', 'soldQuantity')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSellerSort('priceValue')} className="hover:underline">
                            {renderSellerSortLabel('Item Price', 'priceValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">Actions</th>
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
                          <td className="p-3">{item.condition}</td>
                          <td className="p-3 font-medium">{renderSellerSoldValue(item)}</td>
                          <td className="p-3">{formatCurrency(item.priceValue)}</td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <Link
                                to={`/market-analysis/item/${encodeURIComponent(item.id)}?sellerUsername=${encodeURIComponent(detail?.seller?.username || '')}`}
                                className="btn-primary"
                              >
                                Details
                              </Link>
                              <button type="button" className="btn-secondary" onClick={() => handleSearchItem(item)} title="Search this title">
                                <Search size={14} />
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
              )
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Showing {sellerListings.length} result(s)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleLoadSellerListings(Math.max(0, sellerOffset - sellerLimit))}
                  disabled={sellerLoading || sellerOffset <= 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleLoadSellerListings(sellerOffset + sellerLimit)}
                  disabled={sellerLoading || sellerOffset + sellerLimit >= (sellerTotal || 0) || sellerOffset >= sellerLimit}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
