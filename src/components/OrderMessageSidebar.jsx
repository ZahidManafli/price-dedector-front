import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, MessageSquare, RefreshCw, Archive, ArrowLeft, Plus, ChevronRight, User } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ebayAPI } from '../services/api';

const CONV_TYPE = 'FROM_MEMBERS';

function sortMessagesAscending(msgs) {
  return [...msgs].sort((a, b) => {
    const ad = new Date(a.createdDate || a.receiveDate || 0).getTime();
    const bd = new Date(b.createdDate || b.receiveDate || 0).getTime();
    return ad - bd;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = (now - d) / 3600000;
    if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function statusColors(status, dark) {
  switch (String(status || '').toUpperCase()) {
    case 'ACTIVE': return dark ? 'bg-green-900/40 text-green-300' : 'bg-green-100 text-green-700';
    case 'ARCHIVED': return dark ? 'bg-yellow-900/40 text-yellow-300' : 'bg-yellow-100 text-yellow-700';
    case 'DELETED': return dark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700';
    default: return dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500';
  }
}

function ConversationCard({ convo, onClick, dark, fallbackUsername }) {
  const other = convo.otherParty?.username || convo.buyer?.username || convo.recipient
    || fallbackUsername || 'Buyer';
  const latest = convo.latestMessage || (Array.isArray(convo.messages) ? convo.messages.at(-1) : null);
  const previewText = latest?.messageBody || latest?.messageText || latest?.text || '';
  const previewDate = latest?.createdDate || latest?.receiveDate || convo.lastModifiedDate || '';
  const unread = convo.messagesSummary?.unreadCount || convo.unreadCount || 0;
  const status = convo.conversationStatus || 'ACTIVE';

  return (
    <button
      onClick={() => onClick(convo)}
      className={`w-full text-left p-4 rounded-xl border transition-all group ${
        dark
          ? 'bg-gray-800 border-gray-700 hover:border-gray-500 hover:bg-gray-750'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
          dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
        }`}>
          {other[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`font-semibold text-sm truncate ${dark ? 'text-gray-100' : 'text-gray-800'}`}>{other}</span>
              {unread > 0 && (
                <span className="flex-shrink-0 h-5 min-w-5 px-1.5 rounded-full text-xs font-bold bg-blue-500 text-white flex items-center justify-center">
                  {unread}
                </span>
              )}
            </div>
            <span className={`text-xs flex-shrink-0 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDate(previewDate)}</span>
          </div>
          <p className={`text-xs truncate mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            {previewText || 'No messages yet'}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors(status, dark)}`}>{status}</span>
            <ChevronRight size={14} className={`transition-transform group-hover:translate-x-0.5 ${dark ? 'text-gray-600' : 'text-gray-300'}`} />
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message, isMe, dark }) {
  const text = message.messageBody || message.messageText || message.text || message.content || '';
  const dateStr = message.createdDate || message.receiveDate || '';
  const sender = message.senderUsername || message.sender?.username || message.sender || '';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isMe && (
        <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold mr-2 mt-1 ${
          dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
        }`}>
          {sender[0]?.toUpperCase() || 'U'}
        </div>
      )}
      <div className={`flex flex-col max-w-[74%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && sender && (
          <span className={`text-xs mb-1 px-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{sender}</span>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
          isMe
            ? dark
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-blue-500 text-white rounded-br-sm'
            : dark
              ? 'bg-gray-700 text-gray-100 rounded-bl-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
        }`}>
          {text}
        </div>
        <span className={`text-xs mt-1 px-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>{formatDate(dateStr)}</span>
      </div>
      {isMe && (
        <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold ml-2 mt-1 ${
          dark ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
        }`}>
          Me
        </div>
      )}
    </div>
  );
}

export default function OrderMessageSidebar({ order, onClose }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const orderId = order?.orderId || '';
  const itemId = order?.lineItems?.[0]?.legacyItemId || '';
  const buyerUsername = order?.buyer?.username || '';
  const itemTitle = order?.lineItems?.[0]?.title || 'Order';

  const [view, setView] = useState('list');
  const [conversations, setConversations] = useState([]);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState(null);
  const [msgError, setMsgError] = useState(null);
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const [newConvoMode, setNewConvoMode] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const bottomRef = useRef(null);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadMessages = useCallback(async (convo) => {
    setLoadingMsgs(true);
    setMsgError(null);
    setMessages([]);
    try {
      const resp = await ebayAPI.getConversationMessages(convo.conversationId, {
        conversationType: convo.conversationType || CONV_TYPE,
        limit: 50,
      });
      const msgs = resp?.data?.messages || [];
      setMessages(sortMessagesAscending(msgs));
      ebayAPI.updateConversation({
        conversationId: convo.conversationId,
        conversationType: convo.conversationType || CONV_TYPE,
        read: true,
      }).catch(() => {});
    } catch (err) {
      setMsgError(err?.response?.data?.error || err.message || 'Failed to load messages');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const openConversation = useCallback((convo) => {
    setSelectedConvo(convo);
    setNewConvoMode(false);
    setView('thread');
    loadMessages(convo);
  }, [loadMessages]);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    setError(null);
    try {
      const params = { conversationType: CONV_TYPE };
      if (itemId) { params.itemId = itemId; }
      if (buyerUsername) params.buyerUsername = buyerUsername;
      const resp = await ebayAPI.getOrderConversations(params);
      const convos = resp?.data?.conversations || [];
      setConversations(convos);
      if (convos.length === 1) {
        openConversation(convos[0]);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load conversations');
    } finally {
      setLoadingConvos(false);
    }
  }, [itemId, buyerUsername, openConversation]);

  const handleSend = useCallback(async () => {
    const text = composeText.trim();
    if (!text || sending) return;
    setSending(true);
    setMsgError(null);
    try {
      const payload = { messageText: text };
      if (!newConvoMode && selectedConvo) {
        payload.conversationId = selectedConvo.conversationId;
      } else {
        payload.otherPartyUsername = buyerUsername;
        if (itemId) payload.reference = { referenceId: itemId, referenceType: 'LISTING' };
      }
      await ebayAPI.sendMessage(payload);
      setComposeText('');
      if (!newConvoMode && selectedConvo) {
        const resp = await ebayAPI.getConversationMessages(selectedConvo.conversationId, {
          conversationType: selectedConvo.conversationType || CONV_TYPE,
          limit: 50,
        });
        setMessages(sortMessagesAscending(resp?.data?.messages || []));
      } else {
        setNewConvoMode(false);
        setView('list');
        await loadConversations();
      }
    } catch (err) {
      setMsgError(err?.response?.data?.error || err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [composeText, sending, newConvoMode, selectedConvo, buyerUsername, itemId, loadConversations]);

  const toggleStatus = useCallback(async () => {
    if (!selectedConvo || updatingStatus) return;
    const cur = (selectedConvo.conversationStatus || 'ACTIVE').toUpperCase();
    const next = cur === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    setUpdatingStatus(true);
    try {
      await ebayAPI.updateConversation({
        conversationId: selectedConvo.conversationId,
        conversationType: selectedConvo.conversationType || CONV_TYPE,
        conversationStatus: next,
      });
      setSelectedConvo((c) => ({ ...c, conversationStatus: next }));
      setConversations((prev) => prev.map((c) =>
        c.conversationId === selectedConvo.conversationId ? { ...c, conversationStatus: next } : c
      ));
    } catch (err) {
      setMsgError(err?.response?.data?.error || err.message || 'Failed to update');
    } finally {
      setUpdatingStatus(false);
    }
  }, [selectedConvo, updatingStatus]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (messages.length) scrollToBottom(); }, [messages]);

  const isMe = (msg) => {
    const senderName = msg?.senderUsername || msg?.sender?.username || msg?.sender || '';
    if (!senderName || !buyerUsername) return false;
    return senderName.toLowerCase() !== buyerUsername.toLowerCase();
  };

  const convoStatus = (selectedConvo?.conversationStatus || 'ACTIVE').toUpperCase();
  const otherParty = selectedConvo?.otherParty?.username || selectedConvo?.buyer?.username || buyerUsername || 'Buyer';
  const showThread = view === 'thread' || newConvoMode;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      <div className={`fixed right-0 top-0 h-full z-50 w-[540px] flex flex-col shadow-2xl ${
        dark ? 'bg-gray-900 border-l border-gray-700' : 'bg-white border-l border-gray-200'
      }`}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${
          dark ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {showThread && (
            <button
              onClick={() => { setView('list'); setSelectedConvo(null); setMessages([]); setNewConvoMode(false); }}
              className={`p-1.5 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className={`p-2 rounded-lg flex-shrink-0 ${dark ? 'bg-blue-900/40' : 'bg-blue-50'}`}>
            <MessageSquare size={16} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold text-base truncate ${dark ? 'text-gray-100' : 'text-gray-800'}`}>
              {newConvoMode ? 'New Message' : showThread ? `@${otherParty}` : 'Message Panel'}
            </h2>
            <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {newConvoMode ? `To: ${buyerUsername}` : itemTitle}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showThread && !newConvoMode && selectedConvo && (
              <button
                onClick={toggleStatus}
                disabled={updatingStatus}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  convoStatus === 'ACTIVE'
                    ? dark ? 'bg-yellow-900/40 text-yellow-300 hover:bg-yellow-900/60' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    : dark ? 'bg-green-900/40 text-green-300 hover:bg-green-900/60' : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                <Archive size={12} />
                {updatingStatus ? '…' : convoStatus === 'ACTIVE' ? 'Archive' : 'Restore'}
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Order strip */}
        <div className={`flex items-center gap-3 px-5 py-2.5 border-b text-xs flex-shrink-0 ${
          dark ? 'bg-gray-800/50 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-100 text-gray-500'
        }`}>
          <span>Order: <span className={`font-mono ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{orderId || '—'}</span></span>
          <span className={dark ? 'text-gray-600' : 'text-gray-300'}>|</span>
          <span>Buyer: <span className={`font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{buyerUsername || '—'}</span></span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── CONVERSATIONS LIST ── */}
          {!showThread && (
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConvos ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className={`h-24 rounded-xl animate-pulse ${dark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  ))}
                </div>
              ) : error ? (
                <div className={`p-4 rounded-xl border ${dark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <p className="text-sm font-semibold">Could not load conversations</p>
                  <p className="text-xs mt-1 opacity-80">{error}</p>
                  <button onClick={loadConversations} className="mt-3 flex items-center gap-1.5 text-xs font-medium underline underline-offset-2">
                    <RefreshCw size={11} /> Retry
                  </button>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <MessageSquare size={28} className={dark ? 'text-gray-600' : 'text-gray-400'} />
                  </div>
                  <p className={`font-semibold text-base mb-1 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>No conversations</p>
                  <p className={`text-sm mb-6 max-w-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No messages found for this order. Start one below.
                  </p>
                  <button
                    onClick={() => { setNewConvoMode(true); setView('thread'); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                  >
                    <Plus size={15} /> Send Message
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-medium ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={loadConversations}
                      className={`flex items-center gap-1.5 text-xs ${dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <RefreshCw size={11} /> Refresh
                    </button>
                  </div>
                  {conversations.map((c) => (
                    <ConversationCard key={c.conversationId} convo={c} onClick={openConversation} dark={dark} fallbackUsername={buyerUsername} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MESSAGE THREAD ── */}
          {showThread && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {newConvoMode ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-3 ${
                      dark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {(buyerUsername || 'B')[0].toUpperCase()}
                    </div>
                    <p className={`font-semibold text-sm ${dark ? 'text-gray-200' : 'text-gray-700'}`}>{buyerUsername}</p>
                    <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Starting a new conversation…</p>
                  </div>
                ) : loadingMsgs ? (
                  <div className="space-y-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
                        <div className={`h-12 rounded-2xl animate-pulse ${i % 2 ? 'w-52' : 'w-44'} ${dark ? 'bg-gray-800' : 'bg-gray-100'}`} />
                      </div>
                    ))}
                  </div>
                ) : msgError ? (
                  <div className={`p-4 rounded-xl border ${dark ? 'bg-red-900/20 border-red-800 text-red-300' : 'bg-red-50 border-red-200 text-red-600'}`}>
                    <p className="text-sm font-semibold">Failed to load messages</p>
                    <p className="text-xs mt-1 opacity-80">{msgError}</p>
                    {selectedConvo && (
                      <button onClick={() => loadMessages(selectedConvo)} className="mt-3 flex items-center gap-1.5 text-xs font-medium underline underline-offset-2">
                        <RefreshCw size={11} /> Retry
                      </button>
                    )}
                  </div>
                ) : messages.length === 0 ? (
                  <p className={`text-center text-sm py-10 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    No messages in this conversation yet.
                  </p>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <MessageBubble key={msg.messageId || idx} message={msg} isMe={isMe(msg)} dark={dark} />
                    ))}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Compose */}
              <div className={`flex-shrink-0 border-t px-4 py-3 ${dark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                {msgError && !loadingMsgs && (
                  <p className={`text-xs mb-2 ${dark ? 'text-red-400' : 'text-red-500'}`}>{msgError}</p>
                )}
                <div className={`flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  dark
                    ? 'bg-gray-800 border-gray-600 focus-within:border-blue-500'
                    : 'bg-gray-50 border-gray-200 focus-within:border-blue-400'
                }`}>
                  <textarea
                    value={composeText}
                    onChange={(e) => setComposeText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
                    maxLength={2000}
                    rows={3}
                    className={`flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed ${
                      dark ? 'text-gray-100 placeholder:text-gray-500' : 'text-gray-800 placeholder:text-gray-400'
                    }`}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!composeText.trim() || sending}
                    className={`flex-shrink-0 p-2.5 rounded-lg transition-all ${
                      composeText.trim() && !sending
                        ? 'bg-blue-500 hover:bg-blue-600 text-white'
                        : dark ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {sending
                      ? <RefreshCw size={15} className="animate-spin" />
                      : <Send size={15} />
                    }
                  </button>
                </div>
                <div className="flex justify-between items-center mt-1.5 px-1">
                  <span className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>Shift+Enter for new line</span>
                  <span className={`text-xs ${composeText.length > 1800 ? 'text-orange-400' : dark ? 'text-gray-600' : 'text-gray-400'}`}>
                    {composeText.length}/2000
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer — new message button (only in list view with existing conversations) */}
        {!showThread && !loadingConvos && !error && conversations.length > 0 && (
          <div className={`flex-shrink-0 px-5 py-3 border-t ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              onClick={() => { setNewConvoMode(true); setView('thread'); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} /> New Message to Buyer
            </button>
          </div>
        )}
      </div>
    </>
  );
}
