// Order detail timeline (OrderDetailPage): a compact horizontal stepper plus a
// detailed vertical timeline. Data shape: utils/orderTimeline.js.

import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Clock3,
  MessageSquare,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Truck,
  XCircle,
  Zap,
} from 'lucide-react';
import { formatShortDateTime } from '../../utils/dateFormat';

const HOUR_MS = 60 * 60 * 1000;

export const STAGE_ICONS = {
  ordered: Receipt,
  purchased: ShoppingCart,
  shipped: Truck,
  delivered: PackageCheck,
  profit: CircleDollarSign,
};

export const formatDateTime = formatShortDateTime;

export function formatMoney(value, currency = 'USD') {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`;
  }
}

function dotStyles(state, isDark) {
  if (state === 'done') return 'bg-emerald-500 text-white ring-4 ' + (isDark ? 'ring-emerald-500/15' : 'ring-emerald-100');
  if (state === 'current') return 'bg-indigo-600 text-white ring-4 ' + (isDark ? 'ring-indigo-500/25' : 'ring-indigo-100');
  if (state === 'skipped') return isDark ? 'bg-slate-800 text-slate-500 ring-4 ring-slate-900' : 'bg-slate-100 text-slate-400 ring-4 ring-white';
  return isDark ? 'bg-slate-800 text-slate-400 ring-4 ring-slate-900' : 'bg-white text-slate-400 border border-slate-300 ring-4 ring-white';
}

// ── Horizontal stepper ──────────────────────────────────────────────────────

export function StageStepper({ timeline, isDark }) {
  const { t } = useTranslation();
  const stages = timeline.stages;
  return (
    <ol className="flex items-start">
      {stages.map((stage, index) => {
        const Icon = stage.state === 'done' ? Check : STAGE_ICONS[stage.key];
        const next = stages[index + 1];
        const lineDone = stage.state === 'done' && next && next.state !== 'skipped' && next.state !== 'pending';
        return (
          <li key={stage.key} className="relative flex flex-1 flex-col items-center text-center">
            {next && (
              <span
                aria-hidden="true"
                className={`absolute left-1/2 top-[18px] h-0.5 w-full ${
                  lineDone ? 'bg-emerald-500' : isDark ? 'bg-slate-800' : 'bg-slate-200'
                } ${next.state === 'skipped' ? 'opacity-50' : ''}`}
              />
            )}
            <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full transition ${dotStyles(stage.state, isDark)}`}>
              {stage.state === 'current' && <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/30" />}
              <Icon size={16} className="relative" />
            </span>
            <span
              className={`mt-2 px-1 text-[11px] font-semibold leading-tight sm:text-xs ${
                stage.state === 'current'
                  ? isDark ? 'text-indigo-300' : 'text-indigo-700'
                  : stage.state === 'done'
                    ? isDark ? 'text-slate-200' : 'text-slate-800'
                    : isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {t(`orderTimeline.stages.${stage.key}.short`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── Vertical timeline ───────────────────────────────────────────────────────

function Chip({ tone = 'neutral', isDark, icon: Icon, children }) {
  const cls = {
    neutral: isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600',
    success: isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700',
    warn: isDark ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700',
    danger: isDark ? 'bg-rose-500/15 text-rose-300' : 'bg-rose-50 text-rose-700',
    info: isDark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}

function Field({ label, value, mono = false, isDark }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className={`text-[11px] uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
      <p className={`truncate text-sm font-medium ${mono ? 'font-mono' : ''} ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}

function deadlineChip(shipBy, now, t, isDark) {
  if (!shipBy) return null;
  const left = shipBy - now;
  const hours = Math.round(Math.abs(left) / HOUR_MS);
  const text = hours >= 48
    ? t('orderTimeline.days', { count: Math.round(hours / 24) })
    : t('orderTimeline.hours', { count: Math.max(1, hours) });
  if (left < 0) return <Chip tone="danger" isDark={isDark} icon={AlertTriangle}>{t('orderTimeline.shipOverdue', { time: text })}</Chip>;
  return <Chip tone={left <= 24 * HOUR_MS ? 'warn' : 'neutral'} isDark={isDark} icon={Clock3}>{t('orderTimeline.shipBy', { time: text })}</Chip>;
}

function CaseCard({ entry, isDark, lang }) {
  const { t } = useTranslation();
  return (
    <div className={`mt-3 flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
      entry.open
        ? isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/60'
        : isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'
    }`}>
      <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${entry.open ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {t(`orderTimeline.caseKind.${entry.kind}`)} · <span className="font-mono text-xs">{entry.id}</span>
          </p>
          <Chip tone={entry.open ? 'warn' : 'neutral'} isDark={isDark}>
            {entry.open ? t('orderTimeline.caseOpen') : t('orderTimeline.caseClosed')}
          </Chip>
        </div>
        <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {[entry.status && entry.status.replace(/_/g, ' ').toLowerCase(), entry.amount && formatMoney(entry.amount.value, entry.amount.currency), entry.createdAt && formatDateTime(entry.createdAt, lang)]
            .filter(Boolean)
            .join(' · ')}
          {entry.open && entry.respondBy ? ` · ${t('orderTimeline.respondBy', { date: formatDateTime(entry.respondBy, lang) })}` : ''}
        </p>
      </div>
    </div>
  );
}

function StageBody({ stage, isDark, now, lang, actions }) {
  const { t } = useTranslation();
  const messaged = stage.buyerMessagedAt ? (
    <Chip tone="info" isDark={isDark} icon={MessageSquare}>{t('orderTimeline.buyerMessaged', { date: formatDateTime(stage.buyerMessagedAt, lang) })}</Chip>
  ) : null;

  switch (stage.key) {
    case 'ordered':
      return (
        <div className="mt-2 flex flex-wrap gap-2">
          {stage.paidAt && <Chip tone="success" isDark={isDark} icon={Check}>{t('orderTimeline.paidAt', { date: formatDateTime(stage.paidAt, lang) })}</Chip>}
          {!stage.paidAt && stage.paymentStatus && <Chip isDark={isDark}>{stage.paymentStatus}</Chip>}
        </div>
      );
    case 'purchased':
      if (stage.state === 'done') {
        return (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field isDark={isDark} label={t('orderTimeline.amazonOrderId')} value={stage.amazonOrderId} mono />
              <Field isDark={isDark} label={t('orderTimeline.amazonCost')} value={stage.amazonCost ? formatMoney(stage.amazonCost) : null} />
            </div>
            {messaged && <div className="mt-2">{messaged}</div>}
          </>
        );
      }
      return stage.state === 'current' ? actions.purchase : null;
    case 'shipped':
      if (stage.state === 'done') {
        return (
          <>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field isDark={isDark} label={t('orderTimeline.trackingNumber')} value={stage.trackingNumber} mono />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {stage.early && <Chip tone="info" isDark={isDark} icon={Zap}>{t('orderTimeline.sentEarly')}</Chip>}
              {messaged}
            </div>
          </>
        );
      }
      return stage.state === 'current' || stage.state === 'pending' ? (
        <div className="mt-2 flex flex-wrap gap-2">{deadlineChip(stage.shipBy, now, t, isDark)}</div>
      ) : null;
    case 'delivered':
      if (stage.state === 'done') return messaged ? <div className="mt-2">{messaged}</div> : null;
      if (stage.state !== 'current' || (!stage.lastEvent && !stage.carrierStatus)) return null;
      return (
        <div className={`mt-3 rounded-xl border px-3 py-2.5 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {stage.lastEvent?.text || stage.carrierStatus || t('orderTimeline.inTransit')}
          </p>
          {stage.lastEvent && (
            <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              {[stage.lastEvent.location, formatDateTime(stage.lastEvent.at, lang)].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      );
    case 'profit': {
      if (stage.profit === null || stage.profit === undefined) return null;
      const positive = stage.profit >= 0;
      return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`text-lg font-bold tabular-nums ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
            {positive ? '+' : ''}{formatMoney(stage.profit, stage.currency)}
          </span>
          {stage.estimated && <Chip tone="neutral" isDark={isDark}>{t('orderTimeline.estimated')}</Chip>}
        </div>
      );
    }
    default:
      return null;
  }
}

export function TimelineList({ timeline, isDark, now, lang, actions = {} }) {
  const { t } = useTranslation();
  return (
    <ol className="relative">
      {timeline.stages.map((stage, index) => {
        const Icon = STAGE_ICONS[stage.key];
        const last = index === timeline.stages.length - 1;
        const muted = stage.state === 'pending' || stage.state === 'skipped';
        return (
          <li key={stage.key} className="relative flex gap-4 pb-7 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute left-[17px] top-10 bottom-0 w-0.5 ${
                  stage.state === 'done' ? 'bg-emerald-500/60' : isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              />
            )}
            <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${dotStyles(stage.state, isDark)}`}>
              {stage.state === 'done' ? <Check size={16} /> : stage.state === 'skipped' ? <XCircle size={16} /> : <Icon size={16} />}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={`text-sm font-semibold ${muted ? (isDark ? 'text-slate-500' : 'text-slate-400') : isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {t(`orderTimeline.stages.${stage.key}.title`)}
                  {stage.state === 'current' && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>
                      {t('orderTimeline.now')}
                    </span>
                  )}
                </p>
                {stage.at ? (
                  <time className={`text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDateTime(stage.at, lang)}</time>
                ) : null}
              </div>
              <p className={`mt-0.5 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                {stage.state === 'skipped'
                  ? t('orderTimeline.skipped')
                  : stage.key === 'profit' && stage.estimated
                    ? t('orderTimeline.stages.profit.estimatedText')
                    : stage.state === 'pending'
                      ? t('orderTimeline.upcoming')
                      : t(`orderTimeline.stages.${stage.key}.${stage.state === 'done' ? 'done' : 'waiting'}`)}
              </p>
              <StageBody stage={stage} isDark={isDark} now={now} lang={lang} actions={actions} />
              {stage.cases.map((entry) => (
                <CaseCard key={`${entry.kind}-${entry.id}`} entry={entry} isDark={isDark} lang={lang} />
              ))}
            </div>
          </li>
        );
      })}
      {timeline.cancelled && (
        <li className="relative mt-2 flex gap-4">
          <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white ring-4 ring-rose-500/15">
            <XCircle size={16} />
          </span>
          <div className="pt-1.5">
            <p className="text-sm font-semibold text-rose-500">{t('orderTimeline.cancelled')}</p>
          </div>
        </li>
      )}
    </ol>
  );
}
