import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trophy, Crown, Medal, Flame, ShoppingBag, CheckSquare, Target, Gift, Timer, RefreshCw, Loader2, Sparkles, Flag, CalendarCheck, Info, X, ArrowUp, ArrowDown, Minus, Users,
} from 'lucide-react';
import { gamificationAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { TIER_STYLES, formatAzDate } from '../components/gamification/Certificate';
import RankBadge, { rankMeta } from '../components/gamification/RankBadge';
import LeagueBadge, { LEAGUE_META, LEAGUE_ORDER } from '../components/gamification/LeagueBadge';
import UserProfileModal from '../components/gamification/UserProfileModal';

// Gamification — weekly Monday–Sunday (Baku) points race. Backend: services/gamification.js.
// Open to every signed-in user; the admin-only notes below show only to admins.

const PODIUM_ORDER = [2, 1, 3];
const PODIUM_HEIGHT = { 1: 'h-36 sm:h-44', 2: 'h-28 sm:h-32', 3: 'h-20 sm:h-24' };
const TIER_BY_PLACE = { 1: 'gold', 2: 'silver', 3: 'bronze' };
const PLACE_TEXT = { 1: '1-ci yer', 2: '2-ci yer', 3: '3-cü yer' };

function initials(name) {
  return String(name || '?')
    .replace(/\./g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
}

function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(endsAt || 0).getTime() - now);
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    done: ms === 0,
  };
}

function Avatar({ name, tier, size = 'h-14 w-14 text-lg', isDark }) {
  const style = tier ? TIER_STYLES[tier] : null;
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-4 ${size} ${
        style ? '' : isDark ? 'bg-slate-700 ring-slate-800' : 'bg-slate-400 ring-white'
      }`}
      style={style ? { background: `linear-gradient(135deg, ${style.light}, ${style.main} 55%, ${style.dark})`, '--tw-ring-color': isDark ? '#0f172a' : '#ffffff' } : undefined}
    >
      {initials(name)}
    </span>
  );
}

function InfoButton({ onClick, isDark, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Xal necə hesablanıb?"
      aria-label={`${label}: xal necə hesablanıb`}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
        isDark ? 'text-slate-500 hover:bg-slate-800 hover:text-indigo-300' : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
      }`}
    >
      <Info size={14} />
    </button>
  );
}

