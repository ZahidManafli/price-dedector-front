import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { learningAPI } from '../services/api';

// Mirrors WalletPaymentRedirectPage.jsx — fetches the signed Epoint checkout
// payload for a pending video-purchase request and auto-submits a hidden
// form to Epoint's own checkout page.
export default function VideoPurchaseRedirectPage() {
  const { requestId } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await learningAPI.getPurchaseCheckout(requestId);
        if (!cancelled) setPayload(response.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || 'Ödəniş səhifəsi yüklənərkən xəta baş verdi.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    if (payload && formRef.current) formRef.current.submit();
  }, [payload]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 text-center">
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <p className="text-sm text-slate-300">Ödəniş səhifəsinə yönləndirilirsiniz, zəhmət olmasa gözləyin…</p>
      )}
      {payload && (
        <form ref={formRef} method="POST" action={payload.actionUrl} style={{ display: 'none' }}>
          <input type="hidden" name="data" value={payload.data} readOnly />
          <input type="hidden" name="signature" value={payload.signature} readOnly />
        </form>
      )}
    </div>
  );
}
