import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Apple,
  BarChart3,
  Radar,
  ShieldCheck,
  Sparkles,
  Truck,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Download,
  Menu,
  Puzzle,
  Search,
  Send,
  Smartphone,
} from 'lucide-react';
import { renderAccentedTitle } from '../../utils/accentedTitle';

// Landing page -> "Checkila hər zaman yanınızda". One section for every way to reach
// Checkila outside the web app: the Android app (APK, iOS soon), the Chrome extension
// and the Telegram bot. Left: copy + store-style buttons + companion cards. Right: a
// brand-gradient block with an HTML phone mock-up and floating notification cards.
// Phone content is illustrative only.

// Same order as landing:mobileApp.features
const FEATURE_ICONS = [BarChart3, Radar, Truck, ShieldCheck, Sparkles, Puzzle];

const PHONE_ORDERS = [
  { name: 'Emily Carter', item: 'LED Strip Lights 16ft', price: '$24.99', status: 'new', tone: 'from-cyan-400 to-blue-500' },
  { name: 'James Miller', item: 'Washing Machine Cleaner', price: '$18.40', status: 'shipped', tone: 'from-violet-400 to-fuchsia-500' },
  { name: 'Olivia Brooks', item: 'Wireless Headphones', price: '$39.90', status: 'delivered', tone: 'from-emerald-400 to-teal-500' },
  { name: 'Noah Bennett', item: 'Classic Lighters 5-pack', price: '$12.75', status: 'shipped', tone: 'from-amber-400 to-orange-500' },
  { name: 'Sophia Hayes', item: 'Solar Garden Lamp', price: '$21.30', status: 'delivered', tone: 'from-sky-400 to-indigo-500' },
  { name: 'Liam Turner', item: 'Kitchen Scale Digital', price: '$15.60', status: 'delivered', tone: 'from-rose-400 to-pink-500' },
];

const STATUS_STYLE = {
  new: 'bg-cyan-50 text-cyan-700 ring-cyan-600/15',
  shipped: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
};

function initials(name) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2);
}

