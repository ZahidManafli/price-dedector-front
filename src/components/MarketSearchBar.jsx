import React from 'react';

const sortOptions = [
  { value: '', label: 'Best Match' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: 'newlyListed', label: 'Newly Listed' },
  { value: 'endingSoonest', label: 'Ending Soonest' },
];

const conditionOptions = [
  { value: 'ALL', label: 'All Conditions' },
  { value: 'NEW', label: 'New' },
  { value: 'USED', label: 'Used' },
  { value: 'LIKE_NEW', label: 'Like New' },
];

const buyingOptions = [
  { value: '', label: 'All Buying Options' },
  { value: 'FIXED_PRICE', label: 'Buy It Now' },
  { value: 'AUCTION', label: 'Auction' },
  { value: 'BEST_OFFER', label: 'Best Offer' },
];

export default function MarketSearchBar({ params, onChange, onSubmit, disabled }) {
  const setValue = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="glass-card p-4 md:p-5 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Keyword</label>
          <input
            className="input-base"
            placeholder="Search products (ex: drone, iphone, lego)"
            value={params.q}
            onChange={(e) => setValue('q', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Category ID</label>
          <input
            className="input-base"
            placeholder="179697"
            value={params.categoryId}
            onChange={(e) => setValue('categoryId', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Condition</label>
          <select
            className="input-base"
            value={params.condition}
            onChange={(e) => setValue('condition', e.target.value)}
          >
            {conditionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Buying</label>
          <select
            className="input-base"
            value={params.buyingOptions}
            onChange={(e) => setValue('buyingOptions', e.target.value)}
          >
            {buyingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Sort</label>
          <select className="input-base" value={params.sort} onChange={(e) => setValue('sort', e.target.value)}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Min Price</label>
          <input
            className="input-base"
            type="number"
            min="0"
            value={params.minPrice}
            onChange={(e) => setValue('minPrice', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Max Price</label>
          <input
            className="input-base"
            type="number"
            min="0"
            value={params.maxPrice}
            onChange={(e) => setValue('maxPrice', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">Per Page</label>
          <select className="input-base" value={params.limit} onChange={(e) => setValue('limit', Number(e.target.value))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>

        <div className="md:col-span-3 flex items-center gap-2">
          <input
            id="freeShipping"
            type="checkbox"
            checked={Boolean(params.freeShipping)}
            onChange={(e) => setValue('freeShipping', e.target.checked)}
          />
          <label htmlFor="freeShipping" className="text-sm text-slate-600 dark:text-slate-300">
            Free shipping only
          </label>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button type="button" onClick={onSubmit} disabled={disabled} className="btn-primary w-full md:w-auto">
            Run Market Search
          </button>
        </div>
      </div>
    </div>
  );
}
