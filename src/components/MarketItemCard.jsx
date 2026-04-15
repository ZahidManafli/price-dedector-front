import React from 'react';
import { ExternalLink, PlusCircle, Search } from 'lucide-react';
import { countryCodeToFlagEmoji, formatCurrency } from '../utils/helpers';

function openItemUrl(item) {
  const url = String(item?.itemWebUrl || '').trim();
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function MarketItemCard({ item, onSelect, onInspect, onSellerClick, onSearchTitle, isSelected }) {
  const sellerFlag = countryCodeToFlagEmoji(item?.sellerCountryCode);

  return (
    <article className="glass-card p-3 flex flex-col gap-3">
      <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            No image
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => openItemUrl(item)}
          className="text-left text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 min-h-[20px] hover:underline"
          title={item.itemWebUrl ? 'Open on eBay' : 'eBay link unavailable'}
        >
          {item.title}
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          {item.condition} | Seller:{' '}
          <button
            type="button"
            onClick={() => onSellerClick?.(item.sellerName)}
            className="text-blue-700 dark:text-blue-400 hover:underline"
          >
            {item.sellerName || 'Unknown'}
          </button>
          {sellerFlag ? <span className="ml-2 align-middle">{sellerFlag}</span> : null}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          Feedback score: <span className="font-semibold">{Number(item.sellerFeedback || 0)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <p className="text-slate-500 dark:text-slate-300">Item Price</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.priceValue)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <p className="text-slate-500 dark:text-slate-300">Condition</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.condition || 'N/A'}</p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 px-2 py-1 text-xs">
        Sold quantity:{' '}
        <span className="font-semibold">
          {item?.soldLoading ? (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent align-middle"
              aria-label="Loading sold quantity"
              title="Loading sold quantity"
            />
          ) : (
            Number(item?.soldQuantity || 0)
          )}
        </span>
      </div>

      <div className="flex gap-2 mt-auto">
        <button type="button" onClick={() => onSelect(item)} className="btn-secondary flex-1 text-xs">
          <PlusCircle size={14} className="inline mr-1" />
          {isSelected ? 'Selected' : 'Compare'}
        </button>
        <button type="button" onClick={() => onSearchTitle?.(item)} className="btn-secondary text-xs px-3" title="Search this title">
          <Search size={14} />
        </button>
        <button type="button" onClick={() => onInspect(item)} className="btn-primary flex-1 text-xs">
          Details
        </button>
        {item.itemWebUrl && (
          <a href={item.itemWebUrl} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-3">
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </article>
  );
}
