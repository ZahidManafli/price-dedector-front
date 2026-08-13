import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LifeBuoy, Plus, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, MessageSquare, Send, MessageCircle, X, Users, Reply, Mic, Play, Pause, Trash2 } from 'lucide-react';
import { supportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getSocket } from '../services/socket';

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Aşağı' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksək' },
];

// Ticket times are stored in UTC on the backend; mentors/users always enter and
// read them as Baku wall-clock time, matching the rest of the app's Baku-offset
// conventions (see BAKU_OFFSET_MS in cron.js).
const BAKU_OFFSET_MINUTES = 4 * 60;

function datetimeLocalToUtcIso(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - BAKU_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs).toISOString();
}

function isoToDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + BAKU_OFFSET_MINUTES * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('az-AZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Baku',
  }).format(d);
}

function PriorityPill({ priority, isDark }) {
  const label = PRIORITY_OPTIONS.find((p) => p.value === priority)?.label || priority;
  const cls = {
    high: isDark ? 'bg-rose-900/40 text-rose-300 border-rose-700' : 'bg-rose-50 text-rose-700 border-rose-300',
    medium: isDark ? 'bg-amber-900/40 text-amber-300 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300',
    low: isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300',
  }[priority] || '';
  return <span className={`border text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>{label}</span>;
}

function StatusPill({ status, isDark }) {
  const isScheduled = status === 'scheduled';
  const cls = isScheduled
    ? (isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-300')
    : (isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-300');
  return (
    <span className={`border text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {isScheduled ? 'Təyin edilib' : 'Gözləmədə'}
    </span>
  );
}

function truncateQuote(text, max = 80) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function quotePreviewText(item) {
  if (!item) return '';
  return item.messageType === 'voice' ? '🎤 Səsli mesaj' : truncateQuote(item.message, 80);
}

// The small quoted block shown at the top of a bubble when that message is a reply.
function QuotedMessagePreview({ quoted, isDark, mine }) {
  if (!quoted) return null;
  return (
    <div
      className={`mb-1.5 rounded-md border-l-4 px-2 py-1 text-xs ${
        mine
          ? 'border-white/50 bg-white/10 text-indigo-50'
          : isDark ? 'border-indigo-500 bg-slate-900/40 text-slate-300' : 'border-indigo-400 bg-slate-50 text-slate-600'
      }`}
    >
      <div className="font-semibold">{quoted.senderName}</div>
      <div className="truncate">{quotePreviewText(quoted)}</div>
    </div>
  );
}

