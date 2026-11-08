import React, { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { BarChart3, Gift, RefreshCw, RotateCcw, Send, Truck, Users } from 'lucide-react';
import { adminAPI } from '../services/api';

// Admin panel -> Hədiyyə: give Market Analysis / Tracking credits to users with a
// title + message. On confirm the backend (services/gifts.js) adds the credits and
// notifies every recipient in-app, by email and on Telegram, in the background.

const emptyForm = () => ({
  title: '',
  message: '',
  marketAnalysisCredits: '',
  trackingCredits: '',
  audience: 'all',
  emails: '',
  activePlanOnly: true,
});

const STATUS_META = {
  sending: { label: 'Göndərilir', light: 'bg-amber-50 text-amber-700', dark: 'bg-amber-500/15 text-amber-300' },
  sent: { label: 'Göndərildi', light: 'bg-emerald-50 text-emerald-700', dark: 'bg-emerald-500/15 text-emerald-300' },
  failed: { label: 'Xəta', light: 'bg-rose-50 text-rose-700', dark: 'bg-rose-500/15 text-rose-300' },
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function creditsSummary(gift) {
  const parts = [];
  if (gift.marketAnalysisCredits > 0) parts.push(`+${gift.marketAnalysisCredits} Market Analysis`);
  if (gift.trackingCredits > 0) parts.push(`+${gift.trackingCredits} Tracking`);
  return parts.join(' · ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export default function AdminGiftsTab({ isDark }) {
  const [form, setForm] = useState(emptyForm);
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.listGifts();
      setGifts(Array.isArray(res?.data?.gifts) ? res.data.gifts : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Hədiyyələri yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // While a gift is still going out, refresh its progress every few seconds.
  const anySending = gifts.some((g) => g.status === 'sending');
  useEffect(() => {
    if (!anySending) return undefined;
    pollRef.current = setInterval(load, 4000);
    return () => clearInterval(pollRef.current);
  }, [anySending, load]);

  const set = (field) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const payload = () => ({
    title: form.title,
    message: form.message,
    marketAnalysisCredits: Number(form.marketAnalysisCredits) || 0,
    trackingCredits: Number(form.trackingCredits) || 0,
    audience: form.audience,
    emails: form.audience === 'emails' ? form.emails : '',
    activePlanOnly: form.activePlanOnly,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const body = payload();
      const preview = (await adminAPI.previewGift(body))?.data || {};
      const count = Number(preview.recipientCount || 0);
      if (count === 0) {
        setError('Bu şərtlərə uyğun istifadəçi tapılmadı.');
        return;
      }
      const notMatched = Array.isArray(preview.notMatched) ? preview.notMatched : [];
      const credits = creditsSummary(body);
      const confirm = await Swal.fire({
        icon: 'question',
        title: 'Hədiyyəni təsdiqləyirsiniz?',
        html:
          `<div style="text-align:left;font-size:14px;line-height:1.6">` +
          `<p><b>${escapeHtml(body.title)}</b></p>` +
          `<p style="margin-top:6px">Alıcı sayı: <b>${count}</b></p>` +
          `<p>Hər istifadəçiyə: <b>${escapeHtml(credits)}</b></p>` +
          (notMatched.length
            ? `<p style="margin-top:8px;color:#b45309">Tapılmayan və ya şərtə uyğun olmayan email (${notMatched.length}): ${escapeHtml(notMatched.slice(0, 10).join(', '))}${notMatched.length > 10 ? '…' : ''}</p>`
            : '') +
          `<p style="margin-top:8px;color:#64748b">Kreditlər dərhal əlavə olunacaq, istifadəçilərə bildiriş, email və Telegram mesajı gedəcək. Bu əməliyyat geri qaytarılmır.</p>` +
          `</div>`,
        showCancelButton: true,
        confirmButtonText: 'Təsdiqlə və göndər',
        cancelButtonText: 'Ləğv et',
        confirmButtonColor: '#4f46e5',
      });
      if (!confirm.isConfirmed) return;

      const res = await adminAPI.createGift(body);
      setForm(emptyForm());
      await load();
      Swal.fire({
        icon: 'success',
        title: 'Hədiyyə göndərilir',
        text: `${res?.data?.recipientCount || count} istifadəçiyə arxa planda göndərilir.`,
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Hədiyyəni göndərmək alınmadı');
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async (gift) => {
    try {
      await adminAPI.retryGift(gift.id);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Yenidən cəhd alınmadı');
    }
  };

  const handleShowRecipients = async (gift) => {
    try {
      const res = await adminAPI.listGiftRecipients(gift.id);
      const list = Array.isArray(res?.data?.recipients) ? res.data.recipients : [];
      const statusText = { granted: '✓', pending: '…', failed: '✕' };
      Swal.fire({
        title: `Alıcılar (${list.length})`,
        width: 640,
        html:
          `<div style="max-height:360px;overflow:auto;text-align:left;font-size:13px">` +
          list
            .map(
              (r) =>
                `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #e2e8f0">` +
                `<span style="width:16px">${statusText[r.status] || ''}</span>` +
                `<span style="flex:1">${escapeHtml(r.name || '')} <span style="color:#64748b">${escapeHtml(r.email || '')}</span>` +
                `${r.error ? `<br><span style="color:#be123c">${escapeHtml(r.error)}</span>` : ''}</span></div>`
            )
            .join('') +
          `</div>`,
        confirmButtonText: 'Bağla',
      });
    } catch (err) {
      setError(err?.response?.data?.error || 'Alıcıları yükləmək alınmadı');
    }
  };

  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const label = `mb-1 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const card = `rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const segment = (active) =>
    `flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
      active ? 'bg-indigo-600 text-white' : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
    }`;
  const hasCredits = Number(form.marketAnalysisCredits) > 0 || Number(form.trackingCredits) > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <form onSubmit={handleSubmit} className={`${card} xl:col-span-3`}>
          <h2 className={`mb-4 flex items-center gap-2 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <Gift size={18} className="text-indigo-500" />
            Yeni hədiyyə
          </h2>

          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="gift-title">Başlıq</label>
              <input id="gift-title" value={form.title} onChange={set('title')} maxLength={200} required className={input} placeholder="Məs: Novruz bayramınız mübarək!" />
            </div>
            <div>
              <label className={label} htmlFor="gift-message">Mətn</label>
              <textarea id="gift-message" value={form.message} onChange={set('message')} maxLength={5000} required rows={6} className={`${input} leading-relaxed`} placeholder="İstifadəçilərə göstəriləcək mesaj" />
              <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Hədiyyə olunan kreditlər mətnin altına avtomatik əlavə olunur.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="gift-ma">
                  <span className="inline-flex items-center gap-1"><BarChart3 size={13} /> Market Analysis krediti</span>
                </label>
                <input id="gift-ma" type="number" min="0" step="1" value={form.marketAnalysisCredits} onChange={set('marketAnalysisCredits')} className={input} placeholder="0" />
              </div>
              <div>
                <label className={label} htmlFor="gift-tr">
                  <span className="inline-flex items-center gap-1"><Truck size={13} /> Tracking krediti</span>
                </label>
                <input id="gift-tr" type="number" min="0" step="1" value={form.trackingCredits} onChange={set('trackingCredits')} className={input} placeholder="0" />
              </div>
            </div>

            <div>
              <span className={label}>Kimlərə</span>
              <div className={`flex gap-1 rounded-xl p-1 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
                <button type="button" className={segment(form.audience === 'all')} onClick={() => set('audience')('all')}>
                  <Users size={15} /> Bütün istifadəçilər
                </button>
                <button type="button" className={segment(form.audience === 'emails')} onClick={() => set('audience')('emails')}>
                  <Send size={15} /> Seçilmiş istifadəçilər
                </button>
              </div>
              {form.audience === 'emails' && (
                <textarea
                  value={form.emails}
                  onChange={set('emails')}
                  rows={3}
                  className={`${input} mt-2`}
                  placeholder="Email ünvanları, vergül və ya yeni sətirlə ayırın"
                />
              )}
            </div>

            <label className={`flex items-start gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <input type="checkbox" checked={form.activePlanOnly} onChange={set('activePlanOnly')} className="mt-0.5 h-4 w-4 rounded" />
              <span>
                Yalnız aktiv planı olanlar
                <span className={`block text-[11px] ${muted}`}>Planı bitmiş istifadəçinin kreditləri yeniləmədə sıfırlanır, hədiyyə itər.</span>
              </span>
            </label>
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

          <div className="mt-5">
            <button type="submit" disabled={sending || !hasCredits} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60">
              <Gift size={16} />
              {sending ? 'Yoxlanılır…' : 'Hədiyyəni göndər'}
            </button>
          </div>
        </form>

        <div className={`${card} xl:col-span-2`}>
          <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>İstifadəçi belə görəcək</p>
          <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-500">
                <Gift size={18} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{form.title || 'Başlıq'}</p>
                <p className={`mt-1 whitespace-pre-line text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{form.message || 'Mətn burada görünəcək.'}</p>
                {hasCredits && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Number(form.marketAnalysisCredits) > 0 && (
                      <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold text-indigo-500">
                        +{Number(form.marketAnalysisCredits)} Market Analysis
                      </span>
                    )}
                    {Number(form.trackingCredits) > 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                        +{Number(form.trackingCredits)} Tracking
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className={`mt-3 text-xs ${muted}`}>Bildiriş, email və Telegram mesajı (bağlıdırsa) eyni məzmunla gedir.</p>
        </div>
      </div>

      <div className={card}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Göndərilmiş hədiyyələr ({gifts.length})</h2>
          <button type="button" onClick={load} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Yenilə
          </button>
        </div>
        {!loading && gifts.length === 0 && <p className={`text-sm ${muted}`}>Hələ hədiyyə göndərilməyib.</p>}
        <ul className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
          {gifts.map((gift) => {
            const meta = STATUS_META[gift.status] || STATUS_META.sending;
            const done = gift.grantedCount + gift.failedCount;
            const pct = gift.recipientCount ? Math.round((done / gift.recipientCount) * 100) : 0;
            return (
              <li key={gift.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isDark ? meta.dark : meta.light}`}>{meta.label}</span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{gift.title}</p>
                  <p className={`text-xs ${muted}`}>
                    {creditsSummary(gift)} · {gift.audience === 'emails' ? 'Seçilmiş istifadəçilər' : 'Bütün istifadəçilər'} · {formatDate(gift.createdAt)}
                  </p>
                  {gift.status === 'sending' && (
                    <div className={`mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                <div className={`text-right text-xs ${muted}`}>
                  <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{gift.grantedCount}</span>/{gift.recipientCount} alıb
                  {gift.failedCount > 0 && <span className="ml-1 text-rose-500">· {gift.failedCount} xəta</span>}
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => handleShowRecipients(gift)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                    Alıcılar
                  </button>
                  {(gift.status === 'failed' || gift.failedCount > 0) && gift.status !== 'sending' && (
                    <button type="button" onClick={() => handleRetry(gift)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-500 hover:bg-indigo-500/10">
                      <RotateCcw size={12} /> Yenidən
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
