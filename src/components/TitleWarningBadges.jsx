import React, { useMemo } from 'react';
import { getTitleWarnings, checkTitle } from '../utils/titleChecker';

/**
 * Splits a title string into segments, highlighting VERO-matched words
 * as inline red pills and leaving the rest as plain text.
 * Prohibited words show a ⚠ badge row below.
 *
 * Usage:
 *   <HighlightedTitle title={item.title} className="..." />
 */
export function HighlightedTitle({ title, className = '', titleClassName = '' }) {
  const segments = useMemo(() => {
    if (!title) return [{ text: '', type: 'plain' }];
    const { veroMatches, prohibitedMatches } = checkTitle(title);

    if (!veroMatches.length && !prohibitedMatches.length) {
      return [{ text: title, type: 'plain' }];
    }

    // Build a regex that matches any VERO word (case-insensitive)
    if (!veroMatches.length) {
      return [{ text: title, type: 'plain', prohibitedMatches }];
    }

    const pattern = veroMatches
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');

    const parts = title.split(regex);
    const lowerVero = new Set(veroMatches.map((w) => w.toLowerCase()));

    const segs = parts.map((part, i) => ({
      text: part,
      type: lowerVero.has(part.toLowerCase()) ? 'vero' : 'plain',
      key: i,
    }));

    return { segs, prohibitedMatches };
  }, [title]);

  // Handle both return shapes
  const segs = Array.isArray(segments) ? segments : segments.segs;
  const prohibited = Array.isArray(segments) ? [] : (segments.prohibitedMatches || []);
  const hasProhibited = prohibited.length > 0;

  return (
    <span className={`inline ${className}`}>
      {/* Inline title with VERO highlights */}
      <span className={`leading-snug ${titleClassName}`}>
        {segs.map((seg) =>
          seg.type === 'vero' ? (
            <span
              key={seg.key}
              className="inline-flex items-center mx-0.5 rounded px-1.5 py-0.5 text-[0.82em] font-bold leading-none bg-red-500 text-white align-middle"
              title={`VERO / IP-protected brand: "${seg.text}"`}
            >
              {seg.text}
            </span>
          ) : (
            <span key={seg.key}>{seg.text}</span>
          )
        )}
      </span>

      {/* Prohibited warning icon row */}
      {hasProhibited && (
        <span className="flex flex-wrap items-center gap-1 mt-1">
          {prohibited.map((word) => (
            <span
              key={word}
              title={`Prohibited / restricted word: "${word}"`}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-200 dark:border-yellow-600"
            >
              <span className="text-yellow-500 dark:text-yellow-300">⚠</span>
              {word}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Legacy default export kept for backward compat — now a no-op wrapper */
export default function TitleWarningBadges({ title, className }) {
  return <HighlightedTitle title={title} className={className} />;
}
