import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Truck, X, Info, CheckCircle2 } from 'lucide-react';
import { ebayAPI } from '../../services/api';
import { CARRIER_LABELS, detectCarrierFromNumber, isTbaTrackingNumber, normalizeTrackingNumber } from '../../utils/detectCarrier';

// Orders page -> "Add tracking". The seller types a USPS/UPS/FedEx number; the
// carrier fills itself in (read-only) from the number format. On submit the
// backend re-detects the carrier, posts the number to eBay, marks the order
// shipped and sends the buyer the shipped message (POST /ebay/orders/:id/tracking/manual).
export default function AddTrackingModal({ order, isDark, onClose, onSaved }) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const orderId = String(order?.orderId || '');
  const itemTitle = order?.lineItems?.[0]?.title || '';
  const number = normalizeTrackingNumber(value);
  const carrier = useMemo(() => detectCarrierFromNumber(number), [number]);
  const isTba = isTbaTrackingNumber(number);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const hint = !number
    ? t('ordersPage.tracking.carrierHint')
    : isTba
    ? t('ordersPage.tracking.tbaHint')
    : !carrier
    ? t('ordersPage.tracking.unknownHint')
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!carrier || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await ebayAPI.addManualTracking(orderId, number);
      onSaved?.(orderId, res?.data?.tracking || { trackingNumber: number, carrier: carrier.toUpperCase(), fulfillmentStatus: 'shipped', uploadedToEbay: true });
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('ordersPage.tracking.failed'));
    } finally {
      setSaving(false);
    }
  };

  const field = `w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={() => !saving && onClose()}>
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-tracking-title"
        className={`w-full max-w-md overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}
      >
        <div className={`flex items-start justify-between gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
              <Truck size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="add-tracking-title" className={`text-base font-semibold ${strong}`}>{t('ordersPage.tracking.modalTitle')}</h2>
              <p className={`truncate text-xs ${muted}`} title={itemTitle}>
                <span className="font-mono">{orderId}</span>
                {itemTitle ? ` · ${itemTitle}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label={t('ordersPage.tracking.cancel')}
            className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="manual-tracking-number" className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('ordersPage.tracking.number')}
            </label>
            <input
              id="manual-tracking-number"
              ref={inputRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(''); }}
              placeholder="AQUA… / 1Z… / 9400… / 7712…"
              autoComplete="off"
              spellCheck={false}
              className={`${field} font-mono focus:border-indigo-500 focus:ring-2 ${isDark ? 'focus:ring-indigo-500/30' : 'focus:ring-indigo-100'}`}
            />
          </div>

          <div>
            <label htmlFor="manual-tracking-carrier" className={`mb-1 block text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('ordersPage.tracking.carrier')}
            </label>
            <div className="relative">
              <input
                id="manual-tracking-carrier"
                value={carrier ? CARRIER_LABELS[carrier] : ''}
                placeholder={t('ordersPage.tracking.carrierAuto')}
                disabled
                readOnly
                className={`${field} cursor-not-allowed pr-10 ${isDark ? 'bg-slate-900 text-slate-200' : 'bg-slate-50 text-slate-700'} ${carrier ? 'font-semibold' : ''}`}
              />
              {carrier && <CheckCircle2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />}
            </div>
            {hint && (
              <p className={`mt-1.5 flex gap-1.5 text-xs ${isTba || (number && !carrier) ? 'text-amber-600' : muted}`}>
                <Info size={13} className="mt-0.5 shrink-0" />
                {hint}
              </p>
            )}
          </div>

          <p className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${isDark ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
            {t('ordersPage.tracking.whatHappens')}
          </p>

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        </div>

        <div className={`flex justify-end gap-2 border-t px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            {t('ordersPage.tracking.cancel')}
          </button>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={!carrier || saving}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? t('ordersPage.tracking.submitting') : t('ordersPage.tracking.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
