import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  Layers,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import i18n from '../../i18n';
import { applySeo } from '../../utils/seo';
import { renderAccentedTitle } from '../../utils/accentedTitle';
import { useScrollReveal, SCROLL_REVEAL_CSS } from '../../utils/scrollReveal';
import { SEO_PAGES, pathFor, alternatesFor, imageFor } from '../../data/seoPages';
import PublicNavbar from '../../components/marketing/PublicNavbar';
import PublicFooter from '../../components/marketing/PublicFooter';
import LocaleSwitcher from '../../components/marketing/LocaleSwitcher';

const SITE_ORIGIN = 'https://checkila.com';
const FEATURE_ICONS = [Zap, Truck, Bell, ShieldCheck, BarChart3, Layers, Radar];

const EYEBROW =
  'inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200';
const H2 = 'mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl md:leading-[1.1]';

// Generic, informational marketing page for one Checkila feature, rendered
// once per language at a locale-prefixed URL (see src/data/seoPages.js).
// `lang` comes from the route, not from the global i18next language, so the
// content Google indexes for a given URL is always the same regardless of a
// visitor's browser locale or prior language toggle.
// Visual language matches the homepage: floating sticky navbar, centered hero
// with gradient accents, browser-framed screenshot, scroll-reveal animations.
export default function FeatureLandingPage({ pageKey, lang }) {
  const t = useMemo(() => i18n.getFixedT(lang, 'seoPages'), [lang]);
  const tCommon = useMemo(() => i18n.getFixedT(lang, 'common'), [lang]);
  const tLanding = useMemo(() => i18n.getFixedT(lang, 'landing'), [lang]);
  const [openFaq, setOpenFaq] = useState(0);
  const revealRootRef = useRef(null);
  useScrollReveal(revealRootRef);

  const page = useMemo(() => t(pageKey, { returnObjects: true }), [t, pageKey]);
  const pagePath = pathFor(pageKey, lang);
  const screenshot = imageFor(pageKey);
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

  useEffect(() => {
    setOpenFaq(0);
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

  const features = page.features || [];
  const floatCards = features.slice(0, 2);

  return (
    <div ref={revealRootRef} className="relative min-h-screen overflow-x-clip bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <style>{`@keyframes landingFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}.landing-float{animation:landingFloat 6s ease-in-out infinite}.landing-float-delay{animation-delay:-3s}@media (prefers-reduced-motion: reduce){.landing-float{animation:none}}${SCROLL_REVEAL_CSS}`}</style>

      {/* ── Floating, sticky navbar ── */}
      <div className="sticky top-3 z-40 px-4 pt-4 md:px-6">
        <PublicNavbar
          navLinks={navLinks}
          languageSwitcher={<LocaleSwitcher alternates={alternatesFor(pageKey)} currentLang={lang} />}
          loginLabel={tCommon('auth.login')}
        />
      </div>

      <main className="relative">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-6 pb-16 pt-14 md:pb-24 md:pt-20">
          <svg className="pointer-events-none absolute inset-x-0 top-0 h-[560px] w-full text-cyan-500/[0.14] dark:text-cyan-300/[0.08]" viewBox="0 0 1440 560" preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <path key={i} d={`M0 ${120 + i * 26} C 360 ${60 + i * 30}, 1080 ${200 + i * 22}, 1440 ${110 + i * 28}`} fill="none" stroke="currentColor" strokeWidth="1" />
            ))}
          </svg>
          <div className="pointer-events-none absolute left-1/2 top-40 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/20 via-blue-500/15 to-indigo-500/10 blur-3xl dark:from-cyan-400/15 dark:via-blue-500/10" aria-hidden="true" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div data-reveal className={EYEBROW}>
              <Sparkles size={14} />
              {page.hero?.eyebrow}
            </div>
            <h1 data-reveal data-reveal-delay="100" className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl" style={{ textWrap: 'balance' }}>
              {renderAccentedTitle(page.hero?.h1, page.hero?.h1Accents)}
            </h1>
            <p data-reveal data-reveal-delay="200" className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
              {page.hero?.subhead}
            </p>
            <div data-reveal data-reveal-delay="300" className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/40"
              >
                {page.cta?.button}
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/#plans"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-slate-300 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-white/25"
              >
                {tLanding('navigation.plans')}
              </Link>
            </div>
          </div>

          {screenshot && (
            <div data-reveal="zoom" data-reveal-delay="250" className="relative mx-auto mt-14 max-w-6xl md:mt-16">
              <div className="absolute -inset-x-6 -bottom-6 top-10 rounded-[2.5rem] bg-gradient-to-b from-cyan-400/25 via-blue-500/15 to-transparent blur-2xl dark:from-cyan-400/15" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/50 md:rounded-3xl">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-white/10 dark:bg-slate-800/60">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="mx-auto rounded-md bg-white px-3 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10">checkila.com</span>
                </div>
                <img
                  src={screenshot.src}
                  alt={page.hero?.imageAlt || page.hero?.h1}
                  width={screenshot.width}
                  height={screenshot.height}
                  loading="eager"
                  className="block h-auto w-full"
                />
              </div>

              {floatCards[0] && (
                <div className="landing-float absolute -left-4 top-16 hidden w-64 rounded-2xl border border-slate-200 bg-white/95 p-3.5 text-left shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95 md:block xl:-left-14">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-white">{floatCards[0].title}</p>
                  </div>
                </div>
              )}
              {floatCards[1] && (
                <div className="landing-float landing-float-delay absolute -right-4 top-1/3 hidden w-64 rounded-2xl border border-slate-200 bg-white/95 p-3.5 text-left shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95 md:block xl:-right-14">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                      <Zap className="h-4 w-4" />
                    </span>
                    <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 dark:text-white">{floatCards[1].title}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Problem → solution ── */}
        {!!page.problems?.length && (
          <section className="relative px-6 pb-20 pt-4 md:pb-28">
            <div data-reveal-stagger className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
              {page.problems.map((item, idx) => (
                <article
                  key={idx}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400 opacity-[0.10] blur-2xl transition group-hover:opacity-25" aria-hidden="true" />
                  <p className="relative flex items-start gap-2.5 text-sm font-semibold text-slate-900 dark:text-white">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 ring-1 ring-rose-500/15 dark:bg-rose-400/10 dark:text-rose-300">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                    <span className="leading-6">{item.problem}</span>
                  </p>
                  <div className="relative my-4 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent dark:from-white/10 dark:via-white/10" />
                  <p className="relative flex items-start gap-2.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item.solution}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ── What's included (dark brand panel) ── */}
        {!!features.length && (
          <section className="relative px-4 pb-20 sm:px-6 md:pb-28">
            <div data-reveal="zoom" className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] px-5 py-12 shadow-2xl shadow-slate-900/20 ring-1 ring-white/10 sm:px-8 md:rounded-[2.5rem] md:px-12 md:py-16">
              <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-40 right-0 h-[460px] w-[520px] rounded-full bg-blue-600/25 blur-3xl" aria-hidden="true" />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                  maskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
                  WebkitMaskImage: 'radial-gradient(ellipse at top left, black 20%, transparent 70%)',
                }}
                aria-hidden="true"
              />

              <div data-reveal data-reveal-delay="150" className="relative">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 backdrop-blur">
                  <Sparkles size={14} />
                  {tLanding('navigation.features', 'Features')}
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">{tLanding('sections.whatsIncluded', "What's included")}</h2>
              </div>

              <div data-reveal-stagger className="relative mt-10 grid gap-4 md:mt-12 md:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, idx) => {
                  const Icon = FEATURE_ICONS[idx % FEATURE_ICONS.length];
                  return (
                    <article
                      key={idx}
                      className="group rounded-3xl border border-white/10 bg-white/[0.05] p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-cyan-950/40"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 transition group-hover:scale-105">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── How it works ── */}
        {!!page.howItWorks?.length && (
          <section className="relative px-6 pb-20 md:pb-28">
            <div className="relative mx-auto max-w-7xl">
              <div data-reveal className="mx-auto max-w-2xl text-center">
                <span className={EYEBROW}>
                  <Zap size={14} />
                  {page.hero?.eyebrow}
                </span>
                <h2 className={H2}>{tLanding('sections.howItWorks', 'How it works')}</h2>
              </div>
              <div
                data-reveal-stagger
                className={`relative mt-10 grid gap-5 ${page.howItWorks.length >= 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}
              >
                <div className="pointer-events-none absolute left-0 right-0 top-[2.1rem] hidden h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent lg:block" aria-hidden="true" />
                {page.howItWorks.map((step, idx) => (
                  <article
                    key={idx}
                    className="relative rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-slate-900/80"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 ring-4 ring-white dark:ring-slate-950">
                      {step.step || String(idx + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-slate-900 dark:text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── FAQ ── */}
        {!!page.faq?.length && (
          <section className="relative px-6 pb-20 md:pb-28">
            <div className="pointer-events-none absolute left-0 top-20 h-[320px] w-[520px] rounded-full bg-gradient-to-r from-cyan-400/12 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
              <div data-reveal="left" className="lg:sticky lg:top-28 lg:self-start">
                <span className={EYEBROW}>
                  <Sparkles size={14} />
                  FAQ
                </span>
                <h2 className={H2} style={{ textWrap: 'balance' }}>
                  {renderAccentedTitle(tLanding('faq.title', 'Frequently Asked Questions'), tLanding('faq.titleAccents', { returnObjects: true }))}
                </h2>
                <div className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] p-6 text-white shadow-xl shadow-slate-900/20 ring-1 ring-white/10">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl" aria-hidden="true" />
                  <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
                    <Mail className="h-5 w-5" />
                  </span>
                  <p className="relative mt-4 text-lg font-semibold">{tLanding('faq.stillQuestions')}</p>
                  <p className="relative mt-1 text-sm leading-6 text-slate-300">{tLanding('faq.stillQuestionsText')}</p>
                  <a
                    href="mailto:checkilanotify@gmail.com"
                    className="group relative mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-cyan-50"
                  >
                    {tLanding('faq.contactUs')}
                    <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </a>
                </div>
              </div>

              <div data-reveal-stagger className="space-y-3">
                {page.faq.map((item, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={item.q}
                      className={`rounded-2xl border transition duration-300 ${
                        isOpen
                          ? 'border-cyan-500/30 bg-white shadow-lg shadow-cyan-900/[0.06] dark:border-cyan-300/25 dark:bg-white/[0.06]'
                          : 'border-slate-200/80 bg-white/70 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
                      }`}
                    >
                      <h3>
                        <button
                          type="button"
                          onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left md:px-6 md:py-5"
                        >
                          <span className="text-base font-semibold text-slate-900 dark:text-white md:text-[17px]">{item.q}</span>
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 ${
                              isOpen
                                ? 'rotate-180 bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30'
                                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                            }`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </span>
                        </button>
                      </h3>
                      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <p className="px-5 pb-5 text-sm leading-7 text-slate-600 dark:text-slate-300 md:px-6 md:text-[15px]">{item.a}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA ── */}
        <section className="relative px-4 pb-16 sm:px-6 md:pb-24">
          <div data-reveal="zoom" className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#062a3c] to-[#0b1e4d] px-6 py-14 text-center shadow-2xl shadow-slate-900/20 ring-1 ring-white/10 sm:px-10 md:rounded-[2.5rem] md:py-20">
            <div className="pointer-events-none absolute -left-24 -top-24 h-[380px] w-[380px] rounded-full bg-cyan-400/25 blur-3xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-32 -right-16 h-[420px] w-[460px] rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-white/5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200 backdrop-blur">
                <Sparkles size={14} />
                {page.hero?.eyebrow}
              </span>
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-white md:text-5xl md:leading-[1.12]" style={{ textWrap: 'balance' }}>
                {page.cta?.title}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">{page.cta?.description}</p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:bg-cyan-50 sm:w-auto"
                >
                  {page.cta?.button}
                  <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/#plans"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10 sm:w-auto"
                >
                  {tLanding('navigation.plans')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter t={tLanding} resourceLinks={resourceLinks} />
    </div>
  );
}
