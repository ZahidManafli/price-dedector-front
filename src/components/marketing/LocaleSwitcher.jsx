import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, ChevronDown } from 'lucide-react';

const LANG_LABELS = {
  en: 'English (EN)',
  az: 'Azərbaycanca (AZ)',
  ru: 'Русский (RUS)',
  tr: 'Türkçe (TÜR)',
};

// Language switcher for locale-prefixed SEO pages: navigates to the real,
// crawlable URL of the same page in another language instead of toggling
// i18next's global language state (which would leave the URL/lang mismatched
// for search engines).
export default function LocaleSwitcher({ alternates, currentLang }) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLabel = LANG_LABELS[currentLang] || LANG_LABELS.en;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-white/25 dark:hover:bg-white/15"
      >
        <Globe2 size={16} />
        <span className="hidden sm:inline">{currentLabel.split(' ')[0]}</span>
        <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden dark:border-white/15 dark:bg-slate-900">
          {alternates.map(({ lang, href }) => (
            <Link
              key={lang}
              to={href}
              onClick={() => setIsOpen(false)}
              className={`block w-full px-4 py-3 text-left text-sm font-medium transition ${
                currentLang === lang
                  ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
              }`}
            >
              {LANG_LABELS[lang]}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
