// Dashboard "Action Center" — what the seller should do today. Data comes from
// GET /ebay/action-center (backend services/actionCenter.js), which reads only
// cached/stored data; it reloads whenever EbayDataContext finishes a bootstrap
// sync, and the refresh button forces one.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlarmClock,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  Gavel,
  ListChecks,
  PackageX,
  RefreshCw,
  ShoppingCart,
  Snowflake,
  Truck,
} from 'lucide-react';
import { ebayAPI } from '../services/api';
import { useEbayData } from '../context/EbayDataContext';
import DailyTaskList from './DailyTaskList';

const HOUR_MS = 60 * 60 * 1000;
const PREVIEW_ROWS = 3;

const TONES = {
  rose: { icon: 'text-rose-500', tileLight: 'bg-rose-50', tileDark: 'bg-rose-500/10' },
  indigo: { icon: 'text-indigo-500', tileLight: 'bg-indigo-50', tileDark: 'bg-indigo-500/10' },
  teal: { icon: 'text-teal-500', tileLight: 'bg-teal-50', tileDark: 'bg-teal-500/10' },
  amber: { icon: 'text-amber-500', tileLight: 'bg-amber-50', tileDark: 'bg-amber-500/10' },
  violet: { icon: 'text-violet-500', tileLight: 'bg-violet-50', tileDark: 'bg-violet-500/10' },
  sky: { icon: 'text-sky-500', tileLight: 'bg-sky-50', tileDark: 'bg-sky-500/10' },
};

// Fixed, workflow-ordered card config. `itemHref` returns where a preview row goes.
const SECTION_CONFIG = {
  shipDeadline: { icon: AlarmClock, tone: 'rose', href: '/orders', itemHref: (item) => `/orders/${encodeURIComponent(item.id)}` },
  toPurchase: { icon: ShoppingCart, tone: 'indigo', href: '/orders', itemHref: (item) => `/orders/${encodeURIComponent(item.id)}` },
  awaitingTracking: { icon: Truck, tone: 'teal', href: '/tracking', itemHref: () => '/tracking' },
  openCases: { icon: Gavel, tone: 'amber', href: '/cases', itemHref: () => '/cases' },
  stockPrice: { icon: PackageX, tone: 'violet', href: '/products', itemHref: () => '/products' },
  deadStock: { icon: Snowflake, tone: 'sky', href: '/listings', itemHref: (item) => (item.id ? `/listings/${encodeURIComponent(item.id)}` : '/listings') },
};

function severityStyles(severity, isDark) {
  switch (severity) {
    case 'critical':
      return {
        card: isDark ? 'border-rose-500/40 ring-1 ring-rose-500/20' : 'border-rose-200 ring-1 ring-rose-100',
        bar: 'from-rose-500 to-orange-400',
        pill: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700',
        dot: 'bg-rose-500',
      };
    case 'warning':
      return {
        card: isDark ? 'border-amber-500/30' : 'border-amber-200',
        bar: 'from-amber-400 to-yellow-300',
        pill: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
      };
    case 'info':
      return {
        card: isDark ? 'border-sky-500/25' : 'border-sky-200',
        bar: 'from-sky-400 to-indigo-400',
        pill: isDark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-50 text-sky-700',
        dot: 'bg-sky-500',
      };
    default:
      return {
        card: isDark ? 'border-slate-800' : 'border-slate-200',
        bar: null,
        pill: isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
      };
  }
}

function useDurationText(t) {
  return useCallback(
    (ms) => {
      const abs = Math.abs(ms);
      if (abs < HOUR_MS) return t('actionCenter.time.minutes', { count: Math.max(1, Math.round(abs / 60000)) });
      if (abs < 48 * HOUR_MS) return t('actionCenter.time.hours', { count: Math.round(abs / HOUR_MS) });
      return t('actionCenter.time.days', { count: Math.round(abs / (24 * HOUR_MS)) });
    },
    [t]
  );
}

function MetaPill({ tone, isDark, children }) {
  const cls = {
    danger: 'bg-rose-600 text-white',
    hot: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700',
    warn: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700',
    neutral: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600',
  }[tone || 'neutral'];
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

function formatMoney(amount) {
  if (!amount || !Number.isFinite(Number(amount.value))) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: amount.currency || 'USD' }).format(Number(amount.value));
  } catch {
    return `${amount.value} ${amount.currency || ''}`.trim();
  }
}

