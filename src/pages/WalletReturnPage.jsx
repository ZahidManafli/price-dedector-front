import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { walletAPI } from '../services/api';

const POLL_MS = 2000;
const MAX_ATTEMPTS = 6; // ~12s — the async Epoint webhook is normally near-instant

// Mirrors LuhiveReturnPage.jsx — the page Epoint redirects the payer's
// browser back to after a Checkila Smart balance top-up. Polls /wallet/topup/
// confirm/:id a few times in case the async /epoint/callback webhook hasn't
// landed yet by the time the browser gets here.
export default function WalletReturnPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('rid');
  const [status, setStatus] = useState('checking'); // checking | paid | failed | error
  const [balanceAzn, setBalanceAzn] = useState(null);

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
        const res = await walletAPI.confirmPayment(requestId);
        if (cancelled) return;
        const result = res?.data?.status;
        if (result === 'paid') {
          setStatus('paid');
          if (res?.data?.balanceAzn != null) setBalanceAzn(res.data.balanceAzn);
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
    paid: {
      title: 'Balans uğurla artırıldı ✓',
      body: balanceAzn != null ? `Yeni balansınız: ${Number(balanceAzn).toFixed(2)} AZN` : 'Ödəniş uğurla tamamlandı.',
    },
    failed: { title: 'Ödəniş uğursuz oldu', body: 'Ödəniş tamamlanmadı. Zəhmət olmasa yenidən cəhd edin.' },
    error: { title: 'Xəta baş verdi', body: 'Ödəniş statusu yoxlanıla bilmədi. Zəhmət olmasa dəstəklə əlaqə saxlayın.' },
  }[status];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold mb-2">{content.title}</h1>
        <p className="text-sm text-slate-300 mb-6">{content.body}</p>
        <Link to="/amazon-lookup" className="text-sm text-indigo-400 hover:text-indigo-300 underline">
          Checkila Smart-a qayıt
        </Link>
      </div>
    </div>
  );
}
