import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { EyeOff, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { whatsNewAPI } from '../services/api';
import { CATEGORY_META, PostCard, formatPostDate } from './whatsNew/WhatsNewPanel';

// Admin panel -> Yeniliklər: write the announcements users see in the sidebar's
// "What's new" panel (backend routes/whatsNew.js). Live preview uses the same
// PostCard the panel renders.

const CATEGORY_LABELS = {
  feature: 'Yeni funksiya',
  improvement: 'Təkmilləşmə',
  fix: 'Düzəliş',
  announcement: 'Elan',
};

// datetime-local wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(iso) {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const emptyForm = () => ({
  id: null,
  title: '',
  body: '',
  category: 'feature',
  linkUrl: '',
  linkLabel: '',
  isPublished: true,
  publishedAt: toLocalInput(null),
});

export default function AdminWhatsNewTab({ isDark }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await whatsNewAPI.adminList();
      setPosts(Array.isArray(res?.data?.posts) ? res.data.posts : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Yenilikləri yükləmək alınmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e?.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEdit = (post) => {
    setError('');
    setForm({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      linkUrl: post.linkUrl || '',
      linkLabel: post.linkLabel || '',
      isPublished: post.isPublished,
      publishedAt: toLocalInput(post.publishedAt),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      body: form.body,
      category: form.category,
      linkUrl: form.linkUrl,
      linkLabel: form.linkLabel,
      isPublished: form.isPublished,
      publishedAt: new Date(form.publishedAt).toISOString(),
    };
    try {
      if (form.id) await whatsNewAPI.adminUpdate(form.id, payload);
      else await whatsNewAPI.adminCreate(payload);
      setForm(emptyForm());
      await load();
      Swal.fire({ icon: 'success', title: form.id ? 'Yenilik yeniləndi' : 'Yenilik dərc olundu', timer: 1400, showConfirmButton: false });
    } catch (err) {
      setError(err?.response?.data?.error || 'Yadda saxlamaq alınmadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Yeniliyi silmək?',
      text: post.title,
      showCancelButton: true,
      confirmButtonText: 'Sil',
      cancelButtonText: 'Ləğv et',
      confirmButtonColor: '#e11d48',
    });
    if (!result.isConfirmed) return;
    try {
      await whatsNewAPI.adminDelete(post.id);
      if (form.id === post.id) setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Silmək alınmadı');
    }
  };

  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-indigo-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const label = `mb-1 block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const card = `rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`;
  const previewPost = {
    id: 'preview',
    title: form.title || 'Başlıq burada görünəcək',
    body: form.body || 'Mətn burada görünəcək.\n\n- Siyahı üçün sətrin əvvəlinə "- " yazın',
    category: form.category,
    linkUrl: form.linkUrl || null,
    linkLabel: form.linkLabel || null,
    publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
    isNew: true,
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <form onSubmit={handleSave} className={card}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className={`flex items-center gap-2 text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Sparkles size={18} className="text-indigo-500" />
              {form.id ? 'Yeniliyi redaktə et' : 'Yeni yenilik'}
            </h2>
            {form.id && (
              <button type="button" onClick={() => setForm(emptyForm())} className="text-xs font-semibold text-indigo-500 hover:underline">
                Yenisini yarat
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="wn-title">Başlıq</label>
              <input id="wn-title" value={form.title} onChange={set('title')} maxLength={200} required className={input} placeholder="Məs: Sifarişlərin bütöv tarixçəsi" />
            </div>
            <div>
              <label className={label} htmlFor="wn-body">Mətn</label>
              <textarea id="wn-body" value={form.body} onChange={set('body')} maxLength={5000} required rows={8} className={`${input} leading-relaxed`} />
              <p className={`mt-1 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Boş sətir yeni abzas açır. Sətrin əvvəlinə "- " yazsanız siyahı olur.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="wn-category">Kateqoriya</label>
                <select id="wn-category" value={form.category} onChange={set('category')} className={input}>
                  {Object.entries(CATEGORY_LABELS).map(([key, text]) => (
                    <option key={key} value={key}>{text}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="wn-date">Dərc tarixi</label>
                <input id="wn-date" type="datetime-local" value={form.publishedAt} onChange={set('publishedAt')} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="wn-link">Link (istəyə bağlı)</label>
                <input id="wn-link" value={form.linkUrl} onChange={set('linkUrl')} className={input} placeholder="/dashboard və ya https://…" />
              </div>
              <div>
                <label className={label} htmlFor="wn-link-label">Düymə mətni</label>
                <input id="wn-link-label" value={form.linkLabel} onChange={set('linkLabel')} maxLength={80} className={input} placeholder="Məs: Panelə keç" disabled={!form.linkUrl} />
              </div>
            </div>
            <label className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} className="h-4 w-4 rounded" />
              Dərc olunsun (söndürsəniz qaralama kimi qalır)
            </label>
          </div>

          {error && <p className="mt-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60">
              <Plus size={16} />
              {saving ? 'Yadda saxlanılır…' : form.id ? 'Yadda saxla' : 'Dərc et'}
            </button>
          </div>
        </form>

        <div className={card}>
          <p className={`mb-3 text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Önizləmə</p>
          <PostCard post={previewPost} isDark={isDark} />
        </div>
      </div>

      <div className={card}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className={`text-base font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Bütün yeniliklər ({posts.length})</h2>
          <button type="button" onClick={load} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Yenilə
          </button>
        </div>
        {!loading && posts.length === 0 && <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hələ yenilik yoxdur.</p>}
        <ul className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
          {posts.map((post) => {
            const meta = CATEGORY_META[post.category] || CATEGORY_META.feature;
            const scheduled = post.isPublished && post.publishedAt && new Date(post.publishedAt) > new Date();
            return (
              <li key={post.id} className="flex items-center gap-3 py-3">
                <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${isDark ? meta.dark : meta.light}`}>
                  {CATEGORY_LABELS[post.category] || post.category}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{post.title}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {formatPostDate(post.publishedAt, 'az')}
                    {!post.isPublished && <span className="ml-2 inline-flex items-center gap-1 text-amber-500"><EyeOff size={11} /> Qaralama</span>}
                    {scheduled && <span className="ml-2 text-sky-500">Planlaşdırılıb</span>}
                  </p>
                </div>
                <button type="button" onClick={() => handleEdit(post)} aria-label="Redaktə et" className={`rounded-lg p-2 transition ${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Pencil size={15} />
                </button>
                <button type="button" onClick={() => handleDelete(post)} aria-label="Sil" className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-500/10">
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
