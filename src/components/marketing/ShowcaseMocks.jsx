import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BellRing, CheckCircle2, Crown, TrendingUp, Truck } from 'lucide-react';

// Landing page -> "Əməldə görün". Lightweight HTML illustrations of the Tracking and
// Market analysis screens (a framed table/dashboard plus floating detail cards), drawn
// in the landing brand colours instead of heavy screenshots. All data is made up.

const FRAME =
  'relative rounded-[1.75rem] border border-cyan-500/30 bg-white p-4 shadow-xl shadow-cyan-900/[0.06] dark:border-cyan-300/20 dark:bg-slate-900/80 dark:shadow-black/30 sm:p-6';
const FLOAT =
  'absolute rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-cyan-900/10 ring-1 ring-cyan-500/10 backdrop-blur dark:border-white/10 dark:bg-slate-900/95 dark:shadow-black/40';

const AVATAR_TONES = [
  'from-cyan-400 to-blue-500',
  'from-violet-400 to-fuchsia-500',
  'from-emerald-400 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-indigo-500',
];

function Avatar({ name, tone, size = 'h-8 w-8 text-xs' }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ${tone} ${size}`}>
      {name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
    </span>
  );
}

const STATUS_STYLE = {
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300',
  inTransit: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-400/10 dark:text-sky-300',
  shipped: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-400/10 dark:text-amber-300',
};

const TRACKING_ROWS = [
  { name: 'Emily Carter', order: '12-14391', code: '9400 1118 •• 4821', status: 'delivered' },
  { name: 'James Miller', order: '27-08562', code: '1Z9X 47A0 •• 3390', status: 'inTransit' },
  { name: 'Olivia Brooks', order: '05-31277', code: '9400 1362 •• 7745', status: 'delivered' },
  { name: 'Noah Bennett', order: '19-66018', code: '7739 2841 •• 0516', status: 'shipped' },
  { name: 'Sophia Hayes', order: '08-52904', code: '9400 1597 •• 2268', status: 'inTransit' },
];

export function TrackingMock() {
  const { t } = useTranslation('landing');
  const m = (k) => t(`landing:showcase.mock.${k}`);
  return (
    <div className="relative pb-16 sm:pb-10">
      <div className={FRAME}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1.25fr_0.9fr] gap-3 border-b border-slate-200 pb-3 text-xs font-semibold text-slate-900 dark:border-white/10 dark:text-white sm:text-sm">
            <span>{m('customer')}</span>
            <span>{m('order')}</span>
            <span>{m('tracking')}</span>
            <span>{m('status')}</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {TRACKING_ROWS.map((row, i) => (
              <div key={row.order} className="grid grid-cols-[1.4fr_1fr_1.25fr_0.9fr] items-center gap-3 py-3 text-xs text-slate-600 dark:text-slate-300 sm:text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={row.name} tone={AVATAR_TONES[i % AVATAR_TONES.length]} />
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100">{row.name.split(' ')[0]}</span>
                </span>
                <span className="truncate tabular-nums">{row.order}</span>
                <span className="truncate font-mono text-[11px] text-cyan-700 dark:text-cyan-300 sm:text-xs">{row.code}</span>
                <span>
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:text-[11px] ${STATUS_STYLE[row.status]}`}>
                    {m(row.status)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating: converted tracking */}
      <div className={`${FLOAT} -bottom-1 left-2 w-[250px] p-3.5 landing-float sm:-left-6 sm:bottom-0`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {m('converted')}
        </p>
        <div className="mt-2 flex items-center gap-2 font-mono text-[11px]">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500 line-through decoration-slate-400 dark:bg-white/5 dark:text-slate-400">TBA3218••</span>
          <ArrowRight className="h-3 w-3 text-cyan-500" />
          <span className="rounded-md bg-cyan-50 px-1.5 py-0.5 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">9400 1118••</span>
        </div>
      </div>

      {/* Floating: order detail */}
      <div className={`${FLOAT} -right-2 top-1/2 hidden w-[230px] -translate-y-1/3 p-4 sm:block lg:-right-8`} style={{ animationDelay: '1.2s' }}>
        <div className="flex items-center gap-2.5">
          <Avatar name="Emily Carter" tone={AVATAR_TONES[0]} size="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Emily Carter</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">#12-14391</p>
          </div>
        </div>
        <dl className="mt-3 space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500 dark:text-slate-400">{m('carrier')}</dt>
            <dd className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100"><Truck className="h-3.5 w-3.5 text-cyan-500" /> USPS</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500 dark:text-slate-400">{m('status')}</dt>
            <dd className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${STATUS_STYLE.delivered}`}>{m('delivered')}</dd>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <BellRing className="h-3.5 w-3.5" /> {m('notified')}
          </div>
        </dl>
      </div>
    </div>
  );
}

const SELLERS = [
  { name: 'brightdeals', share: 32, tone: 'bg-cyan-500' },
  { name: 'homeglow_us', share: 24, tone: 'bg-blue-500' },
  { name: 'lumina.store', share: 18, tone: 'bg-violet-500' },
  { name: 'smartbuy-24', share: 11, tone: 'bg-emerald-500' },
];

export function MarketAnalysisMock() {
  const { t } = useTranslation('landing');
  const m = (k) => t(`landing:showcase.mock.${k}`);
  const kpis = [
    { label: m('sellThrough'), value: '524%' },
    { label: m('sellers'), value: '100' },
    { label: m('avgPrice'), value: '$14.78' },
  ];
  return (
    <div className="relative pb-16 sm:pb-10">
      <div className={FRAME}>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-white/10 dark:bg-white/[0.04] sm:p-3">
              <p className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:text-[11px]">{k.label}</p>
              <p className="mt-1 text-base font-bold tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-xl">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{m('salesTrend')}</p>
          <svg viewBox="0 0 400 110" className="mt-2 h-24 w-full sm:h-28" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="showcaseArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 85 C40 80 60 60 100 62 S160 78 200 50 S270 30 300 40 S360 18 400 12 L400 110 L0 110 Z" fill="url(#showcaseArea)" />
            <path d="M0 85 C40 80 60 60 100 62 S160 78 200 50 S270 30 300 40 S360 18 400 12" fill="none" stroke="#0891b2" strokeWidth="2.5" />
            <circle cx="300" cy="40" r="4.5" fill="#fff" stroke="#2563eb" strokeWidth="2.5" />
          </svg>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-900 dark:text-white">{m('marketShare')}</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
            {SELLERS.map((s) => (
              <span key={s.name} className={s.tone} style={{ width: `${s.share}%` }} />
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {SELLERS.map((s) => (
              <span key={s.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.tone}`} />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{s.share}%</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating: top seller */}
      <div className={`${FLOAT} -bottom-1 right-2 w-[220px] p-3.5 landing-float sm:-right-6 sm:bottom-0`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
          <Crown className="h-4 w-4 text-amber-500" /> {m('topSeller')}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">brightdeals</span>
          <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">32%</span>
        </div>
      </div>

      {/* Floating: growth */}
      <div className={`${FLOAT} -left-2 top-1/3 hidden w-[190px] p-3.5 sm:block lg:-left-8`}>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{m('last30')}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-white">
          +18% <TrendingUp className="h-4 w-4 text-emerald-500" />
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{m('soldUnits')}</p>
      </div>
    </div>
  );
}