// "How were these points calculated?" — one line per source, then the total.
function ScoreBreakdownModal({ entry, rules, isDark, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const b = entry.breakdown || {};
  const reached = (rules?.checkpoints || []).filter((c) => (entry.sales || 0) >= c.sales);
  const rows = [
    { icon: ShoppingBag, tone: 'text-indigo-500', label: 'Satış', formula: `${entry.sales || 0} × ${rules?.pointsPerSale ?? 0} xal`, points: b.sales || 0 },
    { icon: CheckSquare, tone: 'text-emerald-500', label: 'Gündəlik tapşırıq', formula: `${entry.tasksDone || 0} × ${rules?.pointsPerTask ?? 0} xal`, points: b.tasks || 0 },
    { icon: Flame, tone: 'text-orange-500', label: 'Tam gün bonusu', formula: `${entry.perfectDays || 0} gün × ${rules?.perfectDayBonus ?? 0} xal`, points: b.perfectDays || 0 },
  ];
  const tier = TIER_BY_PLACE[entry.rank] ? TIER_STYLES[TIER_BY_PLACE[entry.rank]] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-breakdown-title"
        className={`w-full max-w-md overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}
      >
        <div className={`flex items-center gap-3 border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <Avatar name={entry.displayName} tier={TIER_BY_PLACE[entry.rank] || null} size="h-10 w-10 text-sm" isDark={isDark} />
          {entry.level && <RankBadge level={entry.level} size="sm" />}
          <div className="min-w-0 flex-1">
            <h2 id="score-breakdown-title" className={`truncate text-base font-semibold ${strong}`}>
              {entry.displayName || 'Siz'}
              {entry.isMe && entry.displayName && <span className="ml-1.5 text-xs font-medium text-indigo-500">(siz)</span>}
            </h2>
            <p className={`text-xs ${muted}`}>
              {entry.rank ? PLACE_TEXT[entry.rank] || `${entry.rank}-ci yer` : 'Hələ sırada deyil'} · bu həftənin xalları
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Bağla" className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 px-5 py-4">
          {rows.map((r) => (
            <div key={r.label} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <r.icon size={16} className={`shrink-0 ${r.tone}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${strong}`}>{r.label}</p>
                  <p className={`text-xs tabular-nums ${muted}`}>{r.formula}</p>
                </div>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${strong}`}>+{r.points.toLocaleString()}</span>
            </div>
          ))}

          <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Flag size={16} className="shrink-0 text-amber-500" />
                <div>
                  <p className={`text-sm font-medium ${strong}`}>Checkpoint bonusları</p>
                  <p className={`text-xs ${muted}`}>{reached.length ? `${reached.length} checkpoint keçilib` : 'Hələ checkpoint keçilməyib'}</p>
                </div>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${strong}`}>+{(b.checkpoints || 0).toLocaleString()}</span>
            </div>
            {reached.length > 0 && (
              <ul className={`mt-2 space-y-1 border-t pt-2 text-xs ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                {reached.map((c) => (
                  <li key={c.sales} className={`flex justify-between tabular-nums ${muted}`}>
                    <span>{c.sales} satışa çatıb</span>
                    <span>+{c.bonus}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className={`flex items-center justify-between border-t px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <span className={`text-sm font-semibold ${strong}`}>Cəmi</span>
          <span className={`text-2xl font-bold tabular-nums ${tier ? '' : strong}`} style={tier ? { color: tier.main } : undefined}>
            {(entry.points || 0).toLocaleString()} <span className="text-sm font-semibold">xal</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function PodiumColumn({ place, entry, prize, isDark, onInfo, onProfile }) {
  const tier = TIER_STYLES[TIER_BY_PLACE[place]];
  const first = place === 1;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className={`mb-3 flex flex-col items-center text-center ${entry ? '' : 'opacity-60'}`}>
        {first ? (
          <Crown size={30} style={{ color: tier.main }} fill={tier.light} className="gami-float mb-1 drop-shadow" />
        ) : (
          <Medal size={20} style={{ color: tier.main }} className="mb-1.5" />
        )}
        <button
          type="button"
          disabled={!entry}
          onClick={() => entry && onProfile(entry)}
          title={entry ? `${entry.displayName} — nailiyyətlərə bax` : undefined}
          className="relative rounded-full transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-default disabled:hover:scale-100"
        >
          {entry && (
            <span
              className="absolute -inset-2 rounded-full opacity-60 blur-md"
              style={{ background: `radial-gradient(circle, ${tier.light}, transparent 70%)` }}
              aria-hidden="true"
            />
          )}
          <span className="relative block">
            <Avatar
              name={entry?.displayName || '—'}
              tier={entry ? TIER_BY_PLACE[place] : null}
              size={first ? 'h-20 w-20 text-2xl sm:h-24 sm:w-24 sm:text-3xl' : 'h-14 w-14 text-lg sm:h-16 sm:w-16 sm:text-xl'}
              isDark={isDark}
            />
          </span>
        </button>
        <div className="mt-2.5 flex max-w-[180px] items-center gap-1">
          {entry && <RankBadge level={entry.level} />}
          {entry ? (
            <button type="button" onClick={() => onProfile(entry)} className="truncate text-sm font-semibold text-slate-900 hover:underline dark:text-white">
              {entry.displayName}
              {entry.isMe && <span className="ml-1 text-xs font-medium text-cyan-600 dark:text-cyan-300">(siz)</span>}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">Boş yer</p>
          )}
          {entry && <InfoButton onClick={() => onInfo(entry)} isDark={isDark} label={entry.displayName} />}
        </div>
        <p
          className="mt-0.5 rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
          style={
            entry
              ? isDark
                ? { color: tier.light, background: `${tier.main}40` }
                : { color: tier.dark, background: `${tier.light}66` }
              : { color: 'inherit', background: 'transparent' }
          }
        >
          {entry ? `${entry.points.toLocaleString()} xal` : '—'}
        </p>
      </div>
      <div
        className={`group relative flex w-full flex-col items-center justify-start overflow-hidden rounded-t-2xl pt-3 shadow-lg transition hover:brightness-105 ${entry ? 'cursor-pointer' : ''} ${PODIUM_HEIGHT[place]}`}
        style={{ background: `linear-gradient(180deg, ${tier.light}, ${tier.main} 55%, ${tier.dark})`, boxShadow: `0 18px 40px -18px ${tier.main}` }}
        onClick={entry ? () => onInfo(entry) : undefined}
        title={entry ? `${entry.points.toLocaleString()} xal` : undefined}
      >
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" aria-hidden="true" />
        <span className="relative text-4xl font-black text-white/95 drop-shadow sm:text-5xl">{place}</span>
        {prize?.title && (
          <span className="relative mt-2 hidden max-w-[90%] truncate rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur sm:block" title={prize.title}>
            <Gift size={10} className="mr-1 inline" />
            {prize.title}
          </span>
        )}
      </div>
    </div>
  );
}

const CARD = 'rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]';
const STAT_TONES = {
  indigo: 'from-indigo-500 to-violet-600 shadow-indigo-500/30',
  emerald: 'from-emerald-500 to-teal-600 shadow-emerald-500/30',
  orange: 'from-orange-500 to-rose-500 shadow-orange-500/30',
  amber: 'from-amber-400 to-orange-500 shadow-amber-500/30',
};

export default function GamificationPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewLeague, setViewLeague] = useState(null); // null = my league
  const [streak, setStreak] = useState(null);

  const load = useCallback(async (league = viewLeague) => {
    setLoading(true);
    setError('');
    try {
      const res = await gamificationAPI.leaderboard(league);
      setData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Reytinqi yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
  }, [viewLeague]);

  useEffect(() => {
    load();
  }, [load]);

  // Perfect-day streak for "Sizin nəticəniz" (not critical — ignore failures).
  useEffect(() => {
    gamificationAPI.achievements().then((res) => setStreak(res?.data?.streak || null)).catch(() => {});
  }, []);

  const countdown = useCountdown(data?.week?.endsAt);
  const board = data?.leaderboard || [];
  const top = useMemo(() => Object.fromEntries(board.slice(0, 3).map((e) => [e.rank, e])), [board]);
  const rest = board.slice(3);
  const leaderPoints = Math.max(1, board[0]?.points || 0);
  const [breakdownEntry, setBreakdownEntry] = useState(null);
  const [profileEntry, setProfileEntry] = useState(null);
  const me = data?.me;
  const rules = data?.rules;
  const leagueInfo = data?.league;
  const shownLeague = leagueInfo?.viewing || 'bronze';

  // Checkpoint journey: nodes placed proportionally along a track up to the last checkpoint.
  const checkpoints = rules?.checkpoints || [];
  const mySales = me?.sales || 0;
  const nextCp = me?.nextCheckpoint || null;
  const maxCpSales = Math.max(1, checkpoints[checkpoints.length - 1]?.sales || 1);
  const journeyFill = Math.min(100, (mySales / maxCpSales) * 100);

  if (loading && !data) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-600" size={28} />
      </div>
    );
  }

  const level = me?.levelProgress;
  const levelMeta = level ? rankMeta(level.level) : null;
  const zone = leagueInfo?.standing?.zone;

  return (
    <div className="page-shell">
      <style>{`@keyframes gamiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}.gami-float{animation:gamiFloat 3.2s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.gami-float{animation:none}}`}</style>
      <div className="w-full space-y-5">
        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

        {data && !data.enabled && isAdmin && (
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <span>Test rejimi: reytinq canlı hesablanır, amma həftəlik mükafat və sertifikatlar hələ verilmir. Admin panel → Gamification bölməsindən aktiv edin.</span>
          </div>
        )}

        {data && (
          <>
            {/* ── Hero: week + my result ── */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] p-5 text-white shadow-xl shadow-slate-900/20 ring-1 ring-white/10 sm:p-7">
              <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-96 rounded-full bg-amber-400/15 blur-3xl" aria-hidden="true" />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                  backgroundSize: '44px 44px',
                  maskImage: 'radial-gradient(ellipse at top left, black 15%, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(ellipse at top left, black 15%, transparent 70%)',
                }}
                aria-hidden="true"
              />

              <div className="relative grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-center">
                {/* Left: week */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200 backdrop-blur">
                      <Trophy size={13} /> Həftəlik yarış
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                      <CalendarCheck size={13} /> {formatAzDate(data.week.startDate)} – {formatAzDate(data.week.lastDate)}
                    </span>
                  </div>
                  <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl" style={{ textWrap: 'balance' }}>
                    Satış edin, tapşırıqları bitirin,{' '}
                    <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 bg-clip-text text-transparent">zirvəyə qalxın</span>
                  </h1>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Həftənin ilk 3 yeri mükafat və sertifikat qazanır. Hər bazar ertəsi yarış yenidən başlayır.</p>

                  <div className="mt-5 flex flex-wrap items-end gap-3">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <Timer size={13} className="text-amber-300" /> Bitməsinə
                      </p>
                      <div className="flex gap-2">
                        {[
                          [countdown.days, 'gün'],
                          [countdown.hours, 'saat'],
                          [countdown.minutes, 'dəq'],
                        ].map(([value, label]) => (
                          <div key={label} className="min-w-[64px] rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-2 text-center backdrop-blur">
                            <p className="text-2xl font-bold tabular-nums">{String(value).padStart(2, '0')}</p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pb-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">
                        <Users size={13} /> {data.participants} iştirakçı
                      </span>
                      <button
                        type="button"
                        onClick={() => load()}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Yenilə
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: my result */}
                <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-5 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                        Sizin nəticəniz
                        {me && (
                          <button
                            type="button"
                            onClick={() => setBreakdownEntry({ ...me, isMe: true })}
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                            aria-label="Xal necə hesablanıb"
                            title="Xal necə hesablanıb?"
                          >
                            <Info size={13} />
                          </button>
                        )}
                      </p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-5xl font-black tabular-nums tracking-tight">{(me?.points || 0).toLocaleString()}</span>
                        <span className="text-sm font-medium text-slate-300">xal</span>
                      </div>
                      {streak?.current > 0 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-semibold text-orange-200" title="Bütün tapşırıqları bitirdiyiniz ardıcıl günlər">
                          <Flame size={12} /> {streak.current} gün seriya
                        </span>
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 text-center ring-1 ${me?.rank && me.rank <= 3 ? 'bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 ring-amber-200/50' : 'bg-white/10 ring-white/10'}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Sıranız</p>
                      <p className="text-3xl font-black tabular-nums">{me?.rank ? `#${me.rank}` : '—'}</p>
                    </div>
                  </div>

                  {level && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/20 p-3">
                      <RankBadge level={level.level} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline justify-between gap-2 text-sm font-semibold">
                          <span className="truncate">{levelMeta.name}</span>
                          <span className="shrink-0 text-xs font-medium text-slate-300">Səviyyə {level.level}</span>
                        </p>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${level.progress}%`, background: `linear-gradient(90deg, ${levelMeta.from}, ${rankMeta(level.level + 1).to})` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                          Növbəti rütbəyə {level.toNext.toLocaleString()} xal · ümumi {level.points.toLocaleString()} xal
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── League ── */}
            {leagueInfo && (
              <div className={`${CARD} flex flex-wrap items-center justify-between gap-4 p-3 sm:p-4`}>
                <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-white/5" role="tablist" aria-label="Liqalar">
                  {LEAGUE_ORDER.map((l) => {
                    const meta = LEAGUE_META[l];
                    const active = shownLeague === l;
                    const mine = leagueInfo.mine === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setViewLeague(l)}
                        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          active ? 'bg-white shadow-sm dark:bg-slate-800' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                        }`}
                        style={active ? { color: meta.to } : undefined}
                      >
                        <LeagueBadge league={l} size="xs" />
                        {meta.label}
                        <span className="rounded-full bg-slate-200/80 px-1.5 text-[11px] tabular-nums text-slate-600 dark:bg-white/10 dark:text-slate-300">{leagueInfo.counts?.[l] ?? 0}</span>
                        {mine && <span className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Siz</span>}
                      </button>
                    );
                  })}
                </div>

                {leagueInfo.standing && (
                  <div className="flex flex-wrap items-center gap-3">
                    <LeagueBadge league={leagueInfo.mine} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {LEAGUE_META[leagueInfo.mine]?.label} liqası · bu ay {leagueInfo.standing.points.toLocaleString()} xal
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Liqada {leagueInfo.standing.rank}/{leagueInfo.standing.members} · ay sonu {formatAzDate(new Date(new Date(leagueInfo.standing.monthEndsAt).getTime() - 1).toISOString())}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        zone === 'up'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : zone === 'down'
                          ? 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-300'
                          : 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-white/5 dark:text-slate-300'
                      }`}
                      title={`Ay sonunda hər liqanın ilk ${leagueInfo.promotePercent}%-i yüksəlir, son ${leagueInfo.promotePercent}%-i enir`}
                    >
                      {zone === 'up' ? <ArrowUp size={12} /> : zone === 'down' ? <ArrowDown size={12} /> : <Minus size={12} />}
                      {zone === 'up' ? 'Yüksəlmə zonası' : zone === 'down' ? 'Enmə zonası' : 'Təhlükəsiz zona'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── This week's stats + checkpoint journey ── */}
            <div className={`${CARD} p-5`}>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { icon: ShoppingBag, label: 'Satış', value: me?.sales || 0, pts: me?.breakdown?.sales || 0, tone: 'indigo' },
                  { icon: CheckSquare, label: 'Tapşırıq', value: me?.tasksDone || 0, pts: me?.breakdown?.tasks || 0, tone: 'emerald' },
                  { icon: Flame, label: 'Tam gün', value: me?.perfectDays || 0, pts: me?.breakdown?.perfectDays || 0, tone: 'orange' },
                  { icon: Flag, label: 'Checkpoint', value: me?.checkpointsReached || 0, pts: me?.breakdown?.checkpoints || 0, tone: 'amber' },
                ].map((s) => (
                  <div key={s.label} className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-3 transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/5 dark:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${STAT_TONES[s.tone]}`}>
                        <s.icon size={16} />
                      </span>
                      <p className="min-w-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <p className="text-xl font-bold tabular-nums text-slate-900 dark:text-white">{s.value}</p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
                        +{s.pts}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {checkpoints.length > 0 ? (
                <div className="mt-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                      <Target size={15} className="text-amber-500" /> Checkpoint yolu
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {nextCp ? `Növbəti: ${nextCp.sales} satış (+${nextCp.bonus} xal) · ${nextCp.remaining} satış qalıb` : 'Bütün checkpoint-lər keçildi 🎉'}
                    </span>
                  </div>
                  <div className="relative mx-3 mb-9 mt-5 h-2.5 rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${journeyFill}%` }} />
                    {checkpoints.map((c) => {
                      const reached = mySales >= c.sales;
                      const left = (c.sales / maxCpSales) * 100;
                      return (
                        <div key={c.sales} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white transition dark:ring-slate-900 ${
                              reached ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {reached ? <CheckSquare size={13} /> : <Flag size={12} />}
                          </span>
                          <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-center text-[11px] leading-tight">
                            <span className={`block font-semibold ${reached ? 'text-orange-600 dark:text-orange-300' : 'text-slate-600 dark:text-slate-300'}`}>{c.sales} satış</span>
                            <span className="block text-slate-400">+{c.bonus}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">Checkpoint təyin olunmayıb</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
              {/* ── Podium + leaderboard ── */}
              <div className="space-y-5 xl:col-span-2">
                <div className={`${CARD} relative overflow-hidden px-5 pt-5`}>
                  <div className="pointer-events-none absolute left-1/2 top-10 h-64 w-[520px] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-300/20 via-yellow-200/25 to-amber-300/20 blur-3xl dark:from-amber-400/10 dark:via-yellow-300/10 dark:to-amber-400/10" aria-hidden="true" />
                  <div className="relative mb-6 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30">
                        <Trophy size={16} />
                      </span>
                      Həftənin liderləri
                    </h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: LEAGUE_META[shownLeague]?.to, background: LEAGUE_META[shownLeague]?.soft }}>
                      <LeagueBadge league={shownLeague} size="xs" /> {LEAGUE_META[shownLeague]?.label} liqası
                    </span>
                  </div>
                  <div className="relative mx-auto flex max-w-2xl items-end gap-2 sm:gap-4">
                    {PODIUM_ORDER.map((place) => (
                      <PodiumColumn key={place} place={place} entry={top[place]} prize={data.prizes?.[place]} isDark={isDark} onInfo={setBreakdownEntry} onProfile={setProfileEntry} />
                    ))}
                  </div>
                </div>

                <div className={`${CARD} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reytinq cədvəli</h3>
                    <span className="text-xs text-slate-400">4-cü yerdən etibarən</span>
                  </div>
                  {rest.length === 0 ? (
                    <div className="flex flex-col items-center px-4 py-12 text-center">
                      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">
                        <Users size={22} />
                      </span>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {board.length === 0 ? 'Bu həftə hələ heç kim xal toplamayıb.' : 'Hələlik yalnız ilk 3 yer doludur.'}
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-white/5">
                      {rest.map((e) => (
                        <li
                          key={e.rank}
                          className={`flex items-center gap-3 px-4 py-3 transition sm:px-5 ${
                            e.isMe ? 'bg-gradient-to-r from-cyan-50 to-blue-50/40 dark:from-cyan-500/10 dark:to-transparent' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.03]'
                          }`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold tabular-nums text-slate-600 dark:bg-white/5 dark:text-slate-300">
                            {e.rank}
                          </span>
                          <button type="button" onClick={() => setProfileEntry(e)} title={`${e.displayName} — nailiyyətlərə bax`} className="group/profile flex min-w-0 flex-1 items-center gap-3 text-left">
                            <Avatar name={e.displayName} size="h-9 w-9 text-xs" isDark={isDark} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <RankBadge level={e.level} />
                                <span className="truncate text-sm font-semibold text-slate-900 group-hover/profile:underline dark:text-white">{e.displayName}</span>
                                {e.isMe && <span className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Siz</span>}
                              </span>
                              <span className="mt-1 block h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                                <span className="block h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${Math.max(4, (e.points / leaderPoints) * 100)}%` }} />
                              </span>
                            </span>
                          </button>
                          <div className="hidden items-center gap-4 text-xs text-slate-500 dark:text-slate-400 md:flex">
                            <span className="inline-flex items-center gap-1" title="Satış"><ShoppingBag size={13} className="text-indigo-500" />{e.sales}</span>
                            <span className="inline-flex items-center gap-1" title="Tapşırıq"><CheckSquare size={13} className="text-emerald-500" />{e.tasksDone}</span>
                            <span className="inline-flex items-center gap-1" title="Checkpoint"><Flag size={13} className="text-amber-500" />{e.checkpointsReached}</span>
                          </div>
                          <span className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900 dark:text-white">{e.points.toLocaleString()}</span>
                          <InfoButton onClick={() => setBreakdownEntry(e)} isDark={isDark} label={e.displayName} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* ── Rules, prizes, last week ── */}
              <div className="space-y-5">
                <div className={`${CARD} p-5`}>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Sparkles size={16} className="text-cyan-500" /> Xal necə qazanılır
                  </h3>
                  <ul className="space-y-2">
                    {[
                      [ShoppingBag, 'Hər satış', rules?.pointsPerSale, 'indigo'],
                      [CheckSquare, 'Hər gündəlik tapşırıq', rules?.pointsPerTask, 'emerald'],
                      [Flame, 'Günün bütün tapşırıqları', rules?.perfectDayBonus, 'orange'],
                    ].map(([Icon, label, pts, tone]) => (
                      <li key={label} className="flex items-center gap-3 rounded-2xl bg-slate-50/80 p-2.5 dark:bg-white/[0.03]">
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow ${STAT_TONES[tone]}`}>
                          <Icon size={15} />
                        </span>
                        <span className="flex-1 text-sm text-slate-600 dark:text-slate-300">{label}</span>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-slate-800 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-100 dark:ring-white/10">+{pts ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                  {checkpoints.length > 0 && (
                    <>
                      <p className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Həftəlik checkpoint-lər</p>
                      <ol className="space-y-1.5">
                        {checkpoints.map((c) => {
                          const reached = mySales >= c.sales;
                          return (
                            <li
                              key={c.sales}
                              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${
                                reached ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-50/80 text-slate-600 dark:bg-white/[0.03] dark:text-slate-300'
                              }`}
                            >
                              <span className="flex items-center gap-2"><Flag size={14} /> {c.sales} satış</span>
                              <span className="text-xs font-bold">+{c.bonus} xal{reached ? ' ✓' : ''}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                </div>

                <div className={`${CARD} p-5`}>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Gift size={16} className="text-rose-500" /> Həftənin mükafatları
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: LEAGUE_META[shownLeague]?.to }}>
                      <LeagueBadge league={shownLeague} size="xs" /> {LEAGUE_META[shownLeague]?.label}
                    </span>
                  </h3>
                  <div className="space-y-2.5">
                    {[1, 2, 3].map((place) => {
                      const prize = data.prizes?.[place];
                      const tier = TIER_STYLES[TIER_BY_PLACE[place]];
                      const credits = [
                        prize?.marketAnalysisCredits > 0 && `+${prize.marketAnalysisCredits} Market Analysis`,
                        prize?.trackingCredits > 0 && `+${prize.trackingCredits} Tracking`,
                      ].filter(Boolean);
                      return (
                        <div
                          key={place}
                          className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-100 p-3 dark:border-white/5"
                          style={{ background: `linear-gradient(90deg, ${tier.light}33, transparent 70%)` }}
                        >
                          <span className="absolute inset-y-0 left-0 w-1" style={{ background: tier.main }} />
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-black text-white shadow-md" style={{ background: `linear-gradient(135deg, ${tier.light}, ${tier.main} 55%, ${tier.dark})` }}>
                            {place}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{prize?.title || PLACE_TEXT[place]}</p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{[...credits, `${tier.name} sertifikat`].join(' · ')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data.lastWeekWinners?.length > 0 && (
                  <div className={`${CARD} p-5`}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <Medal size={16} className="text-amber-500" /> Keçən həftənin qalibləri
                    </h3>
                    <ul className="space-y-2">
                      {data.lastWeekWinners.map((w) => (
                        <li key={w.place} className="flex items-center gap-3 rounded-xl bg-slate-50/80 px-3 py-2 text-sm dark:bg-white/[0.03]">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: TIER_STYLES[w.tier]?.main }}>{w.place}</span>
                          <span className="flex-1 truncate font-medium text-slate-900 dark:text-white">{w.displayName}</span>
                          <span className="tabular-nums text-slate-500 dark:text-slate-400">{w.points} xal</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {breakdownEntry && (
        <ScoreBreakdownModal entry={breakdownEntry} rules={data?.rules} isDark={isDark} onClose={() => setBreakdownEntry(null)} />
      )}

      {profileEntry?.publicId && (
        <UserProfileModal
          publicId={profileEntry.publicId}
          fallbackName={profileEntry.displayName}
          isDark={isDark}
          onClose={() => setProfileEntry(null)}
        />
      )}
    </div>
  );
}
