import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp, AlertCircle } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad2 = (n) => String(n).padStart(2, '0');
const toISODate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ day: cells.length - (firstDay + daysInMonth) + 1, inMonth: false });
  }
  return cells;
}

function SkeletonCalendar() {
  return (
    <div className="p-4 animate-pulse">
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2 mb-4" />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

export default function UpcomingEventsCalendar({ events, loading, error, onRetry }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const eventsByDate = useMemo(() => {
    const map = new Map();
    for (const ev of events || []) {
      const key = String(ev?.eventDate || '').slice(0, 10);
      if (key) map.set(key, ev);
    }
    return map;
  }, [events]);

  const nextEvent = useMemo(() => {
    const todayKey = toISODate(today.getFullYear(), today.getMonth(), today.getDate());
    const upcoming = (events || [])
      .filter((ev) => String(ev?.eventDate || '').slice(0, 10) >= todayKey)
      .sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
    return upcoming[0] || null;
  }, [events, today]);

  const daysUntilNextEvent = useMemo(() => {
    if (!nextEvent?.eventDate) return null;
    const target = new Date(`${nextEvent.eventDate}T00:00:00`);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((target - start) / 86_400_000);
  }, [nextEvent, today]);

  const goPrevMonth = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNextMonth = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const todayKey = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const isEventText = nextEvent?.values === 1;
  const keywords = !isEventText ? (nextEvent?.trendingNiche || []).filter(Boolean) : [];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="h-0.5 w-full bg-gradient-to-r from-rose-500 to-orange-500" />
      <div className="flex items-center justify-between px-4 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-slate-500 dark:text-slate-400"><CalendarDays size={15} /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">Upcoming Events</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-tight">Seasonal niches &amp; dropshipping dates</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          🌐 US
        </span>
      </div>

      {loading ? (
        <SkeletonCalendar />
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-4 pt-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={goPrevMonth} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {MONTH_NAMES[cursor.month]} {cursor.year}
              </span>
              <button onClick={goNextMonth} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, i) => {
                const dateKey = cell.inMonth ? toISODate(cursor.year, cursor.month, cell.day) : null;
                const isToday = dateKey === todayKey;
                const hasEvent = dateKey ? eventsByDate.has(dateKey) : false;
                return (
                  <div
                    key={i}
                    title={hasEvent ? eventsByDate.get(dateKey)?.eventName : undefined}
                    className={`relative aspect-square flex items-center justify-center rounded-lg text-xs ${
                      !cell.inMonth
                        ? 'text-slate-300 dark:text-slate-700'
                        : isToday
                        ? 'bg-blue-600 text-white font-bold'
                        : hasEvent
                        ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 font-semibold ring-1 ring-rose-200 dark:ring-rose-800'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cell.day}
                    {hasEvent && !isToday && (
                      <span className="absolute bottom-0 right-0 text-[8px]">🇺🇸</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {nextEvent && (
            <div className="px-4 pb-4 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-teal-500 dark:text-teal-400">
                {daysUntilNextEvent === 0
                  ? `Today: ${nextEvent.eventName}`
                  : `${daysUntilNextEvent} day${daysUntilNextEvent === 1 ? '' : 's'} until ${nextEvent.eventName}`}
              </p>

              {isEventText ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {String(nextEvent.trendingNiche?.[0] || '').replace(/\\n/g, ' ').replace(/\\r/g, '')}
                </p>
              ) : keywords.length > 0 ? (
                <>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-3 mb-2">
                    Trending Keywords for {nextEvent.eventName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {keywords.slice(0, 8).map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <TrendingUp size={10} className="text-emerald-500" />
                        {kw}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
