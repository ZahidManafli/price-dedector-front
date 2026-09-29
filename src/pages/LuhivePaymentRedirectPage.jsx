import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { luhiveAPI } from '../services/api';

// Mirrors EpointRedirectPage.jsx's "checkout" kind exactly — the backend
// hands back an already-signed { actionUrl, data, signature } for Epoint's
// /checkout, and this page renders a hidden checkila.com-native <form> that
// submits it straight there. Done here (not as a backend-rendered page) so
// the browser's origin/referer on that POST is checkila.com, matching the
// domain registered as "Veb saytın ünvanı" in the Epoint merchant panel, and
// so the private key never has to leave the server.
export default function LuhivePaymentRedirectPage() {
  const { requestId } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await luhiveAPI.getCheckoutPayload(requestId);
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
    if (payload && formRef.current) {
      formRef.current.submit();
    }
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
