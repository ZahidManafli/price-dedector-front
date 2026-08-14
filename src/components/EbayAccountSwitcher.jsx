import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Store } from 'lucide-react';

// Professional dropdown for switching the active eBay account/store — used on
// both the Listings and Orders pages. Replaces a bare native <select> (which
// renders the option list in the browser's own unstyled UI, clashing with the
// rounded pill it sits inside) with a fully custom, themed listbox.
export default function EbayAccountSwitcher({ accounts = [], activeAccountId, activeAccountLabel, onChange, disabled = false, label, isDark = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const accountLabel = (a) => a?.connectionName || a?.username || a?.profileUserId || 'eBay account';
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const currentLabel = accountLabel(activeAccount) || activeAccountLabel || 'eBay account';

  const pillBase = `inline-flex items-center gap-1.5 rounded-full pl-3 pr-2.5 py-2 text-md border transition-colors ${
    isDark ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }`;

  // Only one account (or none) — nothing to switch to, show a plain static badge.
  if (accounts.length <= 1) {
    return (
      <span className={pillBase}>
        {label}: <span className="ml-1 font-semibold">{currentLabel}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${pillBase} ${disabled ? 'opacity-60 cursor-wait' : 'cursor-pointer hover:shadow-sm'} ${
          open ? (isDark ? 'ring-2 ring-emerald-600/40' : 'ring-2 ring-emerald-300') : ''
        }`}
      >
        <Store size={13} className="flex-shrink-0 opacity-80" />
        {label}: <span className="font-semibold">{currentLabel}</span>
        {disabled ? (
          <Loader2 size={13} className="animate-spin ml-0.5" />
        ) : (
          <ChevronDown size={13} className={`ml-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full mt-2 right-0 min-w-[220px] max-w-[320px] z-50 rounded-xl border shadow-2xl overflow-hidden py-1 ${
            isDark ? 'bg-slate-900 border-slate-700 shadow-slate-900/60' : 'bg-white border-slate-200 shadow-slate-300/50'
          }`}
        >
          <div className={`px-3 pt-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            eBay {label}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {accounts.map((a) => {
              const selected = a.id === activeAccountId;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setOpen(false);
                    if (!selected) onChange(a.id);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    selected
                      ? isDark ? 'bg-emerald-900/30 text-emerald-200' : 'bg-emerald-50 text-emerald-700'
                      : isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Store size={14} className="flex-shrink-0 opacity-60" />
                  <span className="flex-1 truncate font-medium">{accountLabel(a)}</span>
                  {selected && <Check size={14} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
