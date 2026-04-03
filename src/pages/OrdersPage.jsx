import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { Loader2, Package, ChevronDown, ChevronUp, Link2 } from 'lucide-react';

export default function OrdersPage() {
  const navigate = useNavigate();
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

  const canNext = nextOffset !== null;
  const offset = useMemo(() => page * limit, [page, limit]);

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
          <div className={`rounded-xl p-6 text-center border ${isDark ? 'bg-slate-900/60 border-slate-700' : ''}`}>
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
              <div className={`w-full max-w-md p-6 rounded-xl border ${isDark ? 'bg-slate-900/80 border-slate-700' : ''}`}>
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
        <div className={`glass-card p-0 overflow-hidden rounded-xl border ${isDark ? 'bg-slate-900/30 border-slate-800' : ''}`}>
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
                {orders.map((order) => {
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
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{payment}</td>
                        <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{fulfillment}</td>
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
                            <pre className={`text-xs overflow-auto max-h-96 ${isDark ? 'text-slate-200' : ''}`}>
                              {JSON.stringify(order, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No orders found.
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
      )}
    </div>
  );
}

