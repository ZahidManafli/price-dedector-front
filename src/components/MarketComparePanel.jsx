import React, { useMemo } from 'react';
import { formatCurrency } from '../utils/helpers';

export default function MarketComparePanel({ items, onRemove, onClear }) {
  const metrics = useMemo(() => {
    if (!items.length) return null;
    const prices = items.map((item) => Number(item.priceValue || 0));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spread = max - min;
    const avg = prices.reduce((sum, n) => sum + n, 0) / prices.length;
    return { min, max, spread, avg };
  }, [items]);

  return (
    <section className="glass-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Comparison Tray ({items.length})</h3>
        <button type="button" className="btn-secondary text-xs" onClick={onClear} disabled={!items.length}>
          Clear
        </button>
      </div>

      {!items.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">Add listings from results to compare price and seller quality.</p>
      ) : (
        <>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <p className="text-slate-500 dark:text-slate-300">Min</p>
                <p className="font-semibold">{formatCurrency(metrics.min)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <p className="text-slate-500 dark:text-slate-300">Max</p>
                <p className="font-semibold">{formatCurrency(metrics.max)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <p className="text-slate-500 dark:text-slate-300">Spread</p>
                <p className="font-semibold">{formatCurrency(metrics.spread)}</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                <p className="text-slate-500 dark:text-slate-300">Average</p>
                <p className="font-semibold">{formatCurrency(metrics.avg)}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {formatCurrency(item.priceValue)} | Seller score {item.sellerFeedback}
                  </p>
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={() => onRemove(item.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
