import React from 'react';
import { getTitleWarnings } from '../utils/titleChecker';

/**
 * TitleWarningBadges
 * Displays inline red (VERO) and yellow (prohibited) warning chips
 * beneath a product title after front-end analysis.
 *
 * Props:
 *   title {string}  - The product title to check
 *   className {string} - Extra wrapper classes (optional)
 */
export default function TitleWarningBadges({ title, className = '' }) {
  const warnings = getTitleWarnings(title);
  if (!warnings) return null;

  const { veroMatches, prohibitedMatches } = warnings;

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${className}`}>
      {veroMatches.map((word) => (
        <span
          key={`vero-${word}`}
          title={`VERO / IP-protected brand: "${word}"`}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-700"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 dark:bg-red-400 flex-shrink-0" />
          VERO: {word}
        </span>
      ))}
      {prohibitedMatches.map((word) => (
        <span
          key={`prohibited-${word}`}
          title={`Prohibited / restricted word: "${word}"`}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-600"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400 flex-shrink-0" />
          ⚠ {word}
        </span>
      ))}
    </div>
  );
}