function fmtSeconds(s) {
  const total = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// WhatsApp-style voice message bubble content: a play/pause circle, a thin
// progress bar, and the elapsed/total duration.
function VoiceMessagePlayer({ src, duration, mine, isDark }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setTotalDuration(audio.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;
  const displaySeconds = currentTime > 0 ? currentTime : totalDuration;

  return (
    <div className="flex items-center gap-2 min-w-[170px] py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full transition ${
          mine ? 'bg-white/20 text-white hover:bg-white/30' : isDark ? 'bg-slate-700 text-slate-100 hover:bg-slate-600' : 'bg-white text-indigo-600 hover:bg-slate-50'
        }`}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className={`h-1 rounded-full overflow-hidden ${mine ? 'bg-white/25' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}>
          <div className={`h-full ${mine ? 'bg-white' : 'bg-indigo-500'}`} style={{ width: `${progressPct}%` }} />
        </div>
        <span className={`text-[10px] ${mine ? 'text-indigo-100/80' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {fmtSeconds(displaySeconds)}
        </span>
      </div>
    </div>
  );
}

// WhatsApp-style reply-preview bar shown above the input while composing a reply.
function ReplyPreviewBar({ isDark, replyTarget, onCancel }) {
  if (!replyTarget) return null;
  return (
    <div className={`flex items-start gap-2 px-3 py-2 border-t ${isDark ? 'border-slate-800 bg-slate-800/60' : 'border-slate-100 bg-slate-50'}`}>
      <div className="flex-1 min-w-0 border-l-4 border-indigo-500 pl-2">
        <div className={`text-xs font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{replyTarget.senderName}</div>
        <div className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{truncateQuote(replyTarget.message, 100)}</div>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className={`shrink-0 p-1 rounded-full ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-200'}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// Hover-revealed chevron next to a message bubble — opens a tiny "Cavabla" menu,
// same interaction as WhatsApp's per-message reply control.
function ReplyMenuButton({ isDark, onReply, align = 'left' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0 self-start mt-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1 ${
          isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-200'
        }`}
        title="Cavabla"
      >
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          onMouseLeave={() => setOpen(false)}
          className={`absolute z-10 mt-1 rounded-lg border shadow-lg overflow-hidden ${align === 'right' ? 'right-0' : 'left-0'} ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReply();
              setOpen(false);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap w-full text-left ${
              isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Reply size={14} />
            Cavabla
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TicketTable({ tickets, isDark, showRequester, onAssign, onRowClick, onOpenChat }) {
  if (!tickets.length) {
    return (
      <div className={`rounded-xl border p-8 text-center text-sm ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
        Heç bir müraciət tapılmadı
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <table className="w-full text-sm">
        <thead className={isDark ? 'bg-slate-900/60' : 'bg-slate-50'}>
          <tr className={`text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <th className="px-3 py-2 font-medium">№</th>
            <th className="px-3 py-2 font-medium">Başlıq</th>
            {showRequester ? <th className="px-3 py-2 font-medium">İstifadəçi</th> : null}
            <th className="px-3 py-2 font-medium">Prioritet</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Tarix</th>
            <th className="px-3 py-2 font-medium" />
            {onAssign ? <th className="px-3 py-2 font-medium" /> : null}
          </tr>
        </thead>
        <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
          {tickets.map((t) => (
            <tr
              key={t.id}
              onClick={() => onRowClick?.(t)}
              className={`${isDark ? 'text-slate-200' : 'text-slate-700'} ${onRowClick ? `cursor-pointer ${isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}` : ''}`}
            >
              <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{t.ticketNumber}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{t.title}</div>
                <div className={`text-xs mt-0.5 max-w-md truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.description}</div>
              </td>
              {showRequester ? <td className="px-3 py-2 whitespace-nowrap">{t.userName}</td> : null}
              <td className="px-3 py-2"><PriorityPill priority={t.priority} isDark={isDark} /></td>
              <td className="px-3 py-2"><StatusPill status={t.status} isDark={isDark} /></td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {t.scheduledStart ? (
                  <>
                    <div>{fmtDateTime(t.scheduledStart)}</div>
                    <div className={isDark ? 'text-slate-500' : 'text-slate-400'}>— {fmtDateTime(t.scheduledEnd)}</div>
                  </>
                ) : '—'}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <button
                  type="button"
                  disabled={t.status !== 'scheduled'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenChat?.(t);
                  }}
                  title={t.status === 'scheduled' ? 'Söhbət' : 'Söhbət yalnız tarix təyin edildikdən sonra aktivdir'}
                  className={`p-1.5 rounded-lg transition ${
                    t.status === 'scheduled'
                      ? isDark ? 'text-indigo-300 hover:bg-slate-800' : 'text-indigo-600 hover:bg-slate-100'
                      : isDark ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <MessageSquare size={16} />
                </button>
              </td>
              {onAssign ? (
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign(t);
                    }}
                    className="btn-secondary text-xs px-2 py-1"
                  >
                    {t.status === 'scheduled' ? 'Yenidən təyin et' : 'Təyin et'}
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MONTH_NAMES_AZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const WEEKDAYS_AZ = ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'];

function pad2(n) {
  return String(n).padStart(2, '0');
}
function toISODate(y, m, d) {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function MentorCalendar({ ticketsByDate, selectedDate, onSelectDate, isDark }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const todayKey = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const goPrev = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNext = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={goPrev} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronLeft size={16} />
        </button>
        <span className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
          {MONTH_NAMES_AZ[cursor.month]} {cursor.year}
        </span>
        <button type="button" onClick={goNext} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS_AZ.map((w) => (
          <span key={w} className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateKey = toISODate(cursor.year, cursor.month, day);
          const count = ticketsByDate.get(dateKey)?.length || 0;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(isSelected ? null : dateKey)}
              className={`relative aspect-square flex items-center justify-center rounded-lg text-xs transition ${
                isSelected
                  ? 'bg-indigo-600 text-white font-bold'
                  : isToday
                  ? `ring-2 ring-indigo-400 font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`
                  : count > 0
                  ? (isDark ? 'bg-indigo-900/30 text-indigo-300 ring-1 ring-indigo-800' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200')
                  : (isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100')
              }`}
            >
              {day}
              {count > 0 && !isSelected ? <span className="absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value, isDark }) {
  return (
    <div>
      <div className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-sm mt-0.5 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value ?? '—'}</div>
    </div>
  );
}

function TicketDetailModal({ ticket, isDark, onClose, onAssign, onOpenChat }) {
  const cardCls = `w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`;

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/40'}`}>
      <div className={cardCls}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ticket.ticketNumber}</h3>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{ticket.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Bağla
          </button>
        </div>

        <div className="space-y-4">
          <DetailRow label="Təsvir" value={<span className="whitespace-pre-wrap">{ticket.description}</span>} isDark={isDark} />

          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="Prioritet" value={<PriorityPill priority={ticket.priority} isDark={isDark} />} isDark={isDark} />
            <DetailRow label="Status" value={<StatusPill status={ticket.status} isDark={isDark} />} isDark={isDark} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DetailRow label="İstifadəçi" value={ticket.userName} isDark={isDark} />
            <DetailRow label="E-poçt" value={ticket.userEmail} isDark={isDark} />
          </div>

          {ticket.status === 'scheduled' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="Mentor" value={ticket.mentorName} isDark={isDark} />
                <DetailRow label="Tarix və vaxt" value={`${fmtDateTime(ticket.scheduledStart)} — ${fmtDateTime(ticket.scheduledEnd)}`} isDark={isDark} />
              </div>
              {ticket.mentorNote ? (
                <DetailRow label="Mentor qeydi" value={<span className="whitespace-pre-wrap">{ticket.mentorNote}</span>} isDark={isDark} />
              ) : null}
            </>
          ) : null}

          <DetailRow label="Yaradılma tarixi" value={fmtDateTime(ticket.createdAt)} isDark={isDark} />
        </div>

        <div className="mt-5 flex gap-2">
          {ticket.status === 'scheduled' ? (
            <button
              type="button"
              onClick={() => onOpenChat?.(ticket)}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                isDark ? 'border border-slate-700 text-slate-100 hover:bg-slate-800' : 'border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MessageSquare size={14} />
              Söhbət
            </button>
          ) : null}
          {onAssign ? (
            <button
              type="button"
              onClick={() => onAssign(ticket)}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              {ticket.status === 'scheduled' ? 'Yenidən təyin et' : 'Təyin et'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated, isDark }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !description.trim()) {
      setError('Başlıq və təsvir tələb olunur');
      return;
    }
    try {
      setLoading(true);
      await supportAPI.createTicket({ title: title.trim(), description: description.trim(), priority });
      onCreated?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Müraciət göndərilmədi');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `w-full rounded-lg border px-3 py-2 outline-none focus:border-indigo-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/40'}`}>
      <div className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Yeni dəstək müraciəti</h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Bağla
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Başlıq"
            className={inputCls}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Təsvir"
            className={`min-h-[112px] ${inputCls}`}
          />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {error ? <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? 'Göndərilir...' : 'Göndər'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AssignScheduleModal({ ticket, onClose, onAssigned, isDark }) {
  const [start, setStart] = useState(isoToDatetimeLocal(ticket.scheduledStart));
  const [end, setEnd] = useState(isoToDatetimeLocal(ticket.scheduledEnd));
  const [note, setNote] = useState(ticket.mentorNote || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!start || !end) {
      setError('Başlanğıc və son tarix tələb olunur');
      return;
    }
    try {
      setLoading(true);
      await supportAPI.assignSchedule(ticket.id, {
        scheduledStart: datetimeLocalToUtcIso(start),
        scheduledEnd: datetimeLocalToUtcIso(end),
        mentorNote: note.trim(),
      });
      onAssigned?.();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Tarix təyin edilmədi');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = `w-full rounded-lg border px-3 py-2 outline-none focus:border-indigo-500 ${
    isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/40'}`}>
      <div className={`w-full max-w-lg rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Tarix təyin et</h3>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{ticket.ticketNumber} — {ticket.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Bağla
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={`mb-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Başlanğıc</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={`mb-1 block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Son</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Əlavə qeyd (istəyə görə)"
            className={`min-h-[84px] ${inputCls}`}
          />
          {error ? <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {loading ? 'Göndərilir...' : 'Təyin et'}
          </button>
        </form>
      </div>
    </div>
  );
}

const TYPING_STOP_DELAY_MS = 1500;
const TYPING_SAFETY_CLEAR_MS = 4000;

// Encapsulates getUserMedia/MediaRecorder so both chat surfaces (ticket chat and
// the "Mentora yaz" conversation) share the exact same recording behavior.
function useVoiceRecorder({ onSend, onError }) {
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const streamRef = useRef(null);

  const stopTracks = () => {
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordSeconds(0);
      setRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      onError?.('Mikrofona giriş rədd edildi və ya mövcud deyil');
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopTracks();
    recordedChunksRef.current = [];
    setRecording(false);
  };

  const sendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    const durationAtStop = recordSeconds;
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      recordedChunksRef.current = [];
      stopTracks();
      setRecording(false);
      onSend?.(blob, durationAtStop);
    };
    recorder.stop();
  };

  useEffect(
    () => () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      stopTracks();
    },
    []
  );

  return { recording, recordSeconds, startRecording, cancelRecording, sendRecording };
}

function TicketChatModal({ ticket, isDark, currentUserId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const bottomRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const otherTypingClearTimerRef = useRef(null);

  const otherPartyId = ticket.userId === currentUserId ? ticket.mentorId : ticket.userId;
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useEffect(() => {
    let cancelled = false;
    const s = getSocket();

    const handleMessage = (payload) => {
      if (Number(payload?.ticketId) !== Number(ticket.id)) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      setOtherTyping(false);
    };
    const handleTyping = (payload) => {
      if (Number(payload?.ticketId) !== Number(ticket.id)) return;
      setOtherTyping(!!payload?.isTyping);
      clearTimeout(otherTypingClearTimerRef.current);
      if (payload?.isTyping) {
        otherTypingClearTimerRef.current = setTimeout(() => setOtherTyping(false), TYPING_SAFETY_CLEAR_MS);
      }
    };
    const handlePresence = (payload) => {
      if (Number(payload?.ticketId) !== Number(ticket.id)) return;
      if (payload?.userId !== otherPartyId) return;
      setOtherOnline(!!payload?.online);
    };
    const joinRoom = () => s.emit('ticket:join', { ticketId: ticket.id });

    s.on('ticket:message', handleMessage);
    s.on('ticket:typing', handleTyping);
    s.on('ticket:presence', handlePresence);
    s.on('connect', joinRoom);
    if (!s.connected) s.connect();
    else joinRoom();

    (async () => {
      try {
        const res = await supportAPI.listMessages(ticket.id);
        if (!cancelled) setMessages(res?.data?.messages || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Mesajlar yüklənmədi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(typingStopTimerRef.current);
      clearTimeout(otherTypingClearTimerRef.current);
      s.emit('ticket:typing', { ticketId: ticket.id, isTyping: false });
      s.emit('ticket:leave', { ticketId: ticket.id });
      s.off('ticket:message', handleMessage);
      s.off('ticket:typing', handleTyping);
      s.off('ticket:presence', handlePresence);
      s.off('connect', joinRoom);
    };
  }, [ticket.id, otherPartyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const s = getSocket();
    s.emit('ticket:typing', { ticketId: ticket.id, isTyping: true });
    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      s.emit('ticket:typing', { ticketId: ticket.id, isTyping: false });
    }, TYPING_STOP_DELAY_MS);
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError('');
    setSending(true);
    clearTimeout(typingStopTimerRef.current);
    getSocket().emit('ticket:typing', { ticketId: ticket.id, isTyping: false });
    try {
      await supportAPI.sendMessage(ticket.id, { message: text, replyToMessageId: replyTarget?.id || null });
      setInput('');
      setReplyTarget(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Mesaj göndərilmədi');
    } finally {
      setSending(false);
    }
  };

  const uploadVoiceMessage = async (blob, durationSeconds) => {
    setError('');
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice-message.webm');
      formData.append('durationSeconds', String(durationSeconds));
      if (replyTarget?.id) formData.append('replyToMessageId', String(replyTarget.id));
      await supportAPI.sendVoiceMessage(ticket.id, formData);
      setReplyTarget(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Səsli mesaj göndərilmədi');
    } finally {
      setSending(false);
    }
  };

  const voiceRecorder = useVoiceRecorder({ onSend: uploadVoiceMessage, onError: setError });

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${isDark ? 'bg-slate-950/75' : 'bg-slate-900/40'}`}>
      <div className={`w-full max-w-lg h-[70vh] flex flex-col rounded-2xl border shadow-2xl ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className={`flex items-start justify-between gap-3 p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{ticket.ticketNumber}</h3>
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ticket.title}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                {otherOnline ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                ) : null}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${otherOnline ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
              </span>
              <span className={`text-[11px] font-medium ${otherOnline ? 'text-emerald-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {otherOnline ? 'Onlayn' : 'Oflayn'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg border px-3 py-1.5 text-sm ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Bağla
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : !messages.length ? (
            <p className={`text-sm text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hələ mesaj yoxdur. Söhbətə başlayın.</p>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === currentUserId;
              const quoted = m.replyToMessageId ? messagesById.get(m.replyToMessageId) : null;
              const bubble = (
                <div
                  onDoubleClick={() => setReplyTarget(m)}
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm cursor-pointer ${
                    mine ? 'bg-indigo-600 text-white' : isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  <QuotedMessagePreview quoted={quoted} isDark={isDark} mine={mine} />
                  {!mine ? (
                    <div className={`text-[11px] font-semibold mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.senderName}</div>
                  ) : null}
                  {m.messageType === 'voice' ? (
                    <VoiceMessagePlayer src={m.voiceUrl} duration={m.voiceDurationSeconds} mine={mine} isDark={isDark} />
                  ) : (
                    <div className="whitespace-pre-wrap">{m.message}</div>
                  )}
                  <div className={`text-[10px] mt-1 text-right ${mine ? 'text-indigo-100/70' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {fmtDateTime(m.createdAt)}
                  </div>
                </div>
              );
              return (
                <div key={m.id} className={`group flex items-start gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                  {mine ? <ReplyMenuButton isDark={isDark} onReply={() => setReplyTarget(m)} align="right" /> : null}
                  {bubble}
                  {!mine ? <ReplyMenuButton isDark={isDark} onReply={() => setReplyTarget(m)} align="left" /> : null}
                </div>
              );
            })
          )}
          {otherTyping ? (
            <div className="flex justify-start">
              <div className={`flex items-center gap-1 rounded-2xl px-3 py-2.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full animate-bounce ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <ReplyPreviewBar isDark={isDark} replyTarget={replyTarget} onCancel={() => setReplyTarget(null)} />

        {error ? <p className={`px-4 pb-2 text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p> : null}

        <form onSubmit={submit} className={`flex items-center gap-2 p-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          {voiceRecorder.recording ? (
            <div className="flex-1 flex items-center gap-2">
              <button
                type="button"
                onClick={voiceRecorder.cancelRecording}
                className={`p-2 rounded-full ${isDark ? 'text-rose-400 hover:bg-slate-800' : 'text-rose-500 hover:bg-slate-100'}`}
              >
                <Trash2 size={16} />
              </button>
              <span className="flex-1 flex items-center gap-1.5 text-sm">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmtSeconds(voiceRecorder.recordSeconds)}</span>
              </span>
              <button
                type="button"
                onClick={voiceRecorder.sendRecording}
                className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500"
              >
                <Send size={16} />
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Mesaj yazın..."
                className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 ${
                  isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              {input.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  <Send size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={voiceRecorder.startRecording}
                  disabled={sending}
                  className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500 disabled:opacity-60"
                >
                  <Mic size={16} />
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function ConversationChatPane({ conversationId, isDark, currentUserId, onActivity }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const bottomRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const otherTypingClearTimerRef = useRef(null);
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useEffect(() => {
    if (!conversationId) return undefined;
    let cancelled = false;
    setMessages([]);
    setLoading(true);
    setError('');
    setOtherTyping(false);
    setOtherOnline(false);
    const s = getSocket();

    const handleMessage = (payload) => {
      if (Number(payload?.conversationId) !== Number(conversationId)) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      setOtherTyping(false);
      onActivity?.(payload);
    };
    const handleTyping = (payload) => {
      if (Number(payload?.conversationId) !== Number(conversationId)) return;
      if (payload?.userId === currentUserId) return;
      setOtherTyping(!!payload?.isTyping);
      clearTimeout(otherTypingClearTimerRef.current);
      if (payload?.isTyping) {
        otherTypingClearTimerRef.current = setTimeout(() => setOtherTyping(false), TYPING_SAFETY_CLEAR_MS);
      }
    };
    const handlePresence = (payload) => {
      if (Number(payload?.conversationId) !== Number(conversationId)) return;
      setOtherOnline(!!payload?.online);
    };
    const joinRoom = () => s.emit('conv:join', { conversationId });

    s.on('conv:message', handleMessage);
    s.on('conv:typing', handleTyping);
    s.on('conv:presence', handlePresence);
    s.on('connect', joinRoom);
    if (!s.connected) s.connect();
    else joinRoom();

    (async () => {
      try {
        const res = await supportAPI.listConversationMessages(conversationId);
        if (!cancelled) setMessages(res?.data?.messages || []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || err.message || 'Mesajlar yüklənmədi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(typingStopTimerRef.current);
      clearTimeout(otherTypingClearTimerRef.current);
      s.emit('conv:typing', { conversationId, isTyping: false });
      s.emit('conv:leave', { conversationId });
      s.off('conv:message', handleMessage);
      s.off('conv:typing', handleTyping);
      s.off('conv:presence', handlePresence);
      s.off('connect', joinRoom);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const s = getSocket();
    s.emit('conv:typing', { conversationId, isTyping: true });
    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      s.emit('conv:typing', { conversationId, isTyping: false });
    }, TYPING_STOP_DELAY_MS);
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setError('');
    setSending(true);
    clearTimeout(typingStopTimerRef.current);
    getSocket().emit('conv:typing', { conversationId, isTyping: false });
    try {
      await supportAPI.sendConversationMessage(conversationId, { message: text, replyToMessageId: replyTarget?.id || null });
      setInput('');
      setReplyTarget(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Mesaj göndərilmədi');
    } finally {
      setSending(false);
    }
  };

  const uploadVoiceMessage = async (blob, durationSeconds) => {
    setError('');
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice-message.webm');
      formData.append('durationSeconds', String(durationSeconds));
      if (replyTarget?.id) formData.append('replyToMessageId', String(replyTarget.id));
      await supportAPI.sendConversationVoiceMessage(conversationId, formData);
      setReplyTarget(null);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Səsli mesaj göndərilmədi');
    } finally {
      setSending(false);
    }
  };

  const voiceRecorder = useVoiceRecorder({ onSend: uploadVoiceMessage, onError: setError });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-4 pt-3">
        <span className="relative flex h-2 w-2">
          {otherOnline ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /> : null}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${otherOnline ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`} />
        </span>
        <span className={`text-[11px] font-medium ${otherOnline ? 'text-emerald-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {otherOnline ? 'Onlayn' : 'Oflayn'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-slate-400" />
          </div>
        ) : !messages.length ? (
          <p className={`text-sm text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hələ mesaj yoxdur. Söhbətə başlayın.</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === currentUserId;
            const quoted = m.replyToMessageId ? messagesById.get(m.replyToMessageId) : null;
            const bubble = (
              <div
                onDoubleClick={() => setReplyTarget(m)}
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm cursor-pointer ${
                  mine ? 'bg-indigo-600 text-white' : isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'
                }`}
              >
                <QuotedMessagePreview quoted={quoted} isDark={isDark} mine={mine} />
                {!mine ? (
                  <div className={`text-[11px] font-semibold mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{m.senderName}</div>
                ) : null}
                {m.messageType === 'voice' ? (
                  <VoiceMessagePlayer src={m.voiceUrl} duration={m.voiceDurationSeconds} mine={mine} isDark={isDark} />
                ) : (
                  <div className="whitespace-pre-wrap">{m.message}</div>
                )}
                <div className={`text-[10px] mt-1 text-right ${mine ? 'text-indigo-100/70' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {fmtDateTime(m.createdAt)}
                </div>
              </div>
            );
            return (
              <div key={m.id} className={`group flex items-start gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
                {mine ? <ReplyMenuButton isDark={isDark} onReply={() => setReplyTarget(m)} align="right" /> : null}
                {bubble}
                {!mine ? <ReplyMenuButton isDark={isDark} onReply={() => setReplyTarget(m)} align="left" /> : null}
              </div>
            );
          })
        )}
        {otherTyping ? (
          <div className="flex justify-start">
            <div className={`flex items-center gap-1 rounded-2xl px-3 py-2.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full animate-bounce ${isDark ? 'bg-slate-400' : 'bg-slate-500'}`}
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <ReplyPreviewBar isDark={isDark} replyTarget={replyTarget} onCancel={() => setReplyTarget(null)} />

      {error ? <p className={`px-4 pb-2 text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p> : null}

      <form onSubmit={submit} className={`flex items-center gap-2 p-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        {voiceRecorder.recording ? (
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={voiceRecorder.cancelRecording}
              className={`p-2 rounded-full ${isDark ? 'text-rose-400 hover:bg-slate-800' : 'text-rose-500 hover:bg-slate-100'}`}
            >
              <Trash2 size={16} />
            </button>
            <span className="flex-1 flex items-center gap-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>{fmtSeconds(voiceRecorder.recordSeconds)}</span>
            </span>
            <button
              type="button"
              onClick={voiceRecorder.sendRecording}
              className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500"
            >
              <Send size={16} />
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Mesaj yazın..."
              className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 ${
                isDark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400'
              }`}
            />
            {input.trim() ? (
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                <Send size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={voiceRecorder.startRecording}
                disabled={sending}
                className="rounded-lg bg-indigo-600 p-2.5 text-white transition hover:bg-indigo-500 disabled:opacity-60"
              >
                <Mic size={16} />
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}

function timeAgoShort(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'indi';
  if (mins < 60) return `${mins}d`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  return `${Math.floor(hours / 24)}g`;
}

function SupportInboxPanel({ isDark, isMentor, currentUserId, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(isMentor);
  const [listError, setListError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [myConversationId, setMyConversationId] = useState(null);
  const [loadingMine, setLoadingMine] = useState(!isMentor);

  useEffect(() => {
    let cancelled = false;

    if (isMentor) {
      (async () => {
        setLoadingList(true);
        setListError('');
        try {
          const res = await supportAPI.listConversations();
          const list = res?.data?.conversations || [];
          if (!cancelled) {
            setConversations(list);
            setSelectedId((prev) => prev ?? list[0]?.id ?? null);
          }
        } catch (err) {
          if (!cancelled) setListError(err?.response?.data?.error || err.message || 'Söhbətlər yüklənmədi');
        } finally {
          if (!cancelled) setLoadingList(false);
        }
      })();
    } else {
      (async () => {
        setLoadingMine(true);
        try {
          const res = await supportAPI.getMyConversation();
          if (!cancelled) setMyConversationId(res?.data?.conversation?.id || null);
        } catch (err) {
          if (!cancelled) setListError(err?.response?.data?.error || err.message || 'Söhbət açılmadı');
        } finally {
          if (!cancelled) setLoadingMine(false);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [isMentor]);

  const handleActivity = (conversationId) => (payload) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === conversationId ? { ...c, lastMessage: payload.message, lastMessageAt: payload.createdAt } : c
      );
      next.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      return next;
    });
  };

  const activeConversation = conversations.find((c) => c.id === selectedId);

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className={`relative w-full ${isMentor ? 'max-w-3xl' : 'max-w-md'} h-full flex shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        {isMentor ? (
          <div className={`w-64 shrink-0 border-r flex flex-col ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className={`flex items-center gap-1.5 p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <Users size={14} className={isDark ? 'text-slate-300' : 'text-slate-500'} />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Söhbətlər</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={18} className="animate-spin text-slate-400" />
                </div>
              ) : listError ? (
                <p className={`p-4 text-xs ${isDark ? 'text-red-300' : 'text-red-600'}`}>{listError}</p>
              ) : !conversations.length ? (
                <p className={`p-4 text-sm text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Hələ söhbət yoxdur</p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b transition ${isDark ? 'border-slate-800/60' : 'border-slate-50'} ${
                      selectedId === c.id
                        ? isDark ? 'bg-slate-800' : 'bg-indigo-50'
                        : isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{c.userName}</span>
                      <span className={`text-[10px] shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{timeAgoShort(c.lastMessageAt)}</span>
                    </div>
                    {c.userPhone ? <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.userPhone}</div> : null}
                    {c.lastMessage ? (
                      <div className={`text-xs truncate mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{c.lastMessage}</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}

        <div className="flex-1 flex flex-col min-w-0">
          <div className={`flex items-center justify-between gap-3 p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <h3 className={`text-base font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isMentor ? activeConversation?.userName || 'Söhbət' : 'Mentor'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className={`shrink-0 rounded-lg border p-1.5 ${isDark ? 'border-white/15 text-slate-300 hover:bg-white/10' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <X size={16} />
            </button>
          </div>

          {isMentor ? (
            selectedId ? (
              <ConversationChatPane
                key={selectedId}
                conversationId={selectedId}
                isDark={isDark}
                currentUserId={currentUserId}
                onActivity={handleActivity(selectedId)}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Söhbət seçin</p>
              </div>
            )
          ) : loadingMine ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-slate-400" />
            </div>
          ) : myConversationId ? (
            <ConversationChatPane conversationId={myConversationId} isDark={isDark} currentUserId={currentUserId} />
          ) : (
            <p className={`p-4 text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{listError || 'Söhbət açılmadı'}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const isMentor = !!user?.isMentor || user?.role === 'admin';

  const [myTickets, setMyTickets] = useState([]);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assigningTicket, setAssigningTicket] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [chatTicket, setChatTicket] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('mine');

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    try {
      const mineRes = await supportAPI.listMine();
      setMyTickets(mineRes?.data?.tickets || []);
      if (isMentor) {
        const allRes = await supportAPI.listAll();
        setAllTickets(allRes?.data?.tickets || []);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Müraciətlər yüklənmədi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ticketsByDate = useMemo(() => {
    const map = new Map();
    for (const t of allTickets) {
      if (!t.scheduledStart) continue;
      const bakuDate = isoToDatetimeLocal(t.scheduledStart).slice(0, 10);
      if (!map.has(bakuDate)) map.set(bakuDate, []);
      map.get(bakuDate).push(t);
    }
    return map;
  }, [allTickets]);

  const ticketsOnSelectedDate = selectedDate ? (ticketsByDate.get(selectedDate) || []) : [];

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="page-title flex items-center gap-2">
          <LifeBuoy size={18} />
          Support
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Yenilə
          </button>
          <button type="button" onClick={() => setShowCreateModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={14} />
            Yeni müraciət
          </button>
          <button type="button" onClick={() => setShowInbox(true)} className="btn-secondary text-sm flex items-center gap-1.5">
            <MessageCircle size={14} />
            {isMentor ? 'Söhbətlər' : 'Mentora yaz'}
          </button>
        </div>
      </div>

      {error ? (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${isDark ? 'border-rose-800 bg-rose-950/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <AlertCircle size={14} />
          {error}
        </div>
      ) : null}

      {isMentor ? (
        <div className={`mb-6 rounded-xl p-1 border inline-flex gap-1 flex-wrap ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
          <button
            type="button"
            onClick={() => setView('mine')}
            className={`px-3 py-2 text-sm rounded-lg transition ${view === 'mine' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Mənim müraciətlərim ({myTickets.length})
          </button>
          <button
            type="button"
            onClick={() => setView('all')}
            className={`px-3 py-2 text-sm rounded-lg transition ${view === 'all' ? 'bg-indigo-600 text-white shadow-sm' : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Bütün müraciətlər ({allTickets.length})
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : !isMentor || view === 'mine' ? (
        <TicketTable tickets={myTickets} isDark={isDark} showRequester={false} onRowClick={setViewingTicket} onOpenChat={setChatTicket} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <MentorCalendar
            ticketsByDate={ticketsByDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            isDark={isDark}
          />
          <div>
            {selectedDate ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {selectedDate} tarixindəki müraciətlər ({ticketsOnSelectedDate.length})
                  </h2>
                  <button type="button" onClick={() => setSelectedDate(null)} className="text-xs text-indigo-500 hover:underline">
                    Hamısına bax
                  </button>
                </div>
                <TicketTable tickets={ticketsOnSelectedDate} isDark={isDark} showRequester onAssign={setAssigningTicket} onRowClick={setViewingTicket} onOpenChat={setChatTicket} />
              </div>
            ) : (
              <TicketTable tickets={allTickets} isDark={isDark} showRequester onAssign={setAssigningTicket} onRowClick={setViewingTicket} onOpenChat={setChatTicket} />
            )}
          </div>
        </div>
      )}

      {showCreateModal ? (
        <CreateTicketModal
          isDark={isDark}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadAllData();
          }}
        />
      ) : null}

      {assigningTicket ? (
        <AssignScheduleModal
          isDark={isDark}
          ticket={assigningTicket}
          onClose={() => setAssigningTicket(null)}
          onAssigned={() => {
            setAssigningTicket(null);
            loadAllData();
          }}
        />
      ) : null}

      {viewingTicket ? (
        <TicketDetailModal
          isDark={isDark}
          ticket={viewingTicket}
          onClose={() => setViewingTicket(null)}
          onOpenChat={(t) => {
            setViewingTicket(null);
            setChatTicket(t);
          }}
          onAssign={
            isMentor
              ? (t) => {
                  setViewingTicket(null);
                  setAssigningTicket(t);
                }
              : undefined
          }
        />
      ) : null}

      {chatTicket ? (
        <TicketChatModal
          isDark={isDark}
          ticket={chatTicket}
          currentUserId={user?.uid}
          onClose={() => setChatTicket(null)}
        />
      ) : null}

      {showInbox ? (
        <SupportInboxPanel
          isDark={isDark}
          isMentor={isMentor}
          currentUserId={user?.uid}
          onClose={() => setShowInbox(false)}
        />
      ) : null}
    </div>
  );
}