function PhoneMock() {
  const { t } = useTranslation('landing');
  const p = (k) => t(`landing:apps.phone.${k}`);
  return (
    <div className="relative mx-auto w-[260px] rounded-[2.6rem] bg-slate-900 p-[9px] shadow-2xl shadow-slate-950/40 ring-1 ring-white/10 sm:w-[290px]">
      <div className="absolute left-1/2 top-[18px] z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" />
      <div className="relative h-[540px] overflow-hidden rounded-[2.1rem] bg-white sm:h-[580px]">
        <div className="flex items-center justify-between px-6 pb-2 pt-4 text-[11px] font-semibold text-slate-900">
          <span>16:00</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-3 rounded-[2px] bg-slate-900" />
            <span className="h-2.5 w-5 rounded-[3px] border border-slate-900 p-[1px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-slate-900" />
            </span>
          </span>
        </div>
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <Menu className="h-4 w-4" /> {p('orders')}
          </span>
          <span className="flex items-center gap-2.5 text-slate-500">
            <Search className="h-4 w-4" />
            <span className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </span>
          </span>
        </div>
        <div className="mt-3 flex gap-1.5 px-4 text-[10px] font-medium">
          <span className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-1 text-white">{p('all')}</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{p('new')}</span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-600">{p('shipped')}</span>
        </div>
        <ul className="mt-3 divide-y divide-slate-100 px-4">
          {PHONE_ORDERS.map((o) => (
            <li key={o.name} className="flex items-center gap-2.5 py-2.5">
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white ${o.tone}`}>
                {initials(o.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-slate-900">{o.name}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-900">{o.price}</span>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-slate-500">{o.item}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold ring-1 ${STATUS_STYLE[o.status]}`}>{p(o.status)}</span>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AppsSection({ apkUrl, chromeUrl, telegramUrl }) {
  const { t } = useTranslation('landing');
  const features = t('landing:mobileApp.features', { returnObjects: true });

  return (
    <section id="mobile-app" className="relative px-4 pb-20 sm:px-6 md:pb-28">
      <span id="companion" className="absolute -top-24" aria-hidden="true" />
      <div data-reveal="zoom" className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 shadow-xl shadow-slate-900/[0.04] dark:border-white/10 dark:from-white/[0.04] dark:via-white/[0.02] dark:to-cyan-400/[0.04] dark:shadow-none md:rounded-[2.5rem]">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden="true" />
        <div className="absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" aria-hidden="true" />

        <div className="relative grid items-center gap-12 px-6 py-12 sm:px-10 md:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:px-14">
          {/* Copy */}
          <div data-reveal="left" data-reveal-delay="150">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
              <Smartphone size={14} />
              {t('landing:mobileApp.eyebrow')}
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl md:leading-[1.1]" style={{ textWrap: 'balance' }}>
              {renderAccentedTitle(t('landing:apps.title'), t('landing:apps.titleAccents', { returnObjects: true }))}
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('landing:mobileApp.description')}</p>

            {Array.isArray(features) && (
              <ul className="mt-6 flex max-w-xl flex-wrap gap-2">
                {features.map((f, i) => {
                  const Icon = FEATURE_ICONS[i] || CheckCircle2;
                  return (
                  <li key={f} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                    <Icon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" />
                    {f}
                  </li>
                  );
                })}
              </ul>
            )}

            {/* Store-style buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={apkUrl}
                download
                className="group inline-flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-2.5 text-white shadow-lg shadow-slate-900/20 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-slate-900 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                <Smartphone className="h-6 w-6" />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] font-medium uppercase tracking-wide opacity-70">{t('landing:apps.downloadFor')}</span>
                  <span className="block text-base font-semibold">Android (.apk)</span>
                </span>
                <Download className="ml-1 h-4 w-4 opacity-70 transition group-hover:translate-y-0.5" />
              </a>
              <span
                className="inline-flex cursor-default items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-slate-400 dark:border-white/15 dark:text-slate-500"
                title={t('landing:mobileApp.ios.badge')}
              >
                <Apple className="h-6 w-6" />
                <span className="text-left leading-tight">
                  <span className="block text-[10px] font-medium uppercase tracking-wide">{t('landing:mobileApp.ios.badge')}</span>
                  <span className="block text-base font-semibold">App Store</span>
                </span>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">{t('landing:mobileApp.android.note')}</p>

            {/* Companions: Chrome extension + Telegram bot */}
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('landing:apps.alsoOn')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                { key: 'chrome', icon: Puzzle, href: chromeUrl },
                { key: 'telegram', icon: Send, href: telegramUrl },
              ].map(({ key, icon: Icon, href }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/60 hover:shadow-lg hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-cyan-300/30"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {t(`landing:companion.${key}.title`)}
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-600 dark:group-hover:text-cyan-300" />
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-500 dark:text-slate-400">{t(`landing:companion.${key}.description`)}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div data-reveal="right" data-reveal-delay="250" className="relative mx-auto w-full max-w-[520px] py-6">
            <div className="absolute inset-x-6 top-0 bottom-24 overflow-hidden rounded-[2rem] bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 sm:inset-x-10" aria-hidden="true">
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'radial-gradient(rgba(255,255,255,.9) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                  maskImage: 'linear-gradient(to bottom, black, transparent 80%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black, transparent 80%)',
                }}
              />
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
            </div>

            <div className="relative">
              <PhoneMock />

              {/* Floating: Telegram notification */}
              <div className="absolute -right-1 top-28 w-[240px] sm:-right-6 sm:w-[280px]">
              <div className="landing-float rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur">
                <div className="flex items-start gap-2.5">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white">
                    <Send className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-900">Checkila Bot</span>
                      <span className="text-[10px] text-slate-400">16:00</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                      {t('landing:apps.notif', { name: 'Emily Carter', price: '$24.99' })}
                    </span>
                  </span>
                </div>
              </div>
              </div>

              {/* Floating tags */}
              <span className="absolute -left-1 bottom-40 -rotate-6 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-cyan-700 shadow-lg shadow-slate-900/10 sm:left-2">
                {t('landing:apps.tagInstant')}
              </span>
              <span className="absolute -left-3 bottom-28 -rotate-12 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-lg shadow-slate-900/10 sm:left-0">
                {t('landing:apps.tagAnywhere')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
