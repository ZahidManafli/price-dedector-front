import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

// Shared plan card for the landing page "Planlar" section and /upgrade-plan.
//
// Pricing rules (all maths in AZN, converted once at the end):
//  • A Subscription-category plan may carry its own tracking add-on
//    (trackingAddonPrice + trackingCreditsLimit). It is pre-selected; unticking
//    strikes through the plan's tracking-credit feature line.
//  • Trial plans always include the add-on — the checkbox is hidden.
//  • The struck-through "was" price = full plan price + add-on × (1 + 20%).
//
// Props:
//  plan          normalized plan ({ id, name, duration, summary, features, … })
//  onSubscribe   (plan, includeTracking, addon) => void — the CTA click
//  ctaLabel      optional CTA text (defaults to "Abunə Olun")
//  fallbackAddon optional { id, price, credits } used when the plan has no own add-on
//  isCurrent     marks the user's active plan (badge + ring)
//  currentSlot   rendered in place of the CTA when isCurrent (e.g. a renew button)

// A plan feature line that describes the tracking credits ("60 credit for Tracking",
// "300 tracking credits", "izləmə krediti"…).
const TRACKING_FEATURE_RE = /(tracking|izl[əe]m[əe]|izleme|takip|отслеж|трек)/i;
const CREDIT_WORD_RE = /(credit|kredit|кредит)/i;
export const isTrackingCreditFeature = (text) => TRACKING_FEATURE_RE.test(text) && CREDIT_WORD_RE.test(text);

// Markup on the tracking add-on inside the struck-through "was" price.
export const TRACKING_ADDON_LIST_MARKUP = 0.2;

export function getOwnTrackingAddon(plan) {
  if (!plan || plan.category !== 'subscription') return null;
  const price = plan.trackingAddonPrice;
  const credits = Number(plan.trackingCreditsLimit);
  if (price === null || price === undefined || !Number.isFinite(Number(price))) return null;
  if (!Number.isFinite(credits) || credits <= 0) return null;
  return { id: plan.id, price: Number(price), credits };
}

export const isTrialPlanName = (name) => /trial/i.test(String(name || ''));

