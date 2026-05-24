/**
 * DailyFinanceFlowChart.jsx  — v2
 *
 * What the chart now shows (all three sources merged into one timeline):
 *
 *  1. TODAY  — `finance.balances.availableFunds` (net ready-to-withdraw balance).
 *              This is money the seller can already request; show it at today's date.
 *
 *  2. FUTURE — `finance.chart.upcomingPayouts` (on-hold SALEs grouped by their eBay
 *              estimated-release date, e.g. Jun 29, Jun 30).  Built by the backend
 *              from transactionMemo "Estimated release on <date>".
 *
 *  3. PAST   — `finance.chart.points` / payoutList for the last 30 days shown as a
 *              faded reference so the seller can compare history vs future.
 *
 * The previous bug: only "future" on-hold release dates were plotted, so "today's"
 * available funds ($33.88) never appeared, and neither did the balance label.
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

// ─── helpers ────────────────────────────────────────────────────────────────

const USD = (v) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v ?? 0);

/** Format a Date → "May 24" style label */
function fmtLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Today label used as the "available now" anchor point */
const TODAY_LABEL = fmtLabel(new Date());

// ─── custom tooltip ──────────────────────────────────────────────────────────

const TYPE_META = {
  upcoming: { label: 'Upcoming release', color: '#22c55e' },
  available: { label: 'Available now',   color: '#3b82f6' },
  past:      { label: 'Past payout',     color: '#f97316' },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const isToday = label === TODAY_LABEL;
  return (
    <div style={{
      background: '#0d1b2a',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '10px 14px',
      minWidth: 185,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}{isToday ? ' · Today' : ''}
      </p>
      {payload.map((entry) => {
        if (entry.value == null) return null;
        const meta = TYPE_META[entry.dataKey] ?? { label: entry.name, color: entry.color };
        return (
          <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
            <span style={{ color: meta.color, fontSize: 12 }}>{meta.label}</span>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{USD(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function DailyFinanceFlowChart({ finance }) {

  // ── 1. AVAILABLE NOW — money ready today ─────────────────────────────────
  const availableNow = Number(
    finance?.balances?.availableFunds ??
    finance?.summaries?.sellerFunds?.availableFunds?.value ??
    0
  );

  // ── 2. UPCOMING RELEASES — from backend upcomingPayouts ──────────────────
  //    Falls back to deriving from transactionList if backend key is missing.
  const upcomingPoints = useMemo(() => {
    const raw = finance?.chart?.upcomingPayouts;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((p) => ({ label: p.label, upcoming: p.value }));
    }

    // Client-side fallback: parse "Estimated release on Jun 30" from transactions
    const txList = [
      ...(finance?.collections?.transactions ?? []),
      ...(finance?.transactionList ?? []),
    ];
    const seen = new Set();
    const map = {};
    const releaseRe = /estimated release on\s+([A-Za-z]+ \d+)/i;
    const year = new Date().getFullYear();

    for (const tx of txList) {
      const id = tx?.transactionId ?? tx?.raw?.transactionId;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const status = String(tx?.transactionStatus ?? tx?.raw?.transactionStatus ?? '').toUpperCase();
      const entry  = String(tx?.bookingEntry  ?? tx?.raw?.bookingEntry  ?? '').toUpperCase();
      const type   = String(tx?.transactionType ?? tx?.raw?.transactionType ?? '').toUpperCase();
      if (status !== 'FUNDS_ON_HOLD' || entry !== 'CREDIT' || type !== 'SALE') continue;

      const amount = Number(tx?.amount?.value ?? tx?.amount ?? tx?.raw?.amount?.value ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const memo  = String(tx?.raw?.transactionMemo ?? tx?.transactionMemo ?? '');
      const match = memo.match(releaseRe);
      let lbl = null;
      if (match) {
        const parsed = new Date(`${match[1]} ${year}`);
        lbl = !isNaN(parsed.getTime()) ? fmtLabel(parsed) : match[1];
      }
      if (!lbl) continue;
      map[lbl] = (map[lbl] ?? 0) + amount;
    }

    return Object.entries(map)
      .map(([label, upcoming]) => ({ label, upcoming: Math.round(upcoming * 100) / 100 }))
      .sort((a, b) => new Date(`${a.label} ${year}`) - new Date(`${b.label} ${year}`));
  }, [finance]);

  // ── 3. PAST PAYOUTS — last 30 days for reference ─────────────────────────
  const pastPoints = useMemo(() => {
    const list = finance?.payoutList ?? finance?.collections?.payouts ?? [];
    return [...list]
      .slice(0, 30)
      .map((p) => ({
        label: fmtLabel(new Date(p.payoutDate)),
        past: Number(p.amount?.value ?? 0),
      }))
      .reverse(); // oldest → newest
  }, [finance]);

  // ── 4. MERGE into one sorted timeline ────────────────────────────────────
  const chartData = useMemo(() => {
    const year = new Date().getFullYear();
    const map = {};

    const set = (label, key, value) => {
      map[label] = { ...(map[label] ?? { label }), [key]: value };
    };

    for (const p of pastPoints)    set(p.label, 'past',      p.past);
    // Today's available balance — anchors the gap between past and future
    if (availableNow > 0)          set(TODAY_LABEL, 'available', availableNow);
    for (const p of upcomingPoints) set(p.label, 'upcoming',  p.upcoming);

    return Object.values(map).sort(
      (a, b) =>
        new Date(`${a.label} ${year}`) - new Date(`${b.label} ${year}`)
    );
  }, [pastPoints, availableNow, upcomingPoints]);

  // ── 5. Summary totals ────────────────────────────────────────────────────
  const totalUpcoming = upcomingPoints.reduce((s, p) => s + (p.upcoming ?? 0), 0);
  const totalOnHold   = Number(finance?.balances?.fundsOnHold ?? finance?.summaries?.sellerFunds?.fundsOnHold?.value ?? 0);

  const hasData = chartData.some((d) => d.past || d.available || d.upcoming);

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0d1b2a 0%, #0a1520 100%)',
      borderRadius: 16,
      padding: '20px 24px 12px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <h3 style={{ color: '#fff', margin: 0, fontSize: 16, fontWeight: 700 }}>
            Daily finance flow
          </h3>
          <p style={{ color: '#64748b', margin: '2px 0 0', fontSize: 13 }}>
            Available now · Upcoming releases · Past payouts
          </p>
        </div>
        <span style={{ color: '#64748b', fontSize: 13 }}>{chartData.length} points</span>
      </div>

      {/* ── Summary pills ── */}
      <div style={{ display: 'flex', gap: 10, margin: '14px 0 18px', flexWrap: 'wrap' }}>
        <Pill label="Available now"   value={USD(availableNow)}  color="#3b82f6" sublabel="Ready to withdraw" />
        <Pill label="Releasing soon"  value={USD(totalUpcoming)} color="#22c55e" sublabel={`across ${upcomingPoints.length} date${upcomingPoints.length !== 1 ? 's' : ''}`} />
        <Pill label="On hold total"   value={USD(totalOnHold)}   color="#f59e0b" sublabel="Pending release" />
      </div>

      {/* ── Chart ── */}
      {!hasData ? (
        <div style={{ color: '#475569', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
          No payout data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradUpcoming" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradPast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f97316" stopOpacity={0.2} />
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

            {/* Vertical "today" marker separating past from future */}
            <ReferenceLine
              x={TODAY_LABEL}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
              label={{ value: 'Today', fill: '#64748b', fontSize: 10, position: 'top' }}
            />

            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: 12, fontSize: 13 }}
              formatter={(key) => {
                const labels = {
                  past:      <span style={{ color: '#f97316' }}>Past payout</span>,
                  available: <span style={{ color: '#3b82f6' }}>Available now</span>,
                  upcoming:  <span style={{ color: '#22c55e' }}>Upcoming release</span>,
                };
                return labels[key] ?? key;
              }}
            />

            {/* Past payouts — orange area */}
            <Area
              type="monotone"
              dataKey="past"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#gradPast)"
              dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />

            {/* Available now — blue dot at today's date */}
            <Line
              type="monotone"
              dataKey="available"
              stroke="#3b82f6"
              strokeWidth={0}
              dot={{ r: 7, fill: '#3b82f6', strokeWidth: 2, stroke: '#1d4ed8' }}
              activeDot={{ r: 9 }}
              connectNulls={false}
            />

            {/* Upcoming releases — green area */}
            <Area
              type="monotone"
              dataKey="upcoming"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#gradUpcoming)"
              dot={{ r: 4, fill: '#22c55e', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function Pill({ label, value, color, sublabel }) {
  return (
    <div style={{
      background: `${color}12`,
      border: `1px solid ${color}28`,
      borderRadius: 10,
      padding: '7px 14px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 130,
    }}>
      <span style={{ color: '#64748b', fontSize: 11, marginBottom: 1 }}>{label}</span>
      <span style={{ color, fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>{value}</span>
      {sublabel && <span style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{sublabel}</span>}
    </div>
  );
}
