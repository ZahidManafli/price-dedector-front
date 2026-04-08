import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Store } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { browseAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

function normalizeSummary(summary) {
  return {
    id: summary?.itemId || '',
    title: summary?.title || 'Untitled listing',
    imageUrl: summary?.image?.imageUrl || summary?.thumbnailImages?.[0]?.imageUrl || '',
    priceValue: Number(summary?.price?.value || 0),
    shippingValue: Number(summary?.shippingOptions?.[0]?.shippingCost?.value || 0),
    condition: summary?.condition || 'Unknown',
    itemWebUrl: summary?.itemWebUrl || summary?.itemAffiliateWebUrl || '',
  };
}

export default function MarketListingDetailPage() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerError, setSellerError] = useState(null);
  const [sellerListings, setSellerListings] = useState([]);

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

  const handleLoadSellerListings = async () => {
    const sellerUsername = String(detail?.seller?.username || '').trim();
    const queryFromUrl = String(searchParams.get('q') || '').trim();
    const fallbackQuery = String(detail?.title || '')
      .split(/\s+/)
      .find((word) => word && word.length >= 3) || '';
    const q = queryFromUrl || fallbackQuery;
    if (!sellerUsername) {
      setSellerError('Seller username is not available for this listing.');
      return;
    }
    if (!q) {
      setSellerError('Cannot load seller listings because no keyword query is available.');
      return;
    }

    try {
      setSellerLoading(true);
      setSellerError(null);
      const response = await browseAPI.search({
        q,
        sellerUsername,
        limit: 12,
        offset: 0,
        fieldgroups: 'EXTENDED',
      });
      const rows = Array.isArray(response?.data?.data?.itemSummaries)
        ? response.data.data.itemSummaries
        : [];
      setSellerListings(rows.map(normalizeSummary));
    } catch (err) {
      setSellerError(err?.response?.data?.error || err?.message || 'Failed to load seller listings');
      setSellerListings([]);
    } finally {
      setSellerLoading(false);
    }
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
          Back to Market Analysis
        </button>
        {detail?.itemWebUrl && (
          <a href={detail.itemWebUrl} target="_blank" rel="noreferrer" className="btn-primary flex items-center gap-2">
            Open on eBay
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {error && (
        <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
      )}

      {detail && (
        <>
          <section className="glass-card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600/10 to-emerald-600/10 p-5 border-b border-slate-200 dark:border-slate-700">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{detail.title}</h1>
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
                  <p className="text-xs text-slate-500 dark:text-slate-300">Shipping (estimated)</p>
                  <p className="text-xl font-semibold">{formatCurrency(Number(detail?.shippingOptions?.[0]?.shippingCost?.value || 0))}</p>
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
              <button type="button" className="btn-secondary" onClick={handleLoadSellerListings}>
                Load seller listings
              </button>
            </div>

            {sellerError && (
              <div className="mb-3">
                <Alert type="warning" message={sellerError} onClose={() => setSellerError(null)} autoClose={false} />
              </div>
            )}

            {sellerLoading ? (
              <LoadingSpinner message="Loading seller listings..." />
            ) : sellerListings.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">Click seller name or "Load seller listings" to fetch matching seller inventory.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sellerListings.map((item) => (
                  <Link
                    key={item.id}
                    to={`/market-analysis/item/${encodeURIComponent(item.id)}?sellerUsername=${encodeURIComponent(detail?.seller?.username || '')}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-400 transition"
                  >
                    <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-2">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">No image</div>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold line-clamp-2 text-slate-900 dark:text-slate-100">{item.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">{item.condition}</p>
                    <p className="text-sm mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(item.priceValue + item.shippingValue)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