export default function PricingPlanCard({
  plan,
  onSubscribe,
  ctaLabel,
  fallbackAddon = null,
  isCurrent = false,
  currentSlot = null,
  includeTracking: includeTrackingProp,
  onIncludeTrackingChange,
}) {
  const { formatPrice } = useLanguage();
  const { t } = useTranslation('pricing');
  // The add-on is pre-selected; unticking it strikes the tracking-credit feature.
  // Uncontrolled by default (each card owns its own choice for the subscribe
  // flow); the current-plan card is controlled from outside instead — passed
  // down the same state the renew box's own checkbox uses, so the headline
  // price always matches what that checkbox says, not an independent default.
  const [includeTrackingState, setIncludeTrackingState] = useState(true);
  const includeTracking = includeTrackingProp !== undefined ? includeTrackingProp : includeTrackingState;
  const setIncludeTracking = onIncludeTrackingChange || setIncludeTrackingState;
  const featured = !!plan.featured;

  const hasDiscount =
    plan.actualPrice != null &&
    plan.discountedPrice != null &&
    Number.isFinite(Number(plan.actualPrice)) &&
    Number.isFinite(Number(plan.discountedPrice)) &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);

  const addon = getOwnTrackingAddon(plan) || (plan.category === 'subscription' ? fallbackAddon : null);
  const isTrialPlan = isTrialPlanName(plan.name);
  const addonOn = (includeTracking || isTrialPlan) && !!addon;

  // Combine in AZN first, then convert once — never convert the plan price and the
  // add-on price separately and add the converted numbers, which would compound
  // rounding and break the currency logic.
  const baseAzn = hasDiscount
    ? Number(plan.discountedPrice)
    : plan.actualPrice != null
      ? Number(plan.actualPrice)
      : Number(plan.price?.match(/[\d.]+/)?.[0] || 0);
  const addonAzn = addonOn ? addon.price : 0;
  const totalAzn = baseAzn + addonAzn;
  const totalDisplay = formatPrice(totalAzn);

  const listAzn =
    (plan.actualPrice != null && Number.isFinite(Number(plan.actualPrice)) ? Number(plan.actualPrice) : baseAzn) +
    (addonOn ? addon.price * (1 + TRACKING_ADDON_LIST_MARKUP) : 0);
  const discountPercent = listAzn > totalAzn ? Math.round(((listAzn - totalAzn) / listAzn) * 100) : 0;
  const showListPrice = discountPercent > 0;

  const muted = featured ? 'text-cyan-50/80' : 'text-slate-500 dark:text-slate-400';

  return (
    <article
      className={`group relative flex h-full flex-col rounded-[1.75rem] p-2 transition duration-300 hover:-translate-y-1 ${
        featured
          ? 'bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 shadow-2xl shadow-cyan-500/25 ring-1 ring-cyan-400/40'
          : 'border border-slate-200/80 bg-slate-50/90 shadow-sm hover:shadow-xl hover:shadow-slate-900/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:shadow-black/30'
      } ${isCurrent ? 'outline outline-2 outline-offset-4 outline-emerald-400/80' : ''}`}
    >
      {featured && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]" aria-hidden="true">
          <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-white/25 blur-3xl" />
        </div>
      )}
      {isCurrent ? (
        <span className="absolute -top-3 right-6 z-10 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-emerald-500/30">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {t('pricing:upgrade.activePlan')}
        </span>
      ) : featured ? (
        <span className="absolute -top-3 right-6 z-10 rounded-full bg-amber-300 px-3 py-1 text-[11px] font-bold text-slate-900 shadow-md shadow-amber-500/30">
          {t('planCard.featured')}
        </span>
      ) : null}

      {/* Top: name, price, add-on, CTA */}
      <div className="relative px-4 pb-5 pt-5">
        <h3 className={`text-lg font-semibold ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
        {plan.summary && <p className={`mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-5 ${muted}`}>{plan.summary}</p>}

        <div className="mt-5 flex min-h-[1.5rem] flex-wrap items-center gap-2">
          {showListPrice && (
            <>
              <span className={`text-sm line-through ${featured ? 'text-cyan-50/70' : 'text-slate-400'}`}>{formatPrice(listAzn)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  featured ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300'
                }`}
              >
                {t('pricing:planCard.save', { percent: discountPercent })}
              </span>
            </>
          )}
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className={`text-4xl font-bold tracking-tight tabular-nums ${featured ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{totalDisplay}</span>
          {plan.duration && <span className={`text-sm ${muted}`}>/ {plan.duration.toLowerCase()}</span>}
        </p>

        {addon && !isTrialPlan && !isCurrent && (
          <label
            className={`mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
              featured
                ? 'bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/20'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-cyan-400/50 dark:bg-white/[0.04] dark:text-slate-200 dark:ring-white/10'
            }`}
          >
            <input
              type="checkbox"
              checked={includeTracking}
              onChange={(e) => setIncludeTracking(e.target.checked)}
              className={`mt-0.5 h-4 w-4 shrink-0 rounded ${featured ? 'accent-white' : 'accent-cyan-600'}`}
            />
            <span className="font-semibold leading-5">{t('pricing:planCard.includeTracking')}</span>
          </label>
        )}

        {isCurrent && currentSlot ? (
          <div className="mt-5">{currentSlot}</div>
        ) : (
          <button
            type="button"
            onClick={() => onSubscribe?.(plan, addonOn, addonOn ? addon : null)}
            className={`mt-5 w-full rounded-full px-4 py-2.5 text-sm font-semibold transition ${
              featured
                ? 'bg-white text-blue-700 shadow-lg shadow-blue-900/20 hover:bg-cyan-50'
                : 'border border-slate-200 bg-white text-slate-900 hover:border-transparent hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 hover:text-white dark:border-white/15 dark:bg-white/5 dark:text-white'
            }`}
          >
            {ctaLabel || t('planCard.subscribe')}
          </button>
        )}
      </div>

      {/* Bottom: features panel */}
      {plan.features.length > 0 && (
        <ul
          className={`relative flex-1 space-y-3 rounded-[1.35rem] p-5 text-sm ${
            featured ? 'bg-white text-slate-700 shadow-inner dark:bg-slate-950/90 dark:text-slate-100' : 'bg-white/80 text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-950/40 dark:text-slate-200 dark:ring-white/5'
          }`}
        >
          {plan.features.map((feature) => {
            const struck = !!addon && !addonOn && isTrackingCreditFeature(feature);
            return (
              <li key={feature} className={`flex items-start gap-2.5 transition ${struck ? 'opacity-60' : ''}`}>
                {struck ? (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
                )}
                <span className={struck ? 'text-slate-400 line-through decoration-slate-400' : ''}>{feature}</span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
