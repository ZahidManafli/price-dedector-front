import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Puzzle, Send } from 'lucide-react';

const CHROME_EXTENSION_URL =
  'https://chromewebstore.google.com/detail/checkila-extension/mokpdmidbgchibehajdblfkjcgcibcbb';
const TELEGRAM_BOT_URL = 'https://t.me/Checkila_bot';

// Shared public-site header used by the SEO landing pages (the homepage has its
// own copy with in-page anchors). Same look as the homepage: a floating,
// rounded, blurred bar — wrap it in a `sticky` container to keep it on screen.
// `navLinks` and `languageSwitcher` are supplied by the caller so this stays
// agnostic to whether the page uses the global i18n toggle (homepage) or
// locale-prefixed URLs (SEO pages).
export default function PublicNavbar({ navLinks = [], languageSwitcher = null, loginLabel = 'Log in', chromeLabel = 'Chrome extension', telegramLabel = 'Telegram bot' }) {
  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-lg shadow-slate-900/[0.04] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 dark:shadow-black/30 md:px-4">
      <Link to="/" className="flex shrink-0 items-center gap-2.5">
        <img
          src="/logo-2.png"
          alt="Checkila"
          className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20"
        />
        <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
      </Link>

      <nav className="hidden items-center gap-0.5 text-sm font-medium text-slate-600 dark:text-slate-300 lg:flex">
        {navLinks.map((link) => {
          const cls = 'whitespace-nowrap rounded-full px-3 py-2 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white';
          return link.external ? (
            <a key={link.href} href={link.href} className={cls}>
              {link.label}
            </a>
          ) : (
            <Link key={link.href} to={link.href} className={cls}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1 md:flex">
          <a
            href={CHROME_EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={chromeLabel}
            aria-label={chromeLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Puzzle size={16} />
          </a>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={telegramLabel}
            aria-label={telegramLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Send size={16} />
          </a>
        </div>
        {languageSwitcher}
        <Link
          to="/login"
          className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-500/30"
        >
          {loginLabel}
          <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  );
}
