import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Search, Tag, StickyNote, Trash2, Plus, X,
  ChevronRight, ShoppingBag, DollarSign, TrendingUp,
  AlertTriangle, Star, RotateCcw, Package, MapPin,
  Mail, Phone, Clock, Loader2, UserX, Check,
} from 'lucide-react';
import { buyersAPI } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  'bg-cyan-500', 'bg-pink-500',
];
function avatarColor(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(buyer) {
  if (buyer.fullName) {
    const parts = buyer.fullName.trim().split(/\s+/);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '');
  }
  return (buyer.username || '?').slice(0, 2).toUpperCase();
}
function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
}
function daysAgo(iso) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

// ── Tag config ────────────────────────────────────────────────────────────────
const AUTO_TAG_STYLE = {
  Repeat:    { light: 'bg-blue-100 text-blue-700 border-blue-200',    dark: 'bg-blue-900/40 text-blue-300 border-blue-700',    icon: RotateCcw },
  VIP:       { light: 'bg-violet-100 text-violet-700 border-violet-200', dark: 'bg-violet-900/40 text-violet-300 border-violet-700', icon: Star },
  Cancelled: { light: 'bg-red-100 text-red-700 border-red-200',       dark: 'bg-red-900/40 text-red-300 border-red-700',       icon: X },
  Refunded:  { light: 'bg-orange-100 text-orange-700 border-orange-200', dark: 'bg-orange-900/40 text-orange-300 border-orange-700', icon: RotateCcw },
};
const TAG_COLOR_OPTIONS = [
  { value: 'slate',  label: 'Gray',   cls: 'bg-slate-100 text-slate-700 border-slate-300',  darkCls: 'bg-slate-800 text-slate-300 border-slate-600' },
  { value: 'blue',   label: 'Blue',   cls: 'bg-blue-100 text-blue-700 border-blue-200',     darkCls: 'bg-blue-900/40 text-blue-300 border-blue-700' },
  { value: 'green',  label: 'Green',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', darkCls: 'bg-emerald-900/40 text-emerald-300 border-emerald-700' },
  { value: 'red',    label: 'Red',    cls: 'bg-red-100 text-red-700 border-red-200',         darkCls: 'bg-red-900/40 text-red-300 border-red-700' },
  { value: 'yellow', label: 'Yellow', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', darkCls: 'bg-yellow-900/40 text-yellow-300 border-yellow-700' },
  { value: 'purple', label: 'Purple', cls: 'bg-violet-100 text-violet-700 border-violet-200', darkCls: 'bg-violet-900/40 text-violet-300 border-violet-700' },
];
function tagCls(color, isDark) {
  const opt = TAG_COLOR_OPTIONS.find((o) => o.value === color) || TAG_COLOR_OPTIONS[0];
  return `${isDark ? opt.darkCls : opt.cls} border text-xs font-medium px-2 py-0.5 rounded-full`;
}
function autoTagCls(tag, isDark) {
  const s = AUTO_TAG_STYLE[tag];
  if (!s) return 'bg-slate-100 text-slate-700 border-slate-200 border text-xs font-medium px-2 py-0.5 rounded-full';
  return `${isDark ? s.dark : s.light} border text-xs font-medium px-2 py-0.5 rounded-full`;
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status, isDark }) {
  const s = String(status || '').toUpperCase();
  let cls = '';
  if (s === 'PAID') cls = isDark ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
  else if (s.includes('REFUND')) cls = isDark ? 'bg-orange-900/40 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-200';
  else cls = isDark ? 'bg-slate-800 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`border text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{s || '—'}</span>;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BuyersPage() {
  const { isDark } = useTheme();
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);       // username
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagColor, setTagColor] = useState('slate');
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const noteRef = useRef(null);

  // ── Load buyer list ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await buyersAPI.list();
        setBuyers(res?.data?.buyers || []);
      } catch { setBuyers([]); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Load buyer detail ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    (async () => {
      try {
        setDetailLoading(true);
        const res = await buyersAPI.get(selected);
        setDetail(res?.data || null);
      } catch { setDetail(null); }
      finally { setDetailLoading(false); }
    })();
  }, [selected]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: buyers.length,
    repeat: buyers.filter((b) => b.autoTags.includes('Repeat')).length,
    vip: buyers.filter((b) => b.autoTags.includes('VIP')).length,
    problem: buyers.filter((b) => b.autoTags.includes('Cancelled') || b.autoTags.includes('Refunded')).length,
  }), [buyers]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return buyers.filter((b) => {
      const matchQ = !q || b.username.toLowerCase().includes(q) || (b.fullName || '').toLowerCase().includes(q);
      const allTags = [...b.autoTags, ...b.manualTags.map((t) => t.tag)];
      const matchTag = tagFilter === 'ALL' || allTags.includes(tagFilter);
      return matchQ && matchTag;
    });
  }, [buyers, search, tagFilter]);

  // ── Unique tags for filter bar ─────────────────────────────────────────────
  const allAutoTags = useMemo(() => {
    const s = new Set();
    buyers.forEach((b) => b.autoTags.forEach((t) => s.add(t)));
    return [...s];
  }, [buyers]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addNote = async () => {
    if (!noteInput.trim() || !selected) return;
    try {
      setAddingNote(true);
      const res = await buyersAPI.addNote(selected, noteInput.trim());
      const newNote = res?.data;
      setDetail((d) => d ? { ...d, notes: [newNote, ...(d.notes || [])] } : d);
      setBuyers((bs) => bs.map((b) => b.username === selected ? { ...b, noteCount: (b.noteCount || 0) + 1 } : b));
      setNoteInput('');
    } catch { /* silent */ }
    finally { setAddingNote(false); }
  };
  const deleteNote = async (noteId) => {
    if (!selected) return;
    await buyersAPI.deleteNote(selected, noteId);
    setDetail((d) => d ? { ...d, notes: (d.notes || []).filter((n) => n.id !== noteId) } : d);
    setBuyers((bs) => bs.map((b) => b.username === selected ? { ...b, noteCount: Math.max(0, (b.noteCount || 1) - 1) } : b));
  };
  const addTag = async () => {
    if (!tagInput.trim() || !selected) return;
    try {
      setAddingTag(true);
      const res = await buyersAPI.addTag(selected, tagInput.trim(), tagColor);
      const newTag = res?.data;
      setDetail((d) => d ? { ...d, tags: [...(d.tags || []), newTag] } : d);
      setBuyers((bs) => bs.map((b) => b.username === selected ? { ...b, manualTags: [...b.manualTags, { tag: newTag.tag, color: newTag.color }] } : b));
      setTagInput('');
      setTagPanelOpen(false);
    } catch { /* silent */ }
    finally { setAddingTag(false); }
  };
  const deleteTag = async (tag) => {
    if (!selected) return;
    await buyersAPI.deleteTag(selected, tag);
    setDetail((d) => d ? { ...d, tags: (d.tags || []).filter((t) => t.tag !== tag) } : d);
    setBuyers((bs) => bs.map((b) => b.username === selected ? { ...b, manualTags: b.manualTags.filter((t) => t.tag !== tag) } : b));
  };

  // ── Current buyer summary (from list) ─────────────────────────────────────
  const selectedBuyer = useMemo(() => buyers.find((b) => b.username === selected), [buyers, selected]);

  // ── Card ───────────────────────────────────────────────────────────────────
  const c = {
    page: isDark ? 'bg-slate-950' : 'bg-slate-50',
    card: isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50',
    cardActive: isDark ? 'bg-indigo-900/30 border-indigo-700' : 'bg-indigo-50 border-indigo-300',
    text: isDark ? 'text-slate-100' : 'text-slate-900',
    sub: isDark ? 'text-slate-400' : 'text-slate-500',
    divider: isDark ? 'divide-slate-700' : 'divide-slate-200',
    input: isDark
      ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500',
    statCard: isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200',
    th: isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-50 text-slate-500',
    tr: isDark ? 'border-slate-700 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50',
  };

  return (
    <div className={`min-h-screen ${c.page}`}>
      <div className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className={`text-2xl font-bold flex items-center gap-2 ${c.text}`}>
              <Users size={22} className="text-indigo-500" />
              Alıcı CRM
            </h1>
            <p className={`text-sm mt-0.5 ${c.sub}`}>eBay sifarişlərinizdən avtomatik toplanmış alıcı məlumatları</p>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Ümumi Alıcı', value: stats.total, icon: Users, color: 'text-indigo-500', filter: 'ALL' },
            { label: 'Təkrarlayan', value: stats.repeat, icon: RotateCcw, color: 'text-blue-500', filter: 'Repeat' },
            { label: 'VIP', value: stats.vip, icon: Star, color: 'text-violet-500', filter: 'VIP' },
            { label: 'Problemli', value: stats.problem, icon: AlertTriangle, color: 'text-red-500', filter: 'Cancelled' },
          ].map(({ label, value, icon: Icon, color, filter }) => (
            <button
              key={label}
              type="button"
              onClick={() => setTagFilter((f) => f === filter ? 'ALL' : filter)}
              className={`rounded-xl border p-4 text-left transition-all ${c.statCard} ${tagFilter === filter ? (isDark ? 'ring-2 ring-indigo-500' : 'ring-2 ring-indigo-400') : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${c.sub}`}>{label}</span>
                <Icon size={15} className={color} />
              </div>
              <p className={`text-2xl font-bold ${c.text}`}>{loading ? '—' : value}</p>
            </button>
          ))}
        </div>

        {/* ── Main split layout ──────────────────────────────────────────── */}
        <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">

          {/* LEFT: Buyer list */}
          <div className={`w-80 shrink-0 flex flex-col rounded-2xl border overflow-hidden ${c.card}`}>
            {/* Search */}
            <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="relative">
                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${c.sub}`} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ad və ya istifadəçi adı axtar..."
                  className={`w-full rounded-lg pl-8 pr-3 py-2 text-sm border outline-none transition ${c.input}`}
                />
              </div>
            </div>
            {/* Tag filter chips */}
            {allAutoTags.length > 0 && (
              <div className={`flex gap-1.5 px-3 py-2 flex-wrap border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                {['ALL', ...allAutoTags].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagFilter(t)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      tagFilter === t
                        ? isDark ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-indigo-600 text-white border-indigo-600'
                        : isDark ? 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-500' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {t === 'ALL' ? 'Hamısı' : t}
                  </button>
                ))}
              </div>
            )}
            {/* Buyer items */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-full gap-2 ${c.sub}`}>
                  <UserX size={32} className="opacity-30" />
                  <p className="text-sm">Alıcı tapılmadı</p>
                </div>
              ) : (
                <ul className={`divide-y ${c.divider}`}>
                  {filtered.map((b) => {
                    const isActive = b.username === selected;
                    return (
                      <li key={b.username}>
                        <button
                          type="button"
                          onClick={() => setSelected(b.username)}
                          className={`w-full text-left px-3 py-3 transition-colors ${isActive ? c.cardActive : c.cardHover}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className={`w-9 h-9 rounded-full ${avatarColor(b.username)} shrink-0 flex items-center justify-center text-white text-sm font-bold`}>
                              {initials(b).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-sm font-semibold truncate ${c.text}`}>
                                  {b.fullName || b.username}
                                </p>
                                <ChevronRight size={12} className={c.sub} />
                              </div>
                              <p className={`text-xs truncate ${c.sub}`}>@{b.username}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                  {fmt(b.totalSpent, b.currency)}
                                </span>
                                <span className={`text-xs ${c.sub}`}>·</span>
                                <span className={`text-xs ${c.sub}`}>{b.orderCount} sifariş</span>
                              </div>
                              {/* Tags */}
                              {(b.autoTags.length > 0 || b.manualTags.length > 0) && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {b.autoTags.slice(0, 2).map((t) => (
                                    <span key={t} className={autoTagCls(t, isDark)}>{t}</span>
                                  ))}
                                  {b.manualTags.slice(0, 1).map((t) => (
                                    <span key={t.tag} className={tagCls(t.color, isDark)}>{t.tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {/* Count footer */}
            <div className={`px-3 py-2 border-t text-xs ${c.sub} ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              {filtered.length} / {buyers.length} alıcı
            </div>
          </div>

          {/* RIGHT: Detail panel */}
          <div className={`flex-1 rounded-2xl border overflow-hidden flex flex-col ${c.card}`}>
            {!selected ? (
              <div className={`flex flex-col items-center justify-center h-full gap-3 ${c.sub}`}>
                <Users size={48} className="opacity-20" />
                <p className="text-base font-medium">Alıcı seçin</p>
                <p className="text-sm opacity-60">Soldan bir alıcıya klikləyin</p>
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={28} className="animate-spin text-indigo-500" />
              </div>
            ) : !detail ? (
              <div className={`flex flex-col items-center justify-center h-full gap-2 ${c.sub}`}>
                <UserX size={36} className="opacity-30" />
                <p className="text-sm">Məlumat tapılmadı</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">

                {/* ── Buyer header ──────────────────────────────────────── */}
                <div className={`p-5 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl ${avatarColor(detail.username)} flex items-center justify-center text-white text-xl font-bold shrink-0`}>
                      {initials(selectedBuyer || { username: detail.username, fullName: detail.buyerInfo?.fullName }).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-lg font-bold truncate ${c.text}`}>
                        {detail.buyerInfo?.fullName || detail.username}
                      </h2>
                      <p className={`text-sm ${c.sub}`}>@{detail.username}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedBuyer?.autoTags.map((t) => (
                          <span key={t} className={`flex items-center gap-1 ${autoTagCls(t, isDark)}`}>
                            {t === 'Repeat' && <RotateCcw size={9} />}
                            {t === 'VIP' && <Star size={9} />}
                            {(t === 'Cancelled' || t === 'Refunded') && <AlertTriangle size={9} />}
                            {t}
                          </span>
                        ))}
                        {detail.tags?.map((t) => (
                          <span key={t.id} className={`flex items-center gap-1 ${tagCls(t.color, isDark)}`}>
                            {t.tag}
                            <button type="button" onClick={() => deleteTag(t.tag)} className="opacity-50 hover:opacity-100 ml-0.5">
                              <X size={9} />
                            </button>
                          </span>
                        ))}
                        {/* Add tag */}
                        {!tagPanelOpen ? (
                          <button
                            type="button"
                            onClick={() => setTagPanelOpen(true)}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed transition-colors ${
                              isDark ? 'border-slate-600 text-slate-400 hover:border-slate-400' : 'border-slate-300 text-slate-500 hover:border-slate-400'
                            }`}
                          >
                            <Plus size={9} /> Etket
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              autoFocus
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') setTagPanelOpen(false); }}
                              placeholder="Etket adı..."
                              className={`rounded-lg border px-2 py-0.5 text-xs outline-none w-28 ${c.input}`}
                            />
                            <div className="flex gap-1">
                              {TAG_COLOR_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setTagColor(opt.value)}
                                  title={opt.label}
                                  className={`w-4 h-4 rounded-full border-2 ${opt.cls.split(' ')[0]} ${tagColor === opt.value ? 'border-slate-800 dark:border-white scale-125' : 'border-transparent'}`}
                                />
                              ))}
                            </div>
                            <button type="button" onClick={addTag} disabled={addingTag || !tagInput.trim()} className={`text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${isDark ? 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40'}`}>
                              {addingTag ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            </button>
                            <button type="button" onClick={() => { setTagPanelOpen(false); setTagInput(''); }} className={`text-xs ${c.sub} hover:opacity-100 opacity-60`}><X size={12} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact row */}
                  <div className={`flex flex-wrap gap-4 mt-4 text-sm ${c.sub}`}>
                    {detail.buyerInfo?.email && (
                      <span className="flex items-center gap-1.5"><Mail size={13} />{detail.buyerInfo.email}</span>
                    )}
                    {detail.buyerInfo?.phone && (
                      <span className="flex items-center gap-1.5"><Phone size={13} />{detail.buyerInfo.phone}</span>
                    )}
                    {(detail.buyerInfo?.city || detail.buyerInfo?.countryCode) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} />
                        {[detail.buyerInfo.city, detail.buyerInfo.stateOrProvince, detail.buyerInfo.countryCode].filter(Boolean).join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Summary stats ──────────────────────────────────────── */}
                <div className={`grid grid-cols-2 md:grid-cols-4 gap-px border-b ${isDark ? 'border-slate-700 bg-slate-700' : 'border-slate-200 bg-slate-200'}`}>
                  {[
                    { label: 'Sifarişlər', value: selectedBuyer?.orderCount ?? detail.orders.length, icon: ShoppingBag, color: 'text-indigo-500' },
                    { label: 'Ümumi Xərc', value: fmt(selectedBuyer?.totalSpent || 0, selectedBuyer?.currency || 'USD'), icon: DollarSign, color: 'text-emerald-500' },
                    { label: 'Orta Sifariş', value: fmt(selectedBuyer?.avgOrder || 0, selectedBuyer?.currency || 'USD'), icon: TrendingUp, color: 'text-blue-500' },
                    { label: 'Son Sifariş', value: daysAgo(selectedBuyer?.lastOrder) || '—', icon: Clock, color: 'text-amber-500' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className={`flex flex-col items-center justify-center py-4 gap-1 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                      <Icon size={16} className={color} />
                      <p className={`text-lg font-bold ${c.text}`}>{value}</p>
                      <p className={`text-xs ${c.sub}`}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* ── Notes + Orders ─────────────────────────────────────── */}
                <div className="p-5 space-y-6">

                  {/* Notes */}
                  <section>
                    <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${c.text}`}>
                      <StickyNote size={14} className="text-amber-500" /> Qeydlər
                      <span className={`text-xs font-normal ${c.sub}`}>({detail.notes?.length || 0})</span>
                    </h3>
                    <div className="flex gap-2 mb-3">
                      <input
                        ref={noteRef}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); } }}
                        placeholder="Yeni qeyd əlavə et..."
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition ${c.input}`}
                      />
                      <button
                        type="button"
                        onClick={addNote}
                        disabled={addingNote || !noteInput.trim()}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                          isDark ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {addingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      </button>
                    </div>
                    {detail.notes?.length > 0 ? (
                      <ul className="space-y-2">
                        {detail.notes.map((n) => (
                          <li key={n.id} className={`flex items-start gap-3 rounded-xl p-3 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${c.text}`}>{n.note}</p>
                              <p className={`text-xs mt-0.5 ${c.sub}`}>{fmtDate(n.createdAt)}</p>
                            </div>
                            <button type="button" onClick={() => deleteNote(n.id)} className={`shrink-0 p-1 rounded opacity-40 hover:opacity-100 hover:text-red-500 transition-all`}>
                              <Trash2 size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={`text-xs ${c.sub}`}>Hələ heç bir qeyd yoxdur.</p>
                    )}
                  </section>

                  {/* Orders */}
                  <section>
                    <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${c.text}`}>
                      <Package size={14} className="text-indigo-500" /> Sifariş Tarixi
                      <span className={`text-xs font-normal ${c.sub}`}>({detail.orders?.length || 0})</span>
                    </h3>
                    {detail.orders?.length > 0 ? (
                      <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={`text-xs uppercase tracking-wider ${c.th}`}>
                              <th className="px-4 py-2.5 text-left font-medium">Sifariş ID</th>
                              <th className="px-4 py-2.5 text-left font-medium">Məhsul</th>
                              <th className="px-4 py-2.5 text-left font-medium">Tarix</th>
                              <th className="px-4 py-2.5 text-right font-medium">Məbləğ</th>
                              <th className="px-4 py-2.5 text-left font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${c.divider}`}>
                            {detail.orders.map((o) => (
                              <tr key={o.orderId} className={`transition-colors ${c.tr} ${o.isCancelled ? (isDark ? 'opacity-50' : 'opacity-60') : ''}`}>
                                <td className={`px-4 py-3 font-mono text-xs ${c.sub}`}>
                                  {o.isCancelled && (
                                    <span className={`inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 -translate-y-0.5`} />
                                  )}
                                  {String(o.orderId).slice(-10)}
                                </td>
                                <td className={`px-4 py-3 max-w-[200px] ${c.text}`}>
                                  <p className="truncate text-xs">{o.items[0]?.title || '—'}</p>
                                  {o.items.length > 1 && (
                                    <p className={`text-xs ${c.sub}`}>+{o.items.length - 1} daha</p>
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-xs whitespace-nowrap ${c.sub}`}>{fmtDate(o.creationDate)}</td>
                                <td className={`px-4 py-3 text-right text-xs font-semibold ${o.isCancelled ? c.sub : (isDark ? 'text-emerald-300' : 'text-emerald-700')}`}>
                                  {o.isCancelled ? <s>{fmt(o.total, o.currency)}</s> : fmt(o.total, o.currency)}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusPill status={o.isCancelled ? 'CANCELLED' : o.paymentStatus} isDark={isDark} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className={`text-xs ${c.sub}`}>Bu alıcı üçün sifariş tapılmadı.</p>
                    )}
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
