import React, { forwardRef } from 'react';

// Gold / silver / bronze certificate for a weekly Gamification winner. Pure SVG,
// so it renders the same everywhere and can be saved as a PNG (downloadCertificatePng).

export const TIER_STYLES = {
  gold: { label: 'GOLD', name: 'Qızıl', dark: '#8a6414', main: '#c9971f', light: '#f6dc8a', soft: '#fdf6e3' },
  silver: { label: 'SILVER', name: 'Gümüş', dark: '#5b6875', main: '#8e9baa', light: '#e3e8ee', soft: '#f5f7f9' },
  bronze: { label: 'BRONZE', name: 'Bürünc', dark: '#7a4419', main: '#b36b32', light: '#ebc097', soft: '#fbf1e8' },
};

const PLACE_TEXT = { 1: '1-ci yer', 2: '2-ci yer', 3: '3-cü yer' };
const LEAGUE_NAMES = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

export function formatAzDate(dateStr) {
  const [y, m, d] = String(dateStr || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${d} ${AZ_MONTHS[m - 1]} ${y}`;
}

const Certificate = forwardRef(function Certificate({ certificate, className = '' }, ref) {
  const tier = TIER_STYLES[certificate?.tier] || TIER_STYLES.gold;
  const id = `cert-${certificate?.id || 'preview'}`;
  const name = certificate?.displayName || 'İstifadəçi';
  const place = PLACE_TEXT[certificate?.place] || '';
  const period = `${formatAzDate(certificate?.weekStart)} – ${formatAzDate(certificate?.weekEnd)}`;

  return (
    <svg
      ref={ref}
      viewBox="0 0 1200 848"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`${tier.name} sertifikat — ${name}, ${place}`}
    >
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tier.light} />
          <stop offset="45%" stopColor={tier.main} />
          <stop offset="100%" stopColor={tier.dark} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={tier.soft} />
        </radialGradient>
        <pattern id={`${id}-guilloche`} width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="14" cy="14" r="12" fill="none" stroke={tier.main} strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>

      {/* Paper */}
      <rect width="1200" height="848" fill={`url(#${id}-glow)`} />
      <rect width="1200" height="848" fill={`url(#${id}-guilloche)`} />

      {/* Frame */}
      <rect x="28" y="28" width="1144" height="792" rx="18" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="10" />
      <rect x="52" y="52" width="1096" height="744" rx="10" fill="none" stroke={tier.main} strokeOpacity="0.55" strokeWidth="1.5" />
      {[[52, 52], [1148, 52], [52, 796], [1148, 796]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" fill={`url(#${id}-metal)`} />
      ))}

      {/* Brand */}
      <text x="600" y="118" textAnchor="middle" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="22" fontWeight="700" letterSpacing="10" fill={tier.dark}>
        CHECKILA
      </text>
      <line x1="470" y1="138" x2="730" y2="138" stroke={tier.main} strokeOpacity="0.6" strokeWidth="1.5" />

      {/* Title */}
      <text x="600" y="205" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="58" fontWeight="700" letterSpacing="6" fill="#1e293b">
        SERTİFİKAT
      </text>
      <text x="600" y="246" textAnchor="middle" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="20" letterSpacing="4" fill="#64748b">
        HƏFTƏNİN LİDERİ · {certificate?.league ? `${String(certificate.league).toUpperCase()} LİQASI` : tier.label}
      </text>

      {/* Medal */}
      <g transform="translate(600 358)">
        <path d="M -52 -86 L -22 -20 L 0 -34 L 22 -20 L 52 -86 Z" fill={tier.dark} opacity="0.85" />
        <circle r="62" fill={`url(#${id}-metal)`} />
        <circle r="50" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" />
        <text y="20" textAnchor="middle" fontFamily="Georgia, serif" fontSize="56" fontWeight="700" fill="#ffffff">
          {certificate?.place || 1}
        </text>
      </g>

      {/* Body */}
      <text x="600" y="470" textAnchor="middle" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="20" fill="#64748b">
        Bu sertifikat təqdim olunur
      </text>
      <text x="600" y="540" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="60" fontStyle="italic" fill="#0f172a">
        {name}
      </text>
      <line x1="330" y1="562" x2="870" y2="562" stroke={tier.main} strokeOpacity="0.6" strokeWidth="1.5" />
      <text x="600" y="608" textAnchor="middle" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="21" fill="#334155">
        {period} həftəsində {certificate?.points ?? 0} xal toplayaraq
      </text>
      <text x="600" y="640" textAnchor="middle" fontFamily="Inter, Segoe UI, Arial, sans-serif" fontSize="21" fill="#334155">
        Checkila {certificate?.league ? `${LEAGUE_NAMES[certificate.league] || ''} liqasında` : 'reytinqində'} <tspan fontWeight="700" fill={tier.dark}>{place}</tspan> tutduğu üçün təltif olunur.
      </text>

      {/* Footer */}
      <g fontFamily="Inter, Segoe UI, Arial, sans-serif" fill="#475569">
        <line x1="150" y1="724" x2="390" y2="724" stroke="#94a3b8" strokeWidth="1" />
        <text x="270" y="752" textAnchor="middle" fontSize="16">{formatAzDate(certificate?.weekEnd)}</text>
        <text x="270" y="774" textAnchor="middle" fontSize="13" fill="#94a3b8">Tarix</text>

        <line x1="810" y1="724" x2="1050" y2="724" stroke="#94a3b8" strokeWidth="1" />
        <text x="930" y="716" textAnchor="middle" fontFamily="Georgia, serif" fontSize="24" fontStyle="italic" fill={tier.dark}>Checkila</text>
        <text x="930" y="752" textAnchor="middle" fontSize="16">Checkila komandası</text>
        <text x="930" y="774" textAnchor="middle" fontSize="13" fill="#94a3b8">İmza</text>

        <text x="600" y="774" textAnchor="middle" fontSize="13" fill="#94a3b8" letterSpacing="2">
          № {certificate?.serial || '—'}
        </text>
      </g>
    </svg>
  );
});

export default Certificate;

// Renders the certificate SVG to a 2400px-wide PNG and downloads it.
export async function downloadCertificatePng(svgElement, fileName = 'checkila-sertifikat.png') {
  if (!svgElement) return;
  const xml = new XMLSerializer().serializeToString(svgElement);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 2400;
    canvas.height = 1696;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
