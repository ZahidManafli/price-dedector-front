/**
 * DailyFinanceFlowChart.jsx
 *
 * Bug fix: The chart was plotting PAST payout history from `finance.chart.points`
 * (money already sent to the bank). It must instead show UPCOMING payouts —
 * the on-hold funds grouped by their estimated eBay release date, now provided
 * by the backend as `finance.chart.upcomingPayouts`.
 *
 * Drop-in replacement for whatever chart section was using finance.chart.points.
 *
 * Props:
 *   finance  – the `finance` object from the /analytics/dashboard API response
 */

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (v) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v ?? 0);

/**
 * Derive upcoming payout data CLIENT-SIDE as a fallback in case the backend
 * hasn't been updated yet to provide `finance.chart.upcomingPayouts`.
 *
 * Parses FUNDS_ON_HOLD SALE transactions and groups them by the "Estimated
 * release on <date>" from the transactionMemo field.
 */
function deriveUpcomingPayouts(transactions = []) {
  const releasePattern = /estimated release on\s+([A-Za-z]+ \d+)/i;
  const map = {};
  const year = new Date().getFullYear();

  for (const tx of transactions) {
    if (
      String(tx?.transactionStatus ?? '').toUpperCase() !== 'FUNDS_ON_HOLD' ||
      String(tx?.bookingEntry ?? '').toUpperCase() !== 'CREDIT' ||
      String(tx?.transactionType ?? '').toUpperCase() !== 'SALE'
    ) continue;

    const amount = Number(tx?.amount?.value ?? tx?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    // Try memo first
    const memo = String(tx?.raw?.transactionMemo ?? tx?.transactionMemo ?? '');
    const match = memo.match(releasePattern);
    let label = null;

    if (match) {
      const parsed = new Date(`${match[1]} ${year}`);
      label = !isNaN(parsed.getTime())
        ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : match[1];
    } else {
      // Fallback: estimate 30 days from transaction date
      const txDate = new Date(tx?.transactionDate ?? '');
      if (!isNaN(txDate.getTime())) {
        const est = new Date(txDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        label = est.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }

    if (!label) continue;
    map[label] = (map[label] ?? 0) + amount;
  }

  return Object.entries(map)
    .map(([label, value]) => ({ label, upcomingPayout: Math.round(value * 100) / 100 }))
    .sort((a, b) => new Date(`${a.label} ${year}`) - new Date(`${b.label} ${year}`));
}

// ─── custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f1923',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 170,
    }}>
      <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 8px' }}>{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 4 }}>
          <span style={{ color: entry.color, fontSize: 12 }}>{entry.name}</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function DailyFinanceFlowChart({ finance }) {
  const chartData = useMemo(() => {
    // ── FIXED: prefer the backend-computed upcomingPayouts array ──────────
    // The old code used finance.chart.points which contains PAST payouts.
    // We now use finance.chart.upcomingPayouts (added to backend), with a
    // client-side fallback that derives the same data from transactionList.
    // ──────────────────────────────────────────────────────────────────────

    const upcoming =
      // Primary: backend-provided upcoming payouts
      (Array.isArray(finance?.chart?.upcomingPayouts) && finance.chart.upcomingPayouts.length > 0)
        ? finance.chart.upcomingPayouts.map((p) => ({
            label: p.label,
            upcomingPayout: p.value,
          }))
        // Fallback: derive from transactionList when backend hasn't been updated yet
        : deriveUpcomingPayouts(finance?.transactionList ?? finance?.collections?.transactions ?? []);

    // Past payouts (last 30 days) kept as a secondary reference line so the
    // user can compare what was received vs what is expected.
    const pastPayouts = (finance?.payoutList ?? finance?.collections?.payouts ?? [])
      .slice(0, 30)
      .map((p) => ({
        label: new Date(p.payoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        pastPayout: Number(p.amount?.value ?? 0),
      }))
      .reverse(); // oldest → newest

    // Merge both series into one unified timeline keyed by label
    const mergedMap = {};
    for (const pt of pastPayouts) {
      mergedMap[pt.label] = { ...(mergedMap[pt.label] ?? {}), label: pt.label, pastPayout: pt.pastPayout };
    }
    for (const pt of upcoming) {
      mergedMap[pt.label] = { ...(mergedMap[pt.label] ?? {}), label: pt.label, upcomingPayout: pt.upcomingPayout };
    }

    // Sort chronologically
    return Object.values(mergedMap).sort(
      (a, b) => new Date(`${a.label} ${new Date().getFullYear()}`) - new Date(`${b.label} ${new Date().getFullYear()}`)
    );
  }, [finance]);

  // Summary numbers
  const totalUpcoming = useMemo(
    () => (finance?.chart?.upcomingPayouts ?? deriveUpcomingPayouts(finance?.transactionList ?? []))
      .reduce((s, p) => s + (p.value ?? p.upcomingPayout ?? 0), 0),
    [finance]
  );

  const totalOnHold = Number(finance?.balances?.fundsOnHold ?? finance?.summaries?.sellerFunds?.fundsOnHold?.value ?? 0);
  const totalAvailable = Number(finance?.balances?.availableFunds ?? finance?.summaries?.sellerFunds?.availableFunds?.value ?? 0);

  const hasData = chartData.some((d) => d.upcomingPayout || d.pastPayout);

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0d1b2a 0%, #0a1520 100%)',
      borderRadius: 16,
      padding: '20px 24px 12px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 700 }}>
            Daily finance flow
          </h3>
          {/* ✅ FIXED: subtitle now reflects upcoming payouts, not past */}
          <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: 13 }}>
            Upcoming payouts vs past payouts
          </p>
        </div>
        <span style={{ color: '#64748b', fontSize: 13 }}>
          {chartData.length} points
        </span>
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 12, margin: '12px 0 16px', flexWrap: 'wrap' }}>
        <Pill label="Releasing soon" value={fmt(totalUpcoming)} color="#22c55e" />
        <Pill label="On hold" value={fmt(totalOnHold)} color="#f59e0b" />
        <Pill label="Available now" value={fmt(totalAvailable)} color="#3b82f6" />
      </div>

      {/* Chart */}
      {!hasData ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
          No payout data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradUpcoming" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />

            <XAxis
              dataKey="label"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v}`}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, fontSize: 13 }}
              formatter={(value) => (
                <span style={{ color: value === 'upcomingPayout' ? '#22c55e' : '#f97316' }}>
                  {value === 'upcomingPayout' ? 'Upcoming payout' : 'Past payout'}
                </span>
              )}
            />

            {/* ✅ PRIMARY series: upcoming/expected money (green) */}
            <Area
              type="monotone"
              dataKey="upcomingPayout"
              name="upcomingPayout"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#gradUpcoming)"
              dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />

            {/* Secondary series: past payouts for comparison (orange, same as before) */}
            <Area
              type="monotone"
              dataKey="pastPayout"
              name="pastPayout"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#gradPast)"
              dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Pill({ label, value, color }) {
  return (
    <div style={{
      background: `${color}15`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      padding: '5px 12px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
