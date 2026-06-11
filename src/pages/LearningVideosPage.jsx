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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ThumbsUp, MessageSquare, Send, Loader2,
  ChevronLeft, PlayCircle, X, Clock,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth }  from '../context/AuthContext';
import { learningAPI } from '../services/api';

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

  const [videos,        setVideos]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

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

  // ── Open video ─────────────────────────────────────────────────────────────
  const openVideo = async (video) => {
    setActiveVideo(video);
    setComments([]);
    setCommentBody('');
    setCommentError(null);
    setCommentOk(false);
    setDetailLoading(true);
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
  const bg      = isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900';
  const card    = isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200';
  const muted   = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCn = `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
    isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
  }`;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${bg}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Page header */}
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
            📚 Dropshipping on Checkila
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Watch our guides and master dropshipping with Checkila.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-6">
            {error}
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
              <ChevronLeft size={16} /> All videos
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

              {/* Left: player + info */}
              <div className="space-y-4">
                <VideoPlayer video={activeVideo} />

                <div>
                  <h2 className={`text-xl font-bold ${isDark ? 'text-slate-50' : 'text-slate-900'}`}>
                    {activeVideo.title}
                  </h2>
                  <div className={`flex items-center gap-4 mt-2 text-sm ${muted}`}>
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
                    {activeVideo.user_liked ? 'Liked' : 'Like'}
                    <span className={`text-xs ${activeVideo.user_liked ? 'text-blue-200' : muted}`}>
                      {activeVideo.like_count || 0}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right: comments */}
              <div className={`rounded-2xl border flex flex-col ${card}`} style={{ maxHeight: '600px' }}>
                <div className={`px-4 py-3 border-b font-semibold text-sm flex-shrink-0 ${isDark ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-800'}`}>
                  Comments ({comments.length})
                </div>

                {/* Comment list */}
                <div className="flex-1 overflow-y-auto px-4">
                  {detailLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-slate-400" />
                    </div>
                  ) : comments.length === 0 ? (
                    <p className={`py-6 text-sm text-center ${muted}`}>
                      Be the first to leave a comment!
                    </p>
                  ) : (
                    comments.map((c) => (
                      <CommentItem key={c.id} comment={c} isDark={isDark} />
                    ))
                  )}
                </div>

                {/* Comment form */}
                <div className={`p-4 border-t flex-shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  {commentOk && (
                    <p className="text-xs text-emerald-500 mb-2">
                      ✓ Comment sent — the admin has been notified by email.
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
                      placeholder="Write a comment… (admin will be notified)"
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
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-slate-400" />
              </div>
            ) : videos.length === 0 ? (
              <div className={`rounded-2xl border p-12 text-center ${card}`}>
                <PlayCircle size={40} className={`mx-auto mb-3 ${muted}`} />
                <p className={`text-sm ${muted}`}>No learning videos are available yet. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => openVideo(video)}
                    className={`rounded-2xl border cursor-pointer overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5 ${card}`}
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
                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition bg-black/30">
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
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
