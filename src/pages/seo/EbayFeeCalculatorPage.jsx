import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import i18n from '../../i18n';
import { useTheme } from '../../context/ThemeContext';
import { applySeo } from '../../utils/seo';
import { SEO_PAGES, pathFor, alternatesFor } from '../../data/seoPages';
import PublicNavbar from '../../components/marketing/PublicNavbar';
import PublicFooter from '../../components/marketing/PublicFooter';
import LocaleSwitcher from '../../components/marketing/LocaleSwitcher';

const SITE_ORIGIN = 'https://checkila.com';
const PAGE_KEY = 'ebayFeeCalculator';

function SectionHeader({ eyebrow, title, description }) {
  return (
    <div className="flex flex-col items-start gap-3 text-left">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 dark:border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100">
        {eyebrow}
      </div>
      <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-5xl">{title}</h2>
      {description && (
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">{description}</p>
      )}
    </div>
  );
}

// Content-only reference article on eBay's fee structure — separate from the
// functional calculator tool at /ebay-calculator (opened from the sidebar).
// This page exists purely to rank for "ebay fee calculator" / "how much does
// ebay take in fees" style queries and to hand off to the real tool via CTA.
export default function EbayFeeCalculatorPage({ lang }) {
  const { isDark } = useTheme();
  const t = useMemo(() => i18n.getFixedT(lang, 'seoPages'), [lang]);
  const tCommon = useMemo(() => i18n.getFixedT(lang, 'common'), [lang]);
  const tLanding = useMemo(() => i18n.getFixedT(lang, 'landing'), [lang]);

  const page = useMemo(() => t(PAGE_KEY, { returnObjects: true }), [t]);
  const pagePath = pathFor(PAGE_KEY, lang);
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
      alternates: alternatesFor(PAGE_KEY),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: page.hero?.h1,
            description: page.meta?.description,
            url: canonicalUrl,
          },
          faqEntities.length ? { '@type': 'FAQPage', mainEntity: faqEntities } : null,
        ].filter(Boolean),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const resourceLinks = SEO_PAGES.map((p) => ({
    href: pathFor(p.key, lang),
    label: t(`${p.key}.hero.eyebrow`),
  }));

  const navLinks = [
    { href: '/', label: tLanding('navigation.home', 'Home') },
    { href: '/ebay-calculator', label: tCommon('nav.ebayCalculator') },
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
            languageSwitcher={<LocaleSwitcher alternates={alternatesFor(PAGE_KEY)} currentLang={lang} />}
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
                to="/ebay-calculator"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:scale-[1.01] hover:from-cyan-300 hover:to-blue-400"
              >
                {page.cta?.button}
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {page.intro && (
          <section className="mx-auto max-w-4xl px-6 py-10">
            <p className="text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">{page.intro}</p>
          </section>
        )}

        {!!page.feeTypes?.length && (
          <section className="mx-auto max-w-7xl px-6 py-14">
            <SectionHeader eyebrow={page.hero?.eyebrow} title={tLanding('sections.feeTypesTitle', 'Types of eBay fees')} />
            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Fee</th>
                    <th className="px-4 py-3">What it is</th>
                    <th className="px-4 py-3">How it's calculated</th>
                    <th className="px-4 py-3">Who pays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {page.feeTypes.map((fee, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{fee.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fee.what}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fee.how}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{fee.who}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!!page.storeTiers?.length && (
          <section className="mx-auto max-w-7xl px-6 py-14">
            <SectionHeader eyebrow="2026" title={tLanding('sections.storeTiersTitle', 'eBay Store subscription tiers')} />
            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Store tier</th>
                    <th className="px-4 py-3">Monthly fee</th>
                    <th className="px-4 py-3">Typical final value fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {page.storeTiers.map((tier, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{tier.tier}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{tier.monthlyFee}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{tier.typicalFvf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!!page.formula?.length && (
          <section className="mx-auto max-w-4xl px-6 py-14">
            <SectionHeader eyebrow="Formula" title={tLanding('sections.formulaTitle', 'How the numbers add up')} />
            <div className="mt-8 space-y-4">
              {page.formula.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                  <p className="mt-1 font-mono text-sm text-cyan-700 dark:text-cyan-300">{item.formula}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.explanation}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!page.glossary?.length && (
          <section className="mx-auto max-w-4xl px-6 py-14">
            <SectionHeader eyebrow="Glossary" title={tLanding('sections.glossaryTitle', 'eBay fee terms you should know')} />
            <dl className="mt-8 grid gap-4 md:grid-cols-2">
              {page.glossary.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                  <dt className="text-sm font-semibold text-slate-900 dark:text-white">{item.term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {!!page.faq?.length && (
          <section className="mx-auto max-w-4xl px-6 py-14">
            <SectionHeader eyebrow="FAQ" title={tLanding('faq.title', 'Frequently Asked Questions')} />
            <div className="mt-8 space-y-3">
              {page.faq.map((item, idx) => (
                <details key={idx} className="group rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
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
              to="/ebay-calculator"
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
