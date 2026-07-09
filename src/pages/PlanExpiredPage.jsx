import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock3, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

const GRACE_PERIOD_DAYS = 2;

export default function PlanExpiredPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark } = useTheme();

  const { daysSinceExpiry, daysRemaining } = useMemo(() => {
    if (!user?.planExpiresAt) return { daysSinceExpiry: 0, daysRemaining: GRACE_PERIOD_DAYS };
    const expiredAt = new Date(user.planExpiresAt).getTime();
    const since = Math.max(0, Math.floor((Date.now() - expiredAt) / (24 * 60 * 60 * 1000)));
    return { daysSinceExpiry: since, daysRemaining: Math.max(0, GRACE_PERIOD_DAYS - since) };
  }, [user?.planExpiresAt]);

  const pageBg = isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: headline card */}
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(248,113,113,0.22),rgba(15,23,42,0)_45%,rgba(34,211,238,0.12)_100%)]" />
            <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-red-400/15 blur-3xl" />
            <div className="absolute -bottom-28 left-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-red-100 backdrop-blur">
                <AlertTriangle size={14} />
                Subscription expired
              </div>

              <h1 className="mt-6 text-3xl font-semibold tracking-tight md:text-5xl">
                Your plan has expired.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-slate-200 md:text-lg">
                Access to Checkila&apos;s features is paused until you renew. Your account
                and data are safe for now, but they will be permanently deleted if the
                plan isn&apos;t renewed in time.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/upgrade-plan')}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Renew my plan
                  <ArrowRight size={16} />
                </button>
                <a
                  href="mailto:checkilanotify@gmail.com"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  <Mail size={16} />
                  Contact support
                </a>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-slate-400 transition hover:text-white"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </div>
            </div>
          </div>

          {/* Right: status card */}
          <div className={`rounded-[2rem] border p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] md:p-8 ${cardBg}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-2xl p-3 ${isDark ? 'bg-red-500/10 text-red-300' : 'bg-red-50 text-red-600'}`}>
                <Clock3 size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Deletion countdown</h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Renew before the countdown ends to keep your data.
                </p>
              </div>
            </div>

            <div className={`mt-6 rounded-2xl border p-5 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Expired on
              </p>
              <p className="mt-2 text-lg font-semibold">{formatDate(user?.planExpiresAt)}</p>
            </div>

            <div className={`mt-4 rounded-2xl border p-5 ${daysRemaining <= 0 ? 'border-red-400/30 bg-red-500/10' : isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Time left before permanent deletion
              </p>
              <p className={`mt-2 text-lg font-semibold ${daysRemaining <= 0 ? 'text-red-400' : ''}`}>
                {daysRemaining > 0
                  ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
                  : 'Your account is scheduled for deletion imminently'}
              </p>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {daysSinceExpiry === 0
                  ? 'Your plan expired today.'
                  : `It has been ${daysSinceExpiry} day${daysSinceExpiry === 1 ? '' : 's'} since expiration.`}
              </p>
            </div>

            <div className={`mt-6 space-y-3 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <p>
                If you don&apos;t renew or update your plan, your account and everything
                linked to it — products, connected eBay accounts, and auto-stock rules —
                will be permanently deleted 2 days after the expiration date.
              </p>
              <p>
                Renewing takes a minute: pick a plan, verify the code we email you, and
                you&apos;re back in business.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
