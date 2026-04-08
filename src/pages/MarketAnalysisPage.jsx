import React, { useMemo, useState } from 'react';
import { LayoutGrid, List, RefreshCw, SearchCheck } from 'lucide-react';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import MarketSearchBar from '../components/MarketSearchBar';
import MarketRefinementPanel from '../components/MarketRefinementPanel';
import MarketItemCard from '../components/MarketItemCard';
import MarketComparePanel from '../components/MarketComparePanel';
import useBrowseSearch from '../hooks/useBrowseSearch';
import { browseAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

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
  const { params, setParams, results, total, refinement, loading, error, setError, searchNow } = useBrowseSearch({
    fieldgroups: 'ASPECT_REFINEMENTS,MATCHING_ITEMS',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailsItem, setDetailsItem] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const [viewMode, setViewMode] = useState('card');

  const filteredResults = useMemo(() => {
    const seller = String(params.sellerUsername || '').trim().toLowerCase();
    if (!seller) return results;
    return results.filter((item) => String(item.sellerName || '').toLowerCase().includes(seller));
  }, [params.sellerUsername, results]);

  const selectedItems = useMemo(() => {
    const map = new Map(filteredResults.map((item) => [item.id, item]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [filteredResults, selectedIds]);

  const metrics = useMemo(() => {
    if (!filteredResults.length) {
      return {
        averagePrice: 0,
        averageMarketCost: 0,
        medianPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        withFreeShipping: 0,
      };
    }
    const prices = filteredResults.map((r) => Number(r.priceValue || 0));
    const marketCosts = filteredResults.map((r) => Number(r.priceValue || 0) + Number(r.shippingValue || 0));
    const freeShippingCount = filteredResults.filter((r) => Number(r.shippingValue || 0) === 0).length;
    return {
      averagePrice: prices.reduce((sum, n) => sum + n, 0) / prices.length,
      averageMarketCost: marketCosts.reduce((sum, n) => sum + n, 0) / marketCosts.length,
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

  const handleInspect = async (item) => {
    setDetailsError(null);
    try {
      const response = await browseAPI.getItem(item.id, 'PRODUCT,ADDITIONAL_SELLER_DETAILS');
      setDetailsItem(response?.data?.data || null);
    } catch (err) {
      setDetailsError(err?.response?.data?.error || err?.message || 'Failed to load listing details');
      setDetailsItem(null);
    }
  };

  const onNextPage = () => {
    setParams((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
  };

  const onPrevPage = () => {
    setParams((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));
  };

  return (
    <div className="page-shell space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Market Analysis</h1>
          <p className="page-subtitle">
            Discover market listings with eBay Browse API and compare pricing opportunities before adding products.
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
        onSubmit={() => searchNow(params)}
        disabled={loading}
      />

      <section className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Results</p>
          <p className="text-lg font-semibold">{filteredResults.length || 0}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Average Item</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.averagePrice)}</p>
        </div>
        <div className="glass-card p-3">
          <p className="text-xs text-slate-500 dark:text-slate-300">Average Market Cost</p>
          <p className="text-lg font-semibold">{formatCurrency(metrics.averageMarketCost)}</p>
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
        <div className="lg:col-span-3">
          <MarketRefinementPanel refinement={refinement} />
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="flex justify-end gap-2">
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
          ) : filteredResults.length === 0 ? (
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
                  {filteredResults.map((item) => (
                    <MarketItemCard
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onSelect={handleSelect}
                      onInspect={handleInspect}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3">Title</th>
                        <th className="text-left p-3">Seller</th>
                        <th className="text-left p-3">Condition</th>
                        <th className="text-left p-3">Item Price</th>
                        <th className="text-left p-3">Shipping</th>
                        <th className="text-left p-3">Market Cost</th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredResults.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-3 max-w-[300px] truncate">{item.title}</td>
                          <td className="p-3">{item.sellerName}</td>
                          <td className="p-3">{item.condition}</td>
                          <td className="p-3">{formatCurrency(item.priceValue)}</td>
                          <td className="p-3">{formatCurrency(item.shippingValue)}</td>
                          <td className="p-3 font-semibold">
                            {formatCurrency(Number(item.priceValue || 0) + Number(item.shippingValue || 0))}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button type="button" className="btn-secondary" onClick={() => handleSelect(item)}>
                                {selectedIds.includes(item.id) ? 'Selected' : 'Compare'}
                              </button>
                              <button type="button" className="btn-primary" onClick={() => handleInspect(item)}>
                                Details
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
                  Showing {filteredResults.length} result(s)
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

      {detailsError && (
        <Alert
          type="warning"
          message={detailsError}
          onClose={() => setDetailsError(null)}
          autoClose={false}
        />
      )}

      {detailsItem && (
        <section className="glass-card p-4">
          <div className="flex justify-between items-start gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Listing Details</h3>
              <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">{detailsItem.title}</p>
            </div>
            <button type="button" className="btn-secondary text-xs" onClick={() => setDetailsItem(null)}>
              Close
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Condition</p>
              <p className="font-medium">{detailsItem.condition || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Price</p>
              <p className="font-medium">
                {formatCurrency(Number(detailsItem?.price?.value || 0))} {detailsItem?.price?.currency || 'USD'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Seller</p>
              <p className="font-medium">{detailsItem?.seller?.username || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Sold Count</p>
              <p className="font-medium">
                {Number(detailsItem?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Selling Success</p>
              <p className="font-medium">
                {(() => {
                  const sold = Number(detailsItem?.estimatedAvailabilities?.[0]?.estimatedSoldQuantity || 0);
                  const available = Number(detailsItem?.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity || 0);
                  const totalQty = sold + available;
                  if (!totalQty) return 'N/A';
                  return `${Math.round((sold / totalQty) * 100)}%`;
                })()}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              <p className="text-slate-500 dark:text-slate-300">Last Seen</p>
              <p className="font-medium">
                {detailsItem?.itemEndDate || detailsItem?.itemCreationDate || 'N/A'}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