// Per-section row content: { title, subtitle, meta: { tone, text } | null }.
function useRowRenderer(t, now) {
  const duration = useDurationText(t);
  return useCallback(
    (key, item) => {
      const countdown = (dueAt) => {
        if (!dueAt) return null;
        const left = dueAt - now;
        if (left < 0) return { tone: 'danger', text: t('actionCenter.overdue', { time: duration(left) }) };
        return { tone: left <= 12 * HOUR_MS ? 'hot' : left <= 24 * HOUR_MS ? 'warn' : 'neutral', text: t('actionCenter.timeLeft', { time: duration(left) }) };
      };
      switch (key) {
        case 'shipDeadline':
        case 'toPurchase':
          return {
            title: item.title,
            subtitle: [item.buyer, formatMoney(item.total)].filter(Boolean).join(' · ') || item.id,
            meta: countdown(item.dueAt) || (item.total ? { tone: 'neutral', text: formatMoney(item.total) } : null),
          };
        case 'awaitingTracking':
          return {
            title: item.title,
            subtitle: t('actionCenter.amazonOrder', { id: item.amazonOrderId }),
            meta: item.createdAt ? { tone: now - item.createdAt >= 72 * HOUR_MS ? 'hot' : 'neutral', text: t('actionCenter.ago', { time: duration(now - item.createdAt) }) } : null,
          };
        case 'openCases':
          return {
            title: `${t(`actionCenter.caseKind.${item.kind}`)} · ${item.title}`,
            subtitle: formatMoney(item.amount) || item.id,
            meta: countdown(item.dueAt) || { tone: 'warn', text: t('actionCenter.needsReply') },
          };
        case 'stockPrice':
          return {
            title: item.title,
            subtitle: item.amazonPrice ? t('actionCenter.amazonPrice', { price: `$${Number(item.amazonPrice).toFixed(2)}` }) : '',
            meta: item.reason === 'outOfStock'
              ? { tone: 'hot', text: t('actionCenter.outOfStock') }
              : { tone: 'warn', text: `+${item.priceChangePct}%` },
          };
        case 'deadStock':
          return {
            title: item.title,
            subtitle: item.price || '',
            meta: item.daysSinceListed != null ? { tone: 'neutral', text: t('actionCenter.noSaleDays', { count: item.daysSinceListed }) } : null,
          };
        default:
          return { title: item.title, subtitle: '', meta: null };
      }
    },
    [t, now, duration]
  );
}

