import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Store, Check, Loader2 } from 'lucide-react';
import { ebayAPI } from '../services/api';

// Minimum lead time enforced client-side too (must match the backend's own
// SCHEDULED_LISTING_MIN_LEAD_MS in routes/ebay.js) so the error surfaces
// instantly instead of only after a round-trip.
const MIN_LEAD_MINUTES = 2;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeInputValue(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function combineLocalDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  if ([y, m, d, h, min].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, h, min, 0, 0);
}

function formatRelative(ms) {
  if (ms <= 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} dəqiqə`);
  return parts.length ? parts.join(' ') : '1 dəqiqədən az';
}

export default function ScheduleListingModal({ isDark, onClose, listingPayload }) {
  const { t } = useTranslation();

  const [ebayAccounts, setEbayAccounts] = useState([]);
  const [activeEbayAccountId, setActiveEbayAccountId] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const now = useMemo(() => new Date(), []);
  const defaultDate = useMemo(() => {
    const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return d;
  }, [now]);

  const [dateStr, setDateStr] = useState(toDateInputValue(defaultDate));
  const [timeStr, setTimeStr] = useState(toTimeInputValue(defaultDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ebayAPI
      .getStatus()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data || {};
        const accounts = Array.isArray(data.ebayAccounts) ? data.ebayAccounts.filter((a) => a.connected) : [];
        setEbayAccounts(accounts);
        setActiveEbayAccountId(data.activeEbayAccountId || accounts[0]?.id || null);
        setSelectedAccountId(data.activeEbayAccountId || accounts[0]?.id || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAccounts(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scheduledDate = combineLocalDateTime(dateStr, timeStr);
  const leadMs = scheduledDate ? scheduledDate.getTime() - Date.now() : null;
  const relativeLabel = leadMs != null ? formatRelative(leadMs) : null;

  const applyQuickPick = (kind) => {
    let target;
    const base = new Date();
    if (kind === '2h') {
      target = new Date(base.getTime() + 2 * 60 * 60 * 1000);
    } else if (kind === '24h') {
      target = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    } else if (kind === 'tomorrow-09') {
      target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 9, 0, 0, 0);
    } else if (kind === 'tomorrow-18') {
      target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1, 18, 0, 0, 0);
    } else {
      return;
    }
    setDateStr(toDateInputValue(target));
    setTimeStr(toTimeInputValue(target));
  };

  const accountLabel = (a) => a?.connectionName || a?.username || a?.profileUserId || 'eBay hesabı';

  const handleConfirm = async () => {
    setError(null);
    if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
      setError(t('scheduleListing.errorPastTime'));
      return;
    }
    if (scheduledDate.getTime() < Date.now() + MIN_LEAD_MINUTES * 60 * 1000) {
      setError(t('scheduleListing.errorMinLead'));
      return;
    }
    if (ebayAccounts.length > 0 && !selectedAccountId) {
      setError(t('scheduleListing.noAccountConnected'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await ebayAPI.scheduleListing({
        ...listingPayload,
        ebayAccountId: selectedAccountId || undefined,
        scheduledFor: scheduledDate.toISOString(),
      });
      setResult(res?.data || { success: true, scheduledFor: scheduledDate.toISOString() });
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('scheduleListing.errorGeneric'));
    } finally {
      setSubmitting(false);
    }
  };

  const base = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500'
  }`;
  const labelClass = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const chipClass = `px-2.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
    isDark
      ? 'border-slate-600 text-slate-300 hover:border-blue-500 hover:text-blue-400'
      : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'
  }`;
  const todayStr = toDateInputValue(new Date());

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div className={`rounded-2xl border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ${base}`}>
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Calendar size={18} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            <h2 className="text-base font-semibold">{t('scheduleListing.modalTitle')}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none">✕</button>
        </div>

        {result ? (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-4">
              <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm flex items-center gap-1.5">
                <Check size={16} /> {t('scheduleListing.successTitle')}
              </p>
              <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('scheduleListing.successBody')}
              </p>
              <p className={`text-xs mt-2 font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {new Date(result.scheduledFor || scheduledDate).toLocaleString()}
              </p>
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full py-2.5">
              {t('scheduleListing.close')}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('scheduleListing.modalSubtitle')}
            </p>

            {error && (
              <div className={`rounded-xl border px-3 py-2.5 text-xs ${isDark ? 'border-red-800 bg-red-950/30 text-red-400' : 'border-red-200 bg-red-50 text-red-600'}`}>
                {error}
              </div>
            )}

            {/* Quick picks */}
            <div>
              <label className={labelClass}>{t('scheduleListing.quickPick')}</label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={chipClass} onClick={() => applyQuickPick('2h')}>
                  {t('scheduleListing.quickPickIn2Hours')}
                </button>
                <button type="button" className={chipClass} onClick={() => applyQuickPick('tomorrow-09')}>
                  {t('scheduleListing.quickPickTomorrowMorning')}
                </button>
                <button type="button" className={chipClass} onClick={() => applyQuickPick('tomorrow-18')}>
                  {t('scheduleListing.quickPickTomorrowEvening')}
                </button>
                <button type="button" className={chipClass} onClick={() => applyQuickPick('24h')}>
                  {t('scheduleListing.quickPickIn24Hours')}
                </button>
              </div>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <Calendar size={12} className="inline mr-1 -mt-0.5" />
                  {t('scheduleListing.dateLabel')}
                </label>
                <input
                  type="date"
                  value={dateStr}
                  min={todayStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className={inputClass}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className={labelClass}>
                  <Clock size={12} className="inline mr-1 -mt-0.5" />
                  {t('scheduleListing.timeLabel')}
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className={inputClass}
                  disabled={submitting}
                />
              </div>
            </div>

            {relativeLabel && (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('scheduleListing.willRunIn')} <span className="font-semibold">{relativeLabel}</span>
                {scheduledDate && <> — {scheduledDate.toLocaleString()}</>}
              </p>
            )}

            {/* Account selector — only when the user has more than one connected account */}
            {!loadingAccounts && ebayAccounts.length > 1 && (
              <div>
                <label className={labelClass}>
                  <Store size={12} className="inline mr-1 -mt-0.5" />
                  {t('scheduleListing.accountLabel')}
                </label>
                <div className={`rounded-lg border overflow-hidden divide-y ${isDark ? 'border-slate-700 divide-slate-700' : 'border-slate-200 divide-slate-100'}`}>
                  {ebayAccounts.map((a) => {
                    const selected = a.id === selectedAccountId;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAccountId(a.id)}
                        disabled={submitting}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                          selected
                            ? isDark ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-50 text-blue-700'
                            : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Store size={14} className="flex-shrink-0 opacity-60" />
                        <span className="flex-1 truncate font-medium">{accountLabel(a)}</span>
                        {selected && <Check size={14} className="flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary flex-1 py-2.5 disabled:opacity-60">
                {t('scheduleListing.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="btn-primary flex-1 py-2.5 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('scheduleListing.scheduling')}
                  </>
                ) : (
                  t('scheduleListing.confirm')
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
