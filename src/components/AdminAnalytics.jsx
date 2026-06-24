import { useState, useEffect, useRef } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Wallet, Users, Plus, Trash2,
  Check, X, ChevronDown, ChevronUp, Pencil, CalendarClock,
} from 'lucide-react';
import { adminAPI } from '../services/api';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Data helpers ──────────────────────────────────────────────────────────────

function fillSignupData(rawRows, range) {
  const now = new Date();

  if (range === '7d') {
    const map = {};
    rawRows.forEach((r) => { map[String(r.date).slice(0, 10)] = r; });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const row = map[key] || {};
      return { label: DAY_NAMES[d.getDay()], user_count: Number(row.user_count || 0), revenue: Number(row.revenue || 0) };
    });
  }

  if (range === '1m') {
    const map = {};
    rawRows.forEach((r) => { map[String(r.date).slice(0, 10)] = r; });
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().slice(0, 10);
      const row = map[key] || {};
      return { label: String(d.getDate()), user_count: Number(row.user_count || 0), revenue: Number(row.revenue || 0) };
    });
  }

  // 1y — monthly buckets
  const map = {};
  rawRows.forEach((r) => { map[`${r.yr}-${r.mo}`] = r; });
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const row = map[key] || {};
    return { label: MONTH_NAMES[d.getMonth()], user_count: Number(row.user_count || 0), revenue: Number(row.revenue || 0) };
  });
}

