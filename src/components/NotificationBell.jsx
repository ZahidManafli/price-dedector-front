import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { notificationsAPI } from '../services/api';

const POLL_MS = 60000;

// Sidebar bell icon — links to /notifications (NotificationsPage.jsx) and
// shows an unread-count badge, polled periodically. A failed poll just
// leaves the badge at its last known value rather than erroring visibly;
// this is a convenience indicator, not core functionality.
export default function NotificationBell({ isDark, collapsed = false, onNavigate }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await notificationsAPI.unreadCount();
        if (!cancelled) setUnreadCount(Number(res?.data?.count || 0));
      } catch {
        // silent
      }
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <Link
      to="/notifications"
      onClick={onNavigate}
      className={`relative flex items-center justify-center rounded-lg transition-colors ${
        collapsed ? 'p-2' : 'h-9 w-9 flex-shrink-0'
      } ${
        isDark
          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
      }`}
      title="Bildirişlər"
    >
      <Bell size={collapsed ? 16 : 16} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
