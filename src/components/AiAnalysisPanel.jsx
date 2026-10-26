import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, CheckCircle2, ChevronDown, ExternalLink, Loader2, Lock, ShieldCheck, Square, X } from 'lucide-react';
import { aiAnalysisAPI } from '../services/api';

const POLL_MS = 3000;

function fmtMoney(value, currency = 'USD', digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num);
  } catch {
    return `${num.toFixed(digits)} ${currency}`;
  }
}

function fmtNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num).toLocaleString() : '—';
}

function fmtPercent(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}%` : '—';
}

function fmtDuration(ms) {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

// Direction of the real Sales Trend points (first half vs second half) —
// a description of the data, never extra data.
function describeTrend(points = []) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const mid = Math.floor(points.length / 2);
  const sum = (list) => list.reduce((acc, p) => acc + (Number(p.sales) || 0), 0);
  const first = sum(points.slice(0, mid)) / Math.max(1, mid);
  const second = sum(points.slice(mid)) / Math.max(1, points.length - mid);
  if (first === 0 && second === 0) return 'flat';
  const change = first === 0 ? 1 : (second - first) / first;
  if (change > 0.15) return 'rising';
  if (change < -0.15) return 'falling';
  return 'steady';
}

// Run state for the AI Analysis button + results (MarketAnalysisPage.jsx).
// Restores the admin's latest run on load and polls while it is running.
export function useAiAnalysisRun({ enabled }) {
  const [run, setRun] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const startingRef = useRef(false);

  const refresh = useCallback(async (runId) => {
    const res = await aiAnalysisAPI.get(runId);
    setRun(res.data?.run || null);
    return res.data?.run || null;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    aiAnalysisAPI
      .getLatest()
      .then((res) => {
        if (!cancelled) {
          const latest = res.data?.run || null;
          setRun(latest);
          // Only reopen a finished run automatically if it is still running.
          setDismissed(latest?.status !== 'running');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || run?.status !== 'running') return undefined;
    const timer = setInterval(() => {
      refresh(run.id).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, run?.id, run?.status, refresh]);

  const start = useCallback(async () => {
    // Guards accidental double clicks before React re-renders the button.
    if (startingRef.current || run?.status === 'running') return;
    startingRef.current = true;
    setStarting(true);
    setError('');
    try {
      const res = await aiAnalysisAPI.start();
      setRun(res.data?.run || null);
      setDismissed(false);
    } catch (err) {
      const runId = err?.response?.data?.runId;
      if (err?.response?.status === 409 && runId) {
        await refresh(runId).catch(() => {});
        setDismissed(false);
      } else {
        setError(err?.response?.data?.error || err?.message || 'Failed to start AI Analysis');
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [run?.status, refresh]);

  const cancel = useCallback(async () => {
    if (!run?.id) return;
    try {
      const res = await aiAnalysisAPI.cancel(run.id);
      setRun(res.data?.run || run);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to cancel');
    }
  }, [run]);

  return {
    run,
    starting,
    error,
    setError,
    start,
    cancel,
    visible: Boolean(run) && !dismissed,
    show: () => setDismissed(false),
    dismiss: () => setDismissed(true),
  };
}

export function AiAnalysisButton({ isAdmin, run, starting, onStart, onShow, disabled }) {
  const { t } = useTranslation();
  const running = run?.status === 'running';
  const handleClick = () => {
    if (!isAdmin) return;
    if (running) {
      onShow?.();
      return;
    }
    onStart();
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAdmin || starting || disabled}
      title={!isAdmin ? t('aiAnalysis.adminOnly') : undefined}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-500 to-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:w-52 dark:border-emerald-500/30"
    >
      {!isAdmin ? <Lock size={14} /> : starting || running ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
      {running
        ? t('aiAnalysis.runningButton', { found: run.confirmedCount, target: run.targetCount })
        : t('aiAnalysis.button')}
    </button>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

function OpportunityCard({ opportunity, renderSalesTrend }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { ebay = {}, amazon = {}, market = {}, profit = {}, verification = {} } = opportunity;
  const trend = describeTrend(market.salesTrend);
  const hasTrend = Array.isArray(market.salesTrend) && market.salesTrend.length > 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* eBay */}
        <div className="flex gap-3 lg:col-span-5">
          {ebay.thumbnail ? (
            <img src={ebay.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">#{opportunity.position} · eBay</p>
            <a href={ebay.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              {ebay.title}
            </a>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {fmtMoney(ebay.priceUsd, ebay.currency)} · {t('aiAnalysis.sold7d', { count: ebay.sold7d ?? 0 })} · STR {fmtPercent(market.sellThroughPct)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ebay.sellerProfileUrl ? (
                <a href={ebay.sellerProfileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
                  {ebay.sellerUsername}
                </a>
              ) : (
                ebay.sellerUsername || '—'
              )}{' '}
              ({t('aiAnalysis.feedback')}: {fmtNumber(ebay.sellerFeedbackScore)}){ebay.sellerCountry ? ` · ${ebay.sellerCountry}` : ''}
            </p>
          </div>
        </div>

        {/* Amazon */}
        <div className="flex gap-3 lg:col-span-4">
          {amazon.thumbnail ? (
            <img src={amazon.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
              Amazon
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold normal-case text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <ShieldCheck size={10} /> {verification.verdict} {fmtPercent((verification.confidence || 0) * 100)}
              </span>
            </p>
            <a href={amazon.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100">
              {amazon.title}
            </a>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {fmtMoney(amazon.priceUsd, amazon.currency)} · ASIN {amazon.asin}
            </p>
            <a href={amazon.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
              {t('aiAnalysis.openAmazon')} <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Profit */}
        <div className="rounded-xl bg-slate-50 p-3 lg:col-span-3 dark:bg-slate-800/60">
          {profit.available ? (
            <>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{t('aiAnalysis.estimatedProfit')}</p>
              <p className={`text-lg font-bold ${profit.profitPerUnitUsd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {fmtMoney(profit.profitPerUnitUsd, profit.currency)} <span className="text-xs font-semibold text-slate-500">/ {t('aiAnalysis.unit')}</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('aiAnalysis.margin')}: {fmtPercent(profit.marginPct)} · {fmtMoney(profit.ebayPriceUsd)} − {fmtMoney(profit.amazonPriceUsd)}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">{t('aiAnalysis.profitUnavailable')}</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
        {open ? t('aiAnalysis.hideDetails') : t('aiAnalysis.showDetails')}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl bg-indigo-50 p-3 text-xs leading-5 text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-100">
            {t('aiAnalysis.summary', {
              ebayPrice: fmtMoney(ebay.priceUsd, ebay.currency),
              amazonPrice: fmtMoney(amazon.priceUsd, amazon.currency),
              sold7d: ebay.sold7d ?? 0,
              str: fmtPercent(market.sellThroughPct),
              seller: ebay.sellerUsername || '—',
              feedback: fmtNumber(ebay.sellerFeedbackScore),
              listings: fmtNumber(market.totalListings),
              totalSold: fmtNumber(market.totalSold),
              profit: profit.available ? fmtMoney(profit.profitPerUnitUsd, profit.currency) : '—',
              asin: amazon.asin,
            })}{' '}
            {trend ? t(`aiAnalysis.trend.${trend}`) : t('aiAnalysis.trend.none')}
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label={t('aiAnalysis.sold7dLabel')} value={fmtNumber(ebay.sold7d)} />
            <Stat label={t('aiAnalysis.sellThrough')} value={fmtPercent(market.sellThroughPct)} hint={market.query ? `“${market.query}”` : null} />
            <Stat label={t('aiAnalysis.totalListings')} value={fmtNumber(market.totalListings)} />
            <Stat label={t('aiAnalysis.totalSold')} value={fmtNumber(market.totalSold)} />
          </div>
          {hasTrend ? (
            <div>
              {renderSalesTrend(market.salesTrend)}
              <p className="mt-1 text-[11px] text-slate-400">
                {t('aiAnalysis.trendPeriod', { days: market.salesTrendPeriodDays || market.salesTrend.length })}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">{t('aiAnalysis.trend.none')}</p>
          )}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <p>
              <span className="font-semibold">{t('aiAnalysis.verification')}:</span> {verification.reason || '—'}
            </p>
            {verification.matchedAttributes?.length > 0 && <p>✓ {verification.matchedAttributes.join(' · ')}</p>}
            <p className="mt-1 text-[11px] text-slate-400">{t('aiAnalysis.profitDisclaimer')}</p>
          </div>
        </div>
      )}
    </article>
  );
}

