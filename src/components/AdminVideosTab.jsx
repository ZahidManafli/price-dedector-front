/**
 * components/AdminVideosTab.jsx
 *
 * Drop this into your AdminPanelPage as:
 *   {!loading && activeTab === 'videos' && <AdminVideosTab />}
 *
 * Requires learningAPI to be added to your api.js service file:
 *   export const learningAPI = {
 *     list:          () => api.get('/learning-videos'),
 *     get:           (id) => api.get(`/learning-videos/${id}`),
 *     create:        (data) => api.post('/learning-videos', data),
 *     update:        (id, data) => api.put(`/learning-videos/${id}`, data),
 *     remove:        (id) => api.delete(`/learning-videos/${id}`),
 *     deleteComment: (videoId, commentId) => api.delete(`/learning-videos/${videoId}/comments/${commentId}`),
 *   };
 */

import React, { useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  PlusCircle, Pencil, Trash2, Eye, EyeOff,
  GripVertical, MessageSquare, ThumbsUp, X, Check, Loader2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { learningAPI } from '../services/api';

const EMPTY_FORM = {
  title: '',
  description: '',
  video_url: '',
  thumbnail_url: '',
  duration_seconds: '',
  sort_order: '',
  is_published: true,
};

function fmtDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminVideosTab() {
  const { isDark } = useTheme();

  const [videos,      setVideos]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState(null);

  // Modal state
  const [modal,       setModal]       = useState(null);   // null | 'create' | 'edit'
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);

  // Comments drawer
  const [commentsFor, setCommentsFor] = useState(null);  // video object | null
  const [comments,    setComments]    = useState([]);
  const [commLoading, setCommLoading] = useState(false);

  const card  = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const input = `block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;
  const label = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learningAPI.list();
      setVideos(res?.data?.videos || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModal('create');
  };

  const openEdit = (video) => {
    setForm({
      title:            video.title || '',
      description:      video.description || '',
      video_url:        video.video_url || '',
      thumbnail_url:    video.thumbnail_url || '',
      duration_seconds: video.duration_seconds ?? '',
      sort_order:       video.sort_order ?? '',
      is_published:     Boolean(video.is_published),
    });
    setEditId(video.id);
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditId(null); };

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!form.title.trim())     return Swal.fire('Error', 'Title is required', 'error');
    if (!form.video_url.trim()) return Swal.fire('Error', 'Video URL is required', 'error');

    setSaving(true);
    try {
      const payload = {
        ...form,
        duration_seconds: form.duration_seconds !== '' ? Number(form.duration_seconds) : null,
        sort_order:        form.sort_order       !== '' ? Number(form.sort_order)       : 0,
      };

      if (modal === 'create') {
        await learningAPI.create(payload);
      } else {
        await learningAPI.update(editId, payload);
      }

      closeModal();
      await loadVideos();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (video) => {
    const result = await Swal.fire({
      title: 'Delete video?',
      text:  `"${video.title}" and all its comments will be permanently removed.`,
      icon:  'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      await learningAPI.remove(video.id);
      await loadVideos();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    }
  };

  // ── Comments drawer ─────────────────────────────────────────────────────────
  const openComments = async (video) => {
    setCommentsFor(video);
    setCommLoading(true);
    try {
      const res = await learningAPI.get(video.id);
      setComments(res?.data?.comments || []);
    } catch {
      setComments([]);
    } finally {
      setCommLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await learningAPI.deleteComment(commentsFor.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
          Learning Videos
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
        >
          <PlusCircle size={16} /> Add Video
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Video list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : videos.length === 0 ? (
        <div className={`rounded-xl border p-8 text-center ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No videos yet. Add your first learning video.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className={`rounded-xl border p-4 flex items-start gap-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-slate-700 flex items-center justify-center">
                {video.thumbnail_url ? (
                  <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-slate-400">No thumb</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-semibold text-sm truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {video.title}
                  </span>
                  {!video.is_published && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 rounded px-1.5 py-0.5">
                      DRAFT
                    </span>
                  )}
                </div>
                {video.description && (
                  <p className={`text-xs mt-0.5 line-clamp-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {video.description}
                  </p>
                )}
                <div className={`flex items-center gap-3 mt-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="flex items-center gap-1"><ThumbsUp size={11} /> {video.like_count || 0}</span>
                  <span className="flex items-center gap-1"><MessageSquare size={11} /> {video.comment_count || 0}</span>
                  {video.duration_seconds && <span>{fmtDuration(video.duration_seconds)}</span>}
                  <span>Order: {video.sort_order}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openComments(video)}
                  title="View comments"
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <MessageSquare size={15} />
                </button>
                <button
                  onClick={() => openEdit(video)}
                  title="Edit"
                  className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(video)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className={`w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh] ${card}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">
                {modal === 'create' ? 'Add New Video' : 'Edit Video'}
              </h3>
              <button onClick={closeModal} className="p-1 rounded hover:opacity-70">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={label}>Title *</label>
                <input name="title" value={form.title} onChange={handleField} className={input} placeholder="e.g. Getting started with Dropshipping" />
              </div>
              <div>
                <label className={label}>Video URL * <span className="font-normal text-slate-400">(YouTube embed, direct .mp4, etc.)</span></label>
                <input name="video_url" value={form.video_url} onChange={handleField} className={input} placeholder="https://www.youtube.com/embed/..." />
              </div>
              <div>
                <label className={label}>Description</label>
                <textarea name="description" value={form.description} onChange={handleField} rows={3} className={`${input} resize-none`} placeholder="What will the viewer learn?" />
              </div>
              <div>
                <label className={label}>Thumbnail URL</label>
                <input name="thumbnail_url" value={form.thumbnail_url} onChange={handleField} className={input} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Duration (seconds)</label>
                  <input name="duration_seconds" type="number" min="0" value={form.duration_seconds} onChange={handleField} className={input} placeholder="e.g. 300" />
                </div>
                <div>
                  <label className={label}>Sort Order</label>
                  <input name="sort_order" type="number" min="0" value={form.sort_order} onChange={handleField} className={input} placeholder="0" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_published"
                  checked={form.is_published}
                  onChange={handleField}
                  className="w-4 h-4 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Published (visible to users)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeModal} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Comments Drawer ─────────────────────────────────────────────────── */}
      {commentsFor && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setCommentsFor(null)}>
          <div
            className={`w-full max-w-md h-full overflow-y-auto p-6 space-y-4 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Comments</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{commentsFor.title}</p>
              </div>
              <button onClick={() => setCommentsFor(null)} className="p-1 rounded hover:opacity-70"><X size={18} /></button>
            </div>

            {commLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
            ) : comments.length === 0 ? (
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {[c.name, c.surname].filter(Boolean).join(' ') || c.email}
                        </p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.email}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="flex-shrink-0 p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{c.body}</p>
                    <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {new Date(c.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
