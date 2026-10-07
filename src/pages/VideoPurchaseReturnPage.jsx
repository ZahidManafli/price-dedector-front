import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { learningAPI } from '../services/api';

const POLL_MS = 2000;
const MAX_ATTEMPTS = 6; // ~12s — the async Epoint webhook is normally near-instant

// Mirrors WalletReturnPage.jsx — the page Epoint redirects the payer's
// browser back to after a video purchase. Polls /purchase/confirm/:id a few
// times in case the async /epoint/callback webhook hasn't landed yet.
export default function VideoPurchaseReturnPage() {
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
        const res = await learningAPI.confirmPurchase(requestId);
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
    paid: { title: 'Ödəniş uğurla tamamlandı ✓', body: 'Videoya ömürlük girişiniz aktivləşdi.' },
    failed: { title: 'Ödəniş uğursuz oldu', body: 'Ödəniş tamamlanmadı. Zəhmət olmasa yenidən cəhd edin.' },
    error: { title: 'Xəta baş verdi', body: 'Ödəniş statusu yoxlanıla bilmədi. Zəhmət olmasa dəstəklə əlaqə saxlayın.' },
  }[status];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold mb-2">{content.title}</h1>
        <p className="text-sm text-slate-300 mb-6">{content.body}</p>
        <Link to="/learning" className="text-sm text-indigo-400 hover:text-indigo-300 underline">
          Videolara qayıt
        </Link>
      </div>
    </div>
  );
}
