import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ListChecks, Search, Type, X } from 'lucide-react';

// "Without AI" preview -> eBay aspects for the suggested category, straight from
// the eBay Taxonomy API (backend fetchTaxonomyItemAspects): every field, whether
// it's required, selection-only or free text, and the values eBay allows.
// Clicking an allowed value writes it into the listing's item specifics.

const VALUE_PREVIEW = 24;

export default function EbayAspectsModal({ aspects = [], values = {}, fromAmazon = [], categoryId, isDark, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all | required | empty
  const [expanded, setExpanded] = useState({});
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const amazonSet = useMemo(() => new Set(fromAmazon), [fromAmazon]);
  const counts = useMemo(() => ({
    all: aspects.length,
    required: aspects.filter((a) => a.required).length,
    empty: aspects.filter((a) => !String(values[a.name] || '').trim()).length,
    filled: aspects.filter((a) => String(values[a.name] || '').trim()).length,
  }), [aspects, values]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return aspects
      .filter((a) => (filter === 'required' ? a.required : filter === 'empty' ? !String(values[a.name] || '').trim() : true))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || (a.values || []).some((v) => String(v).toLowerCase().includes(q)))
      // required first, then the order eBay returned
      .sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)));
  }, [aspects, values, filter, query]);

  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const faint = isDark ? 'text-slate-500' : 'text-slate-400';
  const strong = isDark ? 'text-slate-100' : 'text-slate-900';
  const tab = (active) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition ${
      active ? (isDark ? 'bg-slate-700 text-white' : 'bg-white text-slate-900 shadow-sm') : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ebay-aspects-title"
        className={`flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:rounded-2xl ${isDark ? 'bg-slate-900 ring-1 ring-slate-800' : 'bg-white'}`}
      >
        {/* Header */}
        <div className={`border-b px-5 py-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                <ListChecks size={18} />
              </span>
              <div>
                <h2 id="ebay-aspects-title" className={`text-base font-semibold ${strong}`}>eBay item specifics</h2>
                <p className={`text-xs ${muted}`}>
                  {categoryId ? `Kateqoriya ${categoryId} · ` : ''}eBay-in bu kateqoriya üçün tələb etdiyi sahələr və icazə verdiyi dəyərlər
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Bağla" className={`rounded-lg p-1.5 ${isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="relative min-w-[200px] flex-1">
              <Search size={14} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 ${faint}`} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sahə və ya dəyər axtar…"
                className={`w-full rounded-lg border py-1.5 pl-8 pr-2 text-sm outline-none focus:border-indigo-500 ${isDark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}
              />
            </label>
            <div className={`inline-flex rounded-lg p-1 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
              <button type="button" className={tab(filter === 'all')} onClick={() => setFilter('all')}>Hamısı {counts.all}</button>
              <button type="button" className={tab(filter === 'required')} onClick={() => setFilter('required')}>Məcburi {counts.required}</button>
              <button type="button" className={tab(filter === 'empty')} onClick={() => setFilter('empty')}>Boş {counts.empty}</button>
            </div>
          </div>
          <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${counts.all ? Math.round((counts.filled / counts.all) * 100) : 0}%` }} />
          </div>
          <p className={`mt-1 text-[11px] ${faint}`}>{counts.filled} / {counts.all} sahə doldurulub</p>
        </div>

        {/* Aspects */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {shown.length === 0 ? (
            <p className={`py-10 text-center text-sm ${muted}`}>
              {aspects.length === 0 ? 'Bu kateqoriya üçün eBay aspect qaytarmadı.' : 'Uyğun sahə tapılmadı.'}
            </p>
          ) : (
            <ul className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {shown.map((aspect) => {
                const current = String(values[aspect.name] || '').trim();
                const allowed = Array.isArray(aspect.values) ? aspect.values : [];
                const isOpen = !!expanded[aspect.name];
                const visible = isOpen ? allowed : allowed.slice(0, VALUE_PREVIEW);
                const selectionOnly = aspect.mode === 'SELECTION_ONLY';
                return (
                  <li key={aspect.name} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${strong}`}>{aspect.name}</span>
                      {aspect.required && (
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>Məcburi</span>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        {selectionOnly ? <ListChecks size={10} /> : <Type size={10} />}
                        {selectionOnly ? 'Siyahıdan seçim' : 'Sərbəst mətn'}
                      </span>
                      <span className={`ml-auto text-xs ${current ? (isDark ? 'text-emerald-300' : 'text-emerald-600') : faint}`}>
                        {current ? (
                          <span className="inline-flex items-center gap-1">
                            <Check size={12} /> {current}
                            {amazonSet.has(aspect.name) && (
                              <span className={`rounded px-1 text-[9px] font-semibold uppercase ${isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>Amazon</span>
                            )}
                          </span>
                        ) : (
                          'Boş'
                        )}
                      </span>
                    </div>

                    {allowed.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {visible.map((v) => {
                          const active = current === v;
                          return (
                            <button
                              key={v}
                              type="button"
                              onClick={() => onPick?.(aspect.name, active ? '' : v)}
                              title={active ? 'Seçimi ləğv et' : 'Bu dəyəri seç'}
                              className={`rounded-full border px-2 py-0.5 text-xs transition ${
                                active
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : isDark ? 'border-slate-700 text-slate-300 hover:border-indigo-400 hover:text-indigo-300' : 'border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
                              }`}
                            >
                              {v}
                            </button>
                          );
                        })}
                        {allowed.length > VALUE_PREVIEW && (
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => ({ ...prev, [aspect.name]: !isOpen }))}
                            className="rounded-full px-2 py-0.5 text-xs font-semibold text-indigo-500 hover:underline"
                          >
                            {isOpen ? 'Az göstər' : `+${allowed.length - VALUE_PREVIEW} daha`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className={`mt-1 text-xs ${faint}`}>eBay hazır dəyər vermir — istənilən mətn yazıla bilər.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={`flex items-center justify-between gap-3 border-t px-5 py-3 text-xs ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
          <span>Dəyərə basın — item specifics-ə yazılır.</span>
          <button type="button" onClick={onClose} className="btn-primary px-4 py-1.5 text-sm">Hazırdır</button>
        </div>
      </div>
    </div>
  );
}
