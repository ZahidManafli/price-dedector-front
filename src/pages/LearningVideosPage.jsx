/**
 * pages/LearningVideosPage.jsx
 *
 * User-facing page: browse, watch, like, and comment on Checkila learning videos.
 * Route: /learning  (add to your React Router config)
 *
 * Depends on:
 *   learningAPI (see api.js additions below)
 *   useAuth from your AuthContext
 *   useTheme from your ThemeContext
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ThumbsUp, MessageSquare, Send, Loader2,
  ChevronLeft, PlayCircle, Clock, Lock,
  GraduationCap, Search, CheckCircle2, RefreshCw,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';
import { learningAPI } from '../services/api';
import Alert from '../components/Alert';

// Client-side only "watched" tracking (no backend field for this exists) —
// same localStorage-persisted-preference pattern already used elsewhere in
// this app (e.g. ProductsPage's `products_view`). Purely cosmetic progress
// cue; never sent to the server, never blocks anything.
const WATCHED_STORAGE_KEY = 'learning_videos_watched';

function loadWatchedIds() {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveWatchedIds(set) {
  try {
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // best-effort — a private window or disabled storage just means the
    // checkmark doesn't persist across visits, nothing else breaks.
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDuration(secs) {
  if (!secs) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isYouTubeEmbed(url) {
  return /youtube\.com\/embed|youtu\.be/.test(url || '');
}

// ─── Video Player ────────────────────────────────────────────────────────────

function VideoPlayer({ video }) {
  const url = video.video_url || '';

  if (isYouTubeEmbed(url) || url.includes('youtube') || url.includes('vimeo')) {
    // Normalise youtube watch?v= → embed
    let src = url;
    const ytWatch = url.match(/[?&]v=([^&]+)/);
    if (ytWatch) src = `https://www.youtube.com/embed/${ytWatch[1]}`;

    return (
      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={src}
          title={video.title}
          className="absolute inset-0 w-full h-full rounded-xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct video file
  return (
    <video
      src={url}
      controls
      className="w-full rounded-xl max-h-[480px]"
      poster={video.thumbnail_url || undefined}
    />
  );
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, isDark }) {
  const name = [comment.name, comment.surname].filter(Boolean).join(' ').trim() || comment.email || 'User';
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className={`flex gap-3 py-3 border-b last:border-b-0 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{name}</span>
          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{timeAgo(comment.created_at)}</span>
        </div>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{comment.body}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LearningVideosPage() {
  const { isDark } = useTheme();
  const { user }   = useAuth();
  const navigate   = useNavigate();

  const [videos,        setVideos]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [purchasing,    setPurchasing]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [watchedIds,    setWatchedIds]    = useState(() => loadWatchedIds());

  // Selected video detail
  const [activeVideo,   setActiveVideo]   = useState(null);
  const [comments,      setComments]      = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Comment form
  const [commentBody,   setCommentBody]   = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [commentError,  setCommentError]  = useState(null);
  const [commentOk,     setCommentOk]     = useState(false);

  const commentInputRef = useRef(null);

  // ── Load video list ────────────────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await learningAPI.list();
      const list = (res?.data?.videos || []).filter((v) => v.is_published);
      setVideos(list);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVideos(); }, [loadVideos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) =>
      String(v.title || '').toLowerCase().includes(q) ||
      String(v.description || '').toLowerCase().includes(q)
    );
  }, [videos, searchQuery]);

  // ── Open video ─────────────────────────────────────────────────────────────
  const openVideo = async (video) => {
    setActiveVideo(video);
    setComments([]);
    setCommentBody('');
    setCommentError(null);
    setCommentOk(false);
    setDetailLoading(true);
    // A paid video the user hasn't unlocked yet isn't actually "watched" —
    // only mark it once they can genuinely see the content.
    if (!video.isPaid || video.hasAccess) {
      setWatchedIds((prev) => {
        if (prev.has(video.id)) return prev;
        const next = new Set(prev).add(video.id);
        saveWatchedIds(next);
        return next;
      });
    }
    try {
      const res = await learningAPI.get(video.id);
      setActiveVideo(res?.data?.video || video);
      setComments(res?.data?.comments || []);
    } catch {
      // silently keep the list-level data
    } finally {
      setDetailLoading(false);
    }
  };

  const closeVideo = () => { setActiveVideo(null); setComments([]); };

  // ── Buy access (lifetime, one-time Epoint payment) ────────────────────────
  const handlePurchase = async (video) => {
    setPurchasing(true);
    setError(null);
    try {
      const res = await learningAPI.createPurchase(video.id);
      const requestId = res?.data?.requestId;
      if (!requestId) throw new Error('Sorğu yaradıla bilmədi.');
      navigate(`/learning/pay/${requestId}`);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Ödəniş sorğusu alınmadı.');
    } finally {
      setPurchasing(false);
    }
  };

  // ── Like toggle ────────────────────────────────────────────────────────────
  const handleLike = async (video, e) => {
    e.stopPropagation();
    try {
      const res = await learningAPI.toggleLike(video.id);
      const { liked, like_count } = res?.data || {};

      const patch = (v) =>
        v.id === video.id
          ? { ...v, user_liked: liked ? 1 : 0, like_count }
          : v;

      setVideos((prev) => prev.map(patch));
      if (activeVideo?.id === video.id) setActiveVideo((prev) => patch(prev));
    } catch {
      // ignore
    }
  };

  // ── Submit comment ─────────────────────────────────────────────────────────
  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    setCommentError(null);
    setCommentOk(false);
    try {
      const res = await learningAPI.addComment(activeVideo.id, commentBody.trim());
      const newComment = res?.data?.comment;
      if (newComment) setComments((prev) => [...prev, newComment]);
      setCommentBody('');
      setCommentOk(true);
      setTimeout(() => setCommentOk(false), 3000);

      // Update comment count in list
      setVideos((prev) =>
        prev.map((v) =>
          v.id === activeVideo.id
            ? { ...v, comment_count: (v.comment_count || 0) + 1 }
            : v
        )
      );
    } catch (err) {
      setCommentError(err?.response?.data?.error || err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Style tokens ──────────────────────────────────────────────────────────
  const card    = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const muted   = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCn = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;
  const watchedCount = videos.filter((v) => watchedIds.has(v.id)).length;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      <div className="max-w-[1480px] mx-auto">

        {/* Page header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
              isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <GraduationCap size={24} />
            </span>
            <div>
              <h1 className="page-title">Dərslik Videoları</h1>
              <p className={`mt-1 text-sm ${muted}`}>
                Checkila ilə dropshipping-i addım-addım öyrənin.
              </p>
            </div>
          </div>

          {!activeVideo && !loading && videos.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                isDark ? 'border-slate-700 bg-slate-900 text-slate-300' : 'border-slate-200 bg-white text-slate-600'
              }`}>
                <PlayCircle size={13} /> {videos.length} dərs
              </span>
              {watchedCount > 0 && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <CheckCircle2 size={13} /> {watchedCount} izlənilib
                </span>
              )}
              <button
                type="button"
                onClick={loadVideos}
                title="Yenilə"
                className={`inline-flex items-center justify-center rounded-full border p-2 transition ${
                  isDark ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onClose={() => setError(null)} />
          </div>
        )}

        {/* ── Detail view ─────────────────────────────────────────────────── */}
        {activeVideo ? (
          <div className="space-y-6">

            {/* Back */}
            <button
              onClick={closeVideo}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
              <ChevronLeft size={16} /> Bütün dərslər
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

              {/* Left: player + info */}
              <div className="space-y-4">
                {activeVideo.isPaid && !activeVideo.hasAccess ? (
                  <div
                    className={`relative w-full rounded-xl border flex flex-col items-center justify-center gap-3 py-16 px-6 text-center ${
                      isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    {activeVideo.thumbnail_url && (
                      <img
                        src={activeVideo.thumbnail_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-xl"
                      />
                    )}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <Lock size={32} className={muted} />
                      <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        Bu video ödənişlidir
                      </p>
                      <p className={`text-xs ${muted}`}>
                        Baxmaq üçün bir dəfəlik {Number(activeVideo.priceAzn).toFixed(2)} AZN ödəyin — ömürlük giriş əldə edirsiniz.
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePurchase(activeVideo)}
                        disabled={purchasing}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
                      >
                        {purchasing ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                        {purchasing ? 'Yönləndirilir…' : `${Number(activeVideo.priceAzn).toFixed(2)} AZN ödə`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <VideoPlayer video={activeVideo} />
                )}

                <div className={`rounded-2xl border p-5 ${card}`}>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
                    {activeVideo.title}
                  </h2>
                  <div className={`flex flex-wrap items-center gap-4 mt-2 text-sm ${muted}`}>
                    {activeVideo.duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock size={13} /> {fmtDuration(activeVideo.duration_seconds)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <ThumbsUp size={13} /> {activeVideo.like_count || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={13} /> {comments.length}
                    </span>
                    {watchedIds.has(activeVideo.id) && (
                      <span className={`flex items-center gap-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <CheckCircle2 size={13} /> İzlənilib
                      </span>
                    )}
                  </div>
                  {activeVideo.description && (
                    <p className={`mt-3 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {activeVideo.description}
                    </p>
                  )}

                  {/* Like button */}
                  <button
                    onClick={(e) => handleLike(activeVideo, e)}
                    className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      activeVideo.user_liked
                        ? 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
                        : isDark
                          ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ThumbsUp size={15} />
                    {activeVideo.user_liked ? 'Bəyənildi' : 'Bəyən'}
                    <span className={`text-xs ${activeVideo.user_liked ? 'text-blue-200' : muted}`}>
                      {activeVideo.like_count || 0}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right: comments */}
              <div className={`rounded-2xl border flex flex-col ${card}`} style={{ maxHeight: '600px' }}>
                <div className={`px-4 py-3 border-b font-semibold text-sm flex-shrink-0 flex items-center gap-2 ${isDark ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-800'}`}>
                  <MessageSquare size={15} /> Şərhlər ({comments.length})
                </div>

                {/* Comment list */}
                <div className="flex-1 overflow-y-auto px-4">
                  {detailLoading ? (
                    <div className="space-y-3 py-4">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={`h-14 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      ))}
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <MessageSquare size={24} className={muted} />
                      <p className={`text-sm ${muted}`}>İlk şərhi siz yazın!</p>
                    </div>
                  ) : (
                    comments.map((c) => (
                      <CommentItem key={c.id} comment={c} isDark={isDark} />
                    ))
                  )}
                </div>

                {/* Comment form */}
                <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  {commentOk && (
                    <p className="text-xs text-emerald-500 mb-2 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Şərh göndərildi — admin e-poçtla xəbərdar olundu.
                    </p>
                  )}
                  {commentError && (
                    <p className="text-xs text-red-500 mb-2">{commentError}</p>
                  )}
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={commentInputRef}
                      rows={2}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      placeholder="Şərh yazın… (admin xəbərdar olunacaq)"
                      className={`${inputCn} flex-1`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleComment(e);
                        }
                      }}
                    />
                    <button
                      onClick={handleComment}
                      disabled={submitting || !commentBody.trim()}
                      className="flex-shrink-0 p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

        ) : (
          /* ── Video grid ──────────────────────────────────────────────────── */
          <>
            {!loading && videos.length > 4 && (
              <div className="relative mb-5 max-w-sm">
                <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Dərslərdə axtar..."
                  className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 ${
                    isDark ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className={`rounded-2xl border overflow-hidden ${card}`}>
                    <div className={`w-full animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} style={{ paddingTop: '56.25%' }} />
                    <div className="p-4 space-y-2">
                      <div className={`h-3.5 rounded animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      <div className={`h-3 w-2/3 rounded animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${card}`}>
                <PlayCircle size={40} className={`mx-auto mb-3 ${muted}`} />
                <p className={`text-sm ${muted}`}>Hələ heç bir dərslik videosu yoxdur. Tezliklə yoxlayın!</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${card}`}>
                <Search size={32} className={`mx-auto mb-3 ${muted}`} />
                <p className={`text-sm ${muted}`}>"{searchQuery}" üzrə heç nə tapılmadı.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filteredVideos.map((video) => {
                  const watched = watchedIds.has(video.id);
                  return (
                  <div
                    key={video.id}
                    onClick={() => openVideo(video)}
                    className={`group rounded-2xl border cursor-pointer overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5 ${card}`}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-full bg-slate-800" style={{ paddingTop: '56.25%' }}>
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PlayCircle size={36} className="text-slate-500" />
                        </div>
                      )}
                      {video.duration_seconds && (
                        <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] font-medium rounded px-1.5 py-0.5">
                          {fmtDuration(video.duration_seconds)}
                        </span>
                      )}
                      {video.isPaid && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-blue-600/90 text-white text-[11px] font-semibold rounded-full px-2 py-0.5">
                          <Lock size={10} />
                          {video.hasAccess ? 'Alınıb' : `${Number(video.priceAzn).toFixed(2)} AZN`}
                        </span>
                      )}
                      {watched && (
                        <span className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-emerald-600/90 p-1 text-white">
                          <CheckCircle2 size={13} />
                        </span>
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                        <PlayCircle size={44} className="text-white drop-shadow" />
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="p-4">
                      <h3 className={`font-semibold text-sm line-clamp-2 leading-snug ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {video.title}
                      </h3>
                      {video.description && (
                        <p className={`mt-1 text-xs line-clamp-2 ${muted}`}>{video.description}</p>
                      )}
                      <div className={`mt-3 flex items-center justify-between text-xs ${muted}`}>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><MessageSquare size={11} /> {video.comment_count || 0}</span>
                        </div>

                        {/* Like button */}
                        <button
                          onClick={(e) => handleLike(video, e)}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            video.user_liked
                              ? 'bg-blue-600 text-white'
                              : isDark
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <ThumbsUp size={11} />
                          {video.like_count || 0}
                        </button>
                      </div>
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
  );
}