function ActionCard({ section, isDark, renderRow, onNavigate }) {
  const { t } = useTranslation('system');
  const config = SECTION_CONFIG[section.key];
  if (!config) return null;
  const Icon = config.icon;
  const tone = TONES[config.tone];
  const sev = severityStyles(section.severity, isDark);
  const isClear = section.severity === 'ok';
  const rows = section.items.slice(0, PREVIEW_ROWS);
  const more = section.count - rows.length;

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-lg ${
        isDark ? 'bg-slate-900/60 hover:shadow-black/30' : 'bg-white hover:shadow-slate-200/80'
      } ${sev.card}`}
    >
      {sev.bar && <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${sev.bar}`} />}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isDark ? tone.tileDark : tone.tileLight}`}>
              <Icon size={20} className={tone.icon} />
            </div>
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t(`actionCenter.sections.${section.key}.title`)}
              </p>
              <p className={`truncate text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t(`actionCenter.sections.${section.key}.hint`)}
              </p>
            </div>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${sev.pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
            {t(`actionCenter.severity.${section.severity}`)}
          </span>
        </div>

        {!section.synced ? (
          <div className={`mt-5 flex flex-1 items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm ${
            isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'
          }`}>
            <CloudOff size={18} className="shrink-0" />
            <span>{t('actionCenter.notSynced')}</span>
          </div>
        ) : isClear ? (
          <div className="mt-5 flex flex-1 items-center gap-3">
            <CheckCircle2 size={28} className="shrink-0 text-emerald-500" />
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t(`actionCenter.sections.${section.key}.clear`)}</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-baseline gap-2">
              <span className={`text-4xl font-bold tracking-tight tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>{section.count}</span>
              <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t(`actionCenter.sections.${section.key}.unit`, { count: section.count })}
              </span>
            </div>

            <ul className="mt-3 space-y-1">
              {rows.map((item) => {
                const row = renderRow(section.key, item);
                return (
                  <li key={`${section.key}-${item.kind || ''}-${item.id}`}>
                    <button
                      type="button"
                      onClick={() => onNavigate(config.itemHref(item))}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.title}</p>
                        {row.subtitle ? (
                          <p className={`truncate text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{row.subtitle}</p>
                        ) : null}
                      </div>
                      {row.meta ? <MetaPill tone={row.meta.tone} isDark={isDark}>{row.meta.text}</MetaPill> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {more > 0 && (
              <p className={`mt-1 px-2.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('actionCenter.andMore', { count: more })}
              </p>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => onNavigate(config.href)}
        className={`flex items-center justify-between border-t px-5 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
          isDark ? 'border-slate-800 text-indigo-300 hover:bg-slate-800/60' : 'border-slate-100 text-indigo-600 hover:bg-indigo-50/60'
        }`}
      >
        {t(`actionCenter.sections.${section.key}.cta`)}
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

function SkeletonCard({ isDark }) {
  const block = isDark ? 'bg-slate-800' : 'bg-slate-200';
  return (
    <div className={`animate-pulse rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl ${block}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-3 w-1/2 rounded ${block}`} />
          <div className={`h-2.5 w-3/4 rounded ${block}`} />
        </div>
      </div>
      <div className={`mt-5 h-8 w-16 rounded ${block}`} />
      <div className="mt-4 space-y-2">
        <div className={`h-3 w-full rounded ${block}`} />
        <div className={`h-3 w-5/6 rounded ${block}`} />
      </div>
    </div>
  );
}

export default function ActionCenter({ isDark }) {
  const { t } = useTranslation('system');
  const navigate = useNavigate();
  const { syncVersion, refreshEbayData } = useEbayData();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await ebayAPI.getActionCenter();
      setData(res?.data || null);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('actionCenter.loadFailed'));
    } finally {
      setNow(Date.now());
      setLoading(false);
    }
  }, [t]);

  // Initial load + reload after each finished eBay sync (bootstrap).
  useEffect(() => {
    load();
  }, [load, syncVersion]);

  // Keep countdowns honest while the dashboard stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshEbayData();
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const renderRow = useRowRenderer(t, now);
  const sections = useMemo(() => (Array.isArray(data?.sections) ? data.sections.filter((s) => SECTION_CONFIG[s.key]) : []), [data]);
  const summary = data?.summary || { critical: 0, warning: 0, total: 0 };
  const allClear = !loading && !error && sections.length > 0 && summary.total === 0;

  const updatedText = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  if (!loading && !error && sections.length === 0) return null; // plan grants none of these tabs

  return (
    <section aria-labelledby="action-center-title" className="mb-6">
      <div className={`relative mb-4 overflow-hidden rounded-2xl border p-5 ${
        isDark
          ? 'border-slate-800 bg-gradient-to-br from-indigo-500/15 via-slate-900/60 to-slate-900/60'
          : 'border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-white'
      }`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-600'}`}>
              <ListChecks size={22} className={isDark ? 'text-indigo-300' : 'text-white'} />
            </div>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>
                {t('actionCenter.eyebrow')}
              </p>
              <h2 id="action-center-title" className={`text-lg font-bold sm:text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('actionCenter.title')}
              </h2>
              <p className={`mt-0.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {loading
                  ? t('actionCenter.loading')
                  : allClear
                    ? t('actionCenter.allClear')
                    : t('actionCenter.pending', { count: summary.total })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {summary.critical > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-100 text-rose-700'}`}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                {t('actionCenter.criticalCount', { count: summary.critical })}
              </span>
            )}
            {summary.warning > 0 && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t('actionCenter.warningCount', { count: summary.warning })}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label={t('actionCenter.refresh')}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                isDark ? 'border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? t('actionCenter.refreshing') : updatedText ? t('actionCenter.updatedAt', { time: updatedText }) : t('actionCenter.refresh')}
            </button>
          </div>
        </div>
      </div>

      <DailyTaskList isDark={isDark} />

      {error ? (
        <div className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm ${
          isDark ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); load(); }} className="shrink-0 font-semibold underline">
            {t('actionCenter.retry')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} isDark={isDark} />)
            : sections.map((section) => (
                <ActionCard key={section.key} section={section} isDark={isDark} renderRow={renderRow} onNavigate={navigate} />
              ))}
        </div>
      )}
    </section>
  );
}
