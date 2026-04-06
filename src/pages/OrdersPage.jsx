import React, { useEffect, useMemo, useState } from 'react';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import Alert from '../components/Alert';
import { Loader2, Package, ChevronDown, ChevronUp, Link2, Search, SlidersHorizontal } from 'lucide-react';

export default function OrdersPage() {
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [error, setError] = useState(null);

  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(0);
  const [limit] = useState(25);
  const [expanded, setExpanded] = useState({});
  const [fetchingPage, setFetchingPage] = useState(false);
  const [nextOffset, setNextOffset] = useState(null);
  const [total, setTotal] = useState(null);
  const [query, setQuery] = useState('');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  const canNext = nextOffset !== null;
  const offset = useMemo(() => page * limit, [page, limit]);
  const filteredOrders = useMemo(() => {
    return (orders || []).filter((order) => {
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        String(order?.orderId || '').toLowerCase().includes(q) ||
        String(order?.buyer?.username || '').toLowerCase().includes(q) ||
        String(order?.lineItems?.[0]?.title || '').toLowerCase().includes(q);
      const matchFulfillment =
        fulfillmentFilter === 'ALL' || String(order?.orderFulfillmentStatus || '') === fulfillmentFilter;
      const matchPayment = paymentFilter === 'ALL' || String(order?.orderPaymentStatus || '') === paymentFilter;
      return matchQuery && matchFulfillment && matchPayment;
    });
  }, [orders, query, fulfillmentFilter, paymentFilter]);
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
        setError(err?.response?.data?.error || err?.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPage = async (pageIndex) => {
    try {
      setFetchingPage(true);
      const res = await ebayAPI.getOrders(pageIndex * limit, limit);
      const data = res?.data || {};

      if (data?.accessDenied) {
        setError(data?.accessDeniedErrorMessage || 'eBay fulfillment access denied');
        setOrders([]);
        setNextOffset(null);
        setTotal(null);
        return;
      }

      setOrders(data.orders || []);
      setTotal(typeof data.total === 'number' ? data.total : null);
      setNextOffset(data.nextOffset ?? null);
      setPage(pageIndex);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load eBay orders');
      setOrders([]);
      setNextOffset(null);
    } finally {
      setFetchingPage(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to start eBay connection');
    }
  };

  const toggleExpand = (orderId) => {
    setExpanded((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
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
          Orders
        </h1>
        {ebayStatus.connected && typeof total === 'number' ? (
          <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Total: {total}</div>
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
              Connect your eBay account to view your fulfillment orders.
            </p>
            <button type="button" onClick={handleConnect} className="btn-primary inline-flex items-center gap-2">
              <Link2 size={16} />
              Connect eBay
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
                  eBay Sign-in Required
                </h2>
                <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  You must connect eBay (seller account) to view orders.
                </p>
                <div className="flex gap-3 justify-end">
                  <button type="button" className="btn-secondary" onClick={() => setShowConnectModal(false)}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2"
                    onClick={handleConnect}
                  >
                    <Link2 size={16} />
                    Connect eBay
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
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Showing</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{filteredOrders.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Paid</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{stats.paid}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fulfilled</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>{stats.fulfilled}</p>
          </div>
          <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Refunded</p>
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
                placeholder="Search ID, buyer, item..."
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
                <option value="ALL">All payment</option>
                <option value="PAID">PAID</option>
                <option value="FULLY_REFUNDED">FULLY_REFUNDED</option>
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
                <option value="ALL">All fulfillment</option>
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="FULFILLED">FULFILLED</option>
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
                    Order ID
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Payment
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Fulfillment
                  </th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    Total
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {filteredOrders.map((order) => {
                  const id = order.orderId;
                  const isOpen = !!expanded[id];
                  const payment = order.orderPaymentStatus || '-';
                  const fulfillment = order.orderFulfillmentStatus || '-';
                  const totalValue = order?.pricingSummary?.total?.value;
                  const totalCurrency = order?.pricingSummary?.total?.currency;
                  const buyer = order?.buyer?.username || '-';
                  const createdAt = order?.creationDate ? new Date(order.creationDate).toLocaleString() : '-';

                  return (
                    <React.Fragment key={id}>
                      <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{id}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(payment, 'payment')}`}>
                            {payment}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs border ${getPill(fulfillment, 'fulfillment')}`}>
                            {fulfillment}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {totalValue != null ? `${totalValue} ${totalCurrency || ''}`.trim() : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleExpand(id)}
                            className={`inline-flex items-center gap-1 ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
                          >
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className={isDark ? 'bg-slate-800/60' : 'bg-slate-50'}>
                          <td colSpan={5} className="px-4 py-3">
                            <div className={`text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'} mb-3`}>
                              <div className="flex flex-wrap gap-x-6 gap-y-1">
                                <div>
                                  Buyer: <span className="font-semibold">{buyer}</span>
                                </div>
                                <div>
                                  Created: <span className="font-semibold">{createdAt}</span>
                                </div>
                              </div>
                            </div>
                            <pre
                              className={`text-xs overflow-auto max-h-96 ${
                                isDark ? 'text-slate-200' : 'text-slate-700'
                              }`}
                            >
                              {JSON.stringify(order, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No orders found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={`flex items-center justify-between px-4 py-3 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <div className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Page {page + 1}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => page > 0 && loadPage(page - 1)}
                disabled={page <= 0 || fetchingPage}
                className="btn-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => canNext && loadPage(page + 1)}
                disabled={!canNext || fetchingPage}
                className="btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

