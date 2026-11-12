import React, { useEffect, useRef, useState } from 'react';
import { Award, Download, Loader2, Maximize2, X, Trophy } from 'lucide-react';
import { gamificationAPI } from '../../services/api';
import Certificate, { TIER_STYLES, downloadCertificatePng, formatAzDate } from './Certificate';

// Settings (profile) -> Sertifikatlar: the weekly Gamification certificates this
// user has won, with a full-size view and PNG download.

function CertificateViewer({ certificate, isDark, onClose }) {
  const svgRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCertificatePng(svgRef.current, `checkila-sertifikat-${certificate.weekStart}-${certificate.tier}.png`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" className={`w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}>
        <div className={`flex items-center justify-between border-b px-5 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {TIER_STYLES[certificate.tier]?.name} sertifikat · {formatAzDate(certificate.weekStart)} həftəsi
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={download} disabled={downloading} className="btn-primary inline-flex items-center gap-1.5 text-sm">
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              PNG yüklə
            </button>
            <button type="button" onClick={onClose} aria-label="Bağla" className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className={`p-4 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
          <Certificate ref={svgRef} certificate={certificate} className="h-auto w-full rounded-lg shadow-lg" />
        </div>
      </div>
    </div>
  );
}

export default function CertificatesSection({ isDark }) {
  const [certificates, setCertificates] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    gamificationAPI
      .certificates()
      .then((res) => setCertificates(Array.isArray(res?.data?.certificates) ? res.data.certificates : []))
      .catch(() => setCertificates([]));
  }, []);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const counts = (certificates || []).reduce((acc, c) => ({ ...acc, [c.tier]: (acc[c.tier] || 0) + 1 }), {});

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <Award size={20} />
          </span>
          <div>
            <h2 className={`text-lg font-semibold ${strong}`}>Sertifikatlar</h2>
            <p className={`text-sm ${muted}`}>Həftəlik reytinqdə ilk 3 yerə görə qazandığınız sertifikatlar</p>
          </div>
        </div>
        {certificates?.length > 0 && (
          <div className="flex gap-2">
            {['gold', 'silver', 'bronze'].map((tier) => (
              <span key={tier} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_STYLES[tier].main }} />
                {counts[tier] || 0}
              </span>
            ))}
          </div>
        )}
      </div>

      {certificates === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-indigo-500" size={22} />
        </div>
      ) : certificates.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>
            <Trophy size={20} />
          </span>
          <p className={`text-sm font-medium ${strong}`}>Hələ sertifikatınız yoxdur</p>
          <p className={`mt-1 max-w-sm text-sm ${muted}`}>Həftəni ilk 3 yerdə bitirin — qızıl, gümüş və ya bürünc sertifikat burada görünəcək.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {certificates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpen(c)}
              className={`group overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:shadow-lg ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
            >
              <div className="relative">
                <Certificate certificate={c} className="block h-auto w-full" />
                <span className="absolute right-2 top-2 rounded-lg bg-black/40 p-1.5 text-white opacity-0 transition group-hover:opacity-100">
                  <Maximize2 size={14} />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className={`text-sm font-semibold ${strong}`}>
                  {c.place}-ci yer · {TIER_STYLES[c.tier]?.name}
                </span>
                <span className={`text-xs ${muted}`}>{formatAzDate(c.weekStart)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && <CertificateViewer certificate={open} isDark={isDark} onClose={() => setOpen(null)} />}
    </div>
  );
}
