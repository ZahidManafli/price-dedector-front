import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Check, Loader2, Lock, Truck, Trophy } from 'lucide-react';
import { gamificationAPI } from '../../services/api';
import RankBadge, { rankMeta } from './RankBadge';

// Settings -> Rütbə: the user's rank, progress to the next one, and the ladder
// of ranks with what each level-up pays (backend GET /gamification/level).

export default function RankSection({ isDark }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    gamificationAPI
      .level()
      .then((res) => setData(res?.data || null))
      .catch((err) => setError(err?.response?.data?.error || 'Rütbə məlumatını yükləmək alınmadı'));
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

  const meta = rankMeta(data.level);
  const next = rankMeta(data.level + 1);
  const fmt = (n) => Number(n || 0).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Current rank */}
      <div className="glass-card overflow-hidden">
        <div className="p-5 md:p-6" style={{ background: `linear-gradient(135deg, ${meta.from}22, transparent 60%)` }}>
          <div className="flex flex-wrap items-center gap-5">
            <RankBadge level={data.level} size="lg" showLevel />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold uppercase tracking-wider ${faint}`}>Rütbəniz</p>
              <h2 className={`text-2xl font-bold ${strong}`}>{meta.name}</h2>
              <p className={`text-sm ${muted}`}>
                Səviyyə {data.level} · {fmt(data.points)} ümumi xal
              </p>
            </div>
            <Link to="/gamification" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <Trophy size={14} /> Reytinqə bax
            </Link>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={`font-medium ${strong}`}>
                Növbəti rütbə: <span style={{ color: next.to }}>{next.name}</span> (Səviyyə {data.level + 1})
              </span>
              <span className={`tabular-nums ${muted}`}>
                {fmt(data.points)} / {fmt(data.nextLevelAt)} xal
              </span>
            </div>
            <div className={`h-3 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200/80'}`}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${data.progress}%`, background: `linear-gradient(90deg, ${meta.from}, ${next.to})` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className={muted}>
                Daha <span className={`font-semibold ${strong}`}>{fmt(data.toNext)} xal</span> toplayın
              </span>
              <span className={`inline-flex flex-wrap items-center gap-2 text-xs font-semibold`}>
                <span className={muted}>Mükafat:</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                  <BarChart3 size={12} /> +{data.nextReward.marketAnalysisCredits} Market Analysis
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Truck size={12} /> +{data.nextReward.trackingCredits} Tracking
                </span>
              </span>
            </div>
          </div>
        </div>
        {!data.enabled && (
          <p className={`border-t px-5 py-3 text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
            Rütbə mükafatları hələ aktiv deyil — aktiv olanda keçdiyiniz səviyyələrin kreditləri hesabınıza əlavə olunacaq.
          </p>
        )}
      </div>

      {/* Ladder */}
      <div className="glass-card p-5 md:p-6">
        <h3 className={`mb-1 text-base font-semibold ${strong}`}>Rütbə pillələri</h3>
        <p className={`mb-4 text-sm ${muted}`}>
          Hər satış və bitirdiyiniz hər tapşırıq ümumi xalınıza əlavə olunur. Hər yeni səviyyəyə keçid əvvəlkindən 1 000 xal çox tələb edir, mükafat da hər səviyyədə artır.
        </p>
        <ol className="space-y-2">
          {data.ladder.map((step) => {
            const isCurrent = step.level === data.level;
            return (
              <li
                key={step.level}
                className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                  isCurrent
                    ? isDark ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-indigo-300 bg-indigo-50/70'
                    : isDark ? 'border-slate-800' : 'border-slate-100'
                } ${!step.reached && !isCurrent ? 'opacity-75' : ''}`}
              >
                <RankBadge level={step.level} size="md" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${strong}`}>
                    {step.name}
                    {isCurrent && <span className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">Siz buradasınız</span>}
                  </p>
                  <p className={`text-xs tabular-nums ${faint}`}>Səviyyə {step.level} · {fmt(step.pointsAt)} xal</p>
                </div>
                {step.level > 1 ? (
                  <span className={`text-xs tabular-nums ${muted}`}>
                    +{step.reward.marketAnalysisCredits} Market Analysis · +{step.reward.trackingCredits} Tracking
                  </span>
                ) : (
                  <span className={`text-xs ${faint}`}>Başlanğıc</span>
                )}
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${step.reached ? 'bg-emerald-500 text-white' : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                  {step.reached ? <Check size={13} /> : <Lock size={12} />}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
