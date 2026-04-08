import React, { useMemo, useState } from 'react';
import { LayoutGrid, List, RefreshCw, SearchCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import MarketSearchBar from '../components/MarketSearchBar';
import MarketRefinementPanel from '../components/MarketRefinementPanel';
import MarketItemCard from '../components/MarketItemCard';
import MarketComparePanel from '../components/MarketComparePanel';
import useBrowseSearch from '../hooks/useBrowseSearch';
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
  const navigate = useNavigate();
  const { params, setParams, results, total, refinement, loading, error, setError, searchNow } = useBrowseSearch({
    fieldgroups: 'ASPECT_REFINEMENTS,MATCHING_ITEMS',
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewMode, setViewMode] = useState('card');
  const [sortConfig, setSortConfig] = useState({ key: 'marketCost', direction: 'desc' });

  const filteredResults = useMemo(() => {
    const seller = String(params.sellerUsername || '').trim().toLowerCase();
    if (!seller) return results;
    return results.filter((item) => String(item.sellerName || '').toLowerCase().includes(seller));
  }, [params.sellerUsername, results]);

  const selectedItems = useMemo(() => {
    const map = new Map(filteredResults.map((item) => [item.id, item]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [filteredResults, selectedIds]);

  const sortedResults = useMemo(() => {
    const data = [...filteredResults];
    const { key, direction } = sortConfig;
    if (!key) return data;

    const getValue = (item) => {
      switch (key) {
        case 'title':
          return String(item.title || '').toLowerCase();
        case 'seller':
          return String(item.sellerName || '').toLowerCase();
        case 'condition':
          return String(item.condition || '').toLowerCase();
        case 'soldQuantity':
          return Number(item.soldQuantity || 0);
        case 'priceValue':
          return Number(item.priceValue || 0);
        case 'shippingValue':
          return Number(item.shippingValue || 0);
        case 'marketCost':
          return Number(item.priceValue || 0) + Number(item.shippingValue || 0);
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
  }, [filteredResults, sortConfig]);

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
    return `${label} ${sortConfig.direction === 'asc' ? '▲' : '▼'}`;
  };

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

  const handleInspect = (item) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.categoryId) query.set('categoryId', params.categoryId);
    if (params.sellerUsername) query.set('sellerUsername', params.sellerUsername);
    navigate(`/market-analysis/item/${encodeURIComponent(item.id)}${query.toString() ? `?${query.toString()}` : ''}`);
  };

  const handleSellerClick = (sellerName) => {
    const nextParams = {
      ...params,
      sellerUsername: String(sellerName || '').trim(),
      offset: 0,
    };
    setParams(nextParams);
    searchNow(nextParams);
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
          ) : sortedResults.length === 0 ? (
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
                  {sortedResults.map((item) => (
                    <MarketItemCard
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.includes(item.id)}
                      onSelect={handleSelect}
                      onInspect={handleInspect}
                      onSellerClick={handleSellerClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="glass-card overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('title')} className="hover:underline">
                            {renderSortLabel('Title', 'title')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('seller')} className="hover:underline">
                            {renderSortLabel('Seller', 'seller')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('condition')} className="hover:underline">
                            {renderSortLabel('Condition', 'condition')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('soldQuantity')} className="hover:underline">
                            {renderSortLabel('Sold Qty', 'soldQuantity')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('priceValue')} className="hover:underline">
                            {renderSortLabel('Item Price', 'priceValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('shippingValue')} className="hover:underline">
                            {renderSortLabel('Shipping', 'shippingValue')}
                          </button>
                        </th>
                        <th className="text-left p-3">
                          <button type="button" onClick={() => toggleSort('marketCost')} className="hover:underline">
                            {renderSortLabel('Market Cost', 'marketCost')}
                          </button>
                        </th>
                        <th className="text-left p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="p-3 max-w-[300px] truncate">{item.title}</td>
                          <td className="p-3">
                            <button
                              type="button"
                              onClick={() => handleSellerClick(item.sellerName)}
                              className="text-blue-700 dark:text-blue-400 hover:underline"
                            >
                              {item.sellerName || 'Unknown'}
                            </button>
                          </td>
                          <td className="p-3">{item.condition}</td>
                          <td className="p-3 font-medium">{Number(item.soldQuantity || 0)}</td>
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
                  Showing {sortedResults.length} result(s)
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
    </div>
  );
}
