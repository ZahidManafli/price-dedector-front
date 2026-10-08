/**
 * components/AdminReviewsTab.jsx
 *
 * Drop this into your AdminPanelPage as:
 *   {!loading && activeTab === 'reviews' && <AdminReviewsTab />}
 *
 * Lets the admin add/edit/delete multiple customer reviews/testimonials:
 * full name, star rating (1-5), positive/negative sentiment, and review text.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  PlusCircle, Pencil, Trash2, X, Check, Loader2, Star,
  ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { reviewsAPI } from '../services/api';

const EMPTY_FORM = {
  fullName: '',
  rating: 5,
  sentiment: 'positive',
  reviewText: '',
  sortOrder: '',
  isPublished: true,
};

function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5"
          title={`${n} ulduz`}
        >
          <Star
            size={22}
            className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
          />
        </button>
      ))}
    </div>
  );
}

function SentimentPicker({ value, onChange, isDark }) {
  return (
    <div className={`inline-flex rounded-lg p-0.5 gap-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
      <button
        type="button"
        onClick={() => onChange('positive')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
          value === 'positive'
            ? 'bg-emerald-600 text-white shadow-sm'
            : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <ThumbsUp size={11} /> Pozitiv
      </button>
      <button
        type="button"
        onClick={() => onChange('negative')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
          value === 'negative'
            ? 'bg-rose-600 text-white shadow-sm'
            : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <ThumbsDown size={11} /> Negativ
      </button>
    </div>
  );
}

export default function AdminReviewsTab() {
  const { isDark } = useTheme();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const [modal, setModal]   = useState(null); // null | 'create' | 'edit'
  const [form, setForm]     = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const card  = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const input = `block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;
  const label = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewsAPI.list();
      setReviews(res?.data?.reviews || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('create');
  };

  const openEdit = (review) => {
    setForm({
      fullName: review.full_name || '',
      rating: Number(review.rating) || 5,
      sentiment: review.sentiment || 'positive',
      reviewText: review.review_text || '',
      sortOrder: review.sort_order ?? '',
      isPublished: Boolean(review.is_published),
    });
    setEditId(review.id);
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditId(null); };

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return Swal.fire('Error', 'Ad və soyad tələb olunur', 'error');

    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName.trim(),
        rating: form.rating,
        sentiment: form.sentiment,
        reviewText: form.reviewText?.trim() || '',
        sortOrder: form.sortOrder !== '' ? Number(form.sortOrder) : 0,
        isPublished: form.isPublished,
      };

      if (modal === 'create') {
        await reviewsAPI.create(payload);
      } else {
        await reviewsAPI.update(editId, payload);
      }

      closeModal();
      await loadReviews();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (review) => {
    const result = await Swal.fire({
      title: 'Rəyi sil?',
      text: `"${review.full_name}" adlı rəy silinəcək.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sil',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      await reviewsAPI.remove(review.id);
      await loadReviews();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Rəylər</h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <PlusCircle size={16} /> Rəy əlavə et
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : reviews.length === 0 ? (
        <div className={`rounded-xl border p-8 text-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hələ heç bir rəy əlavə edilməyib.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className={`rounded-xl border p-4 flex items-start gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {review.full_name}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        className={n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                      />
                    ))}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      review.sentiment === 'positive'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    {review.sentiment === 'positive' ? <ThumbsUp size={9} /> : <ThumbsDown size={9} />}
                    {review.sentiment === 'positive' ? 'Pozitiv' : 'Negativ'}
                  </span>
                  {!review.is_published && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded px-1.5 py-0.5">
                      DRAFT
                    </span>
                  )}
                </div>
                {review.review_text && (
                  <p className={`text-sm mt-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{review.review_text}</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(review)}
                  title="Redaktə et"
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(review)}
                  title="Sil"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh] ${card}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">
                {modal === 'create' ? 'Yeni rəy əlavə et' : 'Rəyi redaktə et'}
              </h3>
              <button onClick={closeModal} className="p-1 rounded hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={label}>Ad və soyad *</label>
                <input
                  name="fullName"
                  value={form.fullName}
                  onChange={handleField}
                  className={input}
                  placeholder="məsələn: Elvin Məmmədov"
                />
              </div>

              <div>
                <label className={label}>Ulduz sayı</label>
                <StarPicker value={form.rating} onChange={(rating) => setForm((prev) => ({ ...prev, rating }))} />
              </div>

              <div>
                <label className={label}>Rəyin tipi</label>
                <SentimentPicker
                  value={form.sentiment}
                  onChange={(sentiment) => setForm((prev) => ({ ...prev, sentiment }))}
                  isDark={isDark}
                />
              </div>

              <div>
                <label className={label}>Rəy mətni</label>
                <textarea
                  name="reviewText"
                  value={form.reviewText}
                  onChange={handleField}
                  rows={3}
                  className={`${input} resize-none`}
                  placeholder="Müştərinin rəyi…"
                />
              </div>

              <div>
                <label className={label}>Sıra nömrəsi</label>
                <input
                  name="sortOrder"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={handleField}
                  className={input}
                  placeholder="0"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isPublished"
                  checked={form.isPublished}
                  onChange={handleField}
                  className="w-4 h-4 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Dərc edilib (görünən)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                Ləğv et
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Yadda saxlanılır…' : 'Yadda saxla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
