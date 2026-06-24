import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function inRange(day, from, to) {
  if (!from || !to) return false;
  const t = startOfDay(day).getTime();
  return t > startOfDay(from).getTime() && t < startOfDay(to).getTime();
}

function CalendarMonth({ year, month, from, to, hovering, onDayClick, onDayHover, isDark }) {
  const firstDay = new Date(year, month, 1);
  // Week starts Monday: getDay() returns 0=Sun,1=Mon,...6=Sat
  const startOffset = (firstDay.getDay() + 6) % 7; // days before the 1st
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const today = startOfDay(new Date());
  const tp  = isDark ? 'text-slate-100' : 'text-slate-800';
  const ts  = isDark ? 'text-slate-500' : 'text-slate-400';

  const effectiveTo = to || hovering;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const date = new Date(year, month, dayNum);
    const isFrom      = isSameDay(date, from);
    const isTo        = isSameDay(date, effectiveTo);
    const isInRange   = inRange(date, from, effectiveTo);
    const isToday     = isSameDay(date, today);
    const isWeekend   = date.getDay() === 0 || date.getDay() === 6;

    return { dayNum, date, isFrom, isTo, isInRange, isToday, isWeekend };
  });

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className={`text-center text-[10px] font-semibold py-1 ${ts}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} />;
          const { dayNum, date, isFrom, isTo, isInRange, isToday, isWeekend } = cell;

          let dayClass = '';
          let cellBg = '';

          if (isFrom || isTo) {
            dayClass = 'bg-blue-600 text-white font-bold rounded-full z-10';
            if (isFrom && effectiveTo && !isSameDay(date, effectiveTo)) {
              cellBg = isDark
                ? 'bg-blue-900/40 rounded-l-full'
                : 'bg-blue-100 rounded-l-full';
            } else if (isTo && from && !isSameDay(date, from)) {
              cellBg = isDark
                ? 'bg-blue-900/40 rounded-r-full'
                : 'bg-blue-100 rounded-r-full';
            }
          } else if (isInRange) {
            dayClass = isDark ? 'text-blue-200' : 'text-blue-700';
            cellBg = isDark ? 'bg-blue-900/40' : 'bg-blue-100';
          } else {
            dayClass = isToday
              ? `font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`
              : isWeekend
                ? isDark ? 'text-slate-400' : 'text-slate-500'
                : isDark ? 'text-slate-200' : 'text-slate-700';
          }

          return (
            <div key={i} className={`relative flex items-center justify-center ${cellBg}`}>
              <button
                type="button"
                onClick={() => onDayClick(date)}
                onMouseEnter={() => onDayHover(date)}
                className={`
                  w-8 h-8 text-xs flex items-center justify-center transition-all relative
                  ${isFrom || isTo ? dayClass : `rounded-full hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-300 ${dayClass}`}
                `}
              >
                {isFrom || isTo ? (
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold`}>
                    {dayNum}
                  </span>
                ) : (
                  dayNum
                )}
                {isToday && !(isFrom || isTo) && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ from, to, onChange, isDark }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [hovering, setHovering] = useState(null);
  const [selecting, setSelecting] = useState(null); // 'start' | null (after start chosen)
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleDayClick = (date) => {
    if (!from || selecting === 'start') {
      // Set start, wait for end
      onChange({ from: date, to: null });
      setSelecting('end');
      setHovering(null);
    } else {
      // Set end
      if (date < from) {
        // If clicked before start, swap
        onChange({ from: date, to: from });
      } else if (isSameDay(date, from)) {
        // Same day — single-day range
        onChange({ from: date, to: date });
      } else {
        onChange({ from, to: date });
      }
      setSelecting(null);
      setHovering(null);
      setOpen(false);
    }
  };

  const handleDayHover = (date) => {
    if (selecting === 'end') setHovering(date);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  // Second month (for two-month display)
  const nextViewMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextViewYear  = viewMonth === 11 ? viewYear + 1 : viewYear;

  const formatDate = (d) => d
    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const hasRange = from || to;

  const card  = isDark ? 'bg-slate-900 border-slate-700 shadow-slate-900/60' : 'bg-white border-slate-200 shadow-slate-200/80';
  const hdr   = isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200';
  const ts    = isDark ? 'text-slate-400' : 'text-slate-500';
  const tp    = isDark ? 'text-slate-100' : 'text-slate-800';

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center gap-2 transition-colors ${
          hasRange
            ? isDark
              ? 'border-blue-600/60 bg-blue-950/40 text-blue-300'
              : 'border-blue-400 bg-blue-50 text-blue-700'
            : isDark
              ? 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
        }`}
      >
        <CalendarDays size={13} className="flex-shrink-0" />
        {hasRange
          ? <span>{formatDate(from) || '…'}{to && !isSameDay(from, to) ? ` → ${formatDate(to)}` : ''}</span>
          : <span>Filter by expiry</span>}
        {hasRange && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange({ from: null, to: null }); setSelecting(null); }}
            className={`ml-1 h-4 w-4 rounded-full flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-slate-600 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700'
            }`}
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className={`absolute top-full mt-2 left-0 z-50 rounded-2xl border shadow-2xl overflow-hidden ${card}`}
             style={{ minWidth: 580 }}>
          {/* Header bar */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${hdr}`}>
            <div className={`text-xs font-semibold ${ts}`}>
              {selecting === 'end'
                ? 'Now click the end date'
                : from
                  ? `${formatDate(from)}${to ? ` → ${formatDate(to)}` : ''}`
                  : 'Click a start date'}
            </div>
            {hasRange && (
              <button
                type="button"
                onClick={() => { onChange({ from: null, to: null }); setSelecting(null); setHovering(null); }}
                className={`text-xs font-semibold px-2 py-0.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
              >
                Clear
              </button>
            )}
          </div>

          {/* Two-month grid */}
          <div className="flex gap-0">
            {/* Month 1 */}
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={prevMonth}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className={`text-sm font-semibold ${tp}`}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                <div className="w-7" />
              </div>
              <CalendarMonth
                year={viewYear} month={viewMonth}
                from={from} to={to}
                hovering={hovering}
                onDayClick={handleDayClick}
                onDayHover={handleDayHover}
                isDark={isDark}
              />
            </div>

            {/* Divider */}
            <div className={`w-px self-stretch my-4 ${isDark ? 'bg-slate-700/60' : 'bg-slate-100'}`} />

            {/* Month 2 */}
            <div className="flex-1 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-7" />
                <span className={`text-sm font-semibold ${tp}`}>{MONTH_NAMES[nextViewMonth]} {nextViewYear}</span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <CalendarMonth
                year={nextViewYear} month={nextViewMonth}
                from={from} to={to}
                hovering={hovering}
                onDayClick={handleDayClick}
                onDayHover={handleDayHover}
                isDark={isDark}
              />
            </div>
          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-t ${hdr}`}>
            <p className={`text-[11px] ${ts}`}>
              {selecting === 'end' ? 'Hover to preview range · Click to confirm' : 'Click any day to start selecting a range'}
            </p>
            {from && to && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-7 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
