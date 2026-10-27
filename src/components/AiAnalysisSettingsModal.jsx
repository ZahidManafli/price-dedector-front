import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins, Layers, Loader2, Minus, Plus, RotateCcw, Shuffle, SlidersHorizontal, Store, Target, Wallet, X } from 'lucide-react';
import { aiAnalysisAPI } from '../services/api';

// Same defaults as the backend (aiAnalysisEngine.getDefaultAiSettings).
const DEFAULTS = {
  targetCount: 5,
  minProfitUsd: 0.8,
  minPriceUsd: 0,
  maxPriceUsd: 15,
  includeVariations: false,
  maxSpendUsd: 1,
  startSeller: '',
};
const PLATFORM_FEE_USD = 0.2;
const PROFIT_CHIPS = [0.5, 0.8, 1, 2, 3];
const SPEND_CHIPS = [0.5, 1, 2, 5];
const PRICE_PRESETS = [
  [0, 10],
  [0, 15],
  [10, 25],
  [20, 50],
];

function toForm(settings) {
  return {
    targetCount: String(settings.targetCount),
    minProfitUsd: String(settings.minProfitUsd),
    minPriceUsd: String(settings.minPriceUsd),
    maxPriceUsd: String(settings.maxPriceUsd),
    includeVariations: Boolean(settings.includeVariations),
    maxSpendUsd: String(settings.maxSpendUsd),
    startSeller: settings.startSeller || '',
  };
}

function Section({ icon: Icon, title, hint, children, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  };
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start gap-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
          <Icon size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function MoneyInput({ value, onChange, invalid, ariaLabel }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`input-base h-10 pl-7 text-sm font-semibold ${invalid ? 'border-rose-400 focus:ring-rose-300' : ''}`}
      />
    </div>
  );
}

function Chips({ values, current, onPick, format = (v) => `$${v}` }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {values.map((v) => {
        const active = Number(current) === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onPick(String(v))}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
              active
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {format(v)}
          </button>
        );
      })}
    </div>
  );
}

