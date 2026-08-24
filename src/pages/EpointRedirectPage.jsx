import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { paymentsAPI } from '../services/api';

// Checkout (subscription / tracking top-up) and card-registration work
// differently at the Epoint API level, so this page handles two distinct
// shapes depending on `kind`:
//  - "checkout": /api/1/checkout is a browser-facing form target. The
//    backend hands back the already-signed { actionUrl, data, signature }
//    and this page renders a hidden checkila.com-native <form> that submits
//    it straight to Epoint — done here (not as a backend-rendered page) so
//    the browser's origin/referer on that POST is checkila.com, matching
//    the domain registered as "Veb saytın ünvanı", and so the private key
//    never has to leave the server.
//  - "card": /api/1/card-registration is a server-to-server JSON API — its
//    response carries a redirect_url to the *bank's* hosted card-entry page
//    (e.g. Pasha Bank's ecomm2/ClientHandler). The backend calls it and
//    hands back just that { redirectUrl }; this page does a plain browser
//    redirect to it, no form involved.
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
    if (!payload) return;
    if (kind === 'card') {
      window.location.href = payload.redirectUrl;
    } else if (formRef.current) {
      formRef.current.submit();
    }
  }, [payload, kind]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 text-center">
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <p className="text-sm text-slate-300">Epoint ödəniş səhifəsinə yönləndirilirsiniz, zəhmət olmasa gözləyin…</p>
      )}
      {payload && kind !== 'card' && (
        <form ref={formRef} method="POST" action={payload.actionUrl} style={{ display: 'none' }}>
          <input type="hidden" name="data" value={payload.data} readOnly />
          <input type="hidden" name="signature" value={payload.signature} readOnly />
        </form>
      )}
    </div>
  );
}
