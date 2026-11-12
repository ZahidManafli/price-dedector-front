import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Link } from 'react-router-dom';
import { Flag, Gift, Loader2, Plus, Save, Trash2, Trophy, Award, ExternalLink, Play } from 'lucide-react';
import { adminAPI } from '../services/api';
import { TIER_STYLES, formatAzDate } from './gamification/Certificate';

// Admin panel -> Gamification: scoring rules, weekly checkpoints, the prize for
// each place, the on/off switch for weekly awards and past results
// (backend services/gamification.js).

const TIER_BY_PLACE = { 1: 'gold', 2: 'silver', 3: 'bronze' };

export default function AdminGamificationTab({ isDark }) {
  const [settings, setSettings] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, w] = await Promise.all([adminAPI.getGamificationSettings(), adminAPI.listGamificationWeeks()]);
      setSettings(s?.data?.settings || null);
      setWeeks(Array.isArray(w?.data?.weeks) ? w.data.weeks : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Gamification ayarlarını yükləmək alınmadı');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (field, value) => setSettings((prev) => ({ ...prev, [field]: value }));
  const setPrize = (place, field, value) =>
    setSettings((prev) => ({ ...prev, prizes: { ...prev.prizes, [place]: { ...prev.prizes[place], [field]: value } } }));
  const setCheckpoint = (index, field, value) =>
    setSettings((prev) => ({ ...prev, checkpoints: prev.checkpoints.map((c, i) => (i === index ? { ...c, [field]: value } : c)) }));
  const addCheckpoint = () =>
    setSettings((prev) => {
      const last = prev.checkpoints[prev.checkpoints.length - 1];
      return { ...prev, checkpoints: [...prev.checkpoints, { sales: (Number(last?.sales) || 0) + 25, bonus: (Number(last?.bonus) || 0) + 200 }] };
    });
  const removeCheckpoint = (index) => setSettings((prev) => ({ ...prev, checkpoints: prev.checkpoints.filter((_, i) => i !== index) }));

  const save = async (next = settings) => {
    setSaving(true);
    setError('');
    try {
      const res = await adminAPI.saveGamificationSettings(next);
      setSettings(res?.data?.settings || next);
      Swal.fire({ icon: 'success', title: 'Yadda saxlanıldı', timer: 1300, showConfirmButton: false });
    } catch (err) {
      setError(err?.response?.data?.error || 'Yadda saxlamaq alınmadı');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    const next = { ...settings, enabled: !settings.enabled };
    if (next.enabled) {
      const ok = await Swal.fire({
        icon: 'question',
        title: 'Həftəlik mükafatlandırma aktiv edilsin?',
        text: 'Hər bazar günü saat 23:00-da (cron) həftənin ilk 3 yeri müəyyən olunacaq, mükafatlar verilib sertifikatlar yaradılacaq. İlk yekun bu həftənin sonunda olacaq.',
        showCancelButton: true,
        confirmButtonText: 'Aktiv et',
        cancelButtonText: 'Ləğv et',
        confirmButtonColor: '#4f46e5',
      });
      if (!ok.isConfirmed) return;
    }
    await save(next);
  };

  const finalizeNow = async () => {
    const ok = await Swal.fire({
      icon: 'warning',
      title: 'Həftə indi yekunlaşdırılsın?',
      text: 'Bazar günü cari həftə, digər günlər keçən həftə yekunlaşdırılır. İlk 3 yerə mükafat və sertifikat dərhal veriləcək. Hər həftə yalnız bir dəfə yekunlaşdırılır və bu geri qaytarılmır.',
      showCancelButton: true,
      confirmButtonText: 'Yekunlaşdır',
      cancelButtonText: 'Ləğv et',
      confirmButtonColor: '#e11d48',
    });
    if (!ok.isConfirmed) return;
    setFinalizing(true);
    try {
      const res = await adminAPI.finalizeGamificationWeek();
      const r = res?.data || {};
      if (r.skipped === 'already_finalized') {
        Swal.fire({ icon: 'info', title: 'Bu həftə artıq yekunlaşdırılıb' });
      } else {
        Swal.fire({ icon: 'success', title: 'Həftə yekunlaşdırıldı', text: `${(r.winners || []).length} qalib, ${r.participants || 0} iştirakçı` });
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Yekunlaşdırmaq alınmadı');
    } finally {
      setFinalizing(false);
    }
  };

  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const label = `mb-1 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const card = `rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';

  if (!settings) {
    return (
      <div className="flex justify-center py-16">
        {error ? <p className="text-sm text-rose-500">{error}</p> : <Loader2 className="animate-spin text-indigo-500" size={24} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <Trophy size={20} />
          </span>
          <div>
            <p className={`text-sm font-semibold ${strong}`}>
              Həftəlik mükafatlandırma: {settings.enabled ? <span className="text-emerald-500">aktiv</span> : <span className="text-slate-400">deaktiv</span>}
            </p>
            <p className={`text-xs ${muted}`}>
              {settings.enabled
                ? 'Hər bazar günü saat 23:00-da (Bakı, cron) həftənin ilk 3 yeri mükafatlandırılır.'
                : 'Reytinq canlı hesablanır və hamıya görünür, amma mükafat və sertifikat verilmir.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/gamification" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <ExternalLink size={14} /> Reytinqə bax
          </Link>
          <button type="button" onClick={finalizeNow} disabled={finalizing} className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-60">
            {finalizing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Həftəni yekunlaşdır
          </button>
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
              settings.enabled ? 'bg-slate-600 hover:bg-slate-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {settings.enabled ? 'Deaktiv et' : 'Aktiv et'}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Points */}
        <div className={card}>
          <h2 className={`mb-4 text-base font-semibold ${strong}`}>Xal qaydaları</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="gm-sale">Hər satış</label>
              <input id="gm-sale" type="number" min="0" className={input} value={settings.pointsPerSale} onChange={(e) => setField('pointsPerSale', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="gm-task">Hər tapşırıq</label>
              <input id="gm-task" type="number" min="0" className={input} value={settings.pointsPerTask} onChange={(e) => setField('pointsPerTask', e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="gm-day">Tam gün bonusu</label>
              <input id="gm-day" type="number" min="0" className={input} value={settings.perfectDayBonus} onChange={(e) => setField('perfectDayBonus', e.target.value)} />
            </div>
          </div>
          <p className={`mt-2 text-xs ${muted}`}>
            Satış: Checkila-nın aşkar etdiyi yeni eBay sifarişi. Tam gün: həmin günün bütün gündəlik tapşırıqları bitirilib.
          </p>

          <div className="mb-2 mt-6 flex items-center justify-between">
            <h3 className={`flex items-center gap-2 text-sm font-semibold ${strong}`}>
              <Flag size={15} className="text-amber-500" /> Həftəlik checkpoint-lər
            </h3>
            <button type="button" onClick={addCheckpoint} disabled={settings.checkpoints.length >= 10} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:underline disabled:opacity-40">
              <Plus size={13} /> Əlavə et
            </button>
          </div>
          <div className="space-y-2">
            {settings.checkpoints.length === 0 && <p className={`text-sm ${muted}`}>Checkpoint yoxdur.</p>}
            {settings.checkpoints.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="relative">
                    <input type="number" min="1" className={`${input} pr-14`} value={c.sales} onChange={(e) => setCheckpoint(i, 'sales', e.target.value)} aria-label="Satış sayı" />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs ${muted}`}>satış</span>
                  </div>
                </div>
                <span className={muted}>→</span>
                <div className="flex-1">
                  <div className="relative">
                    <input type="number" min="0" className={`${input} pr-10`} value={c.bonus} onChange={(e) => setCheckpoint(i, 'bonus', e.target.value)} aria-label="Bonus xal" />
                    <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs ${muted}`}>xal</span>
                  </div>
                </div>
                <button type="button" onClick={() => removeCheckpoint(i)} aria-label="Sil" className={`rounded-lg p-2 ${isDark ? 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-300' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prizes */}
        <div className={card}>
          <h2 className={`mb-4 flex items-center gap-2 text-base font-semibold ${strong}`}>
            <Gift size={18} className="text-rose-500" /> Mükafatlar
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((place) => {
              const tier = TIER_STYLES[TIER_BY_PLACE[place]];
              const prize = settings.prizes[place];
              return (
                <div key={place} className={`rounded-xl border p-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`} style={{ borderLeft: `4px solid ${tier.main}` }}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${tier.light}, ${tier.main} 55%, ${tier.dark})` }}>
                      {place}
                    </span>
                    <span className={`text-sm font-semibold ${strong}`}>{place}-ci yer · {tier.name} sertifikat</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className={label}>Mükafatın adı</label>
                      <input className={input} value={prize.title} maxLength={200} onChange={(e) => setPrize(place, 'title', e.target.value)} placeholder="Məs: 1 aylıq pulsuz abunə" />
                    </div>
                    <div className="sm:col-span-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className={label}>Market Analysis krediti</label>
                        <input type="number" min="0" className={input} value={prize.marketAnalysisCredits} onChange={(e) => setPrize(place, 'marketAnalysisCredits', e.target.value)} />
                      </div>
                      <div>
                        <label className={label}>Tracking krediti</label>
                        <input type="number" min="0" className={input} value={prize.trackingCredits} onChange={(e) => setPrize(place, 'trackingCredits', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={`mt-3 text-xs ${muted}`}>
            Kreditlər qalibin hesabına avtomatik əlavə olunur. Kreditsiz mükafat (məs. fiziki hədiyyə) üçün kreditləri 0 qoyun — qalib bildiriş və sertifikat alır, mükafatı siz təqdim edirsiniz.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => save()} disabled={saving} className="btn-primary inline-flex items-center gap-2 px-5 disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Yadda saxla
        </button>
      </div>

      {/* Past weeks */}
      <div className={card}>
        <h2 className={`mb-4 flex items-center gap-2 text-base font-semibold ${strong}`}>
          <Award size={18} className="text-amber-500" /> Yekunlaşdırılmış həftələr
        </h2>
        {weeks.length === 0 ? (
          <p className={`text-sm ${muted}`}>Hələ yekunlaşdırılmış həftə yoxdur.</p>
        ) : (
          <ul className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
            {weeks.map((w) => (
              <li key={w.weekStart} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                <span className={`w-40 text-sm font-medium ${strong}`}>{formatAzDate(w.weekStart)} həftəsi</span>
                <div className="flex flex-1 flex-wrap gap-3">
                  {(w.results?.winners || []).length === 0 ? (
                    <span className={`text-sm ${muted}`}>Qalib yoxdur (heç kim xal toplamayıb)</span>
                  ) : (
                    w.results.winners.map((winner) => (
                      <span key={winner.place} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                        <span className="h-2 w-2 rounded-full" style={{ background: TIER_STYLES[winner.tier]?.main }} />
                        {winner.place}. {winner.displayName} · {winner.points} xal
                      </span>
                    ))
                  )}
                </div>
                <span className={`text-xs ${muted}`}>{w.results?.participants ?? 0} iştirakçı</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