// Checkila Analysis -> AI settings: what every new AI Analysis run looks for
// and when it stops. Saved per user (PUT /ai-analysis/settings).
export default function AiAnalysisSettingsModal({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(toForm(DEFAULTS));
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [sellerMode, setSellerMode] = useState('random');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setFieldErrors({});
    Promise.all([aiAnalysisAPI.getSettings(), aiAnalysisAPI.listSellers().catch(() => ({ data: { sellers: [] } }))])
      .then(([settingsRes, sellersRes]) => {
        if (cancelled) return;
        const settings = { ...DEFAULTS, ...(settingsRes.data?.settings || {}) };
        setForm(toForm(settings));
        setSellerMode(settings.startSeller ? 'specific' : 'random');
        setSellers(sellersRes.data?.sellers || []);
      })
      .catch((err) => !cancelled && setError(err?.response?.data?.error || err?.message || 'Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const set = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Client-side checks mirror the backend's (aiAnalysisEngine.validateAiSettings).
  const localErrors = useMemo(() => {
    const errs = {};
    const n = (k) => Number(form[k]);
    if (!Number.isInteger(n('targetCount')) || n('targetCount') < 1 || n('targetCount') > 20) errs.targetCount = t('aiAnalysis.settings.errTarget');
    if (!(n('minProfitUsd') >= 0) || n('minProfitUsd') > 100) errs.minProfitUsd = t('aiAnalysis.settings.errProfit');
    if (!(n('minPriceUsd') >= 0)) errs.minPriceUsd = t('aiAnalysis.settings.errPrice');
    if (!(n('maxPriceUsd') >= 1) || n('maxPriceUsd') > 1000) errs.maxPriceUsd = t('aiAnalysis.settings.errPrice');
    else if (n('minPriceUsd') >= n('maxPriceUsd')) errs.maxPriceUsd = t('aiAnalysis.settings.errRange');
    if (!(n('maxSpendUsd') >= 0.3) || n('maxSpendUsd') > 20) errs.maxSpendUsd = t('aiAnalysis.settings.errSpend');
    if (sellerMode === 'specific' && !form.startSeller.trim()) errs.startSeller = t('aiAnalysis.settings.errSeller');
    return errs;
  }, [form, sellerMode, t]);

  const errors = { ...localErrors, ...fieldErrors };
  const hasErrors = Object.values(errors).some(Boolean);
  const aiBudget = Math.max(0, Number(form.maxSpendUsd) - PLATFORM_FEE_USD);

  const handleSave = async () => {
    if (hasErrors || saving) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        targetCount: Number(form.targetCount),
        minProfitUsd: Number(form.minProfitUsd),
        minPriceUsd: Number(form.minPriceUsd),
        maxPriceUsd: Number(form.maxPriceUsd),
        includeVariations: form.includeVariations,
        maxSpendUsd: Number(form.maxSpendUsd),
        startSeller: sellerMode === 'specific' ? form.startSeller.trim() : '',
      };
      const res = await aiAnalysisAPI.saveSettings(payload);
      onSaved?.(res.data?.settings || payload);
      onClose();
    } catch (err) {
      const fields = err?.response?.data?.fields;
      if (Array.isArray(fields)) setFieldErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      setError(err?.response?.data?.error || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const target = Number(form.targetCount) || 0;
  const rangeMax = Math.max(50, Number(form.maxPriceUsd) || 0);
  const left = Math.min(100, ((Number(form.minPriceUsd) || 0) / rangeMax) * 100);
  const right = Math.min(100, ((Number(form.maxPriceUsd) || 0) / rangeMax) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} aria-label={t('aiAnalysis.close')} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:rounded-3xl dark:bg-slate-950">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold">{t('aiAnalysis.settings.title')}</h2>
              <p className="text-xs text-white/80">{t('aiAnalysis.settings.subtitle')}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label={t('aiAnalysis.close')}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Target count */}
              <Section icon={Target} title={t('aiAnalysis.settings.targetTitle')} hint={t('aiAnalysis.settings.targetHint')}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => set('targetCount')(String(Math.max(1, target - 1)))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="-"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.targetCount}
                    onChange={(e) => set('targetCount')(e.target.value)}
                    className={`input-base h-10 w-20 text-center text-lg font-bold ${errors.targetCount ? 'border-rose-400' : ''}`}
                    aria-label={t('aiAnalysis.settings.targetTitle')}
                  />
                  <button
                    type="button"
                    onClick={() => set('targetCount')(String(Math.min(20, target + 1)))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="+"
                  >
                    <Plus size={14} />
                  </button>
                  <span className="text-xs text-slate-500">{t('aiAnalysis.settings.products')}</span>
                </div>
                {errors.targetCount && <p className="mt-1 text-xs text-rose-600">{errors.targetCount}</p>}
              </Section>

              {/* Min profit */}
              <Section icon={Coins} accent="emerald" title={t('aiAnalysis.settings.profitTitle')} hint={t('aiAnalysis.settings.profitHint')}>
                <MoneyInput value={form.minProfitUsd} onChange={set('minProfitUsd')} invalid={errors.minProfitUsd} ariaLabel={t('aiAnalysis.settings.profitTitle')} />
                <Chips values={PROFIT_CHIPS} current={form.minProfitUsd} onPick={set('minProfitUsd')} />
                {errors.minProfitUsd && <p className="mt-1 text-xs text-rose-600">{errors.minProfitUsd}</p>}
              </Section>
            </div>

            {/* Price range */}
            <Section icon={SlidersHorizontal} accent="sky" title={t('aiAnalysis.settings.priceTitle')} hint={t('aiAnalysis.settings.priceHint')}>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <MoneyInput value={form.minPriceUsd} onChange={set('minPriceUsd')} invalid={errors.minPriceUsd} ariaLabel="Min" />
                </div>
                <span className="text-slate-400">—</span>
                <div className="flex-1">
                  <MoneyInput value={form.maxPriceUsd} onChange={set('maxPriceUsd')} invalid={errors.maxPriceUsd} ariaLabel="Max" />
                </div>
              </div>
              <div className="relative mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="absolute h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                  style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>$0</span>
                <span>${rangeMax}</span>
              </div>
              <Chips
                values={PRICE_PRESETS.map((_, i) => i)}
                current={PRICE_PRESETS.findIndex(([a, b]) => Number(form.minPriceUsd) === a && Number(form.maxPriceUsd) === b)}
                onPick={(i) => {
                  const [a, b] = PRICE_PRESETS[Number(i)];
                  set('minPriceUsd')(String(a));
                  set('maxPriceUsd')(String(b));
                }}
                format={(i) => `$${PRICE_PRESETS[i][0]}–$${PRICE_PRESETS[i][1]}`}
              />
              {(errors.minPriceUsd || errors.maxPriceUsd) && <p className="mt-1 text-xs text-rose-600">{errors.minPriceUsd || errors.maxPriceUsd}</p>}
            </Section>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Variations */}
              <Section icon={Layers} accent="amber" title={t('aiAnalysis.settings.variationsTitle')} hint={t('aiAnalysis.settings.variationsHint')}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.includeVariations}
                  onClick={() => set('includeVariations')(!form.includeVariations)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left dark:border-slate-700"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {form.includeVariations ? t('aiAnalysis.settings.variationsOn') : t('aiAnalysis.settings.variationsOff')}
                  </span>
                  <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.includeVariations ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${form.includeVariations ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </span>
                </button>
              </Section>

              {/* Spend stop line */}
              <Section icon={Wallet} accent="rose" title={t('aiAnalysis.settings.spendTitle')} hint={t('aiAnalysis.settings.spendHint')}>
                <MoneyInput value={form.maxSpendUsd} onChange={set('maxSpendUsd')} invalid={errors.maxSpendUsd} ariaLabel={t('aiAnalysis.settings.spendTitle')} />
                <Chips values={SPEND_CHIPS} current={form.maxSpendUsd} onPick={set('maxSpendUsd')} />
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {t('aiAnalysis.settings.spendBreakdown', { ai: aiBudget.toFixed(2), fee: PLATFORM_FEE_USD.toFixed(2) })}
                </p>
                {errors.maxSpendUsd && <p className="mt-1 text-xs text-rose-600">{errors.maxSpendUsd}</p>}
              </Section>
            </div>

            {/* Start store */}
            <Section icon={Store} title={t('aiAnalysis.settings.sellerTitle')} hint={t('aiAnalysis.settings.sellerHint')}>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {[
                  ['random', Shuffle, t('aiAnalysis.settings.sellerRandom')],
                  ['specific', Store, t('aiAnalysis.settings.sellerSpecific')],
                ].map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSellerMode(mode)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      sellerMode === mode ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
              {sellerMode === 'random' ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('aiAnalysis.settings.sellerRandomHint', { count: sellers.length })}
                </p>
              ) : (
                <div className="mt-2">
                  <input
                    className={`input-base h-10 text-sm ${errors.startSeller ? 'border-rose-400' : ''}`}
                    placeholder={t('aiAnalysis.settings.sellerPlaceholder')}
                    value={form.startSeller}
                    list="ai-analysis-start-sellers"
                    onChange={(e) => set('startSeller')(e.target.value)}
                  />
                  <datalist id="ai-analysis-start-sellers">
                    {sellers.map((s) => (
                      <option key={s.id} value={s.sellerName} />
                    ))}
                  </datalist>
                  {sellers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sellers.slice(0, 12).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => set('startSeller')(s.sellerName)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            form.startSeller === s.sellerName
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {s.sellerName}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.startSeller && <p className="mt-1 text-xs text-rose-600">{errors.startSeller}</p>}
                </div>
              )}
            </Section>

            {/* Summary */}
            {!hasErrors && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                {t('aiAnalysis.settings.summary', {
                  count: target,
                  min: Number(form.minPriceUsd),
                  max: Number(form.maxPriceUsd),
                  profit: Number(form.minProfitUsd).toFixed(2),
                  spend: Number(form.maxSpendUsd).toFixed(2),
                  variations: form.includeVariations ? t('aiAnalysis.settings.summaryWithVariations') : t('aiAnalysis.settings.summaryNoVariations'),
                  seller: sellerMode === 'specific' && form.startSeller.trim() ? form.startSeller.trim() : t('aiAnalysis.settings.summaryRandomSeller'),
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setForm(toForm(DEFAULTS));
              setSellerMode('random');
              setFieldErrors({});
            }}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <RotateCcw size={13} /> {t('aiAnalysis.settings.reset')}
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-none">
              {t('aiAnalysis.settings.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={hasErrors || saving || loading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('aiAnalysis.settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
