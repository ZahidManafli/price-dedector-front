import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Puzzle, Send } from 'lucide-react';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/checkila-extension/mokpdmidbgchibehajdblfkjcgcibcbb';
const TELEGRAM_BOT_URL = 'https://t.me/Checkila_bot';

// Shared public-site header used by the homepage and every SEO landing page.
// `navLinks` and `languageSwitcher` are supplied by the caller so this stays
// agnostic to whether the page uses the global i18n toggle (homepage) or
// locale-prefixed URLs (SEO pages).
export default function PublicNavbar({ navLinks = [], languageSwitcher = null, loginLabel = 'Log in', chromeLabel = 'Chrome extension', telegramLabel = 'Telegram bot' }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-3">
        <img
          src="/logo-2.png"
          alt="Checkila"
          className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20"
        />
        <span className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
      </Link>

      <nav className="hidden items-center gap-6 text-sm text-slate-600 dark:text-slate-300 md:flex">
        {navLinks.map((link) =>
          link.external ? (
            <a key={link.href} href={link.href} className="transition hover:text-slate-900 dark:hover:text-white">
              {link.label}
            </a>
          ) : (
            <Link key={link.href} to={link.href} className="transition hover:text-slate-900 dark:hover:text-white">
              {link.label}
            </Link>
          )
        )}
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <a
            href={CHROME_EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={chromeLabel}
            aria-label={chromeLabel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-slate-300 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white"
          >
            <Puzzle size={16} />
          </a>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={telegramLabel}
            aria-label={telegramLabel}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-slate-600 transition hover:border-slate-300 hover:bg-slate-200 hover:text-slate-900 dark:border-white/15 dark:bg-white/10 dark:text-slate-300 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white"
          >
            <Send size={16} />
          </a>
        </div>
        {languageSwitcher && (
          <>
            <div className="hidden h-6 w-px bg-slate-200 dark:bg-white/15 sm:block" />
            {languageSwitcher}
          </>
        )}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:border-white/25 dark:hover:bg-white/15"
        >
          {loginLabel}
          <ArrowRight size={14} />
        </Link>
      </div>
    </header>
  );
}
