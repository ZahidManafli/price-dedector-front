import React, { useState, useEffect, useCallback } from 'react';
import {
  X, ThumbsUp, ThumbsDown, Minus, Send,
  ChevronLeft, ChevronRight, MessageSquare, Loader2,
  AlertCircle, RefreshCw,
} from 'lucide-react';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const TYPE_CONFIG = {
  Positive: {
    label: 'Positive',
    pill: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    pillDark: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
    card: 'bg-emerald-50 border-emerald-100',
    cardDark: 'bg-emerald-900/30 border-emerald-800/50',
    text: 'text-emerald-700',
    textDark: 'text-emerald-300',
    Icon: ThumbsUp,
  },
  Negative: {
    label: 'Negative',
    pill: 'bg-rose-100 text-rose-700 border-rose-200',
    pillDark: 'bg-rose-900/40 text-rose-300 border-rose-700/50',
    card: 'bg-rose-50 border-rose-100',
    cardDark: 'bg-rose-900/30 border-rose-800/50',
    text: 'text-rose-700',
    textDark: 'text-rose-300',
    Icon: ThumbsDown,
  },
  Neutral: {
    label: 'Neutral',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    pillDark: 'bg-slate-700/60 text-slate-300 border-slate-600',
    card: 'bg-slate-50 border-slate-200',
    cardDark: 'bg-slate-800/80 border-slate-700',
    text: 'text-slate-600',
    textDark: 'text-slate-300',
    Icon: Minus,
  },
};

const TABS = ['All', 'Positive', 'Negative', 'Neutral'];

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-indigo-500',
];