export function AiAnalysisResults({ run, error, onCancel, onDismiss, renderSalesTrend }) {
  const { t } = useTranslation();
  if (!run) return null;
  const running = run.status === 'running';
  const billing = run.billing || {};
  const counters = run.counters || {};

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            {running ? <Loader2 size={16} className="animate-spin text-emerald-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
            {t('aiAnalysis.title')} — {t(`aiAnalysis.status.${run.status}`, { defaultValue: run.status })}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {run.strategy ? t(`aiAnalysis.strategy.${run.strategy}`) : t('aiAnalysis.preparing')}
            {run.seed ? `: ${run.seed}` : ''}
            {run.stopReason ? ` · ${t(`aiAnalysis.stopReason.${run.stopReason}`, { defaultValue: run.stopReason })}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <button type="button" onClick={onCancel} disabled={run.cancelRequested} className="btn-secondary flex items-center gap-1.5 text-xs">
              <Square size={12} /> {run.cancelRequested ? t('aiAnalysis.cancelling') : t('aiAnalysis.cancel')}
            </button>
          )}
          {!running && (
            <button type="button" onClick={onDismiss} className="btn-secondary flex items-center gap-1.5 text-xs" aria-label={t('aiAnalysis.close')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {(error || run.error) && (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error || run.error}</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <Stat label={t('aiAnalysis.confirmed')} value={`${run.confirmedCount} / ${run.targetCount}`} />
        <Stat label={t('aiAnalysis.evaluated')} value={fmtNumber(counters.candidatesEvaluated)} />
        <Stat label={t('aiAnalysis.amazonSearches')} value={fmtNumber(counters.amazonSearches)} />
        <Stat label={t('aiAnalysis.aiChecks')} value={fmtNumber(billing.aiCallCount)} />
        <Stat
          label={t('aiAnalysis.aiCost')}
          value={fmtMoney(billing.aiCostUsd, 'USD', 4)}
          hint={billing.isFinal ? t('aiAnalysis.actual') : t('aiAnalysis.estimate')}
        />
        <Stat label={t('aiAnalysis.platformFee')} value={fmtMoney(billing.isFinal ? billing.platformFeeUsd : 0.2)} />
        <Stat
          label={t('aiAnalysis.totalCharge')}
          value={`${fmtMoney(billing.totalChargeUsd, 'USD', 4)}`}
          hint={`${Number(billing.totalChargeAzn || 0).toFixed(4)} AZN · ${billing.isFinal ? t(`aiAnalysis.billing.${billing.status}`, { defaultValue: billing.status }) : t('aiAnalysis.estimate')}`}
        />
        <Stat label={t('aiAnalysis.duration')} value={fmtDuration(run.durationMs)} />
      </div>

      {billing.status === 'failed' && billing.error && (
        <p className="mt-2 text-xs text-rose-600">{t('aiAnalysis.billingFailed')}: {billing.error}</p>
      )}

      {running && run.recentEvents?.length > 0 && (
        <ul className="mt-3 max-h-28 space-y-0.5 overflow-y-auto rounded-xl bg-white/70 p-2 text-[11px] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
          {run.recentEvents.slice(0, 8).map((event, i) => (
            <li key={`${event.at}-${i}`} className="truncate">
              {event.message}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-3">
        {(run.opportunities || []).map((opportunity) => (
          <OpportunityCard key={`${opportunity.position}-${opportunity.ebay?.itemId}`} opportunity={opportunity} renderSalesTrend={renderSalesTrend} />
        ))}
        {!running && !(run.opportunities || []).length && (
          <p className="rounded-xl bg-white/70 p-4 text-sm text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">{t('aiAnalysis.noResults')}</p>
        )}
      </div>

      {!running && (
        <p className="mt-3 text-[11px] text-slate-400">{t('aiAnalysis.limitations')}</p>
      )}
    </section>
  );
}
