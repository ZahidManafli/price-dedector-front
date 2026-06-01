import React, { useEffect, useState, useMemo } from 'react';
import { referralAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';

// ── Tiny sparkline / area chart (no external lib needed) ──────────────────────
function PayoutsChart({ payouts, currency }) {
  const sorted = useMemo(() => {
    if (!payouts || payouts.length === 0) return [];
    return [...payouts]
      .filter((p) => p.status === 'paid')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [payouts]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-slate-400">
        No payout history yet.
      </div>
    );
  }

  // Build monthly buckets
  const buckets = {};
  sorted.forEach((p) => {
    const d = new Date(p.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets[key] = (buckets[key] || 0) + Number(p.amount);
  });

  const labels = Object.keys(buckets).sort();
  const values = labels.map((k) => buckets[k]);
  const max = Math.max(...values, 1);

  // SVG dimensions
  const W = 500;
  const H = 90;
  const PAD_X = 40;
  const PAD_Y = 10;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const pts = values.map((v, i) => {
    const x = labels.length === 1 ? PAD_X + chartW / 2 : PAD_X + (i / (labels.length - 1)) * chartW;
    const y = PAD_Y + chartH - (v / max) * chartH;
    return [x, y];
  });

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1][0]},${PAD_Y + chartH} L${pts[0][0]},${PAD_Y + chartH} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Gridlines */}
        {[0, 0.5, 1].map((frac) => (
          <line
            key={frac}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={PAD_Y + chartH * (1 - frac)}
            y2={PAD_Y + chartH * (1 - frac)}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        {/* Area fill */}
        <path d={areaPath} fill="url(#chartGrad)" />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots */}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#10b981" />
        ))}
        {/* Y labels */}
        <text x={PAD_X - 4} y={PAD_Y + 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">
          {max.toFixed(0)}
        </text>
        <text x={PAD_X - 4} y={PAD_Y + chartH + 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5">
          0
        </text>
      </svg>
      {/* X labels */}
      <div className="flex justify-between px-10 mt-1">
        {labels.map((l, i) => (
          <span
            key={l}
            className="text-[10px] text-slate-400"
            style={{ display: i === 0 || i === labels.length - 1 || labels.length <= 6 ? 'block' : 'none' }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Payouts history table ──────────────────────────────────────────────────────
function PayoutsTable({ payouts, currency }) {
  if (!payouts || payouts.length === 0) {
    return <p className="text-sm text-slate-500">No payouts recorded.</p>;
  }

  return (
    <div className="overflow-auto max-h-64">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <th className="text-left pb-2 font-medium">Date</th>
            <th className="text-right pb-2 font-medium">Amount</th>
            <th className="text-left pb-2 pl-4 font-medium">Note</th>
            <th className="text-left pb-2 pl-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {payouts.map((p) => (
            <tr key={p.id}>
              <td className="py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
              </td>
              <td className="py-2 text-right font-semibold whitespace-nowrap">
                {Number(p.amount).toFixed(2)} {p.currency || currency}
              </td>
              <td className="py-2 pl-4 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                {p.note || '—'}
              </td>
              <td className="py-2 pl-4">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {p.status || 'paid'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ReferralDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referrals, setReferrals] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const response = await referralAPI.getMe();
        if (!cancelled) setReferrals(response?.data?.referrals || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Failed to load referral dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="page-title">Referrals</h1>
          <p className="page-subtitle">View your referral pages, members, and payout totals.</p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert type="error" message={error} onClose={() => setError(null)} autoClose={false} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {referrals.length === 0 ? (
            <div className="glass-card p-6 text-slate-600 dark:text-slate-300">No referral pages assigned yet.</div>
          ) : (
            referrals.map((referral) => (
              <div key={referral.id} className="glass-card p-5">
                {/* ── Header row ── */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Referral</p>
                    <h2 className="text-2xl font-semibold">{referral.name}</h2>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">{referral.description || 'No description'}</p>
                    <p className="text-sm mt-3 text-slate-500 dark:text-slate-400">/ref/{referral.slug}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 min-w-[280px]">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Members</p>
                      <p className="text-2xl font-semibold mt-1">{referral.memberCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Commission</p>
                      <p className="text-2xl font-semibold mt-1">{referral.feeAmount}%</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                      <p className="text-xs text-slate-500">Paid</p>
                      <p className="text-2xl font-semibold mt-1">{(-1)*referral.totalPaid} {referral.feeCurrency}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 p-4 col-span-2 bg-emerald-50/60 dark:bg-emerald-950/20">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">Estimated monthly</p>
                      <p className="text-2xl font-semibold mt-1 text-emerald-800 dark:text-emerald-200">
                        {referral.estimatedMonthlyEarnings} {referral.feeCurrency}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Payouts chart ── */}
                <div className="mt-5 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="font-semibold mb-3">Payouts over time</h3>
                  <PayoutsChart payouts={referral.payouts || []} currency={referral.feeCurrency} />
                </div>

                {/* ── Members + Summary + Payouts table ── */}
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="font-semibold mb-3">Members</h3>
                    <div className="space-y-2 max-h-72 overflow-auto pr-1">
                      {(referral.members || []).map((member) => (
                        <div key={member.userId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                          <p className="font-medium">{member.email}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {member.selectedPlanName || 'No plan'}
                            {member.selectedPlanPrice ? ` · ${member.selectedPlanPrice}` : ''}
                            {member.selectedPlanCurrency ? ` ${member.selectedPlanCurrency}` : ''}
                            {member.assignedAt ? ` · ${new Date(member.assignedAt).toLocaleString()}` : ''}
                          </p>
                        </div>
                      ))}
                      {(referral.members || []).length === 0 && (
                        <p className="text-sm text-slate-500">No members assigned.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                    <h3 className="font-semibold mb-3">Summary</h3>
                    <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      <p><span className="font-medium">Referral page:</span> /ref/{referral.slug}</p>
                      <p><span className="font-medium">Referral admin:</span> {referral.referralAdminName || 'N/A'}</p>
                      <p><span className="font-medium">Balance:</span> {referral.balance} {referral.feeCurrency}</p>
                    </div>
                  </div>
                </div>

                {/* ── Payouts history table ── */}
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="font-semibold mb-3">Payout history</h3>
                  <PayoutsTable payouts={referral.payouts || []} currency={referral.feeCurrency} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
