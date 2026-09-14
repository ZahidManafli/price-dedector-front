import React, { useState } from 'react';
import { paymentsAPI } from '../services/api';
import GooglePayModal from './GooglePayModal';

// Shared "how do you want to pay" step for every online-payment flow that
// already has a pending subscription_requests row (id === requestId):
// initial subscription signup, plan upgrade, referral signup, and the
// tracking/market-analysis credit top-ups. Card keeps the existing full-page
// redirect to Epoint's hosted checkout; Google Pay fetches the digital-
// wallet widget and polls this same request's payment_status until Epoint's
// async callback lands. The Settings-page plan-renewal ("Ödəniş et") flow
// doesn't use this — it has no requestId to redirect/poll against, so it
// wires GooglePayModal directly to its own renewal_payment_attempts polling.
export default function PaymentMethodPicker({
  requestId,
  onGooglePaySuccess,
  onGooglePayFailure,
  cardLabel = 'Kart',
  googlePayLabel = 'Google Pay',
  chooseLabel = 'Ödəniş üsulunu seçin',
  className = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [widgetUrl, setWidgetUrl] = useState('');

  const payWithCard = () => {
    window.location.href = paymentsAPI.epointCheckoutUrl(requestId);
  };

  const payWithGooglePay = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await paymentsAPI.getWidgetPayload(requestId);
      const url = res?.data?.widgetUrl;
      if (!url) throw new Error('Google Pay widget yüklənə bilmədi.');
      setWidgetUrl(url);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Google Pay widget yüklənə bilmədi.');
    } finally {
      setLoading(false);
    }
  };

  const poll = async () => {
    const res = await paymentsAPI.getPaymentStatus(requestId);
    const status = res?.data?.paymentStatus;
    if (status === 'success') {
      setWidgetUrl('');
      onGooglePaySuccess?.();
      return { done: true };
    }
    if (status === 'failed') {
      setWidgetUrl('');
      setError('Google Pay ödənişi rədd edildi. Zəhmət olmasa yenidən cəhd edin.');
      onGooglePayFailure?.();
      return { done: true };
    }
    return { done: false };
  };

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{chooseLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={payWithCard}
          className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
        >
          {cardLabel}
        </button>
        <button
          type="button"
          onClick={payWithGooglePay}
          disabled={loading}
          className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {loading ? '...' : googlePayLabel}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      <GooglePayModal widgetUrl={widgetUrl} onCancel={() => setWidgetUrl('')} onPoll={poll} />
    </div>
  );
}
