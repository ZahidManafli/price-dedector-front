import React, { useEffect, useState } from 'react';
import { CalendarCheck, Crown, Flame, Loader2, Lock, Medal, ShieldCheck, ShoppingBag, Sparkles, Star, Trophy, Truck, Zap } from 'lucide-react';
import { gamificationAPI } from '../../services/api';

// Settings -> Nailiyyətlər: one-time badges with progress, plus the
// perfect-day streak (backend services/gamificationAchievements.js).

export const BADGE_STYLE = {
  first_sale: { icon: ShoppingBag, from: '#34d399', to: '#059669' },
  sales_100: { icon: ShoppingBag, from: '#60a5fa', to: '#2563eb' },
  sales_500: { icon: ShoppingBag, from: '#a78bfa', to: '#7c3aed' },
  sales_1000: { icon: Trophy, from: '#fbbf24', to: '#d97706' },
  streak_3: { icon: Flame, from: '#fdba74', to: '#f97316' },
  streak_7: { icon: Flame, from: '#fb923c', to: '#ea580c' },
  streak_30: { icon: Flame, from: '#f87171', to: '#be123c' },
  on_time_month: { icon: Truck, from: '#5eead4', to: '#0d9488' },
  podium: { icon: Medal, from: '#cbd5e1', to: '#64748b' },
  champion: { icon: Crown, from: '#fde68a', to: '#b45309' },
  league_silver: { icon: ShieldCheck, from: '#e3e8ee', to: '#5b6875' },
  league_gold: { icon: ShieldCheck, from: '#f6dc8a', to: '#8a6414' },
  level_5: { icon: Zap, from: '#c4b5fd', to: '#6d28d9' },
  level_10: { icon: Star, from: '#f9a8d4', to: '#be185d' },
};
const GROUPS = [
  ['sales', 'Satış'],
  ['streak', 'Seriya'],
  ['shipping', 'Göndəriş'],
  ['competition', 'Yarış və liqa'],
  ['rank', 'Rütbə'],
];

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AchievementsSection({ isDark }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    gamificationAPI
      .achievements()
      .then((res) => setData(res?.data || null))
      .catch((err) => setError(err?.response?.data?.error || 'Nailiyyətləri yükləmək alınmadı'));
  }, []);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';

  if (!data) {
    return (
      <div className="glass-card flex justify-center p-10">
        {error ? <p className="text-sm text-rose-500">{error}</p> : <Loader2 className="animate-spin text-indigo-500" size={22} />}
      </div>
    );
  }

  const earnedCount = data.achievements.filter((a) => a.earned).length;
  const streak = data.streak || { current: 0, best: 0 };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card p-5">
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${faint}`}>
            <Flame size={14} className="text-orange-500" /> Cari seriya
          </div>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${strong}`}>
            {streak.current} <span className={`text-base font-medium ${muted}`}>gün</span>
          </p>
          <p className={`mt-1 text-xs ${faint}`}>Bütün tapşırıqları bitirdiyiniz ardıcıl günlər</p>
        </div>
        <div className="glass-card p-5">
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${faint}`}>
            <CalendarCheck size={14} className="text-emerald-500" /> Ən uzun seriya
          </div>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${strong}`}>
            {streak.best} <span className={`text-base font-medium ${muted}`}>gün</span>
          </p>
          <p className={`mt-1 text-xs ${faint}`}>Bu günə qədərki rekordunuz</p>
        </div>
        <div className="glass-card p-5">
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${faint}`}>
            <Sparkles size={14} className="text-indigo-500" /> Nişanlar
          </div>
          <p className={`mt-2 text-3xl font-bold tabular-nums ${strong}`}>
            {earnedCount} <span className={`text-base font-medium ${muted}`}>/ {data.achievements.length}</span>
          </p>
          <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500" style={{ width: `${Math.round((earnedCount / Math.max(1, data.achievements.length)) * 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Badges by group */}
      {GROUPS.map(([group, label]) => {
        const items = data.achievements.filter((a) => a.group === group);
        if (!items.length) return null;
        return (
          <div key={group} className="glass-card p-5 md:p-6">
            <h3 className={`mb-4 text-sm font-semibold uppercase tracking-wider ${faint}`}>{label}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((a) => {
                const style = BADGE_STYLE[a.code] || { icon: Star, from: '#cbd5e1', to: '#64748b' };
                const Icon = style.icon;
                const pct = Math.round((a.value / Math.max(1, a.goal)) * 100);
                return (
                  <div
                    key={a.code}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      a.earned
                        ? isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-white'
                        : isDark ? 'border-slate-800' : 'border-slate-100'
                    }`}
                  >
                    <span
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${a.earned ? '' : 'grayscale opacity-40'}`}
                      style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
                    >
                      <Icon size={22} strokeWidth={2.2} />
                      {!a.earned && (
                        <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'}`}>
                          <Lock size={10} />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${a.earned ? strong : muted}`}>{a.title}</p>
                      <p className={`text-xs ${faint}`}>{a.description}</p>
                      {a.earned ? (
                        <p className="mt-1 text-[11px] font-medium text-emerald-500">Qazanıldı · {fmtDate(a.earnedAt)}</p>
                      ) : (
                        a.goal > 1 && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className={`h-1.5 flex-1 overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${style.from}, ${style.to})` }} />
                            </div>
                            <span className={`shrink-0 text-[11px] tabular-nums ${faint}`}>
                              {a.value.toLocaleString()} / {a.goal.toLocaleString()}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