function fillRenewalData(rawRows) {
  const map = {};
  rawRows.forEach((r) => { map[String(r.renewal_date).slice(0, 10)] = r; });
  const now = new Date();
  return Array.from({ length: 31 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map[key] || {};
    return {
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      user_count: Number(row.user_count || 0),
      revenue: Number(row.expected_revenue || 0),
    };
  });
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, isDark, isRenewal }) {
  if (!active || !payload?.length) return null;
  const bg = isDark
    ? 'bg-slate-800 border-slate-600 text-slate-100'
    : 'bg-white border-slate-200 text-slate-800';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-xl text-xs ${bg}`}>
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className={sub}>
            {p.dataKey === 'user_count'
              ? isRenewal ? 'Renewing users' : 'New users'
              : isRenewal ? 'Expected revenue' : 'Revenue'}:
          </span>
          <span className="font-semibold ml-auto pl-3">
            {p.dataKey === 'revenue'
              ? `${Number(p.value).toFixed(2)} ₼`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const RANGES = [
  { key: '7d',         label: '7 days'     },
  { key: '1m',         label: '30 days'    },
  { key: '1y',         label: '1 year'     },
  { key: 'next_month', label: 'Next 30d',  isProjection: true },
];

export default function AdminAnalytics({ isDark }) {
  const [range, setRange] = useState('7d');
  const [chartData, setChartData] = useState([]);
  const [balance, setBalance] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' });
  const [showExpenses, setShowExpenses] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // ── fetch helpers ──
  const fetchSignups = (r) =>
    adminAPI.getSignups(r)
      .then((res) => setChartData(fillSignupData(res.data.rows, r)))
      .catch(console.error);

  const fetchRenewals = () =>
    adminAPI.getExpectedRenewals()
      .then((res) => setChartData(fillRenewalData(res.data.rows)))
      .catch(console.error);

  // Initial full load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [sr, er, br] = await Promise.all([
          adminAPI.getSignups('7d'),
          adminAPI.listExpenses(),
          adminAPI.getBalance(),
        ]);
        setChartData(fillSignupData(sr.data.rows, '7d'));
        setExpenses(er.data);
        setBalance(br.data);
      } catch (err) {
        console.error('AdminAnalytics init error:', err);
      } finally {
        setLoading(false);
        initialized.current = true;
      }
    };
    load();
  }, []);

  // Range change
  useEffect(() => {
    if (!initialized.current) return;
    if (range === 'next_month') {
      fetchRenewals();
    } else {
      fetchSignups(range);
    }
  }, [range]);

  // ── derived totals ──
  const totalRevenue   = chartData.reduce((s, r) => s + r.revenue, 0);
  const totalUsers     = chartData.reduce((s, r) => s + r.user_count, 0);
  const totalMonthlyExp = expenses.filter((e) => e.is_recurring).reduce((s, e) => s + Number(e.amount), 0);
  const netProfit      = totalRevenue - totalMonthlyExp;
  const isRenewal      = range === 'next_month';

  // ── balance handlers ──
  const handleSaveBalance = async () => {
    try {
      const res = await adminAPI.updateBalance(parseFloat(balanceInput) || 0);
      setBalance(res.data);
      setEditingBalance(false);
    } catch (err) {
      console.error('Balance update error:', err);
    }
  };

  // ── expense handlers ──
  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.name || !newExpense.amount) return;
    try {
      const res = await adminAPI.createExpense({
        name: newExpense.name,
        amount: parseFloat(newExpense.amount),
      });
      setExpenses((prev) => [...prev, res.data]);
      setNewExpense({ name: '', amount: '' });
    } catch (err) {
      console.error('Create expense error:', err);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await adminAPI.deleteExpense(id);
      setExpenses((prev) => prev.filter((ex) => ex.id !== id));
    } catch (err) {
      console.error('Delete expense error:', err);
    }
  };

  const [payingId, setPayingId] = useState(null);
  const handlePayExpense = async (id) => {
    setPayingId(id);
    try {
      const res = await adminAPI.payExpense(id);
      setExpenses((prev) => prev.map((ex) => ex.id === id ? res.data.expense : ex));
      setBalance(res.data.balance);
    } catch (err) {
      console.error('Pay expense error:', err);
    } finally {
      setPayingId(null);
    }
  };

  // ── style shortcuts ──
  const card    = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const tp      = isDark ? 'text-slate-100' : 'text-slate-800';
  const ts      = isDark ? 'text-slate-400' : 'text-slate-500';
  const divider = isDark ? 'border-slate-700' : 'border-slate-100';
  const gridLine = isDark ? '#1e293b' : '#f1f5f9';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  // Bar / line colours differ between historical and projection views
  const barFill   = isRenewal ? '#8b5cf6' : (isDark ? '#3b82f6' : '#60a5fa');
  const lineFill  = isRenewal ? '#f59e0b' : '#10b981';

  return (
    <div className="space-y-4 pb-6">

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Balance */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${ts}`}>
            <Wallet size={11} /> Balance
          </div>
          {editingBalance ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                className="input-base h-8 text-sm flex-1 min-w-0"
                step="0.01"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveBalance();
                  if (e.key === 'Escape') setEditingBalance(false);
                }}
              />
              <button
                onClick={handleSaveBalance}
                className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 hover:bg-blue-700"
              >
                <Check size={13} />
              </button>
              <button
                onClick={() => setEditingBalance(false)}
                className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className={`text-2xl font-bold ${tp}`}>
                  {balance != null ? Number(balance.balance).toFixed(2) : '—'}
                </div>
                <div className={`text-[11px] mt-0.5 ${ts}`}>AZN</div>
              </div>
              <button
                onClick={() => { setBalanceInput(String(balance?.balance ?? 0)); setEditingBalance(true); }}
                className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}
              >
                <Pencil size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Users card — label changes for renewal view */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${ts}`}>
            <Users size={11} /> {isRenewal ? 'Renewing Users' : 'New Users'}
          </div>
          <div className={`text-2xl font-bold ${tp}`}>{loading ? '—' : totalUsers}</div>
          <div className={`text-[11px] mt-0.5 ${ts}`}>
            {isRenewal ? 'in next 30 days' : 'in selected period'}
          </div>
        </div>

        {/* Revenue card */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${ts}`}>
            <TrendingUp size={11} /> {isRenewal ? 'Expected Revenue' : 'Revenue'}
          </div>
          <div className={`text-2xl font-bold ${isRenewal ? 'text-amber-500' : 'text-emerald-500'}`}>
            {loading ? '—' : totalRevenue.toFixed(2)}
          </div>
          <div className={`text-[11px] mt-0.5 ${ts}`}>
            {isRenewal ? 'AZN projected (30d)' : 'AZN in period'}
          </div>
        </div>

        {/* 4th card: net profit in 1m, expected net in next_month, else monthly expenses */}
        <div className={`rounded-2xl border p-4 ${card}`}>
          {isRenewal ? (
            <>
              <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${ts}`}>Expected Net</div>
              <div className={`text-2xl font-bold ${(totalRevenue - totalMonthlyExp) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {loading ? '—' : (totalRevenue - totalMonthlyExp).toFixed(2)}
              </div>
              <div className={`text-[11px] mt-0.5 ${ts}`}>after {totalMonthlyExp.toFixed(2)} ₼ exp.</div>
            </>
          ) : range === '1m' ? (
            <>
              <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${ts}`}>Net Profit (30d)</div>
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {loading ? '—' : netProfit.toFixed(2)}
              </div>
              <div className={`text-[11px] mt-0.5 ${ts}`}>after {totalMonthlyExp.toFixed(2)} ₼ exp.</div>
            </>
          ) : (
            <>
              <div className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${ts}`}>Monthly Expenses</div>
              <div className="text-2xl font-bold text-amber-500">{totalMonthlyExp.toFixed(2)}</div>
              <div className={`text-[11px] mt-0.5 ${ts}`}>₼ / month recurring</div>
            </>
          )}
        </div>
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-4 ${card}`}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h3 className={`font-semibold text-sm ${tp}`}>
              {isRenewal ? 'Expected Renewals — next 30 days' : 'Signups & Revenue'}
            </h3>
            {isRenewal && (
              <p className={`text-[11px] mt-0.5 ${ts}`}>
                Users whose paid plans expire in the next 30 days (trial/free excluded)
              </p>
            )}
          </div>

          {/* Period switcher */}
          <div className={`flex rounded-xl overflow-hidden border text-xs flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            {RANGES.map(({ key, label, isProjection }) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 font-semibold transition-colors flex items-center gap-1 ${
                  range === key
                    ? isProjection
                      ? 'bg-violet-600 text-white'
                      : 'bg-blue-600 text-white'
                    : isDark
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {isProjection && <CalendarClock size={10} />}
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-52 flex items-center justify-center">
            <div className={`text-sm ${ts}`}>Loading chart…</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={224}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridLine} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                interval={range === '1m' ? 4 : range === 'next_month' ? 4 : 0}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: axisColor }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: lineFill }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}₼`}
                width={50}
              />
              <Tooltip content={<CustomTooltip isDark={isDark} isRenewal={isRenewal} />} />
              <Legend
                formatter={(v) => (
                  <span className="text-xs">
                    {v === 'user_count'
                      ? isRenewal ? 'Renewing users' : 'New users'
                      : isRenewal ? 'Expected revenue (₼)' : 'Revenue (₼)'}
                  </span>
                )}
              />
              <Bar
                yAxisId="left"
                dataKey="user_count"
                name="user_count"
                fill={barFill}
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="revenue"
                stroke={lineFill}
                strokeWidth={2.5}
                strokeDasharray={isRenewal ? '6 3' : undefined}
                dot={{ r: 3, fill: lineFill, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {isRenewal && (
          <p className={`mt-2 text-[11px] text-center ${ts}`}>
            Dashed line = projected revenue · Bars = number of users renewing that day
          </p>
        )}
      </div>

      {/* ── Monthly Expenses ────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${card}`}>
        <button
          type="button"
          onClick={() => setShowExpenses((v) => !v)}
          className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDark ? 'hover:bg-slate-700/40' : 'hover:bg-slate-50'}`}
        >
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${tp}`}>Monthly Expenses</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
              {expenses.length}
            </span>
            {totalMonthlyExp > 0 && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {totalMonthlyExp.toFixed(2)} ₼/mo
              </span>
            )}
          </div>
          {showExpenses
            ? <ChevronUp size={15} className={ts} />
            : <ChevronDown size={15} className={ts} />}
        </button>

        {showExpenses && (
          <div className={`border-t ${divider}`}>
            <div className="px-5 pt-3 pb-4 space-y-2">
              {expenses.length === 0 && (
                <p className={`text-xs py-2 ${ts}`}>
                  No expenses yet. Add recurring monthly costs below.
                </p>
              )}
              {expenses.map((exp) => {
                const today = new Date(); today.setHours(0,0,0,0);
                const nextDue = exp.next_due_at ? new Date(exp.next_due_at) : null;
                const isPaid = nextDue && nextDue > today;
                const isDue  = !isPaid;
                const isPaying = payingId === exp.id;

                return (
                  <div
                    key={exp.id}
                    className={`rounded-xl px-3 py-2.5 transition-colors ${isDark ? 'bg-slate-700/40' : 'bg-slate-50'}`}
                  >
                    {/* Row 1: name + amount + buttons */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm font-medium truncate ${tp}`}>{exp.name}</span>
                        {!!exp.is_recurring && (
                          <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 flex-shrink-0 ${isDark ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                            monthly
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-amber-500">{Number(exp.amount).toFixed(2)} ₼</span>
                        {/* Paid button — only when due */}
                        {isDue && (
                          <button
                            type="button"
                            disabled={isPaying}
                            onClick={() => handlePayExpense(exp.id)}
                            className={`h-7 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                              isPaying
                                ? 'opacity-50 cursor-wait bg-emerald-700/40 text-emerald-300'
                                : isDark
                                ? 'bg-emerald-700/30 text-emerald-300 hover:bg-emerald-700/60'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            <Check size={11} strokeWidth={3} />
                            Ödənildi
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className={`h-6 w-6 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-red-900/30 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {/* Row 2: payment status */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isPaid ? (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                          <span className="text-[11px] text-emerald-400 font-medium">
                            Ödənilib · növbəti {new Date(exp.next_due_at).toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="text-[11px] text-amber-400 font-medium">
                            {exp.last_paid_at
                              ? `Son ödəniş: ${new Date(exp.last_paid_at).toLocaleDateString('az-AZ', { day: '2-digit', month: 'short', year: 'numeric' })} · İndi ödənilib olmalıdır`
                              : 'Hələ ödənilməyib'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              <form onSubmit={handleAddExpense} className="flex items-center gap-2 pt-1">
                <input
                  value={newExpense.name}
                  onChange={(e) => setNewExpense((p) => ({ ...p, name: e.target.value }))}
                  className="input-base h-9 text-sm flex-1 min-w-0"
                  placeholder="Expense name (e.g. Server cost)"
                  type="text"
                />
                <input
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                  className="input-base h-9 text-sm w-32 flex-shrink-0"
                  placeholder="Amount (₼)"
                  type="number"
                  min="0"
                  step="0.01"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-xl bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-blue-700 transition-colors flex-shrink-0"
                >
                  <Plus size={13} /> Add
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
