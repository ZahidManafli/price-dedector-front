import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Send, MessageSquare, Loader2, AlertCircle, RefreshCw,
  Inbox, Flag, ChevronDown, ChevronUp, Mail, MailOpen,
  CornerDownRight, ShieldAlert,
} from 'lucide-react';
import { ebayAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

const QUESTION_TYPES = [
  { value: 'General', label: 'General' },
  { value: 'Shipping', label: 'Shipping' },
  { value: 'Payment', label: 'Payment' },
  { value: 'Refund', label: 'Refund' },
  { value: 'CustomizedOrder', label: 'Custom Order' },
];

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'unanswered', label: 'Unanswered' },
];

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDays > 365 ? 'numeric' : undefined });
  } catch { return dateStr; }
}

function MessageCard({ msg, isDark, isExpanded, onToggle }) {
  const body = msg.content || stripHtml(msg.text) || '';
  const isLong = body.length > 220;
  const displayBody = isExpanded || !isLong ? body : body.slice(0, 220) + '…';

  return (
    <div
      className={`rounded-xl border transition-all ${
        !msg.read
          ? isDark
            ? 'border-blue-700/70 bg-blue-950/20'
            : 'border-blue-200 bg-blue-50/60'
          : isDark
          ? 'border-slate-700 bg-slate-900/50'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Sender avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white ${
          msg.sender ? 'bg-indigo-500' : 'bg-slate-400'
        }`}>
          {String(msg.sender || '?').slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Row 1: sender + date + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              {msg.sender || 'eBay'}
            </span>
            {!msg.read && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-600 text-white">
                New
              </span>
            )}
            {msg.highPriority && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700/50' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                <ShieldAlert size={9} />
                High Priority
              </span>
            )}
            {msg.flagged && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700/50' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                <Flag size={9} />
                Flagged
              </span>
            )}
            {msg.questionType && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {msg.questionType}
              </span>
            )}
            <span className={`ml-auto text-xs flex-shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {formatDate(msg.receiveDate)}
            </span>
          </div>

          {/* Subject */}
          <p className={`text-xs mb-2 truncate font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {msg.subject || '(No subject)'}
          </p>

          {/* Body */}
          {body ? (
            <div>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {displayBody}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={onToggle}
                  className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium transition ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                >
                  {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          ) : (
            <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>(no message body)</p>
          )}

          {/* Footer: replied indicator */}
          {msg.replied && (
            <div className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              <CornerDownRight size={10} />
              Replied
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposePanel({ order, isDark, onSent, onCancel }) {
  const itemId = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
  const buyerUsername = String(order?.buyer?.username || '').trim();
  const itemTitle = String(order?.lineItems?.[0]?.title || '').trim();

  const [subject, setSubject] = useState(`Re: ${itemTitle ? itemTitle.slice(0, 60) : 'your order'}`);
  const [questionType, setQuestionType] = useState('General');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await ebayAPI.sendItemMessage({
        itemId,
        recipientId: buyerUsername,
        subject: subject.trim() || `Re: your order`,
        body: body.trim(),
        questionType,
      });
      onSent();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`border-t p-4 flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Send size={13} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
        <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
          New Message
        </span>
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          to {buyerUsername || 'buyer'}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className={`ml-auto w-6 h-6 rounded flex items-center justify-center transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <X size={12} />
        </button>
      </div>

      {/* Subject */}
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={255}
        placeholder="Subject"
        className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isDark
            ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
        }`}
      />

      {/* Question type */}
      <select
        value={questionType}
        onChange={(e) => setQuestionType(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isDark
            ? 'bg-slate-800 border-slate-600 text-slate-100'
            : 'bg-white border-slate-300 text-slate-900'
        }`}
      >
        {QUESTION_TYPES.map((qt) => (
          <option key={qt.value} value={qt.value}>{qt.label}</option>
        ))}
      </select>

      {/* Body */}
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="Write your message…"
        className={`w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-500/40 ${
          isDark
            ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500'
            : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
        }`}
      />
      <div className="flex items-center justify-between mt-1.5 gap-2">
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{body.length}/2000</span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {error && (
            <span className="flex items-center gap-1 text-xs text-rose-500">
              <AlertCircle size={11} />
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderMessageSidebar({ order, onClose }) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [showCompose, setShowCompose] = useState(false);

  const itemId = String(order?.lineItems?.[0]?.legacyItemId || '').trim();
  const buyerUsername = String(order?.buyer?.username || '').trim();
  const itemTitle = String(order?.lineItems?.[0]?.title || '').trim();
  const orderId = String(order?.orderId || '').trim();

  const loadMessages = useCallback(async () => {
    if (!itemId) {
      setError('No item ID available for this order');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await ebayAPI.getItemMessages(itemId);
      setMessages(res.data?.messages || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSent = () => {
    setShowCompose(false);
    loadMessages();
  };

  const filteredMessages = messages.filter((m) => {
    if (filter === 'unread') return !m.read;
    if (filter === 'flagged') return m.flagged;
    if (filter === 'unanswered') return !m.replied;
    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;
  const flaggedCount = messages.filter((m) => m.flagged).length;
  const unansweredCount = messages.filter((m) => !m.replied).length;

  const filterCount = { all: messages.length, unread: unreadCount, flagged: flaggedCount, unanswered: unansweredCount };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[540px] flex flex-col shadow-2xl ${isDark ? 'bg-slate-950 border-l border-slate-800' : 'bg-slate-50 border-l border-slate-200'}`}>

        {/* ── Header ── */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-indigo-900/50' : 'bg-indigo-100'}`}>
            <Inbox size={15} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Message Panel
            </h2>
            <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {buyerUsername ? `Buyer: ${buyerUsername}` : `Order: ${orderId}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition flex-shrink-0 ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Order info strip ── */}
        <div className={`px-5 py-3 border-b flex items-center gap-3 flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <MessageSquare size={13} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs truncate font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {itemTitle || 'Unknown item'}
            </p>
            <p className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Item #{itemId || '—'} · Order #{orderId.slice(0, 18)}
            </p>
          </div>
          {/* Message count badge */}
          {!loading && messages.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {unreadCount > 0 && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                  {unreadCount} new
                </span>
              )}
              <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {messages.length} total
              </span>
            </div>
          )}
        </div>

        {/* ── Filter tabs + actions ── */}
        <div className={`flex items-center gap-0.5 px-4 py-2.5 border-b flex-shrink-0 ${isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-white'}`}>
          {FILTERS.map((f) => {
            const cnt = filterCount[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === f.key
                    ? 'bg-indigo-600 text-white'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {f.label}
                {cnt > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${filter === f.key ? 'bg-white/20 text-white' : isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
          <div className="flex-1" />
          <button
            type="button"
            onClick={loadMessages}
            title="Refresh"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <RefreshCw size={12} />
          </button>
          {!showCompose && itemId && buyerUsername && (
            <button
              type="button"
              onClick={() => setShowCompose(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition ml-1"
            >
              <Send size={11} />
              Compose
            </button>
          )}
        </div>

        {/* ── Scrollable message list ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`rounded-xl border p-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                    <div className="flex-1 space-y-2">
                      <div className={`h-3 rounded-full w-32 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      <div className={`h-3 rounded-full w-full animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
                      <div className={`h-3 rounded-full w-3/4 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
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
                <p className={`font-semibold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Failed to load messages</p>
                <p className={`text-xs mt-1 max-w-[280px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{error}</p>
              </div>
              <button
                type="button"
                onClick={loadMessages}
                className="mt-1 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
              >
                <RefreshCw size={11} />
                Try Again
              </button>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {messages.length === 0
                  ? <Mail size={22} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                  : <MailOpen size={22} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                }
              </div>
              <div>
                <p className={`font-semibold text-sm ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {messages.length === 0 ? 'No messages yet' : `No ${filter} messages`}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {messages.length === 0
                    ? 'There are no messages for this order in your eBay inbox.'
                    : `Try a different filter to see more messages.`}
                </p>
              </div>
              {messages.length === 0 && itemId && buyerUsername && !showCompose && (
                <button
                  type="button"
                  onClick={() => setShowCompose(true)}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
                >
                  <Send size={11} />
                  Send First Message
                </button>
              )}
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              {filteredMessages.map((msg, idx) => (
                <MessageCard
                  key={msg.messageId || `msg-${idx}`}
                  msg={msg}
                  isDark={isDark}
                  isExpanded={expandedIds.has(msg.messageId || `msg-${idx}`)}
                  onToggle={() => toggleExpand(msg.messageId || `msg-${idx}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Compose panel ── */}
        {showCompose && (
          <ComposePanel
            order={order}
            isDark={isDark}
            onSent={handleSent}
            onCancel={() => setShowCompose(false)}
          />
        )}
      </div>
    </>
  );
}
