import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import i18n from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { applySeo } from '../../utils/seo';
import { SEO_PAGES, pathFor, alternatesFor } from '../../data/seoPages';
import PublicNavbar from '../../components/marketing/PublicNavbar';
import PublicFooter from '../../components/marketing/PublicFooter';
import LocaleSwitcher from '../../components/marketing/LocaleSwitcher';

const SITE_ORIGIN = 'https://checkila.com';

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="flex flex-col items-start gap-3 text-left">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 dark:border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100">
        {eyebrow}
      </div>
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-5xl">{title}</h2>
      {description && (
        <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">{description}</p>
      )}
    </div>
  );
}

// Generic, informational marketing page for one Checkila feature, rendered
// once per language at a locale-prefixed URL (see src/data/seoPages.js).
// `lang` comes from the route, not from the global i18next language, so the
// content Google indexes for a given URL is always the same regardless of a
// visitor's browser locale or prior language toggle.
export default function FeatureLandingPage({ pageKey, lang }) {
  const { isDark } = useTheme();
  const t = useMemo(() => i18n.getFixedT(lang, 'seoPages'), [lang]);
  const tCommon = useMemo(() => i18n.getFixedT(lang, 'common'), [lang]);
  const tLanding = useMemo(() => i18n.getFixedT(lang, 'landing'), [lang]);

  const page = useMemo(() => t(pageKey, { returnObjects: true }), [t, pageKey]);
  const pagePath = pathFor(pageKey, lang);
  const canonicalUrl = `${SITE_ORIGIN}${pagePath}`;

  useEffect(() => {
    const faqEntities = (page.faq || []).map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }));

    applySeo({
      title: page.meta?.title,
      description: page.meta?.description,
      canonical: pagePath,
      htmlLang: lang,
      alternates: alternatesFor(pageKey),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'SoftwareApplication',
            name: `Checkila — ${page.hero?.h1}`,
            description: page.meta?.description,
            url: canonicalUrl,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
          },
          faqEntities.length
            ? { '@type': 'FAQPage', mainEntity: faqEntities }
            : null,
        ].filter(Boolean),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, lang]);

  const resourceLinks = SEO_PAGES.map((p) => ({
    href: pathFor(p.key, lang),
    label: t(`${p.key}.hero.eyebrow`),
  }));

  const navLinks = [
    { href: '/', label: tLanding('navigation.home', 'Home') },
    { href: '/#plans', label: tLanding('navigation.plans') },
    { href: pathFor('ebayFeeCalculator', lang), label: t('ebayFeeCalculator.hero.eyebrow') },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 ${isDark ? 'opacity-70' : 'opacity-40'}`}>
        <div className="absolute -top-24 left-[-8rem] h-96 w-96 rounded-full bg-cyan-500/18 blur-3xl" />
        <div className="absolute top-28 right-[-7rem] h-96 w-96 rounded-full bg-blue-500/16 blur-3xl" />
      </div>

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-16 pt-8 md:pb-20 md:pt-10">
          <PublicNavbar
            navLinks={navLinks}
            languageSwitcher={<LocaleSwitcher alternates={alternatesFor(pageKey)} currentLang={lang} />}
            loginLabel={tCommon('auth.login')}
          />

          <div className="mt-14 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 dark:border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100">
              <Sparkles size={14} />
              {page.hero?.eyebrow}
            </div>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-slate-900 dark:text-white md:text-6xl">
              {page.hero?.h1}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
              {page.hero?.subhead}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400"
              >
                {page.cta?.button}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {!!page.problems?.length && (
          <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
            <div className="grid gap-6 md:grid-cols-3">
              {page.problems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-300">
                    {item.problem}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.solution}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!page.features?.length && (
          <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
            <SectionHeader
              eyebrow={tLanding('navigation.features', 'Features')}
              title={tLanding('sections.whatsIncluded', "What's included")}
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {page.features.map((feature, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"
                >
                  <CheckCircle2 className="text-cyan-600 dark:text-cyan-300" size={20} />
                  <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!page.howItWorks?.length && (
          <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
            <div className="grid gap-8 md:grid-cols-4">
              {page.howItWorks.map((step, idx) => (
                <div key={idx}>
                  <span className="text-3xl font-semibold text-cyan-600 dark:text-cyan-300">{step.step}</span>
                  <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!page.faq?.length && (
          <section className="mx-auto max-w-4xl px-6 py-14 md:py-20">
            <SectionHeader eyebrow="FAQ" title={tLanding('faq.title', 'Frequently Asked Questions')} />
            <div className="mt-8 space-y-3">
              {page.faq.map((item, idx) => (
                <details
                  key={idx}
                  className="group rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-white">
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-6 py-14 md:py-20">
          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-400/10 to-blue-500/10 p-10 text-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white md:text-3xl">{page.cta?.title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 dark:text-slate-300">{page.cta?.description}</p>
            <Link
              to="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01]"
            >
              {page.cta?.button}
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter t={tLanding} resourceLinks={resourceLinks} />
    </div>
  );
}
