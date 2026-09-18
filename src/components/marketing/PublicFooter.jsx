import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, BadgeCheck } from 'lucide-react';

// Shared public-site footer. `t` is a translate function already resolved to
// the right namespace/language by the caller (global t on the homepage,
// i18n.getFixedT(lang, ...) on locale-prefixed SEO pages).
export default function PublicFooter({ t, resourceLinks = [] }) {
  return (
    <footer className="relative z-10 border-t border-slate-200 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className={`grid gap-10 ${resourceLinks.length ? 'md:grid-cols-[1.05fr_0.75fr_0.85fr]' : 'md:grid-cols-[1.15fr_0.85fr]'}`}>
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/logo-2.png"
                alt="Checkila"
                className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/20"
              />
              <span className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Checkila</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t('landing:footer.tagline')}
            </p>
          </div>

          {resourceLinks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">
                {t('landing:footer.resourcesTitle')}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {resourceLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-100">
              {t('landing:footer.contactTitle')}
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                  <Phone size={15} />
                </span>
                <a
                  href="tel:+994708047546"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  +994 70 804 75 46
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                  <Mail size={15} />
                </span>
                <a
                  href="mailto:checkilanotify@gmail.com"
                  className="text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  checkilanotify@gmail.com
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                  <BadgeCheck size={15} />
                </span>
                <span className="text-slate-600 dark:text-slate-300">{t('landing:footer.taxId')}: 1807480082</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-700 dark:text-cyan-100">
                  <MapPin size={15} />
                </span>
                <span className="text-slate-600 dark:text-slate-300">{t('landing:footer.address')}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Checkila. {t('landing:footer.rights')}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/privacy" className="transition hover:text-slate-900 dark:hover:text-white">
              Privacy Policy
            </Link>
            <Link to="/extension-privacy" className="transition hover:text-slate-900 dark:hover:text-white">
              Extension Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
