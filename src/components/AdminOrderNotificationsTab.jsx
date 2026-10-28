import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShoppingCart,
  Store,
} from 'lucide-react';
import { adminAPI } from '../services/api';

// Admin panel -> Sifariş bildirişləri: what the eBay Platform Notifications
// pipeline (backend services/ebayOrderNotifications.js) has done — the last
// cron run, which accounts are subscribed, every order that was announced to
// a user (with the computed profit), and the raw event queue for diagnosis.
// Backed by /admin/ebay-order-notifications/* (routes/admin.js).

const PAGE_SIZE = 50;

const money = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : `$${Number(value).toFixed(2)}`);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

const EVENT_STATUS_STYLES = {
  processed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  ignored: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const STATUS_LABELS = {
  processed: 'Göndərildi',
  pending: 'Növbədə',
  ignored: 'Atıldı',
  failed: 'Xəta',
  active: 'Aktiv',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${EVENT_STATUS_STYLES[status] || EVENT_STATUS_STYLES.ignored}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function OrderRow({ order }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(order.items) ? order.items : [];
  const saleTotal = items.reduce((sum, item) => sum + (Number(item.saleTotal) || 0), 0);
  const buyer = [order.buyerName, order.buyerUserId ? `(${order.buyerUserId})` : null].filter(Boolean).join(' ') || '—';
  return (
    <>
      <tr
        className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="px-3 py-2 text-slate-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(order.createdAt)}</td>
        <td className="px-3 py-2">
          <p className="font-medium text-slate-800 dark:text-slate-100">{order.userEmail}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{order.storeName}</p>
        </td>
        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{order.orderId}</td>
        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{buyer}</td>
        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
          {items.length === 1 ? <span className="line-clamp-1">{items[0].title}</span> : `${items.length} məhsul`}
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-300">{money(saleTotal)}</td>
        <td
          className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${
            order.totalProfit == null
              ? 'text-slate-400'
              : order.totalProfit >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
          }`}
        >
          {money(order.totalProfit)}
        </td>
      </tr>
      {open && (
        <tr className="bg-slate-50 dark:bg-slate-900/40">
          <td colSpan={8} className="px-4 py-3">
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={`${item.itemId}-${item.sku || index}`}
                  className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  {item.productImage ? (
                    <img src={item.productImage} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700">
                      <ShoppingCart className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {item.title}
                      {item.variationTitle ? <span className="text-slate-500"> · {item.variationTitle}</span> : null}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Item ID: {item.itemId}
                      {item.sku ? ` · SKU: ${item.sku}` : ''} · Say: {item.quantity}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                      <div><span className="text-slate-500">eBay satış</span><p className="font-semibold text-slate-800 dark:text-slate-100">{money(item.saleTotal)}</p></div>
                      <div><span className="text-slate-500">Amazon</span><p className="font-semibold text-slate-800 dark:text-slate-100">{item.matched ? money(item.amazonTotal) : '—'}</p></div>
                      <div><span className="text-slate-500">eBay fee</span><p className="font-semibold text-slate-800 dark:text-slate-100">{money(item.ebayFees)}</p></div>
                      <div>
                        <span className="text-slate-500">Reklam{item.adRatePercent ? ` (${item.adRatePercent}%)` : ''}</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{item.adFee > 0 ? money(item.adFee) : '—'}</p>
                      </div>
                      <div><span className="text-slate-500">Qalan</span><p className="font-semibold text-emerald-600 dark:text-emerald-400">{item.matched ? money(item.profit) : '—'}</p></div>
                    </div>
                    {!item.matched && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Products bölməsində tapılmadı — mənfəət hesablanmadı.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function OrdersView() {
  const [orders, setOrders] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (offset = 0) => {
    if (offset) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const res = await adminAPI.listNotifiedOrders({ limit: PAGE_SIZE, offset, search: search || undefined });
      const next = res.data?.orders || [];
      setOrders((prev) => (offset ? [...prev, ...next] : next));
      setHasMore(Boolean(res.data?.hasMore));
    } catch (err) {
      setError(errorMessage(err, 'Sifarişlər yüklənmədi'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search]);

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="İstifadəçi email-i, sifariş № və ya mağaza adı"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          Axtar
        </button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Tarix</th>
              <th className="px-3 py-2">İstifadəçi / mağaza</th>
              <th className="px-3 py-2">Sifariş №</th>
              <th className="px-3 py-2">Alıcı</th>
              <th className="px-3 py-2">Məhsul</th>
              <th className="px-3 py-2 text-right">Satış</th>
              <th className="px-3 py-2 text-right">Qalan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Hələ bildirilmiş sifariş yoxdur.</td></tr>
            ) : (
              orders.map((order) => <OrderRow key={order.id} order={order} />)
            )}
          </tbody>
        </table>
      </div>

      {hasMore && !loading && (
        <div className="text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => load(orders.length)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Daha çox
          </button>
        </div>
      )}
    </div>
  );
}

function SubscriptionsView() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    adminAPI
      .listOrderNotificationSubscriptions()
      .then((res) => !cancelled && setSubscriptions(res.data?.subscriptions || []))
      .catch((err) => !cancelled && setError(errorMessage(err, 'Abunələr yüklənmədi')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-slate-400" />;
  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">İstifadəçi</th>
              <th className="px-3 py-2">eBay hesabı</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Abunə tarixi</th>
              <th className="px-3 py-2">Xəta</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Hələ abunə olmuş hesab yoxdur — cron ilk işləyəndə əlavə olunacaq.</td></tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{sub.userEmail || sub.userId}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{sub.ebayUserId}</td>
                  <td className="px-3 py-2"><StatusBadge status={sub.status} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(sub.subscribedAt)}</td>
                  <td className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
                    {sub.status === 'failed' ? (
                      <>
                        {sub.lastError}
                        <span className="block text-slate-500 dark:text-slate-400">
                          Cəhd: {sub.attempts} · növbəti: {formatDate(sub.nextRetryAt)}
                        </span>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EventsView() {
  const [status, setStatus] = useState('');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    adminAPI
      .listOrderNotificationEvents({ status: status || undefined, limit: 200 })
      .then((res) => !cancelled && setEvents(res.data?.events || []))
      .catch((err) => !cancelled && setError(errorMessage(err, 'Hadisələr yüklənmədi')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {['', 'processed', 'pending', 'ignored', 'failed'].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              status === value
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {value ? STATUS_LABELS[value] : 'Hamısı'}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2">Gəlib</th>
              <th className="px-3 py-2">Satıcı</th>
              <th className="px-3 py-2">Sifariş №</th>
              <th className="px-3 py-2">Məhsul</th>
              <th className="px-3 py-2 text-right">Qiymət</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Qeyd</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Hadisə yoxdur.</td></tr>
            ) : (
              events.map((event) => (
                <tr key={event.id} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(event.receivedAt)}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{event.ebayUserId}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{event.orderId}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                    <span className="line-clamp-1">{event.payload?.itemTitle || event.itemId}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700 dark:text-slate-300">
                    {event.payload?.unitPrice != null ? `${money(event.payload.unitPrice)} × ${event.payload.quantity || 1}` : '—'}
                  </td>
                  <td className="px-3 py-2"><StatusBadge status={event.status} /></td>
                  <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{event.lastError || ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const VIEWS = [
  { key: 'orders', label: 'Bildirilən sifarişlər' },
  { key: 'subscriptions', label: 'Abunə olmuş hesablar' },
  { key: 'events', label: 'Hadisə növbəsi' },
];

export default function AdminOrderNotificationsTab() {
  const [view, setView] = useState('orders');
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    adminAPI
      .getOrderNotificationsOverview()
      .then((res) => {
        if (cancelled) return;
        setOverview(res.data || null);
        setError('');
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Məlumat yüklənmədi')))
      .finally(() => !cancelled && setRefreshing(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const lastRun = overview?.lastRun;
  const subs = overview?.subscriptions || {};
  const events24h = overview?.events?.last24h || {};
  const orders = overview?.orders || {};
  const lastRunErrors = Array.isArray(lastRun?.errors) ? lastRun.errors.length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <BellRing className="h-5 w-5 text-blue-600" />
            eBay sifariş bildirişləri
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            eBay-in göndərdiyi sifarişlər, istifadəçilərə gedən bildirişlər və hesabların abunə vəziyyəti.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ShoppingCart}
          tone="green"
          label="Bildirilən sifariş (24 saat / 7 gün)"
          value={`${orders.last24h ?? 0} / ${orders.last7d ?? 0}`}
          hint={`Son 7 gündə ${orders.users7d ?? 0} istifadəçi`}
        />
        <StatCard
          icon={CheckCircle2}
          tone="green"
          label="İstifadəçilərə qalan mənfəət (7 gün)"
          value={money(orders.profit7d)}
          hint="Products-da tapılan məhsullar üzrə"
        />
        <StatCard
          icon={Store}
          tone={subs.failed ? 'amber' : 'blue'}
          label="Abunə olmuş eBay hesabı"
          value={subs.active ?? 0}
          hint={subs.failed ? `${subs.failed} hesabda abunə xətası` : 'Xəta yoxdur'}
        />
        <StatCard
          icon={lastRunErrors ? AlertTriangle : Clock}
          tone={lastRunErrors ? 'red' : 'blue'}
          label="Son cron işi"
          value={lastRun ? formatDate(lastRun.finishedAt) : '—'}
          hint={
            lastRun
              ? `${lastRun.ordersNotified} sifariş · ${lastRun.subscribed} yeni abunə · ${lastRunErrors} xəta`
              : 'Server başlayandan bəri hələ işləməyib'
          }
        />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Son 24 saatda eBay-dən gələn hadisələr: {events24h.processed || 0} göndərildi · {events24h.pending || 0} növbədə ·{' '}
        {events24h.ignored || 0} atıldı · {events24h.failed || 0} xəta
      </p>

      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              view === item.key ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div key={`${view}-${refreshKey}`}>
        {view === 'orders' && <OrdersView />}
        {view === 'subscriptions' && <SubscriptionsView />}
        {view === 'events' && <EventsView />}
      </div>
    </div>
  );
}
