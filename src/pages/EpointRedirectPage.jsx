import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { paymentsAPI } from '../services/api';

// Fetches the signed { actionUrl, data, signature } for a checkout or
// card-registration attempt, then renders a hidden checkila.com-native form
// and submits it straight to Epoint. Doing the actual form submission from a
// real page in this app (rather than a backend-rendered redirect page) means
// the browser's origin/referer on that POST is always checkila.com, matching
// the domain registered as "Veb saytın ünvanı" in the Epoint merchant panel —
// and it never needs the public/private keys, only the already-signed data.
export default function EpointRedirectPage({ kind }) {
  const { requestId, attemptId } = useParams();
  const id = kind === 'card' ? attemptId : requestId;
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fetcher = kind === 'card' ? paymentsAPI.getCardRegistrationPayload : paymentsAPI.getCheckoutPayload;
        const response = await fetcher(id);
        if (!cancelled) setPayload(response.data);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || 'Ödəniş səhifəsi yüklənərkən xəta baş verdi.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, kind]);

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
        <p className="text-sm text-slate-300">Epoint ödəniş səhifəsinə yönləndirilirsiniz, zəhmət olmasa gözləyin…</p>
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
