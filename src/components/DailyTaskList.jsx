// Today's to-do list inside the dashboard Action Center. The backend builds it
// every morning per eBay account (services/dailyTasks.js); tasks tick off by
// themselves when the work is detected, or the user ticks them here.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ExternalLink, Loader2, Package, RefreshCw, ShoppingCart, Snowflake, Sparkles, Store } from 'lucide-react';
import { amazonAPI, dailyTasksAPI } from '../services/api';
import { useEbayData } from '../context/EbayDataContext';

const HOUR_MS = 60 * 60 * 1000;
// The Orders page keeps manually entered ASINs here (OrdersPage.jsx).
const ORDERS_ASIN_MAP_STORAGE_KEY = 'checkila.ordersPage.asinMap.v1';

function storedAsin(orderId) {
  try {
    const map = JSON.parse(window.localStorage.getItem(ORDERS_ASIN_MAP_STORAGE_KEY) || '{}');
    return String(map?.[orderId] || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

const TYPE_META = {
  ship_order: { icon: Package, tone: 'text-indigo-500', tile: ['bg-indigo-50', 'bg-indigo-500/10'] },
  review_case: { icon: AlertTriangle, tone: 'text-amber-500', tile: ['bg-amber-50', 'bg-amber-500/10'] },
  review_dead_stock: { icon: Snowflake, tone: 'text-sky-500', tile: ['bg-sky-50', 'bg-sky-500/10'] },
};

function TaskRow({ task, isDark, onToggle, onNavigate, now }) {
  const { t } = useTranslation('system');
  const [ordering, setOrdering] = useState(false);
  const [message, setMessage] = useState(null);
  const done = task.status === 'done';
  const meta = TYPE_META[task.type] || TYPE_META.ship_order;
  const Icon = meta.icon;
  const asin = task.type === 'ship_order' ? task.meta?.asin || storedAsin(task.refId) : '';

  const handleOrderOnAmazon = async () => {
    if (!asin || ordering) return;
    setOrdering(true);
    setMessage(null);
    try {
      await amazonAPI.autoOrder({
        asin,
        quantity: task.meta?.quantity || 1,
        shipTo: task.meta?.shipTo || {},
        ebayOrderId: task.refId,
      });
      setMessage({ ok: true, text: t('actionCenter.tasks.orderSent') });
    } catch (err) {
      setMessage({ ok: false, text: err?.response?.data?.error || err?.message || t('actionCenter.tasks.orderFailed') });
    } finally {
      setOrdering(false);
    }
  };

  let subline = null;
  let deadline = null;
  if (task.type === 'ship_order') {
    const total = task.meta?.total ? `$${Number(task.meta.total).toFixed(2)}` : null;
    subline = [task.meta?.buyer, total].filter(Boolean).join(' · ');
    const shipBy = task.meta?.shipBy ? new Date(task.meta.shipBy).getTime() : null;
    if (shipBy && !done) {
      const left = shipBy - now;
      const hours = Math.max(1, Math.round(Math.abs(left) / HOUR_MS));
      const time = hours >= 48 ? t('actionCenter.time.days', { count: Math.round(hours / 24) }) : t('actionCenter.time.hours', { count: hours });
      deadline = left < 0
        ? { text: t('actionCenter.overdue', { time }), cls: 'bg-rose-600 text-white' }
        : { text: t('actionCenter.timeLeft', { time }), cls: left <= 12 * HOUR_MS ? (isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700') : left <= 24 * HOUR_MS ? (isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700') : (isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600') };
    }
  } else if (task.type === 'review_case') {
    subline = String(task.meta?.status || '').replace(/_/g, ' ').toLowerCase();
  } else if (task.type === 'review_dead_stock') {
    subline = (task.meta?.sample || []).slice(0, 2).map((s) => s.title).join(', ');
  }

  const secondaryBtn = `inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
    isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
  }`;

  return (
    <li className={`flex flex-col gap-3 rounded-xl border px-3 py-3 transition sm:flex-row sm:items-center ${
      done
        ? isDark ? 'border-slate-800/60 bg-slate-900/20' : 'border-slate-100 bg-slate-50/50'
        : isDark ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700' : 'border-slate-200 bg-white hover:border-slate-300'
    }`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(task)}
          aria-pressed={done}
          aria-label={done ? t('actionCenter.tasks.markOpen') : t('actionCenter.tasks.markDone')}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            done ? 'border-emerald-500 bg-emerald-500 text-white' : isDark ? 'border-slate-600 hover:border-emerald-400' : 'border-slate-300 hover:border-emerald-500'
          }`}
        >
          {done && <Check size={14} strokeWidth={3} />}
        </button>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDark ? meta.tile[1] : meta.tile[0]} ${done ? 'opacity-50' : ''}`}>
          <Icon size={16} className={meta.tone} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${done ? (isDark ? 'text-slate-500 line-through' : 'text-slate-400 line-through') : isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {task.type === 'ship_order' ? t('actionCenter.tasks.shipPrefix', { title: task.title }) : task.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {subline ? <p className={`truncate text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{subline}</p> : null}
            {deadline && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${deadline.cls}`}>{deadline.text}</span>}
            {done && task.doneBy === 'auto' && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                <Sparkles size={10} />
                {t('actionCenter.tasks.autoDone')}
              </span>
            )}
          </div>
          {message && <p className={`mt-1 text-xs ${message.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{message.text}</p>}
        </div>
      </div>

      {!done && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-9 sm:pl-0">
          {task.type === 'ship_order' && (
            asin ? (
              <button
                type="button"
                onClick={handleOrderOnAmazon}
                disabled={ordering}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {ordering ? <Loader2 size={12} className="animate-spin" /> : <ShoppingCart size={12} />}
                Order on Amazon
              </button>
            ) : (
              <button type="button" onClick={() => onNavigate('/orders')} className={secondaryBtn} title={t('actionCenter.tasks.noAsinHint')}>
                {t('actionCenter.tasks.addAsin')}
              </button>
            )
          )}
          {task.type === 'ship_order' && (
            <button type="button" onClick={() => onNavigate(`/orders/${encodeURIComponent(task.refId)}`)} className={secondaryBtn}>
              {t('actionCenter.tasks.view')}
            </button>
          )}
          {task.type === 'review_case' && (
            <button type="button" onClick={() => onNavigate('/cases')} className={secondaryBtn}>
              {t('actionCenter.tasks.viewCase')}
              <ExternalLink size={11} />
            </button>
          )}
          {task.type === 'review_dead_stock' && (
            <button type="button" onClick={() => onNavigate('/listings')} className={secondaryBtn}>
              {t('actionCenter.tasks.viewListings')}
              <ExternalLink size={11} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function DailyTaskList({ isDark }) {
  const { t } = useTranslation('system');
  const navigate = useNavigate();
  const { syncVersion } = useEbayData();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeAccount, setActiveAccount] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await dailyTasksAPI.today();
      setData(res?.data || null);
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || t('actionCenter.tasks.loadFailed'));
    } finally {
      setLoading(false);
      setNow(Date.now());
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, syncVersion]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const accounts = data?.accounts || [];
  useEffect(() => {
    if (!accounts.length) return;
    if (activeAccount && accounts.some((a) => a.accountId === activeAccount)) return;
    const withOpen = accounts.find((a) => a.tasks.some((task) => task.status !== 'done'));
    setActiveAccount((withOpen || accounts[0]).accountId);
  }, [accounts, activeAccount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      const res = await dailyTasksAPI.refresh();
      setData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || t('actionCenter.tasks.loadFailed'));
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  };

  const handleToggle = async (task) => {
    const done = task.status !== 'done';
    const patch = (status, doneBy) => (prev) => prev && {
      ...prev,
      done: prev.done + (status === 'done' ? 1 : -1),
      accounts: prev.accounts.map((a) => ({
        ...a,
        tasks: a.tasks.map((x) => (x.id === task.id ? { ...x, status, doneBy } : x)),
      })),
    };
    setData(patch(done ? 'done' : 'open', done ? 'user' : null));
    try {
      await dailyTasksAPI.setDone(task.id, done);
    } catch {
      setData(patch(done ? 'open' : 'done', task.doneBy));
    }
  };

  const current = accounts.find((a) => a.accountId === activeAccount) || accounts[0] || null;
  const sortedTasks = useMemo(
    () => (current ? [...current.tasks].sort((a, b) => (a.status === 'done') - (b.status === 'done')) : []),
    [current]
  );
  const total = data?.total || 0;
  const doneCount = data?.done || 0;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  const card = `mb-4 rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;

  return (
    <section className={card} aria-labelledby="daily-tasks-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 id="daily-tasks-title" className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {t('actionCenter.tasks.title')}
          </h3>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('actionCenter.tasks.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className={`h-2 w-28 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className={`whitespace-nowrap text-xs font-semibold tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t('actionCenter.tasks.progress', { done: doneCount, total })}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? t('actionCenter.refreshing') : t('actionCenter.tasks.rebuild')}
          </button>
        </div>
      </div>

      {error && <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${isDark ? 'bg-rose-500/10 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{error}</p>}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-14 animate-pulse rounded-xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'}`} />
          ))}
        </div>
      ) : !total ? (
        <div className={`mt-4 flex items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
          <Sparkles size={18} className="shrink-0 text-indigo-500" />
          <span>{data?.generatedAt ? t('actionCenter.tasks.noneToday') : t('actionCenter.tasks.notGenerated')}</span>
        </div>
      ) : (
        <>
          {accounts.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
              {accounts.map((account) => {
                const open = account.tasks.filter((task) => task.status !== 'done').length;
                const selected = account.accountId === current?.accountId;
                return (
                  <button
                    key={account.accountId}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveAccount(account.accountId)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Store size={13} />
                    {account.label}
                    <span className={`rounded-full px-1.5 text-[10px] ${selected ? 'bg-white/20' : open ? 'bg-rose-500 text-white' : isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {open ? open : <Check size={10} className="inline" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {current && current.tasks.every((task) => task.status === 'done') && (
            <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
              <Check size={16} />
              {t('actionCenter.tasks.allDone', { account: current.label })}
            </div>
          )}

          <ul className="mt-3 space-y-2">
            {sortedTasks.map((task) => (
              <TaskRow key={task.id} task={task} isDark={isDark} now={now} onToggle={handleToggle} onNavigate={navigate} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
