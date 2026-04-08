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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyNotice, setHistoryNotice] = useState('');
  const [sellHistory, setSellHistory] = useState([]);
  const [soldEstimate, setSoldEstimate] = useState(0);

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

  useEffect(() => {
    let cancelled = false;

    const loadSellHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError(null);
        setHistoryNotice('');
        const res = await browseAPI.getSellHistory(itemId, {
          numberOfDays: 30,
          page: 1,
          entriesPerPage: 25,
        });
        if (cancelled) return;
        const payload = res?.data?.data || {};
        setSellHistory(Array.isArray(payload.transactions) ? payload.transactions : []);
        setSoldEstimate(Number(payload.soldEstimate || 0));
        if (payload.notice) {
          setHistoryNotice(payload.notice);
        }
      } catch (err) {
        if (cancelled) return;
        setHistoryError(err?.response?.data?.error || err?.message || 'Failed to load sell history');
        setSellHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    if (itemId) {
      loadSellHistory();
    }

    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const sold = Number(detail?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0);
  const available = Number(detail?.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity || 0);
  const totalQty = sold + available;
  const successRate = totalQty > 0 ? Math.round((sold / totalQty) * 100) : null;

  const handleLoadSellerListings = async () => {
    const sellerUsername = String(detail?.seller?.username || '').trim();
    if (!sellerUsername) {
      setSellerError('Seller username is not available for this listing.');
      return;
    }

    try {
      setSellerLoading(true);
      setSellerError(null);
      const response = await browseAPI.search({
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

  const averageSoldPrice = sellHistory.length
    ? sellHistory.reduce((sum, tx) => sum + Number(tx?.transactionPrice?.value || 0), 0) / sellHistory.length
    : null;

  const latestSales = sellHistory
    .map((tx) => ({
      ...tx,
      when: tx?.paidTime || tx?.createdDate || tx?.lastModified || null,
    }))
    .filter((tx) => tx.when)
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
    .slice(0, 8);

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
              </div>
            </div>
          </section>

          <section className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sell History</h2>
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  try {
                    setHistoryLoading(true);
                    setHistoryError(null);
                    setHistoryNotice('');
                    const res = await browseAPI.getSellHistory(itemId, {
                      numberOfDays: 30,
                      page: 1,
                      entriesPerPage: 25,
                    });
                    const payload = res?.data?.data || {};
                    setSellHistory(Array.isArray(payload.transactions) ? payload.transactions : []);
                    setSoldEstimate(Number(payload.soldEstimate || 0));
                    if (payload.notice) setHistoryNotice(payload.notice);
                  } catch (err) {
                    setHistoryError(err?.response?.data?.error || err?.message || 'Failed to refresh sell history');
                    setSellHistory([]);
                  } finally {
                    setHistoryLoading(false);
                  }
                }}
              >
                Refresh history
              </button>
            </div>

            {historyError && (
              <div className="mb-3">
                <Alert type="warning" message={historyError} onClose={() => setHistoryError(null)} autoClose={false} />
              </div>
            )}

            {historyNotice && (
              <div className="mb-3">
                <Alert type="info" message={historyNotice} onClose={() => setHistoryNotice('')} autoClose={false} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Transactions Loaded</p>
                <p className="text-xl font-semibold">{sellHistory.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Average Sold Price</p>
                <p className="text-xl font-semibold">{averageSoldPrice !== null ? formatCurrency(averageSoldPrice) : 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs text-slate-500 dark:text-slate-300">Estimated Sold (Browse)</p>
                <p className="text-xl font-semibold">{soldEstimate || sold}</p>
              </div>
            </div>

            {historyLoading ? (
              <LoadingSpinner message="Loading sell history..." />
            ) : latestSales.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                No transaction events were returned for this listing in the selected period.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <th className="text-left p-3">When</th>
                      <th className="text-left p-3">Quantity</th>
                      <th className="text-left p-3">Transaction Price</th>
                      <th className="text-left p-3">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestSales.map((tx) => (
                      <tr key={tx.transactionId || `${tx.when}-${tx.quantityPurchased}`} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-3">{tx.when ? new Date(tx.when).toLocaleString() : 'N/A'}</td>
                        <td className="p-3">{tx.quantityPurchased || 0}</td>
                        <td className="p-3">
                          {tx?.transactionPrice?.value != null ? formatCurrency(tx.transactionPrice.value) : 'N/A'}
                        </td>
                        <td className="p-3">
                          {tx?.amountPaid?.value != null ? formatCurrency(tx.amountPaid.value) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
