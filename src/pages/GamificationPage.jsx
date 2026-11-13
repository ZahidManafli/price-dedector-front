import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Trophy, Crown, Medal, Flame, ShoppingBag, CheckSquare, Target, Gift, Timer, RefreshCw, Loader2, Sparkles, Flag, CalendarCheck, Info, X,
} from 'lucide-react';
import { gamificationAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { TIER_STYLES, formatAzDate } from '../components/gamification/Certificate';
import RankBadge, { rankMeta } from '../components/gamification/RankBadge';

// Gamification — weekly Monday–Sunday (Baku) points race. Backend: services/gamification.js.
// Open to every signed-in user; the admin-only notes below show only to admins.

const PODIUM_ORDER = [2, 1, 3];
const PODIUM_HEIGHT = { 1: 'h-40 sm:h-48', 2: 'h-28 sm:h-36', 3: 'h-20 sm:h-28' };
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

function PodiumColumn({ place, entry, prize, isDark, onInfo }) {
  const tier = TIER_STYLES[TIER_BY_PLACE[place]];
  const Icon = place === 1 ? Crown : Medal;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className={`mb-3 flex flex-col items-center text-center ${entry ? '' : 'opacity-50'}`}>
        <Icon size={place === 1 ? 26 : 20} style={{ color: tier.main }} className="mb-1.5" fill={place === 1 ? tier.light : 'none'} />
        <Avatar name={entry?.displayName || '—'} tier={entry ? TIER_BY_PLACE[place] : null} size={place === 1 ? 'h-16 w-16 text-xl sm:h-20 sm:w-20 sm:text-2xl' : 'h-12 w-12 text-base sm:h-16 sm:w-16 sm:text-lg'} isDark={isDark} />
        <div className="mt-2 flex max-w-[180px] items-center gap-1">
          {entry && <RankBadge level={entry.level} />}
          <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {entry?.displayName || 'Boş yer'}
            {entry?.isMe && <span className="ml-1 text-xs font-medium text-indigo-500">(siz)</span>}
          </p>
          {entry && <InfoButton onClick={() => onInfo(entry)} isDark={isDark} label={entry.displayName} />}
        </div>
        <p className="text-sm font-bold tabular-nums" style={{ color: tier.dark }}>
          {entry ? `${entry.points.toLocaleString()} xal` : '—'}
        </p>
      </div>
      <div
        className={`group relative flex w-full items-start justify-center rounded-t-xl pt-3 shadow-inner transition hover:brightness-105 ${entry ? 'cursor-pointer' : ''} ${PODIUM_HEIGHT[place]}`}
        style={{ background: `linear-gradient(180deg, ${tier.light}, ${tier.main} 60%, ${tier.dark})` }}
        onClick={entry ? () => onInfo(entry) : undefined}
        title={entry ? `${entry.points.toLocaleString()} xal` : undefined}
      >
        {/* Hover: points */}
        {entry && (
          <span
            role="tooltip"
            className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100"
          >
            {entry.points.toLocaleString()} xal
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </span>
        )}
        <span className="font-serif text-4xl font-bold text-white/95 drop-shadow sm:text-5xl">{place}</span>
        {prize?.title && (
          <span className="absolute bottom-2 left-1/2 hidden max-w-[90%] -translate-x-1/2 truncate rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-medium text-white sm:block" title={prize.title}>
            {prize.title}
          </span>
        )}
      </div>
    </div>
  );
}

