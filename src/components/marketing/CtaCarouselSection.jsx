import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Award,
  BarChart3,
  Calculator,
  ClipboardList,
  FileText,
  Mail,
  MessageSquareText,
  Radar,
  ShoppingCart,
  Smartphone,
  Truck,
  Users,
  Wand2,
  ArrowRight,
} from 'lucide-react';
import { renderAccentedTitle } from '../../utils/accentedTitle';

// Landing page -> final CTA ("Seçimdə kömək lazımdır?"). Left: copy + buttons.
// Right: two columns of feature pills scrolling endlessly from top to bottom
// (second column slower and offset), faded at the edges; pauses on hover.

const FEATURE_ICONS = [Radar, ClipboardList, ShoppingCart, MessageSquareText, BarChart3, Truck, FileText, Wand2, Calculator, Users, Smartphone, Award];
const ICON_TONES = [
  'from-cyan-500 to-blue-600',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-fuchsia-600',
  'from-blue-500 to-cyan-500',
  'from-amber-500 to-orange-600',
];

function FeaturePill({ icon: Icon, label, tone }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-md shadow-cyan-900/[0.06] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/20">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${tone}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">{label}</span>
    </div>
  );
}

function Column({ items, duration, delay = 0 }) {
  // Track = items twice; translating from -50% to 0 moves the pills downward seamlessly.
  return (
    <div className="cta-col relative h-full overflow-hidden">
      <div className="cta-track flex flex-col gap-3" style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}>
        {[...items, ...items].map((item, i) => (
          <div key={i} aria-hidden={i >= items.length ? 'true' : undefined}>
            <FeaturePill {...item} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CtaCarouselSection({ contactHref = 'mailto:checkilanotify@gmail.com' }) {
  const { t } = useTranslation('landing');
  const labels = t('landing:cta.features', { returnObjects: true });
  const items = (Array.isArray(labels) ? labels : []).map((label, i) => ({
    label,
    icon: FEATURE_ICONS[i % FEATURE_ICONS.length],
    tone: ICON_TONES[i % ICON_TONES.length],
  }));
  const left = items.filter((_, i) => i % 2 === 0);
  const right = items.filter((_, i) => i % 2 === 1);

  return (
    <section id="contact" className="relative px-4 pb-16 sm:px-6 md:pb-24">
      <style>{`@keyframes ctaDown{from{transform:translateY(-50%)}to{transform:translateY(0)}}.cta-track{animation:ctaDown linear infinite}.cta-marquee:hover .cta-track{animation-play-state:paused}@media (prefers-reduced-motion: reduce){.cta-track{animation:none}}`}</style>
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-cyan-500/20 bg-gradient-to-br from-cyan-50 via-white to-blue-100/70 shadow-xl shadow-cyan-900/[0.06] dark:border-white/10 dark:from-[#062a3c] dark:via-slate-950 dark:to-[#0b1e4d] dark:shadow-black/30 md:rounded-[2.5rem]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-400/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-[28rem] rounded-full bg-blue-300/25 blur-3xl dark:bg-blue-600/20" aria-hidden="true" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 pt-12 sm:px-10 lg:py-16 lg:pl-14 lg:pr-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
              {t('landing:cta.needHelp')}
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-[2.75rem] md:leading-[1.12]" style={{ textWrap: 'balance' }}>
              {renderAccentedTitle(t('landing:cta.startWithPlan'), t('landing:cta.titleAccents', { returnObjects: true }))}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:cta.readyDescription')}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href={contactHref}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-900/80 bg-transparent px-7 py-3.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-900 hover:text-white dark:border-white/30 dark:text-white dark:hover:bg-white dark:hover:text-slate-900"
              >
                <Mail size={16} />
                {t('landing:faq.contactUs')}
              </a>
              <Link
                to="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30"
              >
                {t('landing:cta.ctaButton')}
                <ArrowRight size={16} className="transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* Endless vertical carousel of features */}
          <div
            className="cta-marquee relative grid h-[380px] grid-cols-1 gap-3 px-6 sm:grid-cols-2 sm:px-10 lg:h-[460px] lg:pl-0 lg:pr-10"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)',
            }}
          >
            {/* Phones: one column with every feature; wider screens: two columns at different speeds */}
            <div className="h-full sm:hidden">
              <Column items={items} duration={44} />
            </div>
            <div className="hidden h-full sm:block">
              <Column items={left} duration={28} />
            </div>
            <div className="hidden h-full sm:block">
              <Column items={right} duration={36} delay={-9} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
