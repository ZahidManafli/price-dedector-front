import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';

export default function MarketSearchBar({
  params,
  onChange,
  onSubmit,
  disabled,
  searchType,
  marketCreditsRemaining,
  searchCost,
  recentSellers = [],
  recentTitles = [],
}) {
  const { t } = useTranslation();
  const isFastMode = String(searchType || '').trim().toLowerCase() === 'fast';
  const hasProductName = String(params?.q || '').trim() !== '';
  const hasSellerName = String(params?.sellerUsername || '').trim() !== '';
  const sellerInputDisabled = Boolean(disabled) || (isFastMode && hasProductName);
  const productInputDisabled = Boolean(disabled) || (isFastMode && hasSellerName);
  const sortOptions = [
    { value: '', label: t('marketSearchBar.bestMatch') },
    { value: 'price', label: t('marketSearchBar.priceLowHigh') },
    { value: '-price', label: t('marketSearchBar.priceHighLow') },
    { value: 'newlyListed', label: t('marketSearchBar.newlyListed') },
    { value: 'endingSoonest', label: t('marketSearchBar.endingSoonest') },
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
      <div>
        <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.keyword')}</label>
        <input
          className="input-base"
          placeholder={t('marketSearchBar.keywordPlaceholder')}
          value={params.q}
          list="recent-checkila-titles"
          disabled={productInputDisabled}
          onChange={(e) => setValue('q', e.target.value)}
        />
        <datalist id="recent-checkila-titles">
          {recentTitles.map((title) => (
            <option key={title} value={title} />
          ))}
        </datalist>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.seller')}</label>
          <input
            className="input-base"
            placeholder={t('marketSearchBar.sellerPlaceholder')}
            value={params.sellerUsername || ''}
            list="recent-checkila-sellers"
            disabled={sellerInputDisabled}
            onChange={(e) => setValue('sellerUsername', e.target.value)}
          />
          <datalist id="recent-checkila-sellers">
            {recentSellers.map((seller) => (
              <option key={seller} value={seller} />
            ))}
          </datalist>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.categoryId')}</label>
          <input
            className="input-base"
            placeholder="179697"
            value={params.categoryId}
            readOnly={isFastMode}
            onChange={(e) => setValue('categoryId', e.target.value)}
          />
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.buying')}</label>
          <select
            className="input-base"
            value={params.buyingOptions}
            onChange={(e) => setValue('buyingOptions', e.target.value)}
            readOnly={isFastMode}
          >
            {buyingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.sort')}</label>
          <select className="input-base" value={params.sort} onChange={(e) => setValue('sort', e.target.value)} readOnly={isFastMode}>
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
            readOnly={isFastMode}
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
            readOnly={isFastMode}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-300">{t('marketSearchBar.perPage')}</label>
          <select className="input-base" value={params.limit} onChange={(e) => setValue('limit', Number(e.target.value))} readOnly={isFastMode}>
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-center gap-2 md:pb-2.5">
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

        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={disabled}
            className="flex w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Zap size={14} className="fill-current" />
              {t('marketSearchBar.runAnalysis')}
            </span>
            {(typeof searchCost === 'number' || (marketCreditsRemaining !== null && marketCreditsRemaining !== undefined)) && (
              <span className="text-[11px] font-medium text-white/80">
                {typeof searchCost === 'number' ? t('marketSearchBar.credit', { count: searchCost }) : ''}
                {marketCreditsRemaining !== null && marketCreditsRemaining !== undefined
                  ? ` • ${t('marketSearchBar.remaining')}: ${marketCreditsRemaining}`
                  : ''}
              </span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
