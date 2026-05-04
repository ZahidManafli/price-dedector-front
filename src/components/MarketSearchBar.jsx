import React from 'react';
import { useTranslation } from 'react-i18next';

export default function MarketSearchBar({
  params,
  onChange,
  onSubmit,
  disabled,
  marketCreditsRemaining,
  searchCost,
  recentSellers = [],
  recentTitles = [],
}) {
  const { t } = useTranslation();
  const sortOptions = [
    { value: '', label: t('marketSearchBar.bestMatch') },
    { value: 'price', label: t('marketSearchBar.priceLowHigh') },
    { value: '-price', label: t('marketSearchBar.priceHighLow') },
    { value: 'newlyListed', label: t('marketSearchBar.newlyListed') },
    { value: 'endingSoonest', label: t('marketSearchBar.endingSoonest') },
  ];
  const conditionOptions = [
    { value: 'ALL', label: t('marketSearchBar.allConditions') },
    { value: 'NEW', label: t('marketSearchBar.new') },
    { value: 'USED', label: t('marketSearchBar.used') },
    { value: 'LIKE_NEW', label: t('marketSearchBar.likeNew') },
  ];
  const buyingOptions = [
    { value: '', label: t('marketSearchBar.allBuyingOptions') },
    { value: 'FIXED_PRICE', label: t('marketSearchBar.buyItNow') },
    { value: 'AUCTION', label: t('marketSearchBar.auction') },
    { value: 'BEST_OFFER', label: t('marketSearchBar.bestOffer') },
  ];
  const setValue = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="glass-card p-4 md:p-5 fade-in"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.keyword')}</label>
          <input
            className="input-base"
            placeholder={t('marketSearchBar.keywordPlaceholder')}
            value={params.q}
            list="recent-checkila-titles"
            onChange={(e) => setValue('q', e.target.value)}
          />
          <datalist id="recent-checkila-titles">
            {recentTitles.map((title) => (
              <option key={title} value={title} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.categoryId')}</label>
          <input
            className="input-base"
            placeholder="179697"
            value={params.categoryId}
            onChange={(e) => setValue('categoryId', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.condition')}</label>
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
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.buying')}</label>
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
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.sort')}</label>
          <select className="input-base" value={params.sort} onChange={(e) => setValue('sort', e.target.value)}>
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.minPrice')}</label>
          <input
            className="input-base"
            type="number"
            min="0"
            value={params.minPrice}
            onChange={(e) => setValue('minPrice', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.maxPrice')}</label>
          <input
            className="input-base"
            type="number"
            min="0"
            value={params.maxPrice}
            onChange={(e) => setValue('maxPrice', e.target.value)}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.seller')}</label>
          <input
            className="input-base"
            placeholder={t('marketSearchBar.sellerPlaceholder')}
            value={params.sellerUsername || ''}
            list="recent-checkila-sellers"
            onChange={(e) => setValue('sellerUsername', e.target.value)}
          />
          <datalist id="recent-checkila-sellers">
            {recentSellers.map((seller) => (
              <option key={seller} value={seller} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.perPage')}</label>
          <select className="input-base" value={params.limit} onChange={(e) => setValue('limit', Number(e.target.value))}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <input
            id="freeShipping"
            type="checkbox"
            checked={Boolean(params.freeShipping)}
            onChange={(e) => setValue('freeShipping', e.target.checked)}
          />
          <label htmlFor="freeShipping" className="text-sm text-slate-600 dark:text-slate-300">
            {t('marketSearchBar.freeShippingOnly')}
          </label>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={disabled} className="btn-primary w-full md:w-auto">
            {t('marketSearchBar.runAnalysis')}
            {typeof searchCost === 'number' ? ` (${t('marketSearchBar.credit', { count: searchCost })})` : ''}
            {marketCreditsRemaining !== null && marketCreditsRemaining !== undefined
              ? ` • ${t('marketSearchBar.remaining')}: ${marketCreditsRemaining}`
              : ''}
          </button>
        </div>
      </div>
    </form>
  );
}
