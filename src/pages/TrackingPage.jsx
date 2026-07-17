import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function StatusPill({ status, isDark }) {
  const s = String(status || '').trim();
  if (!s) return <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>;

  const lower = s.toLowerCase();
  let cls;
  if (lower === 'delivered') {
    cls = isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (lower === 'error') {
    cls = isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-300';
  } else if (lower === 'cancelled') {
    cls = isDark ? 'bg-slate-700/40 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-300';
  } else if (lower === 'delayed') {
    cls = isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300';
  } else {
    cls = isDark ? 'bg-blue-900/40 text-blue-300 border-blue-700' : 'bg-blue-50 text-blue-700 border-blue-300';
  }
  return <span className={`border text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

function TrackedRow({ row, isDark, onUpdated }) {
  const [gettingTracking, setGettingTracking] = useState(false);
  const [sendingToEbay, setSendingToEbay] = useState(false);
  const [error, setError] = useState('');

  const handleGetTracking = async () => {
    setGettingTracking(true);
    setError('');
    try {
      const res = await ebayAPI.getTracking(row.ebayOrderId);
      const tracking = res?.data?.tracking;
      onUpdated(tracking);
      if (tracking?.aquilineTrackingNumber) {
        Swal.fire({
          title: 'Aquiline code',
          text: tracking.aquilineTrackingNumber,
          icon: 'success',
          confirmButtonText: 'Copy',
        }).then((result) => {
          if (result.isConfirmed) {
            navigator.clipboard?.writeText(tracking.aquilineTrackingNumber);
          }
        });
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to get tracking');
    } finally {
      setGettingTracking(false);
    }
  };

  const handleSendToEbay = async () => {
    setSendingToEbay(true);
    setError('');
    try {
      const res = await ebayAPI.uploadOrderTrackingToEbay(row.ebayOrderId, {});
      onUpdated(res?.data?.tracking);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to send to eBay');
    } finally {
      setSendingToEbay(false);
    }
  };

  return (
    <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.ebayOrderId}</td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.amazonOrderId || row.amazonTrackingNumber || '—'}</td>
      <td className="px-4 py-3">
        <StatusPill status={row.aquilineStatus || row.tag} isDark={isDark} />
        {row.aquilineTrackingNumber && (
          <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.aquilineTrackingNumber}</div>
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {row.ebayFulfillmentId ? 'Uploaded' : '—'}
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {fmtDate(row.updatedAt)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {row.amazonOrderId && !row.aquilineTrackingNumber && (
            <button
              type="button"
              onClick={handleGetTracking}
              disabled={gettingTracking}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {gettingTracking ? 'Getting…' : 'Get Tracking'}
            </button>
          )}
          {row.aquilineTrackingNumber && !row.ebayFulfillmentId && (
            <button
              type="button"
              onClick={handleSendToEbay}
              disabled={sendingToEbay}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              {sendingToEbay ? 'Sending…' : 'Send to eBay'}
            </button>
          )}
          {/* OrderDetailPage only renders with the full eBay order passed via router
              state (see OrdersPage's navigate(..., { state: { order } })) — this list
              only has the tracking row, not the full order, so send users to the Orders
              list to open the order rather than a dead-end deep link. */}
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-400"
          >
            <ExternalLink size={12} />
          </Link>
        </div>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      </td>
    </tr>
  );
}

function UnmatchedRow({ item, isDark, onResolved }) {
  const [ebayOrderId, setEbayOrderId] = useState(item.candidateEbayOrderIds?.[0] || '');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');

  const resolve = async () => {
    if (!ebayOrderId.trim()) return;
    setResolving(true);
    setError('');
    try {
      await ebayAPI.resolveUnmatchedAmazonOrder(item.id, ebayOrderId.trim());
      onResolved(item.id);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to resolve');
    } finally {
      setResolving(false);
    }
  };

  return (
    <tr className={isDark ? 'bg-slate-900' : 'bg-white'}>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
        {item.amazonOrderLink ? (
          <a href={item.amazonOrderLink} target="_blank" rel="noreferrer" className="underline hover:text-indigo-400">
            {item.amazonOrderId}
          </a>
        ) : (
          item.amazonOrderId
        )}
      </td>
      <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
        {[item.shipTo?.name, item.shipTo?.postalCode].filter(Boolean).join(' · ') || '—'}
      </td>
      <td className={`px-4 py-3 text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{fmtDate(item.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {Array.isArray(item.candidateEbayOrderIds) && item.candidateEbayOrderIds.length > 0 ? (
            <select
              value={ebayOrderId}
              onChange={(e) => setEbayOrderId(e.target.value)}
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            >
              <option value="">Select order…</option>
              {item.candidateEbayOrderIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          ) : (
            <input
              value={ebayOrderId}
              onChange={(e) => setEbayOrderId(e.target.value)}
              placeholder="eBay order id"
              className={`rounded-lg border px-2 py-1.5 text-sm ${isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-300 text-slate-900'}`}
            />
          )}
          <button
            type="button"
            onClick={resolve}
            disabled={resolving || !ebayOrderId.trim()}
            className="btn-primary text-xs px-3 py-1.5"
          >
            {resolving ? 'Linking…' : 'Link'}
          </button>
        </div>
        {error && <p className="text-xs text-rose-500 mt-1">{error}</p>}
      </td>
    </tr>
  );
}

export default function TrackingPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('tracked');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unmatched, setUnmatched] = useState([]);
  const [unmatchedLoading, setUnmatchedLoading] = useState(true);

  const loadTracked = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ebayAPI.listTracking();
      setRows(Array.isArray(res?.data?.tracking) ? res.data.tracking : []);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load tracking records');
    } finally {
      setLoading(false);
    }
  };

  const loadUnmatched = async () => {
    setUnmatchedLoading(true);
    try {
      const res = await ebayAPI.listUnmatchedAmazonOrders();
      setUnmatched(Array.isArray(res?.data?.unmatched) ? res.data.unmatched : []);
    } catch {
      setUnmatched([]);
    } finally {
      setUnmatchedLoading(false);
    }
  };

  useEffect(() => {
    loadTracked();
    loadUnmatched();
  }, []);

  const handleResolved = (id) => {
    setUnmatched((prev) => prev.filter((u) => u.id !== id));
    loadTracked();
  };

  const handleRowUpdated = (updatedTracking) => {
    if (!updatedTracking) return;
    setRows((prev) => prev.map((r) => (r.id === updatedTracking.id ? updatedTracking : r)));
  };

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Truck size={18} />
          Tracking
        </h1>
      </div>

      <div className={`mb-6 rounded-xl p-1 border inline-flex gap-1 ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
        <button
          type="button"
          onClick={() => setActiveTab('tracked')}
          className={`px-3 py-2 text-sm rounded-lg transition ${activeTab === 'tracked' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Tracked Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('unmatched')}
          className={`px-3 py-2 text-sm rounded-lg transition inline-flex items-center gap-1.5 ${activeTab === 'unmatched' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          {unmatched.length > 0 && <AlertTriangle size={13} />}
          Needs Review{unmatched.length > 0 ? ` (${unmatched.length})` : ''}
        </button>
      </div>

      {error && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isDark ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
          {error}
        </div>
      )}

      {activeTab === 'tracked' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  {['eBay Order', 'Amazon Order ID', 'Aquiline Status', 'Uploaded to eBay', 'Updated', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      No tracked orders yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <TrackedRow key={row.id} row={row} isDark={isDark} onUpdated={handleRowUpdated} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'unmatched' && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="overflow-x-auto">
            <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
              <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
                <tr>
                  {['Amazon Order ID', 'Ship-to', 'Observed', 'Link to eBay order'].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}>
                {unmatchedLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                    </td>
                  </tr>
                ) : unmatched.length === 0 ? (
                  <tr>
                    <td colSpan={4} className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Nothing needs review — every observed Amazon order has been matched.
                    </td>
                  </tr>
                ) : (
                  unmatched.map((item) => (
                    <UnmatchedRow key={item.id} item={item} isDark={isDark} onResolved={handleResolved} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
