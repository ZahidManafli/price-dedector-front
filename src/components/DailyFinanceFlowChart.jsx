/**
 * DailyFinanceFlowChart — the dashboard's "hero" finance chart.
 *
 * Merges three sources into one timeline:
 *  1. TODAY     — `balances.availableFunds` (net ready-to-withdraw balance), plotted at today's date.
 *  2. FUTURE    — `chart.upcomingPayouts` (on-hold SALEs grouped by their eBay estimated-release
 *                 date, e.g. Jun 29, Jun 30). Built by the backend from transactionMemo
 *                 "Estimated release on <date>".
 *  3. PAST      — `lists.payouts.items` for the fetched period, shown as a faded reference so the
 *                 seller can compare history vs. future.
 */

import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

function fmtLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TODAY_LABEL = fmtLabel(new Date());

function CustomTooltip({ active, payload, label, isDark, t, currencyFormatter }) {
  if (!active || !payload?.length) return null;
  const isToday = label === TODAY_LABEL;
  const META = {
    upcoming: { label: t('dashboard.finance.pillUpcoming'), color: '#22c55e' },
    available: { label: t('dashboard.finance.pillAvailable'), color: '#3b82f6' },
    past: { label: t('dashboard.finance.payoutsTitle'), color: '#f97316' },
  };
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 min-w-[190px] shadow-xl ${
      isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'
    }`}>
      <p className={`text-[11px] uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}{isToday ? ` · ${t('dashboard.finance.todayLabel')}` : ''}
      </p>
      {payload.map((entry) => {
        if (entry.value == null) return null;
        const meta = META[entry.dataKey] ?? { label: entry.name, color: entry.color };
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
            <span className="text-xs" style={{ color: meta.color }}>{meta.label}</span>
            <span className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{currencyFormatter(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Pill({ label, value, color, sublabel, isDark }) {
  return (
    <div
      className="rounded-xl px-3.5 py-2 flex flex-col min-w-[128px] border"
      style={{ background: `${color}${isDark ? '1a' : '0d'}`, borderColor: `${color}40` }}
    >
      <span className={`text-[11px] mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className="text-[15px] font-bold leading-tight" style={{ color }}>{value}</span>
      {sublabel && <span className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{sublabel}</span>}
    </div>
  );
}

export default function DailyFinanceFlowChart({ isDark, t, finance, currencyFormatter }) {
  const balances = finance?.balances || {};
  const payoutItems = finance?.lists?.payouts?.items || [];
  const upcomingPoints = finance?.chart?.upcomingPayouts || [];

  const availableNow = Number(balances.availableFunds ?? 0);
  const processingNow = Number(balances.processingFunds ?? 0);
  const totalOnHold = Number(balances.fundsOnHold ?? 0);

  const pastPoints = useMemo(() => {
    return [...payoutItems]
      .filter((p) => p?.payoutDate)
      .slice(0, 60)
      .map((p) => ({ label: fmtLabel(new Date(p.payoutDate)), past: Number(p.amount?.value ?? 0) }))
      .reverse();
  }, [payoutItems]);

  const chartData = useMemo(() => {
    const year = new Date().getFullYear();
    const map = {};
    const set = (label, key, value) => {
      map[label] = { ...(map[label] ?? { label }), [key]: value };
    };
    for (const p of pastPoints) set(p.label, 'past', p.past);
    if (availableNow > 0) set(TODAY_LABEL, 'available', availableNow);
    for (const p of upcomingPoints) set(p.label, 'upcoming', p.value);

    return Object.values(map).sort((a, b) => new Date(`${a.label} ${year}`) - new Date(`${b.label} ${year}`));
  }, [pastPoints, availableNow, upcomingPoints]);

  const totalUpcoming = upcomingPoints.reduce((s, p) => s + (p.value ?? 0), 0);
  const hasData = chartData.some((d) => d.past || d.available || d.upcoming);
  const fmt = currencyFormatter || ((v) => `$${Number(v || 0).toFixed(2)}`);
  const axisColor = isDark ? '#64748b' : '#94a3b8';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)';

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dashboard.finance.chartTitle')}</h3>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('dashboard.finance.chartSubtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap my-3.5">
        <Pill isDark={isDark} label={t('dashboard.finance.pillProcessing')} value={fmt(processingNow)} color="#a78bfa" />
        <Pill isDark={isDark} label={t('dashboard.finance.pillAvailable')} value={fmt(availableNow)} color="#3b82f6" />
        <Pill isDark={isDark} label={t('dashboard.finance.pillUpcoming')} value={fmt(totalUpcoming)} color="#22c55e" />
        <Pill isDark={isDark} label={t('dashboard.finance.pillOnHold')} value={fmt(totalOnHold)} color="#f59e0b" />
      </div>

      {!hasData ? (
        <div className={`text-center py-10 text-sm rounded-xl border border-dashed ${
          isDark ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'
        }`}>
          {t('dashboard.finance.noChartData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradUpcomingFin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPastFin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v).replace(/\.00$/, '')} />
            <Tooltip content={<CustomTooltip isDark={isDark} t={t} currencyFormatter={fmt} />} />
            <ReferenceLine
              x={TODAY_LABEL}
              stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.15)'}
              strokeDasharray="4 4"
              label={{ value: t('dashboard.finance.todayLabel'), fill: axisColor, fontSize: 10, position: 'top' }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
              formatter={(key) => {
                const labels = {
                  past: <span style={{ color: '#f97316' }}>{t('dashboard.finance.payoutsTitle')}</span>,
                  available: <span style={{ color: '#3b82f6' }}>{t('dashboard.finance.pillAvailable')}</span>,
                  upcoming: <span style={{ color: '#22c55e' }}>{t('dashboard.finance.pillUpcoming')}</span>,
                };
                return labels[key] ?? key;
              }}
            />
            <Area type="monotone" dataKey="past" stroke="#f97316" strokeWidth={2} fill="url(#gradPastFin)" dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="available" stroke="#3b82f6" strokeWidth={0} dot={{ r: 7, fill: '#3b82f6', strokeWidth: 2, stroke: '#1d4ed8' }} activeDot={{ r: 9 }} connectNulls={false} />
            <Area type="monotone" dataKey="upcoming" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradUpcomingFin)" dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
