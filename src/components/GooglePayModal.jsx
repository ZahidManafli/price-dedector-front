import React, { useEffect, useRef } from 'react';

// Purely a "waiting for the popup" status card — it renders no iframe.
// Google Pay's actual payment sheet (and most bank-hosted payment pages,
// for anti-clickjacking reasons — many send X-Frame-Options/CSP
// frame-ancestors that refuse to render at all inside a cross-origin
// <iframe>, and even where that's not set, the web Payment Request API
// that drives Google Pay demands a real top-level browsing context) will
// not reliably render embedded in an <iframe> the way Epoint's docs
// suggest — in practice it just shows a blank white box. The actual widget
// page is opened in a real popup window by the caller (PaymentMethodPicker
// / SettingsPage), which is the only thing that works consistently across
// browsers; this component just polls for completion and offers a way to
// cancel/close that popup while the user finishes paying in it.
export default function GooglePayModal({ open, onCancel, onPoll, pollIntervalMs = 3000 }) {
  const onPollRef = useRef(onPoll);
  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(async () => {
      try {
        const result = await onPollRef.current?.();
        if (result?.done) clearInterval(id);
      } catch {
        // Transient network hiccup — keep polling, next tick may succeed.
      }
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [open, pollIntervalMs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 p-6 text-center shadow-2xl">
        <p className="text-sm font-semibold text-white">Google Pay</p>
        <p className="mt-3 text-sm text-slate-300">
          Ödənişi açılan pəncərədə tamamlayın. Pəncərə görünmürsə, brauzerinizin pop-up bloklayıcısını yoxlayın.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-xs text-slate-300 hover:bg-white/10"
        >
          Ləğv et
        </button>
      </div>
    </div>
  );
}
