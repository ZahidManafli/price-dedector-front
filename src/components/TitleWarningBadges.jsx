import React, { useMemo } from 'react';
import { checkTitle } from '../utils/titleChecker';

/**
 * HighlightedTitle
 *
 * Renders a product title with matched words highlighted inline as pills:
 *   - VERO words  → red pill   (bg-red-500 text-white)
 *   - Prohibited  → yellow pill (bg-yellow-400 text-yellow-900)
 *
 * Both types appear directly inside the title text flow, just like
 * the design reference images show.
 */
export function HighlightedTitle({ title, className = '', titleClassName = '' }) {
  const segments = useMemo(() => {
    if (!title) return [{ text: '', type: 'plain', key: 0 }];

    const { veroMatches, prohibitedMatches } = checkTitle(title);

    const allMatches = [
      ...veroMatches.map((w) => ({ word: w, type: 'vero' })),
      ...prohibitedMatches.map((w) => ({ word: w, type: 'prohibited' })),
    ];

    if (!allMatches.length) {
      return [{ text: title, type: 'plain', key: 0 }];
    }

    // Build one regex that captures ALL matched words (VERO + prohibited)
    const pattern = allMatches
      .map((m) => m.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    // Map lower-cased word → type for fast lookup
    const typeMap = new Map(
      allMatches.map((m) => [m.word.toLowerCase(), m.type])
    );

    const parts = title.split(regex);
    return parts.map((part, i) => ({
      text: part,
      type: typeMap.get(part.toLowerCase()) ?? 'plain',
      key: i,
    }));
  }, [title]);

  return (
    <span className={`inline leading-snug ${titleClassName} ${className}`}>
      {segments.map((seg) => {
        if (seg.type === 'vero') {
          return (
            <span
              key={seg.key}
              className="inline-flex items-center mx-0.5 rounded px-1.5 py-0.5 text-[0.82em] font-bold leading-none bg-red-500 text-white align-middle whitespace-nowrap"
              title={`VERO / IP-protected brand: "${seg.text}"`}
            >
              {seg.text}
            </span>
          );
        }
        if (seg.type === 'prohibited') {
          return (
            <span
              key={seg.key}
              className="inline-flex items-center gap-0.5 mx-0.5 rounded px-1.5 py-0.5 text-[0.82em] font-bold leading-none bg-yellow-400 text-yellow-900 align-middle whitespace-nowrap"
              title={`Prohibited / restricted word: "${seg.text}"`}
            >
              <span className="text-[10px]">⚠</span>
              {seg.text}
            </span>
          );
        }
        return <span key={seg.key}>{seg.text}</span>;
      })}
    </span>
  );
}

/** Backward-compat default export */
export default function TitleWarningBadges({ title, className }) {
  return <HighlightedTitle title={title} className={className} />;
}
