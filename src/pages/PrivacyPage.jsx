import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { getPrivacyPolicy } from '../content/privacyPolicy';
import PrivacyPolicyContent from '../components/privacy/PrivacyPolicyContent';
import { renderAccentedTitle } from '../utils/accentedTitle';

// Public Privacy Policy page (/privacy). Text lives in content/privacyPolicy.js
// and is shared with the in-app consent modal.
export default function PrivacyPage() {
  const { i18n } = useTranslation();
  const policy = useMemo(() => getPrivacyPolicy(i18n.language), [i18n.language]);

  useEffect(() => {
    document.title = `${policy.ui.title} | Checkila`;
  }, [policy.ui.title]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/15 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft size={15} />
          Checkila
        </Link>

        <header className="mx-auto mt-10 max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
            <ShieldCheck size={14} />
            Checkila
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl">
            {renderAccentedTitle(policy.ui.title, [policy.ui.title.split(' ').slice(-1)[0]])}
          </h1>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {policy.ui.effective}: <span className="font-semibold text-slate-700 dark:text-slate-200">{policy.effective}</span>
            <span className="mx-2">·</span>
            {policy.ui.version}: <span className="font-semibold text-slate-700 dark:text-slate-200">{policy.version}</span>
          </p>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[240px_1fr]">
          {/* Table of contents */}
          <nav className="hidden lg:block">
            <div className="sticky top-8 space-y-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              {policy.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#privacy-${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`privacy-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="block rounded-lg px-2.5 py-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  {s.title}
                </a>
              ))}
            </div>
          </nav>

          <article className="rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03] md:p-10">
            <PrivacyPolicyContent policy={policy} />
          </article>
        </div>
      </div>
    </div>
  );
}
