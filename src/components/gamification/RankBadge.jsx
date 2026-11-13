import React from 'react';
import { Sprout, Leaf, Star, Shield, Zap, Gem, Award, Crown, Flame, Trophy } from 'lucide-react';

// Rank icon per level (backend services/gamificationLevels.js has the names and
// the points/reward math). Levels past the named ones keep the top style.
const RANKS = [
  { name: 'Yeni başlayan', icon: Sprout, from: '#94a3b8', to: '#64748b' },
  { name: 'Satıcı', icon: Leaf, from: '#34d399', to: '#059669' },
  { name: 'Təcrübəli', icon: Star, from: '#38bdf8', to: '#0284c7' },
  { name: 'Peşəkar', icon: Shield, from: '#60a5fa', to: '#4f46e5' },
  { name: 'Ekspert', icon: Zap, from: '#a78bfa', to: '#7c3aed' },
  { name: 'Usta', icon: Gem, from: '#f472b6', to: '#c026d3' },
  { name: 'Elit', icon: Award, from: '#fbbf24', to: '#d97706' },
  { name: 'Çempion', icon: Crown, from: '#fb923c', to: '#ea580c' },
  { name: 'Əfsanə', icon: Flame, from: '#f87171', to: '#be123c' },
];
const LEGEND = { icon: Trophy, from: '#fde68a', to: '#b45309' };

export function rankMeta(level = 1) {
  const l = Math.max(1, Math.floor(Number(level) || 1));
  if (l <= RANKS.length) return { level: l, ...RANKS[l - 1] };
  return { level: l, name: `Əfsanə ${l - RANKS.length + 1}`, ...LEGEND };
}

const SIZES = {
  xs: { box: 'h-5 w-5', icon: 11 },
  sm: { box: 'h-6 w-6', icon: 13 },
  md: { box: 'h-9 w-9', icon: 18 },
  lg: { box: 'h-16 w-16', icon: 30 },
};

export default function RankBadge({ level = 1, size = 'xs', showLevel = false, className = '' }) {
  const meta = rankMeta(level);
  const s = SIZES[size] || SIZES.xs;
  const Icon = meta.icon;
  return (
    <span
      title={`Səviyyə ${meta.level} · ${meta.name}`}
      aria-label={`Səviyyə ${meta.level}, ${meta.name}`}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-sm ring-2 ring-white/70 dark:ring-slate-900/70 ${s.box} ${className}`}
      style={{ background: `linear-gradient(135deg, ${meta.from}, ${meta.to})` }}
    >
      <Icon size={s.icon} strokeWidth={2.4} />
      {showLevel && (
        <span className="absolute -bottom-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
          {meta.level}
        </span>
      )}
    </span>
  );
}
