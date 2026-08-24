import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { XCircle, RotateCcw } from 'lucide-react';
import { paymentsAPI } from '../services/api';

export default function PaymentErrorPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('rid') || '';
  const isCard = searchParams.get('type') === 'card';
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    if (!requestId) return;
    setRetrying(true);
    window.location.href = paymentsAPI.epointCheckoutUrl(requestId);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
          <XCircle size={34} />
        </div>

        {isCard ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Kart əlavə edilmədi</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Kartınızı əlavə edərkən xəta baş verdi. Zəhmət olmasa Ayarlar bölməsindən yenidən cəhd edin.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Ödəniş uğursuz oldu</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Ödənişiniz tamamlanmadı. Kartınızın məlumatlarını yoxlayıb yenidən cəhd edə bilərsiniz.
            </p>
          </>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!isCard && requestId && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              <RotateCcw size={16} />
              Ödənişi yenidən sına
            </button>
          )}
          <Link
            to={isCard ? '/settings' : '/'}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {isCard ? 'Ayarlara qayıt' : 'Ana səhifəyə qayıt'}
          </Link>
        </div>
      </div>
    </div>
  );
}
