// Shared visual primitives for dashboard analytics sections (Seller Analytics, Finance, ...)
// so every "eBay data" card in the dashboard shares one consistent design language.

import { useState } from 'react';

export function SectionCard({ isDark, className = '', children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${
        isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      } ${className}`}
    >
      {children}
    </div>
  );
}

const ACCENT_MAP = {
  indigo: { text: 'text-indigo-500', ring: 'from-indigo-500/15' },
  emerald: { text: 'text-emerald-500', ring: 'from-emerald-500/15' },
  rose: { text: 'text-rose-500', ring: 'from-rose-500/15' },
  amber: { text: 'text-amber-500', ring: 'from-amber-500/15' },
  violet: { text: 'text-violet-500', ring: 'from-violet-500/15' },
  sky: { text: 'text-sky-500', ring: 'from-sky-500/15' },
};

export function StatTile({ isDark, icon: Icon, label, value, sublabel, accent = 'indigo' }) {
  const a = ACCENT_MAP[accent] || ACCENT_MAP.indigo;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 ${
        isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className={`pointer-events-none absolute -top-6 -right-6 h-16 w-16 rounded-full bg-gradient-to-br ${a.ring} to-transparent blur-xl`} />
      <div className="relative flex items-center gap-1.5">
        {Icon && <Icon size={12} className={a.text} />}
        <p className={`text-[10px] uppercase tracking-wide font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
      </div>
      <p className={`relative mt-1 text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{value}</p>
      {sublabel && <p className={`relative text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{sublabel}</p>}
    </div>
  );
}

export function WidgetDenied({ isDark, message, fallback, LockIcon }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-dashed px-3 py-4 text-xs ${
      isDark ? 'border-slate-700 text-slate-400 bg-slate-950/30' : 'border-slate-300 text-slate-500 bg-slate-50'
    }`}>
      {LockIcon && <LockIcon size={14} className="mt-0.5 shrink-0" />}
      <span>{message || fallback}</span>
    </div>
  );
}

export function EmptyState({ isDark, children }) {
  return (
    <div className={`rounded-xl border border-dashed px-3 py-6 text-center text-xs ${
      isDark ? 'border-slate-700 text-slate-400 bg-slate-950/30' : 'border-slate-300 text-slate-500 bg-slate-50'
    }`}>
      {children}
    </div>
  );
}

const DOT_STYLE = {
  emerald: { light: 'bg-emerald-50 border-emerald-200 text-emerald-700', dark: 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300', dot: '#10b981' },
  sky: { light: 'bg-sky-50 border-sky-200 text-sky-700', dark: 'bg-sky-950/40 border-sky-800/60 text-sky-300', dot: '#0ea5e9' },
  amber: { light: 'bg-amber-50 border-amber-200 text-amber-700', dark: 'bg-amber-950/40 border-amber-800/60 text-amber-300', dot: '#f59e0b' },
  rose: { light: 'bg-rose-50 border-rose-200 text-rose-700', dark: 'bg-rose-950/40 border-rose-800/60 text-rose-300', dot: '#ef4444' },
  violet: { light: 'bg-violet-50 border-violet-200 text-violet-700', dark: 'bg-violet-950/40 border-violet-800/60 text-violet-300', dot: '#8b5cf6' },
  slate: { light: 'bg-slate-100 border-slate-200 text-slate-600', dark: 'bg-slate-900/50 border-slate-700 text-slate-400', dot: '#94a3b8' },
};

/** Small rounded-full colored-dot badge — reused for every status/rating/level chip in the dashboard. */
export function Dot({ isDark, color = 'slate', children }) {
  const style = DOT_STYLE[color] || DOT_STYLE.slate;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${isDark ? style.dark : style.light}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {children}
    </span>
  );
}

/** Lightweight centered modal for on-demand detail views (order/payout/transfer detail, etc). */
export function DetailModal({ isDark, title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border p-5 shadow-2xl ${
          isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Generic responsive data table with a "show all" toggle — order earnings / payouts / transactions / billing activities all share this. */
export function DataTable({ isDark, columns, rows, keyField = 'id', defaultVisible = 8, onRowClick, emptyMessage, showAllLabel, showLessLabel }) {
  const [expanded, setExpanded] = useState(false);
  if (!rows || rows.length === 0) {
    return <EmptyState isDark={isDark}>{emptyMessage}</EmptyState>;
  }
  const visible = expanded ? rows : rows.slice(0, defaultVisible);
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: isDark ? '#1e293b' : '#e2e8f0' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className={isDark ? 'bg-slate-950/60' : 'bg-slate-50'}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2 font-semibold whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row[keyField] || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${i % 2 === 0 ? '' : isDark ? 'bg-slate-950/30' : 'bg-slate-50/60'} ${
                  onRowClick ? (isDark ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/60') : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-1.5 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'} ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > defaultVisible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition ${
            isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-900/60' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {expanded ? (showLessLabel || 'Show less') : `${showAllLabel || 'Show all'} (${rows.length})`}
        </button>
      )}
    </div>
  );
}
