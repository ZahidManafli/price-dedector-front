import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Gauge,
  Lock,
  ShieldCheck,
  Table as TableIcon,
  TrendingUp,
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

// ─── shared color tokens ────────────────────────────────────────────────────

const RATING_STYLE = {
  LOW: { light: 'bg-emerald-50 border-emerald-200 text-emerald-700', dark: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300', dot: '#10b981' },
  AVERAGE: { light: 'bg-sky-50 border-sky-200 text-sky-700', dark: 'bg-sky-950/40 border-sky-800/60 text-sky-300', dot: '#0ea5e9' },
  HIGH: { light: 'bg-amber-50 border-amber-200 text-amber-700', dark: 'bg-amber-950/40 border-amber-800/60 text-amber-300', dot: '#f59e0b' },
  VERY_HIGH: { light: 'bg-rose-50 border-rose-200 text-rose-700', dark: 'bg-rose-950/40 border-rose-800/60 text-rose-300', dot: '#ef4444' },
  NOT_APPLICABLE: { light: 'bg-slate-100 border-slate-200 text-slate-600', dark: 'bg-slate-900/50 border-slate-700 text-slate-400', dot: '#94a3b8' },
};

const LEVEL_STYLE = {
  TOP_RATED: { light: 'bg-emerald-50 border-emerald-200 text-emerald-700', dark: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300', dot: '#10b981' },
  ABOVE_STANDARD: { light: 'bg-sky-50 border-sky-200 text-sky-700', dark: 'bg-sky-950/40 border-sky-800/60 text-sky-300', dot: '#0ea5e9' },
  BELOW_STANDARD: { light: 'bg-rose-50 border-rose-200 text-rose-700', dark: 'bg-rose-950/40 border-rose-800/60 text-rose-300', dot: '#ef4444' },
};

const RATE_METRIC_KEYS = new Set(['CLICK_THROUGH_RATE', 'SALES_CONVERSION_RATE']);

const TRAFFIC_METRIC_COLOR = {
  LISTING_IMPRESSION_TOTAL: '#6366f1',
  LISTING_IMPRESSION_SEARCH_RESULTS_PAGE: '#3b82f6',
  LISTING_IMPRESSION_STORE: '#06b6d4',
  TOTAL_IMPRESSION_TOTAL: '#0ea5e9',
  CLICK_THROUGH_RATE: '#f59e0b',
  LISTING_VIEWS_TOTAL: '#8b5cf6',
  LISTING_VIEWS_SOURCE_SEARCH_RESULTS_PAGE: '#a78bfa',
  LISTING_VIEWS_SOURCE_STORE: '#c084fc',
  LISTING_VIEWS_SOURCE_DIRECT: '#d946ef',
  LISTING_VIEWS_SOURCE_OTHER_EBAY: '#ec4899',
  LISTING_VIEWS_SOURCE_OFF_EBAY: '#f43f5e',
  SALES_CONVERSION_RATE: '#10b981',
  TRANSACTION: '#22c55e',
};

const DEFAULT_SELECTED_METRICS = ['LISTING_IMPRESSION_TOTAL', 'LISTING_VIEWS_TOTAL', 'TRANSACTION', 'SALES_CONVERSION_RATE'];

function formatNumber(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ─── small building blocks ──────────────────────────────────────────────────

function SectionCard({ isDark, className = '', children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function StatTile({ isDark, icon: Icon, label, value, sublabel, accent = 'indigo' }) {
  const accentMap = {
    indigo: { text: 'text-indigo-500', ring: 'from-indigo-500/15' },
    emerald: { text: 'text-emerald-500', ring: 'from-emerald-500/15' },
    rose: { text: 'text-rose-500', ring: 'from-rose-500/15' },
    amber: { text: 'text-amber-500', ring: 'from-amber-500/15' },
    violet: { text: 'text-violet-500', ring: 'from-violet-500/15' },
    sky: { text: 'text-sky-500', ring: 'from-sky-500/15' },
  };
  const a = accentMap[accent] || accentMap.indigo;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 ${
        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className={`pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-br ${a.ring} to-transparent blur-xl`} />
      <div className="relative flex items-center gap-1.5">
        {Icon && <Icon size={12} className={a.text} />}
        <p className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      </div>
      <p className={`relative mt-1 text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
      {sublabel && <p className={`relative text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{sublabel}</p>}
    </div>
  );
}

function RatingBadge({ isDark, rating, t }) {
  const style = RATING_STYLE[rating] || RATING_STYLE.NOT_APPLICABLE;
  const labelKey = {
    LOW: 'dashboard.ratingLow',
    AVERAGE: 'dashboard.ratingAverage',
    HIGH: 'dashboard.ratingHigh',
    VERY_HIGH: 'dashboard.ratingVeryHigh',
    NOT_APPLICABLE: 'dashboard.ratingNotApplicable',
  }[rating] || 'dashboard.ratingNotApplicable';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${isDark ? style.dark : style.light}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {t(labelKey)}
    </span>
  );
}

function LevelBadge({ isDark, level, t }) {
  const style = LEVEL_STYLE[level] || RATING_STYLE.NOT_APPLICABLE;
  const labelKey = {
    TOP_RATED: 'dashboard.levelTopRated',
    ABOVE_STANDARD: 'dashboard.levelAboveStandard',
    BELOW_STANDARD: 'dashboard.levelBelowStandard',
  }[level] || null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${isDark ? style.dark : style.light}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {labelKey ? t(labelKey) : (level || '—')}
    </span>
  );
}

function WidgetDenied({ isDark, message, t }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-dashed px-3 py-4 text-xs ${
      isDark ? 'border-slate-700 text-slate-400 bg-slate-950/30' : 'border-slate-300 text-slate-500 bg-slate-50'
    }`}>
      <Lock size={14} className="mt-0.5 shrink-0" />
      <span>{message || t('dashboard.widgetAccessDenied')}</span>
    </div>
  );
}

function EmptyState({ isDark, children }) {
  return (
    <div className={`rounded-xl border border-dashed px-3 py-6 text-center text-xs ${
      isDark ? 'border-slate-700 text-slate-400 bg-slate-950/30' : 'border-slate-300 text-slate-500 bg-slate-50'
    }`}>
      {children}
    </div>
  );
}

// ─── customer service metric card ───────────────────────────────────────────

function CustomerServiceCard({ isDark, t, title, data }) {
  const [expanded, setExpanded] = useState(false);
  const dimensions = data?.dimensions || [];
  const top = dimensions[0] || null;
  const visibleDimensions = expanded ? dimensions : dimensions.slice(0, 3);

  return (
    <SectionCard isDark={isDark} className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-950/50' : 'bg-indigo-50'}`}>
          <Gauge size={15} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.customerServiceHint')}</p>
        </div>
      </div>

      {data?.accessDenied ? (
        <div className="mt-3">
          <WidgetDenied isDark={isDark} message={data?.accessDeniedErrorMessage} t={t} />
        </div>
      ) : dimensions.length === 0 ? (
        <div className="mt-3">
          <EmptyState isDark={isDark}>{t('dashboard.noData')}</EmptyState>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {top?.name || t('dashboard.topCategory')}
            </p>
            <RatingBadge isDark={isDark} rating={top?.rating} t={t} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.yourRate')}</p>
              <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {Number(top?.rate || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.benchmarkAverage')}</p>
              <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {top?.benchmarkAverage != null ? Number(top.benchmarkAverage).toFixed(2) : '—'}
              </p>
            </div>
          </div>

          {/* rate vs benchmark comparison bar */}
          {top?.rate != null && top?.benchmarkAverage != null && (
            (() => {
              const rate = Number(top.rate) || 0;
              const bench = Number(top.benchmarkAverage) || 0;
              const max = Math.max(rate, bench, 0.0001) * 1.25;
              return (
                <div className="mt-3 space-y-1.5">
                  <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (rate / max) * 100)}%` }} />
                  </div>
                  <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                    <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${Math.min(100, (bench / max) * 100)}%` }} />
                  </div>
                </div>
              );
            })()
          )}

          {dimensions.length > 1 && (
            <div className="mt-4 space-y-1.5">
              {visibleDimensions.map((dm, i) => (
                <div
                  key={`${dm.dimensionKey}-${dm.value}-${i}`}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                    isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{dm.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {Number(dm.rate || 0).toFixed(2)}
                    </span>
                    <RatingBadge isDark={isDark} rating={dm.rating} t={t} />
                  </div>
                </div>
              ))}
              {dimensions.length > 3 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className={`w-full mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-lg transition ${
                    isDark ? 'text-indigo-400 hover:bg-slate-900/60' : 'text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  {expanded ? t('dashboard.showLess') : t('dashboard.viewAllCategories')}
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── seller standards profile card ──────────────────────────────────────────

function MetricThresholdBar({ isDark, metric, t }) {
  const lower = Number(metric.thresholdLowerBound);
  const upper = Number(metric.thresholdUpperBound);
  const value = Number(metric.value);
  const hasRange = Number.isFinite(lower) && Number.isFinite(upper) && upper > lower && Number.isFinite(value);
  if (!hasRange) return null;
  const pct = Math.min(100, Math.max(0, ((value - lower) / (upper - lower)) * 100));
  return (
    <div className="mt-1.5">
      <div className={`h-1.5 w-full rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
      <div className={`flex justify-between text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        <span>{t('dashboard.lowerBound')}: {formatNumber(lower, 1)}</span>
        <span>{t('dashboard.upperBound')}: {formatNumber(upper, 1)}</span>
      </div>
    </div>
  );
}

function SellerStandardsCard({ isDark, t, standards }) {
  const profiles = standards?.profiles || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const profile = profiles[activeIdx] || profiles[0] || null;

  return (
    <SectionCard isDark={isDark} className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-950/50' : 'bg-emerald-50'}`}>
          <ShieldCheck size={15} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.sellerStandardsProfile')}</p>
          <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.standardsLevel')}</p>
        </div>
      </div>

      {standards?.accessDenied ? (
        <div className="mt-3">
          <WidgetDenied isDark={isDark} message={standards?.accessDeniedErrorMessage} t={t} />
        </div>
      ) : !profile ? (
        <div className="mt-3">
          <EmptyState isDark={isDark}>{t('dashboard.noStandardsData')}</EmptyState>
        </div>
      ) : (
        <div className="mt-3">
          {profiles.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {profiles.map((p, i) => (
                <button
                  key={`${p.program}-${p.cycle?.cycleType}-${i}`}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                    i === activeIdx
                      ? isDark ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-indigo-600 border-indigo-600 text-white'
                      : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-900/60' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.program} · {p.cycle?.cycleType || t('dashboard.current')}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <LevelBadge isDark={isDark} level={profile.standardslevel} t={t} />
            <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {profile.cycle?.evaluationMonth ? `${t('dashboard.evaluationMonth')}: ${profile.cycle.evaluationMonth}` : ''}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div className={`rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-slate-800 bg-slate-950/30 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              {t('dashboard.program')}: <span className={isDark ? 'text-slate-200 font-semibold' : 'text-slate-800 font-semibold'}>{profile.program || '-'}</span>
            </div>
            <div className={`rounded-lg border px-2.5 py-1.5 ${isDark ? 'border-slate-800 bg-slate-950/30 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              {t('dashboard.metrics')}: <span className={isDark ? 'text-slate-200 font-semibold' : 'text-slate-800 font-semibold'}>{(profile.metrics || []).length}</span>
            </div>
          </div>

          <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {(profile.metrics || []).map((m) => (
              <div
                key={m.metricKey}
                className={`rounded-lg border px-3 py-2 ${isDark ? 'border-slate-800 bg-slate-950/30' : 'border-slate-200 bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{m.name || m.metricKey}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {m.value == null ? '-' : String(m.value)}
                    </span>
                    {m.level && <LevelBadge isDark={isDark} level={m.level} t={t} />}
                  </div>
                </div>
                <MetricThresholdBar isDark={isDark} metric={m} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── traffic report card ────────────────────────────────────────────────────

function TrafficReportTooltip({ active, payload, label, isDark, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-xs shadow-lg ${
        isDark ? 'bg-slate-950 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <p className={`font-semibold mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {t(`dashboard.trafficMetrics.${entry.dataKey}`, { defaultValue: entry.dataKey })}
          </span>
          <span className="font-bold">{Number(entry.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
        </div>
      ))}
    </div>
  );
}

function TrafficReportCard({ isDark, t, traffic }) {
  const [selected, setSelected] = useState(() => new Set(DEFAULT_SELECTED_METRICS));
  const [showTable, setShowTable] = useState(false);
  const metricKeys = traffic?.metricKeys || DEFAULT_SELECTED_METRICS;
  const points = traffic?.points || [];

  const chartData = useMemo(
    () => points.map((p) => ({ day: p.day, ...(p.values || {}) })),
    [points]
  );

  const totals = useMemo(() => {
    const sum = (key) => points.reduce((s, p) => s + Number(p?.values?.[key] || 0), 0);
    const avg = (key) => (points.length ? sum(key) / points.length : 0);
    return {
      totalImpressions: sum('LISTING_IMPRESSION_TOTAL'),
      totalViews: sum('LISTING_VIEWS_TOTAL'),
      avgClickThrough: avg('CLICK_THROUGH_RATE'),
      avgConversion: avg('SALES_CONVERSION_RATE'),
      totalTransactions: sum('TRANSACTION'),
    };
  }, [points]);

  const toggleMetric = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const volumeKeys = metricKeys.filter((k) => !RATE_METRIC_KEYS.has(k));
  const rateKeys = metricKeys.filter((k) => RATE_METRIC_KEYS.has(k));
  const activeVolume = volumeKeys.filter((k) => selected.has(k));
  const activeRate = rateKeys.filter((k) => selected.has(k));

  return (
    <SectionCard isDark={isDark} className="p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-950/50' : 'bg-violet-50'}`}>
            <TrendingUp size={15} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('dashboard.trafficReportTitle')}</p>
            <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.trafficReportSubtitle')}</p>
          </div>
        </div>
      </div>

      {traffic?.accessDenied ? (
        <WidgetDenied isDark={isDark} message={traffic?.accessDeniedErrorMessage} t={t} />
      ) : points.length === 0 ? (
        <EmptyState isDark={isDark}>{t('dashboard.noTrafficData')}</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            <StatTile isDark={isDark} icon={BarChart3} label={t('dashboard.totalImpressions')} value={formatNumber(totals.totalImpressions)} accent="indigo" />
            <StatTile isDark={isDark} icon={BarChart3} label={t('dashboard.totalViews')} value={formatNumber(totals.totalViews)} accent="violet" />
            <StatTile isDark={isDark} icon={Gauge} label={t('dashboard.avgClickThrough')} value={totals.avgClickThrough.toFixed(3)} accent="amber" />
            <StatTile isDark={isDark} icon={Gauge} label={t('dashboard.salesConversionRate')} value={totals.avgConversion.toFixed(3)} accent="emerald" />
            <StatTile isDark={isDark} icon={TrendingUp} label={t('dashboard.totalTransactions')} value={formatNumber(totals.totalTransactions)} accent="sky" />
          </div>

          <div className="mb-2">
            <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('dashboard.selectMetrics')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {metricKeys.map((key) => {
                const active = selected.has(key);
                const color = TRAFFIC_METRIC_COLOR[key] || '#6366f1';
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleMetric(key)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 ${
                      active
                        ? isDark ? 'border-transparent text-white' : 'border-transparent text-white'
                        : isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-900/60' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    style={active ? { backgroundColor: color } : undefined}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? '#fff' : color }} />
                    {t(`dashboard.trafficMetrics.${key}`, { defaultValue: key })}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-[260px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  {activeVolume.map((key) => (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={TRAFFIC_METRIC_COLOR[key]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={TRAFFIC_METRIC_COLOR[key]} stopOpacity={0.03} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                {activeRate.length > 0 && (
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                )}
                <Tooltip content={<TrafficReportTooltip isDark={isDark} t={t} />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  formatter={(key) => (
                    <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>
                      {t(`dashboard.trafficMetrics.${key}`, { defaultValue: key })}
                    </span>
                  )}
                />
                {activeVolume.map((key) => (
                  <Area
                    key={key}
                    yAxisId="left"
                    type="monotone"
                    dataKey={key}
                    stroke={TRAFFIC_METRIC_COLOR[key]}
                    fill={`url(#grad-${key})`}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                ))}
                {activeRate.map((key) => (
                  <Line
                    key={key}
                    yAxisId="right"
                    type="monotone"
                    dataKey={key}
                    stroke={TRAFFIC_METRIC_COLOR[key]}
                    strokeWidth={2.5}
                    dot={{ r: 2.5 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-900/60' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <TableIcon size={12} />
            {showTable ? t('dashboard.hideFullTable') : t('dashboard.viewFullTable')}
            {showTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showTable && (
            <div className="mt-3 overflow-x-auto rounded-xl border max-h-[320px]" style={{ borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr className={isDark ? 'bg-slate-950/60' : 'bg-slate-50'}>
                    <th className={`sticky left-0 text-left px-3 py-2 font-semibold whitespace-nowrap ${isDark ? 'text-slate-300 bg-slate-950/60' : 'text-slate-600 bg-slate-50'}`}>
                      {t('dashboard.dateColumn')}
                    </th>
                    {metricKeys.map((key) => (
                      <th key={key} className={`text-right px-3 py-2 font-semibold whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {t(`dashboard.trafficMetrics.${key}`, { defaultValue: key })}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={p.date || p.day || i} className={i % 2 === 0 ? '' : isDark ? 'bg-slate-950/30' : 'bg-slate-50/60'}>
                      <td className={`sticky left-0 px-3 py-1.5 font-medium whitespace-nowrap ${isDark ? 'text-slate-300 bg-slate-900/95' : 'text-slate-700 bg-white'}`}>
                        {p.day}
                      </td>
                      {metricKeys.map((key) => (
                        <td key={key} className={`text-right px-3 py-1.5 whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {p.values?.[key] == null ? '—' : formatNumber(p.values[key], RATE_METRIC_KEYS.has(key) ? 3 : 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── main export ─────────────────────────────────────────────────────────────

export default function SellerAnalyticsSection({ analytics, loading, error, isDark, onConnectEbay, onGoToSettings }) {
  const { t } = useTranslation('system');

  const customerServiceInad = analytics?.customerService?.types?.ITEM_NOT_AS_DESCRIBED || null;
  const customerServiceInr = analytics?.customerService?.types?.ITEM_NOT_RECEIVED || null;
  const sellerStandards = analytics?.sellerStandards || null;
  const traffic = analytics?.traffic || null;

  const allDenied = Boolean(
    customerServiceInad?.accessDenied &&
    customerServiceInr?.accessDenied &&
    sellerStandards?.accessDenied &&
    traffic?.accessDenied
  );

  const executiveStats = useMemo(() => {
    const metrics = sellerStandards?.profile?.metrics || [];
    const find = (key) => metrics.find((m) => m.metricKey === key)?.value;
    const points = traffic?.points || [];
    const avg = (key) => (points.length ? points.reduce((s, p) => s + Number(p?.values?.[key] || 0), 0) / points.length : 0);
    let peakPoint = null;
    for (const p of points) {
      const conv = Number(p?.values?.SALES_CONVERSION_RATE ?? p?.conversionRate ?? 0);
      const peakConv = Number(peakPoint?.values?.SALES_CONVERSION_RATE ?? peakPoint?.conversionRate ?? -Infinity);
      if (!peakPoint || conv > peakConv) peakPoint = p;
    }
    return {
      defectRate: find('DEFECTIVE_TRANSACTION_COUNT') ?? '-',
      salesAmount: find('MIN_GMV') ?? '-',
      transactions: find('MIN_TXN_COUNT') ?? '-',
      lateShipments: find('SHIPPING_MISS_COUNT') ?? '-',
      avgConversion: avg('SALES_CONVERSION_RATE'),
      avgClickThrough: avg('CLICK_THROUGH_RATE'),
      peakDay: peakPoint?.day || '-',
      standardsLevel: sellerStandards?.profile?.standardslevel || null,
    };
  }, [sellerStandards, traffic]);

  if (allDenied) {
    return (
      <SectionCard isDark={isDark} className={`p-5 ${isDark ? 'border-indigo-800/50 bg-indigo-950/20' : 'border-indigo-200 bg-indigo-50/60'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-900/60' : 'bg-indigo-100'}`}>
            <Lock size={16} className={isDark ? 'text-indigo-300' : 'text-indigo-600'} />
          </div>
          <div>
            <p className={`text-sm font-bold ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>{t('dashboard.sellerAnalytics')}</p>
            <p className={`text-xs ${isDark ? 'text-indigo-300/70' : 'text-indigo-700'}`}>
              {analytics?.analyticsAccessErrorMessage || t('dashboard.widgetAccessDenied')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onConnectEbay} className="rounded-xl px-4 py-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm">
            {t('dashboard.connectEbay')}
          </button>
          <button
            type="button"
            onClick={onGoToSettings}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition border ${
              isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-900/50' : 'border-slate-200 text-slate-700 hover:bg-white'
            }`}
          >
            {t('dashboard.goToSettings')}
          </button>
        </div>
      </SectionCard>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dashboard.sellerAnalytics')}</h2>
          <p className={`text-sm mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.sellerAnalyticsSubtitle')}</p>
        </div>
        <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {loading ? t('dashboard.loading') : analytics ? t('dashboard.updated') : ''}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <p className={`text-sm rounded-xl border px-3 py-2 ${isDark ? 'border-rose-800/50 bg-rose-950/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <AlertCircle size={13} className="inline mr-1.5 -mt-0.5" />
            {error}
          </p>
        </div>
      )}

      {loading && !analytics && (
        <div className="flex items-center justify-center py-10">
          <LoadingSpinner />
        </div>
      )}

      {analytics && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
            <StatTile isDark={isDark} label={t('dashboard.transactions')} value={executiveStats.transactions} accent="sky" />
            <StatTile isDark={isDark} label={t('dashboard.salesAmount')} value={executiveStats.salesAmount} accent="emerald" />
            <StatTile isDark={isDark} label={t('dashboard.defectCount')} value={executiveStats.defectRate} accent="rose" />
            <StatTile isDark={isDark} label={t('dashboard.lateShipments')} value={executiveStats.lateShipments} accent="amber" />
            <StatTile isDark={isDark} label={t('dashboard.avgConversion')} value={Number(executiveStats.avgConversion).toFixed(3)} accent="violet" />
            <StatTile
              isDark={isDark}
              label={t('dashboard.standardsLevel')}
              value={executiveStats.standardsLevel ? t({
                TOP_RATED: 'dashboard.levelTopRated',
                ABOVE_STANDARD: 'dashboard.levelAboveStandard',
                BELOW_STANDARD: 'dashboard.levelBelowStandard',
              }[executiveStats.standardsLevel] || 'dashboard.noData') : '-'}
              accent="indigo"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <CustomerServiceCard isDark={isDark} t={t} title={t('dashboard.itemNotAsDescribed')} data={customerServiceInad} />
            <CustomerServiceCard isDark={isDark} t={t} title={t('dashboard.itemNotReceived')} data={customerServiceInr} />
            <SellerStandardsCard isDark={isDark} t={t} standards={sellerStandards} />
          </div>

          <TrafficReportCard isDark={isDark} t={t} traffic={traffic} />
        </>
      )}
    </div>
  );
}