export default function GamificationPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await gamificationAPI.leaderboard();
      setData(res?.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Reytinqi yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countdown = useCountdown(data?.week?.endsAt);
  const board = data?.leaderboard || [];
  const top = useMemo(() => Object.fromEntries(board.slice(0, 3).map((e) => [e.rank, e])), [board]);
  const rest = board.slice(3);
  const [breakdownEntry, setBreakdownEntry] = useState(null);
  const me = data?.me;
  const rules = data?.rules;

  const card = `rounded-2xl border ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';

  // Checkpoint progress: from the last reached checkpoint to the next one.
  const checkpoints = rules?.checkpoints || [];
  const mySales = me?.sales || 0;
  const nextCp = me?.nextCheckpoint || null;
  const prevCpSales = checkpoints.filter((c) => mySales >= c.sales).slice(-1)[0]?.sales || 0;
  const cpProgress = nextCp ? Math.min(100, Math.round(((mySales - prevCpSales) / Math.max(1, nextCp.sales - prevCpSales)) * 100)) : 100;

  if (loading && !data) {
    return (
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="w-full space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
              <Trophy size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`text-2xl font-semibold tracking-tight ${strong}`}>Gamification</h1>
              </div>
              <p className={`text-sm ${muted}`}>Satış edin, gündəlik tapşırıqları bitirin, xal toplayın — həftənin ilk 3 yeri mükafat qazanır</p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:opacity-50 ${isDark ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Yenilə
          </button>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

        {data && !data.enabled && isAdmin && (
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${isDark ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200' : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
            <Sparkles size={16} className="mt-0.5 shrink-0" />
            <span>
              Test rejimi: reytinq canlı hesablanır, amma həftəlik mükafat və sertifikatlar hələ verilmir. Admin panel → Gamification bölməsindən aktiv edin.
            </span>
          </div>
        )}

        {data && (
          <>
            {/* ── Top row: week + my standing ── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className={`${card} p-5`}>
                <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${faint}`}>
                  <CalendarCheck size={14} /> Bu həftə
                </div>
                <p className={`mt-2 text-lg font-semibold ${strong}`}>
                  {formatAzDate(data.week.startDate)} – {formatAzDate(data.week.lastDate)}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <Timer size={16} className="text-orange-500" />
                  <span className={`text-sm ${muted}`}>Bitməsinə</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[
                    [countdown.days, 'gün'],
                    [countdown.hours, 'saat'],
                    [countdown.minutes, 'dəq'],
                  ].map(([value, label]) => (
                    <div key={label} className={`rounded-xl py-2 text-center ${isDark ? 'bg-slate-800/70' : 'bg-slate-50'}`}>
                      <p className={`text-2xl font-bold tabular-nums ${strong}`}>{String(value).padStart(2, '0')}</p>
                      <p className={`text-[11px] uppercase tracking-wide ${faint}`}>{label}</p>
                    </div>
                  ))}
                </div>
                <p className={`mt-3 text-xs ${faint}`}>{data.participants} iştirakçı xal toplayıb</p>
              </div>

              <div className={`${card} p-5 lg:col-span-2`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${faint}`}>
                      Sizin nəticəniz
                      {me && <InfoButton onClick={() => setBreakdownEntry({ ...me, isMe: true })} isDark={isDark} label="Sizin nəticəniz" />}
                    </p>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className={`text-4xl font-bold tabular-nums ${strong}`}>{(me?.points || 0).toLocaleString()}</span>
                      <span className={`text-sm ${muted}`}>xal</span>
                    </div>
                    {me?.levelProgress && (
                      <div className="mt-3 flex items-center gap-2.5">
                        <RankBadge level={me.levelProgress.level} size="md" />
                        <div className="min-w-[180px]">
                          <p className={`text-sm font-semibold ${strong}`}>
                            {rankMeta(me.levelProgress.level).name}
                            <span className={`ml-1.5 text-xs font-medium ${muted}`}>Səviyyə {me.levelProgress.level}</span>
                          </p>
                          <div className={`mt-1 h-1.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${me.levelProgress.progress}%`, background: `linear-gradient(90deg, ${rankMeta(me.levelProgress.level).from}, ${rankMeta(me.levelProgress.level + 1).to})` }}
                            />
                          </div>
                          <p className={`mt-1 text-[11px] tabular-nums ${faint}`}>
                            Növbəti rütbəyə {me.levelProgress.toNext.toLocaleString()} xal · ümumi {me.levelProgress.points.toLocaleString()} xal
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl px-4 py-2 text-center ${isDark ? 'bg-slate-800/70' : 'bg-slate-50'}`}>
                    <p className={`text-[11px] uppercase tracking-wide ${faint}`}>Sıranız</p>
                    <p className={`text-2xl font-bold tabular-nums ${me?.rank && me.rank <= 3 ? 'text-amber-500' : strong}`}>
                      {me?.rank ? `#${me.rank}` : '—'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { icon: ShoppingBag, label: 'Satış', value: me?.sales || 0, pts: me?.breakdown?.sales || 0, tone: 'text-indigo-500' },
                    { icon: CheckSquare, label: 'Tapşırıq', value: me?.tasksDone || 0, pts: me?.breakdown?.tasks || 0, tone: 'text-emerald-500' },
                    { icon: Flame, label: 'Tam gün', value: me?.perfectDays || 0, pts: me?.breakdown?.perfectDays || 0, tone: 'text-orange-500' },
                    { icon: Flag, label: 'Checkpoint', value: me?.checkpointsReached || 0, pts: me?.breakdown?.checkpoints || 0, tone: 'text-amber-500' },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <div className={`flex items-center gap-1.5 text-xs ${muted}`}>
                        <s.icon size={13} className={s.tone} /> {s.label}
                      </div>
                      <p className={`mt-1 text-lg font-semibold tabular-nums ${strong}`}>{s.value}</p>
                      <p className={`text-xs tabular-nums ${faint}`}>+{s.pts} xal</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1.5 font-medium ${muted}`}>
                      <Target size={13} className="text-amber-500" />
                      {nextCp ? `Növbəti checkpoint: ${nextCp.sales} satış (+${nextCp.bonus} xal)` : checkpoints.length ? 'Bütün checkpoint-lər keçildi 🎉' : 'Checkpoint təyin olunmayıb'}
                    </span>
                    {nextCp && <span className={faint}>{nextCp.remaining} satış qalıb</span>}
                  </div>
                  <div className={`mt-2 h-2.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${cpProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {/* ── Podium + table ── */}
              <div className="space-y-4 xl:col-span-2">
                <div className={`${card} overflow-hidden p-5`}>
                  <h2 className={`mb-6 flex items-center gap-2 text-base font-semibold ${strong}`}>
                    <Trophy size={18} className="text-amber-500" /> Həftənin liderləri
                  </h2>
                  <div className="mx-auto flex max-w-2xl items-end gap-2 sm:gap-4">
                    {PODIUM_ORDER.map((place) => (
                      <PodiumColumn key={place} place={place} entry={top[place]} prize={data.prizes?.[place]} isDark={isDark} onInfo={setBreakdownEntry} />
                    ))}
                  </div>
                  <div className={`-mx-5 -mb-5 h-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </div>

                <div className={`${card} overflow-hidden`}>
                  <div className={`flex items-center justify-between border-b px-4 py-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <h3 className={`text-sm font-semibold ${strong}`}>Reytinq cədvəli</h3>
                    <span className={`text-xs ${faint}`}>4-cü yerdən etibarən</span>
                  </div>
                  {rest.length === 0 ? (
                    <p className={`px-4 py-10 text-center text-sm ${muted}`}>
                      {board.length === 0 ? 'Bu həftə hələ heç kim xal toplamayıb.' : 'Hələlik yalnız ilk 3 yer doludur.'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'bg-slate-900 text-slate-500' : 'bg-slate-50/80 text-slate-500'}`}>
                            <th className="w-16 px-4 py-3 text-left">#</th>
                            <th className="px-4 py-3 text-left">İstifadəçi</th>
                            <th className="px-4 py-3 text-right">Satış</th>
                            <th className="px-4 py-3 text-right">Tapşırıq</th>
                            <th className="px-4 py-3 text-right">Checkpoint</th>
                            <th className="px-4 py-3 text-right">Xal</th>
                          </tr>
                        </thead>
                        <tbody className={isDark ? 'divide-y divide-slate-800' : 'divide-y divide-slate-100'}>
                          {rest.map((e) => (
                            <tr key={e.rank} className={e.isMe ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/70') : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/70'}>
                              <td className={`px-4 py-3 font-semibold tabular-nums ${muted}`}>{e.rank}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={e.displayName} size="h-8 w-8 text-xs" isDark={isDark} />
                                  <RankBadge level={e.level} />
                                  <span className={`font-medium ${strong}`}>
                                    {e.displayName}
                                    {e.isMe && <span className="ml-1.5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Siz</span>}
                                  </span>
                                  <InfoButton onClick={() => setBreakdownEntry(e)} isDark={isDark} label={e.displayName} />
                                </div>
                              </td>
                              <td className={`px-4 py-3 text-right tabular-nums ${muted}`}>{e.sales}</td>
                              <td className={`px-4 py-3 text-right tabular-nums ${muted}`}>{e.tasksDone}</td>
                              <td className={`px-4 py-3 text-right tabular-nums ${muted}`}>{e.checkpointsReached}</td>
                              <td className={`px-4 py-3 text-right font-semibold tabular-nums ${strong}`}>{e.points.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Rules, prizes, last week ── */}
              <div className="space-y-4">
                <div className={`${card} p-5`}>
                  <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${strong}`}>
                    <Sparkles size={16} className="text-indigo-500" /> Xal necə qazanılır
                  </h3>
                  <ul className="space-y-2.5 text-sm">
                    {[
                      [ShoppingBag, 'Hər satış', rules?.pointsPerSale, 'text-indigo-500'],
                      [CheckSquare, 'Hər bitirilən gündəlik tapşırıq', rules?.pointsPerTask, 'text-emerald-500'],
                      [Flame, 'Günün bütün tapşırıqları bitəndə', rules?.perfectDayBonus, 'text-orange-500'],
                    ].map(([Icon, label, pts, tone]) => (
                      <li key={label} className="flex items-center justify-between gap-3">
                        <span className={`flex items-center gap-2 ${muted}`}><Icon size={15} className={tone} /> {label}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>+{pts ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                  {checkpoints.length > 0 && (
                    <>
                      <p className={`mb-2 mt-5 text-xs font-semibold uppercase tracking-wider ${faint}`}>Həftəlik checkpoint-lər</p>
                      <ol className="space-y-2">
                        {checkpoints.map((c) => {
                          const reached = mySales >= c.sales;
                          return (
                            <li key={c.sales} className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${reached ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                              <span className={`flex items-center gap-2 ${reached ? 'text-emerald-600 dark:text-emerald-300' : muted}`}>
                                <Flag size={14} /> {c.sales} satış
                              </span>
                              <span className={`text-xs font-semibold ${reached ? 'text-emerald-600 dark:text-emerald-300' : strong}`}>+{c.bonus} xal{reached ? ' ✓' : ''}</span>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                </div>

                <div className={`${card} p-5`}>
                  <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${strong}`}>
                    <Gift size={16} className="text-rose-500" /> Həftənin mükafatları
                  </h3>
                  <div className="space-y-2">
                    {[1, 2, 3].map((place) => {
                      const prize = data.prizes?.[place];
                      const tier = TIER_STYLES[TIER_BY_PLACE[place]];
                      const credits = [
                        prize?.marketAnalysisCredits > 0 && `+${prize.marketAnalysisCredits} Market Analysis`,
                        prize?.trackingCredits > 0 && `+${prize.trackingCredits} Tracking`,
                      ].filter(Boolean);
                      return (
                        <div key={place} className={`flex items-center gap-3 rounded-xl border p-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${tier.light}, ${tier.main} 55%, ${tier.dark})` }}>
                            {place}
                          </span>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-semibold ${strong}`}>{prize?.title || PLACE_TEXT[place]}</p>
                            <p className={`truncate text-xs ${faint}`}>
                              {[...credits, `${tier.name} sertifikat`].join(' · ')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data.lastWeekWinners?.length > 0 && (
                  <div className={`${card} p-5`}>
                    <h3 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${strong}`}>
                      <Medal size={16} className="text-amber-500" /> Keçən həftənin qalibləri
                    </h3>
                    <ul className="space-y-2">
                      {data.lastWeekWinners.map((w) => (
                        <li key={w.place} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TIER_STYLES[w.tier]?.main }} />
                            <span className={strong}>{w.displayName}</span>
                          </span>
                          <span className={`tabular-nums ${muted}`}>{w.points} xal</span>
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
    </div>
  );
}
