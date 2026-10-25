import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, PackageCheck, TrendingUp, AlertTriangle, ShoppingBag } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { notificationsAPI } from '../services/api';
import Alert from '../components/Alert';

const PAGE_SIZE = 30;

// One icon per notification `type` (see backend's createNotification call
// sites — productCheckNotifications.js, productController.js, cron.js).
// Unknown/future types fall back to a plain bell, so a new type added later
// never looks broken here.
function iconForType(type) {
  if (type === 'product_price_alert') return TrendingUp;
  if (type === 'product_auto_stock') return PackageCheck;
  if (type === 'product_compare_done') return CheckCheck;
  if (type === 'product_create_done' || type === 'product_update_done') return ShoppingBag;
  if (type?.endsWith('_failed') || type?.includes('failure')) return AlertTriangle;
  return Bell;
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'indicə';
  if (diffMin < 60) return `${diffMin} dəq əvvəl`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} saat əvvəl`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} gün əvvəl`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (offset = 0) => {
    try {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      const res = await notificationsAPI.list(PAGE_SIZE, offset);
      const page = res?.data?.notifications || [];
      setNotifications((prev) => (offset === 0 ? page : [...prev, ...page]));
      setHasMore(page.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Bildirişlər yüklənə bilmədi');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(0);
  }, [load]);

  const handleOpen = async (notification) => {
    if (!notification.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      try {
        await notificationsAPI.markRead(notification.id);
      } catch {
        // best-effort — a failed mark-read never blocks navigation
      }
    }
    const productId = notification.data?.productId;
    if (productId) {
      navigate(`/products/${productId}`);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationsAPI.markAllRead();
    } catch (err) {
      setError(err?.response?.data?.error || 'Əməliyyat uğursuz oldu');
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="page-shell">
      <div className="max-w-[1480px] mx-auto">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Bell size={24} />
            </span>
            <div>
              <h1 className="page-title">Bildirişlər</h1>
              <p className={`mt-1 text-sm ${muted}`}>
                Sistemin sizə göndərdiyi bütün bildirişlər.
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                isDark ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CheckCheck size={13} />
              Hamısını oxunmuş et ({unreadCount})
            </button>
          )}
        </div>

        {error && <div className="mb-4"><Alert type="error" message={error} onClose={() => setError(null)} /></div>}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className={`rounded-2xl border p-16 text-center text-sm ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            Hələ heç bir bildiriş yoxdur.
          </div>
        ) : (
          <div className={`divide-y rounded-2xl border ${isDark ? 'divide-slate-800 border-slate-800 bg-slate-900' : 'divide-slate-100 border-slate-200 bg-white'}`}>
            {notifications.map((notification) => {
              const Icon = iconForType(notification.type);
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleOpen(notification)}
                  className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                    isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                  } ${!notification.isRead ? (isDark ? 'bg-indigo-500/5' : 'bg-indigo-50/50') : ''}`}
                >
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {notification.title}
                      </span>
                      {!notification.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                    </span>
                    <span className={`mt-0.5 block text-sm ${muted}`}>{notification.message}</span>
                    <span className={`mt-1 block text-xs ${muted}`}>{formatTimestamp(notification.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && hasMore && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => load(notifications.length)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                isDark ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />}
              Daha çox göstər
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
