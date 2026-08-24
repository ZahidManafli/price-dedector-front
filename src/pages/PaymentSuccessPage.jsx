import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const isCard = searchParams.get('type') === 'card';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
          <CheckCircle2 size={34} />
        </div>

        {isCard ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Kart uğurla əlavə edildi</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Kartınız Checkila hesabınıza əlavə olundu. İndi Ayarlar bölməsindən avtomatik yeniləməni aktivləşdirə bilərsiniz.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Ödənişiniz uğurla tamamlandı</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Sorğunuz avtomatik olaraq təsdiqləndi. Növbəti addımlar barədə ətraflı təlimat email ünvanınıza göndərildi.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              <Mail size={14} />
              Zəhmət olmasa email qutunuzu (spam qovluğu daxil olmaqla) yoxlayın
            </div>
          </>
        )}

        <Link
          to={isCard ? '/settings' : '/login'}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          {isCard ? 'Ayarlara qayıt' : 'Daxil olun'}
        </Link>
      </div>
    </div>
  );
}
