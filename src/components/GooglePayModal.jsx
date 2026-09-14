import React, { useEffect, useRef } from 'react';

// Epoint's own docs describe the Google Pay / Apple Pay widget as something
// to embed in an <iframe>, not navigate to — it never redirects back to us,
// so completion only ever arrives async, via Epoint's server-to-server
// callback. `onPoll` is called on an interval and must resolve
// `{ done: boolean }`; the modal keeps polling until it does. Kept as a
// standalone component (rather than baked into PaymentMethodPicker) so the
// Settings-page plan-renewal flow — which has no subscription_requests id to
// poll against — can reuse the same iframe+polling UI.
export default function GooglePayModal({ widgetUrl, onCancel, onPoll, pollIntervalMs = 3000 }) {
  const onPollRef = useRef(onPoll);
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!widgetUrl) return undefined;
    const id = setInterval(async () => {
      try {
        const result = await onPollRef.current?.();
        if (result?.done) clearInterval(id);
      } catch {
        // Transient network hiccup — keep polling, next tick may succeed.
      }
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [widgetUrl, pollIntervalMs]);

  if (!widgetUrl) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Google Pay</p>
          <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
            Bağla
          </button>
        </div>
        <iframe
          title="Google Pay"
          src={widgetUrl}
          className="h-[560px] w-full rounded-xl border border-white/10 bg-white"
        />
        <p className="mt-2 text-center text-xs text-slate-400">
          Ödəniş tamamlandıqdan sonra bu pəncərə avtomatik bağlanacaq.
        </p>
      </div>
    </div>
  );
}
