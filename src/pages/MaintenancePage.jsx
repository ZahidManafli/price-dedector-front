import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Clock3, ShieldAlert, Sparkles } from 'lucide-react';
import { maintenanceAPI } from '../services/api';

function formatUtc(value) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export default function MaintenancePage() {
  const location = useLocation();
  const [status, setStatus] = useState({ active: false, maintenance: location.state?.maintenance || null });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await maintenanceAPI.getStatus();
        if (!mounted) return;
        setStatus({
          active: Boolean(response?.data?.active),
          maintenance: response?.data?.maintenance || location.state?.maintenance || null,
        });
      } catch {
        if (!mounted) return;
        setStatus((prev) => ({ ...prev, maintenance: prev.maintenance || location.state?.maintenance || null }));
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [location.state]);

  const windowLabel = useMemo(() => {
    if (!status.maintenance) return null;
    return `${formatUtc(status.maintenance.startAt)} - ${formatUtc(status.maintenance.endAt)}`;
  }, [status.maintenance]);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#dbeafe_0%,_#f8fafc_38%,_#f8fafc_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.28),rgba(15,23,42,0)_45%,rgba(14,165,233,0.18)_100%)]" />
            <div className="absolute -right-24 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="absolute -bottom-28 left-0 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />

            <div className="relative z-10 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100 backdrop-blur">
                <Sparkles size={14} />
                Service paused
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
                We&apos;ll be back shortly.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-8 text-slate-200 md:text-lg">
                Checkila is in a scheduled maintenance window. Access is paused while we apply
                updates and verify platform health.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Status</p>
                  <p className="mt-2 text-lg font-semibold">
                    {status.active ? 'Maintenance active' : 'Maintenance notice'}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Sign-in remains available for the portal.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">Window</p>
                  <p className="mt-2 text-lg font-semibold">
                    {windowLabel || 'Awaiting schedule details'}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Times are displayed in UTC for consistency.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-50"
                >
                  Go to login
                </Link>
                <a
                  href="mailto:checkilanotify@gmail.com"
                  className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Contact support
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] md:p-8">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">What&apos;s happening</h2>
                <p className="text-sm text-slate-500">A controlled pause while the system is updated.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
              <p>
                If you were already signed in, your session will be cleared automatically when a
                protected request detects the maintenance window.
              </p>
              <p>
                Everyone will see this screen until the scheduled window ends.
              </p>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Clock3 size={16} className="text-blue-700" />
                Maintenance window
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-900">Starts:</span> {formatUtc(status.maintenance?.startAt)}</p>
                <p><span className="font-medium text-slate-900">Ends:</span> {formatUtc(status.maintenance?.endAt)}</p>
                <p><span className="font-medium text-slate-900">Message:</span> {status.maintenance?.message || 'The system is temporarily unavailable.'}</p>
              </div>
            </div>

            <div className="mt-8 text-xs text-slate-400">
              If this looks unexpected, contact the team before retrying login.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}