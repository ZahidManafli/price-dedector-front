import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import Alert from '../components/Alert';
import { ArrowDownUp, Loader2, Package, Link2, Search, SlidersHorizontal } from 'lucide-react';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const getBuyerDisplay = (order) => {
    const username = String(order?.buyer?.username || '').trim();
    const fullName = String(order?.buyer?.buyerRegistrationAddress?.fullName || '').trim();
    if (username && fullName) return `${username} | ${fullName}`;
    return username || fullName || '-';
  };

  const isOrderCancelled = (order) => {
    const cancellation = order?.cancelStatus || order?.orderCancelStatus || order?.cancellation || {};
    const cancelState = String(cancellation?.cancelState || '').toUpperCase();
    // eBay uses "CANCELED" (US spelling) in the payload; accept both just in case.
    return cancelState === 'CANCELED' || cancelState === 'CANCELLED';
  };

  const getDerivedShipmentStatus = (order) => {
    const fulfillmentRaw = String(order?.orderFulfillmentStatus || '').toUpperCase();
    if (fulfillmentRaw === 'NOT_STARTED' && isOrderCancelled(order)) return 'ORDER_CANCELLED';
    return fulfillmentRaw || '-';
  };

  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [pageCursors, setPageCursors] = useState([null]);
  const [fetchingPage, setFetchingPage] = useState(false);
  const [total, setTotal] = useState(null);
  const [query, setQuery] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [sortKey, setSortKey] = useState('orderId');
  const [sortDir, setSortDir] = useState('asc');
  const ordersRequestRef = useRef(0);

  const canNext = pageCursors[page + 1] != null;
  const filteredOrders = useMemo(() => {
    const base = (orders || []).filter((order) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        String(order?.orderId || '').toLowerCase().includes(q) ||
        String(order?.buyer?.username || '').toLowerCase().includes(q) ||
        String(order?.buyer?.buyerRegistrationAddress?.fullName || '').toLowerCase().includes(q) ||
        String(order?.lineItems?.[0]?.title || '').toLowerCase().includes(q);
      const matchFulfillment =
        fulfillmentFilter === 'ALL' || getDerivedShipmentStatus(order) === String(fulfillmentFilter || '').toUpperCase();
      const matchPayment = paymentFilter === 'ALL' || String(order?.orderPaymentStatus || '') === paymentFilter;
      return matchQuery && matchFulfillment && matchPayment;
    });
    const compare = (a, b) => {
      if (sortKey === 'orderId') return String(a?.orderId || '').localeCompare(String(b?.orderId || ''));
      if (sortKey === 'payment') {
        return String(a?.orderPaymentStatus || '').localeCompare(String(b?.orderPaymentStatus || ''));
      }
      if (sortKey === 'fulfillment') {
        return getDerivedShipmentStatus(a).localeCompare(getDerivedShipmentStatus(b));
      }
      if (sortKey === 'total') {
        return Number(a?.pricingSummary?.total?.value ?? -1) - Number(b?.pricingSummary?.total?.value ?? -1);
      }
      return 0;
    };
    const sorted = [...base].sort(compare);
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [orders, query, fulfillmentFilter, paymentFilter, sortKey, sortDir]);
  const onSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  };
  const sortLabel = (key, label) => (
    <button type="button" onClick={() => onSort(key)} className="inline-flex items-center gap-1">
      {label}
      <ArrowDownUp size={12} className={sortKey === key ? 'opacity-100' : 'opacity-40'} />
    </button>
  );
  const stats = useMemo(() => {
    const paid = orders.filter((o) => String(o?.orderPaymentStatus || '') === 'PAID').length;
    const refunded = orders.filter((o) => String(o?.orderPaymentStatus || '').includes('REFUNDED')).length;
    const fulfilled = orders.filter((o) => String(o?.orderFulfillmentStatus || '') === 'FULFILLED').length;
    return { paid, refunded, fulfilled };
  }, [orders]);
  const getPill = (value, type) => {
    const v = String(value || '');
    if (type === 'payment') {
      if (v.includes('REFUND')) return isDark ? 'bg-rose-900/30 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
      if (v === 'PAID') return isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (v === 'ORDER_CANCELLED') return isDark ? 'bg-rose-900/30 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
    if (v === 'FULFILLED') return isDark ? 'bg-emerald-900/30 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (v === 'NOT_STARTED') return isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200';
    return isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const statusRes = await ebayAPI.getStatus();
        const status = statusRes?.data || { connected: false };
        setEbayStatus(status);

        if (!status.connected) {
          setShowConnectModal(true);
          return;
        }

        await loadPage(0);
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || t('ordersPage.failedLoad'));
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyOrdersPayload = (data = {}, pageIndex = 0) => {
    setOrders(data.orders || []);
    setTotal(typeof data.total === 'number' ? data.total : null);
    const nextHref = typeof data.next === 'string' && data.next.trim() ? data.next.trim() : null;
    setPageCursors((prev) => {
      const next = [...prev];
      if (next[0] === undefined) next[0] = null;
      next[pageIndex + 1] = nextHref;
      return next;
    });
    setPage(pageIndex);
  };

  const loadPage = async (pageIndex, { forceRefresh = false, silent = false } = {}) => {
    const requestId = ++ordersRequestRef.current;
    try {
      if (!silent) setFetchingPage(true);
      const cursor = pageCursors[pageIndex] ?? null;
      const res = await ebayAPI.getOrders({
        ...(forceRefresh ? { refresh: true } : {}),
        ...(cursor ? { next: cursor } : {}),
      });
      const data = res?.data || {};
      if (requestId !== ordersRequestRef.current) return;

      if (data?.accessDenied) {
        setError(data?.accessDeniedErrorMessage || 'eBay shipment access denied');
        setOrders([]);
        setPageCursors((prev) => {
          const next = [...prev];
          next[pageIndex + 1] = null;
          return next;
        });
        setTotal(null);
        return;
      }

      applyOrdersPayload(data, pageIndex);

      if (data?.from_cache && !forceRefresh) {
        ebayAPI
          .getOrders({
            refresh: true,
            ...(cursor ? { next: cursor } : {}),
          })
          .then((refreshRes) => {
            const refreshData = refreshRes?.data || {};
            if (requestId !== ordersRequestRef.current) return;
            if (refreshData?.accessDenied) return;
            applyOrdersPayload(refreshData, pageIndex);
          })
          .catch((refreshErr) => {
            const msg = refreshErr?.response?.data?.error || '';
            if (msg) console.warn('Silent orders refresh failed:', msg);
          });
      }
    } catch (err) {
      if (requestId !== ordersRequestRef.current) return;
      setError(err?.response?.data?.error || err?.message || t('ordersPage.failedLoad'));
      setOrders([]);
      setPageCursors((prev) => {
        const next = [...prev];
        next[pageIndex + 1] = null;
        return next;
      });
    } finally {
      if (requestId === ordersRequestRef.current && !silent) {
        setFetchingPage(false);
      }
    }
  };

  const handleConnect = async () => {
    try {
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('ordersPage.failedConnect'));
    }
  };

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} />
          {t('ordersPage.title')}
        </h1>
        {ebayStatus.connected ? (
          <div className={`text-sm flex items-center gap-3 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {(ebayStatus.activeAccountLabel || ebayStatus.accountId) ? (
              <span className={`inline-flex items-center rounded-full px-3 py-2 text-md border ${isDark ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {t('ordersPage.activeAccount')}: <span className="ml-1 font-semibold">{ebayStatus.activeAccountLabel || ebayStatus.accountId}</span>
              </span>
            ) : null}
            {typeof total === 'number' ? `${t('ordersPage.table.total')}: ${total}` : null}
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-4">
          <Alert type="error" message={error} onClose={() => setError(null)} />
        </div>
      )}

      {!ebayStatus.connected ? (
        <>
          <div
            className={`rounded-xl p-6 text-center border ${
              isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
              <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} mb-4`}> 
              {t('ordersPage.connectPrompt')}
            </p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} />
              {t('ordersPage.connectButton')}
            </button>
          </div>

          {showConnectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div
                className={`w-full max-w-md p-6 rounded-xl border ${
                  isDark ? 'bg-slate-900/80 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <h2 className="text-lg font-semibold mb-2" style={{ color: isDark ? '#e2e8f0' : undefined }}>
                  {t('ordersPage.signinRequired')}
                </h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('ordersPage.signinDescription')}
                </p>
                <div className="flex gap-3 justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>
                    {t('listingModal.close')}
                  </button>
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={handleConnect}
                  >
                    <Link2 size={16} />
                    {t('ordersPage.connectButton')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.showing')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{filteredOrders.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.paid')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{stats.paid}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.shipped')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{stats.fulfilled}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('ordersPage.refunded')}</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>{stats.refunded}</p>
          </div>
        </div>
        <div className={`mb-4 rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative md:col-span-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('ordersPage.searchPlaceholder')}
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </label>
            <label className="relative">
              <SlidersHorizontal size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">{t('ordersPage.filter.allPayment')}</option>
                <option value="PAID">{t('ordersPage.filter.paid')}</option>
                <option value="FULLY_REFUNDED">{t('ordersPage.filter.fullyRefunded')}</option>
              </select>
            </label>
            <label className="relative">
              <SlidersHorizontal size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={fulfillmentFilter}
                onChange={(e) => setFulfillmentFilter(e.target.value)}
                className={`w-full rounded-lg pl-9 pr-3 py-2 text-sm border ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">{t('ordersPage.filter.allShipment')}</option>
                <option value="NOT_STARTED">{t('ordersPage.filter.notStarted')}</option>
                <option value="ORDER_CANCELLED">{t('ordersPage.filter.orderCancelled')}</option>
                <option value="FULFILLED">{t('ordersPage.filter.fulfilled')}</option>
              </select>
            </label>
          </div>
        </div>
        <div
              className={`glass-card p-0 overflow-hidden rounded-xl border ${
                isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('orderId', t('ordersPage.table.orderId'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {t('ordersPage.table.buyer')}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('payment', t('ordersPage.table.payment'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('fulfillment', t('ordersPage.table.shipment'))}
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {sortLabel('total', t('ordersPage.table.total'))}
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {filteredOrders.map((order) => {
                  const id = order.orderId;
                  const payment = order.orderPaymentStatus || '-';
                  const shipmentStatus = getDerivedShipmentStatus(order);
                  const totalValue = order?.pricingSummary?.total?.value;
                  const totalCurrency = order?.pricingSummary?.total?.currency;
                  const buyer = getBuyerDisplay(order);
                  const createdAt = order?.creationDate ? new Date(order.creationDate).toLocaleString() : '-';

                  return (
                    <React.Fragment key={id}>
                      <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{id}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{buyer}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(payment, 'payment')}`}>
                            {payment}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(shipmentStatus, 'fulfillment')}`}>
                            {shipmentStatus}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {totalValue != null ? `${totalValue} ${totalCurrency || ''}`.trim() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/orders/${encodeURIComponent(String(id))}`, {
                                state: { order },
                              })
                            }
                            className={`inline-flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                          >
                            {t('ordersPage.table.details')}
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                      <td colSpan={6} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('ordersPage.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('ordersPage.pagination.page', { page: page + 1 })}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => page > 0 && loadPage(page - 1)}
                disabled={page <= 0 || fetchingPage}
                className="btn-secondary"
              >
                {t('ordersPage.pagination.previous')}
              </button>
              <button
                type="button"
                onClick={() => canNext && loadPage(page + 1)}
                disabled={!canNext || fetchingPage}
                className="btn-secondary"
              >
                {t('ordersPage.pagination.next')}
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

