import React from 'react';

// Title with the language's accent phrases (e.g. landing:hero.titleAccents)
// painted in the brand gradient: "<eBay Dropshipping> Aləti və E-ticarət
// <Avtomatlaşdırma> Platforması". Phrases not found in the title are ignored.
export function renderAccentedTitle(title, accents) {
  const text = String(title || '');
  const list = (Array.isArray(accents) ? accents : []).map(String).filter((a) => a && text.includes(a));
  if (!list.length) return text;
  const escaped = list.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'g'));
  return parts.map((part, i) =>
    list.includes(part) ? (
      <span key={i} className="bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 bg-clip-text text-transparent">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}
