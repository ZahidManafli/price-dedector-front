import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { luhiveAPI } from '../services/api';

const POLL_MS = 2000;
const MAX_ATTEMPTS = 6; // ~12s — the async Epoint webhook is normally near-instant

// The "Checkila landing page" Epoint redirects the payer's browser back to
// after they pay — this is the second, redundant trigger (alongside the
// async /epoint/callback webhook) that notifies Luhive of a successful
// payment; see routes/luhive.js's processLuhivePaymentResult for why calling
// it from both places is safe. If the webhook hasn't landed yet by the time
// the browser gets here, this polls confirm a few times before giving up
// rather than reporting a false failure for something still in flight.
export default function LuhiveReturnPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('rid');
  const [status, setStatus] = useState('checking'); // checking | paid | failed | error

  useEffect(() => {
    if (!requestId) {
      setStatus('error');
      return undefined;
    }

    let cancelled = false;
    let attempt = 0;

    const poll = async () => {
      attempt += 1;
      try {
        const res = await luhiveAPI.confirmPayment(requestId);
        if (cancelled) return;
        const result = res?.data?.status;
        if (result === 'paid') {
          setStatus('paid');
        } else if (result === 'failed') {
          setStatus('failed');
        } else if (attempt < MAX_ATTEMPTS) {
          setTimeout(poll, POLL_MS);
        } else {
          setStatus('failed');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const content = {
    checking: { title: 'Ödəniş yoxlanılır…', body: 'Zəhmət olmasa gözləyin, bu bir neçə saniyə çəkə bilər.' },
    paid: { title: 'Ödəniş uğurla tamamlandı ✓', body: 'Bu pəncərəni bağlayıb Luhive-ə qayıda bilərsiniz.' },
    failed: { title: 'Ödəniş uğursuz oldu', body: 'Ödəniş tamamlanmadı. Zəhmət olmasa yenidən cəhd edin.' },
    error: { title: 'Xəta baş verdi', body: 'Ödəniş statusu yoxlanıla bilmədi. Zəhmət olmasa dəstəklə əlaqə saxlayın.' },
  }[status];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold mb-2">{content.title}</h1>
        <p className="text-sm text-slate-300">{content.body}</p>
      </div>
    </div>
  );
}
