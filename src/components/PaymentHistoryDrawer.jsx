import React, { useEffect, useState } from 'react';
import { X, Receipt, Download, Loader2 } from 'lucide-react';
import { paymentsAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { downloadPaymentReceiptPdf } from '../utils/paymentReceiptPdf';

const STATUS_LABEL = {
  success: 'Uğurlu',
  failed: 'Uğursuz',
  pending: 'Gözləmədə',
};

function describePayment(payment) {
  if (payment.requestType === 'tracking_credits_topup') {
    return `Tracking Credits Top-Up (+${payment.requestedCredits || 0})`;
  }
  return payment.planName || 'Checkila ödənişi';
}

// 'az-AZ' toLocaleString renders as "2026 M08 24" in most browsers (limited
// ICU data for that locale) — 'en-GB' with explicit fields gives a
// consistent "24 Aug 2026, 13:29" regardless of the visitor's browser/OS.
function formatHistoryDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PaymentHistoryDrawer({ open, onClose }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await paymentsAPI.getHistory();
        if (!cancelled) setPayments(response?.data?.payments || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || 'Ödəniş tarixçəsi yüklənərkən xəta baş verdi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const customerName = `${user?.name || ''} ${user?.surname || ''}`.trim();

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] flex flex-col shadow-2xl ${isDark ? 'bg-slate-950 border-l border-slate-800' : 'bg-slate-50 border-l border-slate-200'}`}>
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-cyan-900/50' : 'bg-cyan-100'}`}>
            <Receipt size={15} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Ödəniş tarixçəsi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : payments.length === 0 ? (
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hələ heç bir ödəniş edilməyib.</p>
          ) : (
            payments.map((payment) => (
              <div
                key={payment.id}
                className={`rounded-xl border p-3.5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                      {describePayment(payment)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatHistoryDate(payment.paidAt || payment.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      payment.status === 'success'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                        : payment.status === 'failed'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {STATUS_LABEL[payment.status] || payment.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {Number(payment.amount || 0).toFixed(2)} AZN
                    {payment.cardMask ? (
                      <span className={`ml-2 text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{payment.cardMask}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadPaymentReceiptPdf(payment, { customerName, customerEmail: user?.email })}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                      isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Download size={13} />
                    Yüklə
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
