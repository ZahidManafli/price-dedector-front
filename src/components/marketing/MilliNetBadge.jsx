import React, { useEffect, useRef, useState } from 'react';

// MilliNet participant badge for the landing page footer. index.html loads
// MilliNet's own banner.js inside a hidden #millinet-banner holder; this moves
// that exact link + image here while the footer is mounted and puts it back on
// unmount. If the script was blocked, the same link is rendered directly.
const MILLINET_URL = 'https://millinet.az';
const MILLINET_IMAGE = 'https://millinet.az/images/participant.png?v=2';

// Same frame as the Epoint widget next to it (180×90 inside a card).
export const TRUST_BADGE_CARD =
  'inline-flex h-[92px] w-[182px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-white/10';

export default function MilliNetBadge({ className = '' }) {
  const slotRef = useRef(null);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const holder = document.getElementById('millinet-banner');
    const link = holder?.querySelector('a');
    if (!link || !slotRef.current) return undefined;
    link.setAttribute('rel', 'noopener noreferrer');
    link.setAttribute('aria-label', 'MilliNet 2026 iştirakçısı');
    slotRef.current.appendChild(link);
    setMoved(true);
    return () => {
      holder.appendChild(link);
    };
  }, []);

  return (
    <div
      ref={slotRef}
      className={`${TRUST_BADGE_CARD} [&_a]:block [&_img]:block [&_img]:h-[90px] [&_img]:w-[180px] [&_img]:object-contain ${className}`}
    >
      {!moved && (
        <a href={MILLINET_URL} target="_blank" rel="noopener noreferrer" aria-label="MilliNet 2026 iştirakçısı">
          <img src={MILLINET_IMAGE} alt="MilliNet 2026 iştirakçı" />
        </a>
      )}
    </div>
  );
}
