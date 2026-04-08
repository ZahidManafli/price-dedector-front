import React from 'react';
import { ExternalLink, PlusCircle } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export default function MarketItemCard({ item, onSelect, onInspect, isSelected }) {
  const totalVisiblePrice = Number(item.priceValue || 0) + Number(item.shippingValue || 0);

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
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 min-h-[40px]">{item.title}</h4>
        <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
          {item.condition} | Seller: {item.sellerName}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <p className="text-slate-500 dark:text-slate-300">Item Price</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.priceValue)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
          <p className="text-slate-500 dark:text-slate-300">+ Shipping</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(item.shippingValue)}</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 px-2 py-1 text-xs">
        Total visible cost: <span className="font-semibold">{formatCurrency(totalVisiblePrice)}</span>
      </div>

      <div className="flex gap-2 mt-auto">
        <button type="button" onClick={() => onSelect(item)} className="btn-secondary flex-1 text-xs">
          <PlusCircle size={14} className="inline mr-1" />
          {isSelected ? 'Selected' : 'Compare'}
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
