import React, { useEffect, useRef } from 'react';

// Epoint's own docs describe the Google Pay / Apple Pay widget as something
// to embed in an <iframe>, not navigate to — it never redirects back to us,
// so completion only ever arrives async, via Epoint's server-to-server
// callback. `onPoll` is called on an interval and must resolve
// `{ done: boolean }`; the modal keeps polling until it does.
//
// `allow="payment"` is required for the web Payment Request API (which
// Google Pay's own button/sheet is built on) to function at all inside a
// nested browsing context — without it, browsers silently refuse to let the
// framed page open the payment sheet. If the frame still renders blank
// after this, that means Epoint's widget response is setting
// X-Frame-Options/CSP frame-ancestors that refuses embedding from our
// domain — a hard browser security boundary nothing on our side can
// override; the "open in a new tab" fallback link below exists specifically
// for that case, and Epoint support would need to whitelist our domain for
// the widget the same way the checkout/card-registration flows already
// depend on the "Veb saytın ünvanı" registered in the merchant panel.
export default function GooglePayModal({ widgetUrl, onCancel, onPoll, pollIntervalMs = 3000, title = 'Google Pay' }) {
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
          <p className="text-sm font-semibold text-white">{title}</p>
          <button type="button" onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-200">
            Bağla
          </button>
        </div>
        <iframe
          title={title}
          src={widgetUrl}
          allow="payment"
          className="h-[560px] w-full rounded-xl border border-white/10 bg-white"
        />
        <p className="mt-2 text-center text-xs text-slate-400">
          Ödəniş tamamlandıqdan sonra bu pəncərə avtomatik bağlanacaq.
        </p>
        <p className="mt-1 text-center text-xs">
          <a href={widgetUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
            Yüklənmirsə, buradan yeni pəncərədə açın
          </a>
        </p>
      </div>
    </div>
  );
}