function UserAvatar({ username }) {
  const initials = String(username || '?').slice(0, 2).toUpperCase();
  const colorIdx = username ? username.charCodeAt(0) % AVATAR_COLORS.length : 0;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[colorIdx]}`}>
      {initials}
    </div>
  );
}

function FeedbackEntry({ entry, isDark, replyState, onOpenReply, onCloseReply, onSendReply, onReplyTextChange }) {
  const typeConf = TYPE_CONFIG[entry.commentType] || TYPE_CONFIG.Neutral;
  const { Icon } = typeConf;
  const rs = replyState || {};
  const hasResponse = Boolean(entry.feedbackResponse);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <div className={`rounded-xl border p-4 transition-colors ${isDark ? 'border-slate-700 bg-slate-900/60 hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <div className="flex gap-3">
        <UserAvatar username={entry.commentingUser} />

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {entry.commentingUser || 'Unknown User'}
            </span>
            {entry.commentingUserScore > 0 && (
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                ({entry.commentingUserScore})
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${isDark ? typeConf.pillDark : typeConf.pill}`}>
              <Icon size={9} />
              {typeConf.label}
            </span>
            {entry.role && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {entry.role}
              </span>
            )}
            <span className={`ml-auto text-xs flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {formatDate(entry.commentTime)}
            </span>
          </div>

          {/* Item title */}
          {entry.itemTitle && (
            <p className={`text-xs mb-2 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {entry.itemTitle}
            </p>
          )}

          {/* Comment text */}
          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {entry.commentText || <em className="opacity-50">No comment</em>}
          </p>

          {/* Existing response */}
          {hasResponse && (
            <div className={`mt-3 pl-3 border-l-2 rounded-r-lg py-2 pr-3 ${isDark ? 'border-blue-700 bg-blue-950/30' : 'border-blue-300 bg-blue-50'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                Your response
              </p>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {entry.feedbackResponse}
              </p>
            </div>
          )}

          {/* Reply section */}
          {!hasResponse && entry.feedbackId && (
            <div className="mt-3">
              {rs.open ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={rs.text || ''}
                    onChange={(e) => onReplyTextChange(entry.feedbackId, e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Write your reply… (max 500 characters)"
                    className={`w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/40 ${
                      isDark
                        ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {(rs.text || '').length}/500
                    </span>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {rs.error && (
                        <span className="text-xs text-rose-500 flex items-center gap-1">
                          <AlertCircle size={11} />
                          {rs.error}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onCloseReply(entry.feedbackId)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendReply(entry)}
                        disabled={rs.sending || !rs.text?.trim()}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {rs.sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        {rs.sending ? 'Sending…' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenReply(entry.feedbackId)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                    isDark
                      ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                >
                  <MessageSquare size={11} />
                  Reply
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FeedbackSidebar({ listing, ebayListingId, onClose }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [replyState, setReplyState] = useState({});

  const loadFeedback = useCallback(async (pageNum, commentType) => {
    if (!ebayListingId) return;
    setLoading(true);
    setError(null);
    try {
      const params = { pageNumber: pageNum, entriesPerPage: 25 };
      if (commentType && commentType !== 'All') params.commentType = commentType;
      const res = await ebayAPI.getListingFeedback(ebayListingId, params);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [ebayListingId]);

  useEffect(() => {
    setPage(1);
    setReplyState({});
    loadFeedback(1, filter === 'All' ? null : filter);
  }, [ebayListingId, filter, loadFeedback]);

  const handleFilterChange = (f) => { setFilter(f); };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadFeedback(newPage, filter === 'All' ? null : filter);
  };

  const openReply = (feedbackId) => {
    setReplyState((s) => ({ ...s, [feedbackId]: { open: true, text: '', sending: false, error: null } }));
  };

  const closeReply = (feedbackId) => {
    setReplyState((s) => ({ ...s, [feedbackId]: { ...s[feedbackId], open: false } }));
  };

  const setReplyText = (feedbackId, text) => {
    setReplyState((s) => ({ ...s, [feedbackId]: { ...(s[feedbackId] || {}), text } }));
  };

  const sendReply = async (entry) => {
    const rs = replyState[entry.feedbackId] || {};
    if (!rs.text?.trim()) return;
    setReplyState((s) => ({ ...s, [entry.feedbackId]: { ...s[entry.feedbackId], sending: true, error: null } }));
    try {
      await ebayAPI.respondToListingFeedback(ebayListingId, {
        feedbackId: entry.feedbackId,
        targetUserId: entry.commentingUser,
        responseText: rs.text.trim(),
        responseType: 'Reply',
        transactionId: entry.transactionId,
        orderLineItemId: entry.orderLineItemId,
      });
      setData((d) => ({
        ...d,
        feedbackDetails: d.feedbackDetails.map((f) =>
          f.feedbackId === entry.feedbackId ? { ...f, feedbackResponse: rs.text.trim() } : f
        ),
      }));
      setReplyState((s) => ({ ...s, [entry.feedbackId]: { open: false, text: '', sending: false, error: null } }));
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to send reply';
      setReplyState((s) => ({ ...s, [entry.feedbackId]: { ...s[entry.feedbackId], sending: false, error: msg } }));
    }
  };

  const getSummaryCount = (periods, targetDays = 30) =>
    periods?.find?.((p) => p.periodInDays === targetDays)?.count ?? 0;

  const pos30 = getSummaryCount(data?.feedbackSummary?.positive, 30);
  const neg30 = getSummaryCount(data?.feedbackSummary?.negative, 30);
  const neu30 = getSummaryCount(data?.feedbackSummary?.neutral, 30);

  const totalEntries = data?.pagination?.totalEntries ?? data?.feedbackDetails?.length ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;
  const listingTitle = listing?._title || listing?.title || `Item ${ebayListingId}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[520px] flex flex-col shadow-2xl ${isDark ? 'bg-slate-950 border-l border-slate-800' : 'bg-slate-50 border-l border-slate-200'}`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-blue-900/50' : 'bg-blue-100'}`}>
            <MessageSquare size={15} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Feedback</h2>
            <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{listingTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <X size={15} />
          </button>
        </div>

        {/* Score / summary bar */}
        {!loading && !error && data && (
          <div className={`px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center gap-4">
              {/* Score badge */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${isDark ? 'bg-blue-900/60 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                  {data.feedbackScore ?? 0}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Score</span>
              </div>

              {/* Period stat cards */}
              <div className="flex gap-2 flex-1">
                {[
                  { key: 'Positive', count: pos30, conf: TYPE_CONFIG.Positive },
                  { key: 'Neutral', count: neu30, conf: TYPE_CONFIG.Neutral },
                  { key: 'Negative', count: neg30, conf: TYPE_CONFIG.Negative },
                ].map(({ key, count, conf }) => {
                  const { Icon } = conf;
                  return (
                    <div key={key} className={`flex-1 rounded-xl p-3 text-center border ${isDark ? conf.cardDark : conf.card}`}>
                      <Icon size={13} className={`mx-auto mb-1 ${isDark ? conf.textDark : conf.text}`} />
                      <div className={`font-bold text-lg leading-none ${isDark ? conf.textDark : conf.text}`}>{count}</div>
                      <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{key}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>* 30-day period</p>
          </div>
        )}

        {/* Filter tabs + refresh */}
        <div className={`flex items-center gap-0.5 px-4 py-2.5 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white'}`}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleFilterChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === tab
                  ? 'bg-blue-600 text-white'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => loadFeedback(page, filter === 'All' ? null : filter)}
            title="Refresh"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`rounded-xl border p-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-3 rounded-full w-28 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      <div className={`h-3 rounded-full w-full animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      <div className={`h-3 rounded-full w-4/5 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-rose-900/30' : 'bg-rose-50'}`}>
                <AlertCircle size={22} className={isDark ? 'text-rose-400' : 'text-rose-500'} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Failed to load feedback</p>
                <p className={`text-xs mt-1 max-w-[280px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{error}</p>
              </div>
              <button
                type="button"
                onClick={() => loadFeedback(1, filter === 'All' ? null : filter)}
                className="mt-1 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                <RefreshCw size={11} />
                Try Again
              </button>
            </div>
          ) : !data?.feedbackDetails?.length ? (
            <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <MessageSquare size={22} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
              </div>
              <div>
                <p className={`font-semibold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>No feedback yet</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {filter !== 'All'
                    ? `No ${filter.toLowerCase()} feedback for this listing.`
                    : 'This listing has no feedback yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {data.feedbackDetails.map((entry, idx) => (
                <FeedbackEntry
                  key={entry.feedbackId || `entry-${idx}`}
                  entry={entry}
                  isDark={isDark}
                  replyState={replyState[entry.feedbackId]}
                  onOpenReply={openReply}
                  onCloseReply={closeReply}
                  onSendReply={sendReply}
                  onReplyTextChange={setReplyText}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {!loading && !error && totalEntries > 0 && (
          <div className={`flex items-center justify-between px-5 py-3 border-t flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
                className={`h-7 w-7 rounded-lg flex items-center justify-center border transition disabled:opacity-30 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
                className={`h-7 w-7 rounded-lg flex items-center justify-center border transition disabled:opacity-30 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
