/**
 * components/AdminVideosTab.jsx
 *
 * Drop this into your AdminPanelPage as:
 *   {!loading && activeTab === 'videos' && <AdminVideosTab />}
 *
 * Supports:
 *   - Video source: YouTube/external URL  OR  direct file upload (.mp4, .webm, etc.)
 *   - Thumbnail:    URL string            OR  image file upload
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import {
  PlusCircle, Pencil, Trash2,
  MessageSquare, ThumbsUp, X, Check, Loader2,
  Upload, Link as LinkIcon,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { learningAPI } from '../services/api';

// ─── constants ───────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  description: '',
  video_url: '',
  thumbnail_url: '',
  duration_seconds: '',
  sort_order: '',
  is_published: true,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Toggle pill component
function TogglePill({ value, onChange, options, isDark }) {
  return (
    <div className={`inline-flex rounded-lg p-0.5 gap-0.5 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            value === opt.value
              ? 'bg-blue-600 text-white shadow-sm'
              : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  // Upload mode toggles: 'url' | 'file'
  const [videoMode,   setVideoMode]   = useState('url');
  const [thumbMode,   setThumbMode]   = useState('url');

  // File refs
  const [videoFile,   setVideoFile]   = useState(null);
  const [thumbFile,   setThumbFile]   = useState(null);
  const videoInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  // Comments drawer
  const [commentsFor, setCommentsFor] = useState(null);
  const [comments,    setComments]    = useState([]);
  const [commLoading, setCommLoading] = useState(false);

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card  = isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  const input = `block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;
  const label = `block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`;
  const dropzone = `flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition ${
    isDark
      ? 'border-slate-600 bg-slate-800/50 hover:border-blue-500 hover:bg-slate-800 text-slate-400'
      : 'border-slate-300 bg-slate-50 hover:border-blue-500 hover:bg-slate-100 text-slate-500'
  }`;

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
  const resetFileState = () => {
    setVideoFile(null);
    setThumbFile(null);
    setVideoMode('url');
    setThumbMode('url');
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (thumbInputRef.current) thumbInputRef.current.value = '';
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    resetFileState();
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
    resetFileState();
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setEditId(null); resetFileState(); };

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
  };

  const handleThumbFile = (e) => {
    const file = e.target.files?.[0] || null;
    setThumbFile(file);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim()) return Swal.fire('Error', 'Title is required', 'error');

    // Validate video source
    const hasVideoUrl  = form.video_url.trim();
    const hasVideoFile = videoFile;
    if (videoMode === 'url' && !hasVideoUrl)  return Swal.fire('Error', 'Video URL is required', 'error');
    if (videoMode === 'file' && !hasVideoFile && modal === 'create')
      return Swal.fire('Error', 'Please select a video file', 'error');

    setSaving(true);
    try {
      // Build FormData — backend accepts multipart for both modes
      const fd = new FormData();
      fd.append('title',       form.title.trim());
      fd.append('description', form.description?.trim() || '');
      fd.append('duration_seconds', form.duration_seconds !== '' ? Number(form.duration_seconds) : '');
      fd.append('sort_order',  form.sort_order !== '' ? Number(form.sort_order) : 0);
      fd.append('is_published', form.is_published ? '1' : '0');

      // Video
      if (videoMode === 'file' && videoFile) {
        fd.append('video_file', videoFile);
      } else {
        fd.append('video_url', form.video_url.trim());
      }

      // Thumbnail
      if (thumbMode === 'file' && thumbFile) {
        fd.append('thumbnail_file', thumbFile);
      } else {
        fd.append('thumbnail_url', form.thumbnail_url?.trim() || '');
      }

      if (modal === 'create') {
        await learningAPI.create(fd);
      } else {
        await learningAPI.update(editId, fd);
      }

      closeModal();
      await loadVideos();
    } catch (e) {
      Swal.fire('Error', e?.response?.data?.error || e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete video ────────────────────────────────────────────────────────────
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

            <div className="space-y-4">

              {/* Title */}
              <div>
                <label className={label}>Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleField}
                  className={input}
                  placeholder="e.g. Getting started with Dropshipping"
                />
              </div>

              {/* Description */}
              <div>
                <label className={label}>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleField}
                  rows={3}
                  className={`${input} resize-none`}
                  placeholder="What will the viewer learn?"
                />
              </div>

              {/* ── Video source ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={label} style={{ marginBottom: 0 }}>Video Source *</label>
                  <TogglePill
                    value={videoMode}
                    onChange={(v) => { setVideoMode(v); setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                    isDark={isDark}
                    options={[
                      { value: 'url',  label: 'URL',    icon: <LinkIcon size={11} /> },
                      { value: 'file', label: 'Upload', icon: <Upload size={11} /> },
                    ]}
                  />
                </div>

                {videoMode === 'url' ? (
                  <input
                    name="video_url"
                    value={form.video_url}
                    onChange={handleField}
                    className={input}
                    placeholder="https://www.youtube.com/embed/… or https://…/video.mp4"
                  />
                ) : (
                  <>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoFile}
                    />
                    <div
                      className={dropzone}
                      onClick={() => videoInputRef.current?.click()}
                    >
                      <Upload size={22} />
                      {videoFile ? (
                        <span className="text-sm font-medium text-blue-500 truncate max-w-full px-2">
                          {videoFile.name}
                        </span>
                      ) : (
                        <>
                          <span className="text-sm font-medium">Click to choose a video file</span>
                          <span className="text-xs">MP4, WebM, MOV, AVI — max size depends on your server config</span>
                        </>
                      )}
                    </div>
                    {videoFile && (
                      <button
                        type="button"
                        onClick={() => { setVideoFile(null); if (videoInputRef.current) videoInputRef.current.value = ''; }}
                        className={`mt-1 text-xs flex items-center gap-1 ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
                      >
                        <X size={11} /> Remove file
                      </button>
                    )}
                    {/* When editing, show current URL if no new file chosen */}
                    {modal === 'edit' && !videoFile && form.video_url && (
                      <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Current: <span className="font-mono break-all">{form.video_url}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* ── Thumbnail ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={label} style={{ marginBottom: 0 }}>Thumbnail</label>
                  <TogglePill
                    value={thumbMode}
                    onChange={(v) => { setThumbMode(v); setThumbFile(null); if (thumbInputRef.current) thumbInputRef.current.value = ''; }}
                    isDark={isDark}
                    options={[
                      { value: 'url',  label: 'URL',    icon: <LinkIcon size={11} /> },
                      { value: 'file', label: 'Upload', icon: <Upload size={11} /> },
                    ]}
                  />
                </div>

                {thumbMode === 'url' ? (
                  <input
                    name="thumbnail_url"
                    value={form.thumbnail_url}
                    onChange={handleField}
                    className={input}
                    placeholder="https://…/thumbnail.jpg"
                  />
                ) : (
                  <>
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbFile}
                    />
                    <div
                      className={dropzone}
                      onClick={() => thumbInputRef.current?.click()}
                    >
                      <Upload size={22} />
                      {thumbFile ? (
                        <div className="flex flex-col items-center gap-1">
                          <img
                            src={URL.createObjectURL(thumbFile)}
                            alt="preview"
                            className="w-24 h-16 object-cover rounded"
                          />
                          <span className="text-xs font-medium text-blue-500">{thumbFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium">Click to choose an image</span>
                          <span className="text-xs">JPG, PNG, WebP</span>
                        </>
                      )}
                    </div>
                    {thumbFile && (
                      <button
                        type="button"
                        onClick={() => { setThumbFile(null); if (thumbInputRef.current) thumbInputRef.current.value = ''; }}
                        className={`mt-1 text-xs flex items-center gap-1 ${isDark ? 'text-slate-400 hover:text-red-400' : 'text-slate-500 hover:text-red-500'}`}
                      >
                        <X size={11} /> Remove file
                      </button>
                    )}
                    {modal === 'edit' && !thumbFile && form.thumbnail_url && (
                      <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Current: <span className="font-mono break-all">{form.thumbnail_url}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Duration + Sort */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Duration (seconds)</label>
                  <input
                    name="duration_seconds"
                    type="number"
                    min="0"
                    value={form.duration_seconds}
                    onChange={handleField}
                    className={input}
                    placeholder="e.g. 300"
                  />
                </div>
                <div>
                  <label className={label}>Sort Order</label>
                  <input
                    name="sort_order"
                    type="number"
                    min="0"
                    value={form.sort_order}
                    onChange={handleField}
                    className={input}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Published */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_published"
                  checked={form.is_published}
                  onChange={handleField}
                  className="w-4 h-4 rounded"
                />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Published (visible to users)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
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
