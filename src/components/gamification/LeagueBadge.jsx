import React from 'react';
import { Shield } from 'lucide-react';

// League (bronze < silver < gold) shield. Backend: services/gamificationLeagues.js.
export const LEAGUE_META = {
  bronze: { label: 'Bronze', from: '#ebc097', mid: '#b36b32', to: '#7a4419', soft: 'rgba(179,107,50,0.12)' },
  silver: { label: 'Silver', from: '#e3e8ee', mid: '#8e9baa', to: '#5b6875', soft: 'rgba(142,155,170,0.15)' },
  gold: { label: 'Gold', from: '#f6dc8a', mid: '#c9971f', to: '#8a6414', soft: 'rgba(201,151,31,0.14)' },
};
export const LEAGUE_ORDER = ['bronze', 'silver', 'gold'];

const SIZES = { xs: [18, 10], sm: [24, 13], md: [36, 18], lg: [56, 28] };

export default function LeagueBadge({ league = 'bronze', size = 'sm', withLabel = false, className = '' }) {
  const meta = LEAGUE_META[league] || LEAGUE_META.bronze;
  const [box, icon] = SIZES[size] || SIZES.sm;
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={`${meta.label} liqası`}>
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ width: box, height: box, background: `linear-gradient(135deg, ${meta.from}, ${meta.mid} 55%, ${meta.to})` }}
      >
        <Shield size={icon} strokeWidth={2.4} fill="rgba(255,255,255,0.25)" />
      </span>
      {withLabel && <span className="text-sm font-semibold" style={{ color: meta.to }}>{meta.label} liqası</span>}
    </span>
  );
}
