import React, { useEffect, useRef, useState } from 'react';
import { Flame, Loader2, Medal, Star, Trophy, X } from 'lucide-react';
import { gamificationAPI } from '../../services/api';
import RankBadge from './RankBadge';
import LeagueBadge, { LEAGUE_META } from './LeagueBadge';
import { TIER_STYLES } from './Certificate';
import { BADGE_STYLE } from './AchievementsSection';

// Public Gamification profile opened from the leaderboard: rank, league,
// streak, podium finishes and earned badges (backend GET /gamification/profile/:publicId).

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function UserProfileModal({ publicId, fallbackName, isDark, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  // Latest onClose without refetching when the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    gamificationAPI
      .profile(publicId)
      .then((res) => { if (!cancelled) setProfile(res?.data || null); })
      .catch((err) => { if (!cancelled) setError(err?.response?.data?.error || 'Profil yüklənmədi'); });
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [publicId]);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const league = profile ? LEAGUE_META[profile.league] || LEAGUE_META.bronze : null;
  const podiumTotal = profile ? profile.podium.gold + profile.podium.silver + profile.podium.bronze : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gm-profile-title"
        className={`flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}
      >
        {/* Header */}
        <div
          className="relative px-5 pb-5 pt-6"
          style={league ? { background: `linear-gradient(135deg, ${league.soft}, transparent 70%)` } : undefined}
        >
          <button type="button" onClick={onClose} aria-label="Bağla" className={`absolute right-3 top-3 rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
          <div className="flex items-center gap-4">
            {profile ? <RankBadge level={profile.level} size="lg" showLevel /> : <span className={`h-16 w-16 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />}
            <div className="min-w-0">
              <h2 id="gm-profile-title" className={`truncate text-xl font-bold ${strong}`}>
                {profile?.displayName || fallbackName}
                {profile?.isMe && <span className="ml-2 text-xs font-medium text-indigo-500">(siz)</span>}
              </h2>
              {profile && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className={`font-medium ${muted}`}>Səviyyə {profile.level} · {profile.rankName}</span>
                  <LeagueBadge league={profile.league} size="xs" withLabel />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {!profile && !error && (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-indigo-500" size={22} />
            </div>
          )}
          {error && <p className="py-8 text-center text-sm text-rose-500">{error}</p>}

          {profile && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                  <Flame size={16} className="mx-auto text-orange-500" />
                  <p className={`mt-1 text-lg font-bold tabular-nums ${strong}`}>{profile.streak.current}</p>
                  <p className={`text-[11px] ${faint}`}>gün seriya</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                  <Star size={16} className="mx-auto text-amber-500" />
                  <p className={`mt-1 text-lg font-bold tabular-nums ${strong}`}>{profile.streak.best}</p>
                  <p className={`text-[11px] ${faint}`}>ən uzun seriya</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                  <Trophy size={16} className="mx-auto text-indigo-500" />
                  <p className={`mt-1 text-lg font-bold tabular-nums ${strong}`}>{podiumTotal}</p>
                  <p className={`text-[11px] ${faint}`}>kürsü</p>
                </div>
              </div>

              {podiumTotal > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {['gold', 'silver', 'bronze'].map((tier) =>
                    profile.podium[tier] > 0 ? (
                      <span key={tier} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                        <Medal size={13} style={{ color: TIER_STYLES[tier].main }} />
                        {profile.podium[tier]} × {TIER_STYLES[tier].name}
                      </span>
                    ) : null
                  )}
                </div>
              )}

              {/* Badges */}
              <div className="mt-5 mb-2 flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${strong}`}>Nailiyyətlər</h3>
                <span className={`text-xs tabular-nums ${faint}`}>
                  {profile.achievements.length} / {profile.totalAchievements}
                </span>
              </div>
              {profile.achievements.length === 0 ? (
                <p className={`rounded-xl px-3 py-6 text-center text-sm ${isDark ? 'bg-slate-800/40 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                  Hələ nailiyyət qazanılmayıb.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {profile.achievements.map((a) => {
                    const style = BADGE_STYLE[a.code] || { icon: Star, from: '#cbd5e1', to: '#64748b' };
                    const Icon = style.icon;
                    return (
                      <div key={a.code} className={`flex items-center gap-3 rounded-xl border p-2.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`} title={a.description}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}>
                          <Icon size={18} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${strong}`}>{a.title}</p>
                          <p className={`truncate text-[11px] ${faint}`}>{a.earnedAt ? fmtDate(a.earnedAt) : a.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
