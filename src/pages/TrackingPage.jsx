import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Loader2, ExternalLink } from 'lucide-react';
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

export default function TrackingPage() {
  const { isDark } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await ebayAPI.listTracking();
        if (!cancelled) setRows(Array.isArray(res?.data?.tracking) ? res.data.tracking : []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Failed to load tracking records');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-2">
          <Truck size={18} />
          Tracking
        </h1>
      </div>

      {error && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${isDark ? 'bg-rose-900/30 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'}`}>
          {error}
        </div>
      )}

      <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full ${isDark ? 'divide-y divide-slate-700' : 'divide-y divide-slate-200'}`}>
            <thead className={isDark ? 'bg-slate-800/70' : 'bg-slate-50'}>
              <tr>
                {['eBay Order', 'Amazon Order / TBA', 'Aquiline Code', 'Status', 'Uploaded to eBay', 'Updated', ''].map((h, i) => (
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
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin mx-auto text-indigo-500" size={24} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-4 py-8 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No tracked orders yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{row.ebayOrderId}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.amazonTrackingNumber || '—'}</td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.aquilineTrackingNumber || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.aquilineStatus || row.tag} isDark={isDark} />
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {row.ebayFulfillmentId ? 'Uploaded' : '—'}
                    </td>
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {fmtDate(row.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* OrderDetailPage only renders with the full eBay order passed via router
                          state (see OrdersPage's navigate(..., { state: { order } })) — this list
                          only has the tracking row, not the full order, so send users to the Orders
                          list to open the order rather than a dead-end deep link. */}
                      <Link
                        to="/orders"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-400"
                      >
                        Open in Orders <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
