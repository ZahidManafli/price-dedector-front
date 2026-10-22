import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Store, Zap } from 'lucide-react';

// Advanced filters (category ID, buying options, sort, min/max price, per-page,
// free-shipping-only) are deliberately not rendered here anymore — the user
// wanted a clean, focused search bar. The underlying `params` fields and the
// onSubmit() contract with the parent page are untouched: whatever defaults
// MarketAnalysisPage.jsx's state already carries for those keys still get
// submitted exactly as before, so the search itself behaves identically —
// only the controls to CHANGE them from this bar are gone.
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
  const setValue = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50/60 p-5 md:p-6 shadow-sm fade-in dark:border-indigo-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {/* Decorative glow — purely cosmetic, sits behind everything */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />

      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('marketSearchBar.keyword')}
          </label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-base pl-10 h-11 text-sm"
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
        </div>

        <div className="lg:w-72">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('marketSearchBar.seller')}
          </label>
          <div className="relative">
            <Store size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input-base pl-10 h-11 text-sm"
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
        </div>

        <div className="lg:w-64">
          <button
            type="submit"
            disabled={disabled}
            className="flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-white shadow-lg shadow-indigo-500/25 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
