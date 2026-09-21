import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, X, ExternalLink, Loader2, Trash2, AlertCircle, Clock3, CheckCircle2, XCircle, Ban } from 'lucide-react';
import { ebayAPI } from '../services/api';

const STATUS_META = {
  pending: { icon: Clock3, colorLight: 'text-amber-600 bg-amber-50 border-amber-200', colorDark: 'text-amber-300 bg-amber-950/30 border-amber-800' },
  processing: { icon: Loader2, colorLight: 'text-blue-600 bg-blue-50 border-blue-200', colorDark: 'text-blue-300 bg-blue-950/30 border-blue-800' },
  completed: { icon: CheckCircle2, colorLight: 'text-emerald-600 bg-emerald-50 border-emerald-200', colorDark: 'text-emerald-300 bg-emerald-950/30 border-emerald-800' },
  failed: { icon: XCircle, colorLight: 'text-red-600 bg-red-50 border-red-200', colorDark: 'text-red-300 bg-red-950/30 border-red-800' },
  cancelled: { icon: Ban, colorLight: 'text-slate-500 bg-slate-100 border-slate-200', colorDark: 'text-slate-400 bg-slate-800/50 border-slate-700' },
};

// Floating icon + drawer that lets a user see and cancel what they've scheduled
// from the "Planlaşdırılmış Listing" flow in ListOnEbayModal. Self-contained —
// fetches its own data, doesn't touch any of ListingsPage's existing state.
export default function ScheduledListingsPanel({ isDark = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const load = () => {
    setLoading(true);
    ebayAPI
      .getScheduledListings()
      .then((res) => setItems(Array.isArray(res?.data?.items) ? res.data.items : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  const handleCancel = async (id) => {
    setCancellingId(id);
    try {
      await ebayAPI.cancelScheduledListing(id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'cancelled' } : i)));
    } catch {
      // no-op — row stays as-is, user can retry
    } finally {
      setCancellingId(null);
    }
  };

  const base = isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = isDark ? 'border-slate-700' : 'border-slate-200';
  const subText = isDark ? 'text-slate-400' : 'text-slate-500';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('scheduledListingsPanel.floatingButton')}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-2xl font-semibold text-sm transition-all duration-200 hover:scale-105 active:scale-95 ${
          isDark ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
      >
        <CalendarClock size={18} />
        <span>{t('scheduledListingsPanel.floatingButton')}</span>
        {pendingCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-indigo-600 text-xs font-bold leading-none">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-md flex flex-col shadow-2xl ${base} border-l ${border}`} style={{ animation: 'slideInRight 0.22s ease-out' }}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${border} shrink-0`}>
          <div className="flex items-center gap-2.5">
            <CalendarClock size={20} className="text-indigo-500" />
            <div>
              <h2 className="font-bold text-base leading-tight">{t('scheduledListingsPanel.title')}</h2>
              <p className={`text-xs ${subText}`}>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && (
            <div className={`flex items-center justify-center gap-2 py-10 text-sm ${subText}`}>
              <Loader2 size={16} className="animate-spin" /> …
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className={`flex flex-col items-center justify-center gap-2 py-16 text-center ${subText}`}>
              <CalendarClock size={40} className="opacity-30" />
              <p className="text-sm">{t('scheduledListingsPanel.empty')}</p>
            </div>
          )}

          {items.map((item) => {
            const meta = STATUS_META[item.status] || STATUS_META.pending;
            const StatusIcon = meta.icon;
            const image = Array.isArray(item.payload?.pictureUrls) ? item.payload.pictureUrls[0] : null;
            return (
              <div key={item.id} className={`rounded-xl border p-3 flex gap-3 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-white'} border ${border}`}>
                  {image ? (
                    <img src={image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <CalendarClock size={18} className="opacity-30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.payload?.title || 'Untitled listing'}</p>
                  <p className={`text-xs mt-0.5 ${subText}`}>
                    {new Date(item.scheduledFor).toLocaleString()}
                    {item.payload?.price ? ` · $${Number(item.payload.price).toFixed(2)}` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${isDark ? meta.colorDark : meta.colorLight}`}>
                      <StatusIcon size={11} className={item.status === 'processing' ? 'animate-spin' : ''} />
                      {t(`scheduledListingsPanel.status${item.status.charAt(0).toUpperCase()}${item.status.slice(1)}`)}
                    </span>
                  </div>
                  {item.status === 'failed' && item.errorMessage && (
                    <p className="text-xs mt-1.5 text-red-500 flex items-start gap-1">
                      <AlertCircle size={12} className="mt-0.5 shrink-0" /> {item.errorMessage}
                    </p>
                  )}
                  {item.status === 'completed' && item.listingUrl && (
                    <a href={item.listingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:underline font-medium">
                      {t('scheduledListingsPanel.viewOnEbay')} <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                {item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => handleCancel(item.id)}
                    disabled={cancellingId === item.id}
                    title={t('scheduledListingsPanel.cancelAction')}
                    className={`self-start p-1.5 rounded-lg transition-colors shrink-0 ${isDark ? 'text-slate-400 hover:bg-red-950/40 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
                  >
                    {cancellingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
