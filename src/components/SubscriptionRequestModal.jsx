import React, { useMemo, useState } from 'react';
import { settingsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import PaymentMethodPicker from './PaymentMethodPicker';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Coins,
  Layers,
  Loader2,
  Mail,
  MailCheck,
  Package,
  Phone,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Store,
  Truck,
  User,
  X,
} from 'lucide-react';

// Shared input look (landing hero style: soft slate fields, cyan focus ring).
const INPUT =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/15 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:bg-slate-950';
const INPUT_WITH_ICON = INPUT + ' pl-10';

function Field({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      {children}
    </div>
  );
}

function toHumanText(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatPlanCategory(category = '', t) {
  const normalized = String(category || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (normalized === 'amazon_monitoring' || normalized === 'amazonmonitoring') return t('subscriptionRequestModal.planCategoryAmazonMonitoring');
  if (normalized === 'analytics' || normalized === 'analysis' || normalized === 'data_analytics') return t('subscriptionRequestModal.planCategoryDataAnalytics');
  if (normalized === 'subscription') return t('subscriptionRequestModal.planCategorySubscription');
  if (normalized === 'tracking_plans' || normalized === 'tracking_plan' || normalized === 'trackingplans') return t('subscriptionRequestModal.planCategoryTracking');
  if (normalized === 'custom') return t('subscriptionRequestModal.planCategoryCustom');
  return toHumanText(normalized || 'subscription');
}

function formatPlanName(name = '', t) {
  const raw = String(name || '').trim();
  if (!raw) return t('subscriptionRequestModal.planFallback');
  // Keep existing proper names, but normalize technical keys like amazon_monitoring.
  if (raw.includes('_') || raw.includes('-')) return toHumanText(raw);
  return raw;
}

function initialForm(selectedPlanId = '', requestType = 'subscription', defaultValues = {}, presetIncludeTracking = false) {
  return {
    name: defaultValues.name || '',
    surname: defaultValues.surname || '',
    email: defaultValues.email || '',
    phoneNumber: defaultValues.phoneNumber || '',
    planId: selectedPlanId,
    requestedCredits: defaultValues.requestedCredits || '',
    trackingCreditsLimit: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    customNote: defaultValues.customNote || '',
    requestType,
    // Carried over from a checkbox the user already ticked on the plan card before
    // clicking Subscribe. Harmless if the selected plan turns out not to qualify —
    // the checkbox stays hidden and the submit payload re-gates on canOfferTrackingAddon.
    includeTracking: !!presetIncludeTracking,
    trackingPlanId: '',
  };
}

// Plan prices are always entered in AZN — `formatPrice` (from LanguageContext)
// converts to whatever currency matches the user's selected language, the same
// way every other plan price on the landing page is displayed.
function formatTrackingAddonAmount(plan, formatPrice) {
  const amount =
    plan?.discountedPrice ?? plan?.actualPrice ?? Number(String(plan?.price || '').replace(/[^0-9.]/g, '')) ?? null;
  if (amount == null || !Number.isFinite(Number(amount))) return plan?.price || '';
  return formatPrice(Number(amount));
}

export default function SubscriptionRequestModal({
  open,
  onClose,
  plans = [],
  selectedPlanId = '',
  lockPlan = false,
  onSuccess,
  requestType = 'subscription',
  defaultValues = {},
  presetIncludeTracking = false,
  title,
  description,
  submitLabel,
}) {
  const { t } = useTranslation();
  const { formatPrice } = useLanguage();
  const [form, setForm] = useState(initialForm(selectedPlanId, requestType, defaultValues, presetIncludeTracking));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationRequestId, setVerificationRequestId] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState('');
  const [paymentStep, setPaymentStep] = useState(false);

  const defaultValuesSignature = useMemo(
    () =>
      [
        String(defaultValues?.name || '').trim(),
        String(defaultValues?.surname || '').trim(),
        String(defaultValues?.email || '').trim(),
        String(defaultValues?.phoneNumber || '').trim(),
        String(defaultValues?.requestedCredits || '').trim(),
        String(defaultValues?.customNote || '').trim(),
      ].join('::'),
    [
      defaultValues?.name,
      defaultValues?.surname,
      defaultValues?.email,
      defaultValues?.phoneNumber,
      defaultValues?.requestedCredits,
      defaultValues?.customNote,
    ]
  );

  const availablePlans = useMemo(() => {
    const deduped = new Map();
    (plans || []).forEach((plan) => {
      if (!plan || plan.isActive === false) return;
      const id = String(plan.id || '').trim();
      if (!id) return;
      if (!deduped.has(id)) deduped.set(id, plan);
    });
    return [...deduped.values()];
  }, [plans]);

  // Tracking add-on plans are never subscribable on their own — they're an opt-in
  // extra attached to whichever real plan the user picks above.
  const trackingAddOnPlans = useMemo(
    () => (plans || []).filter((plan) => plan && plan.isActive !== false && plan.category === 'tracking_plans'),
    [plans]
  );

  const selectedTrackingAddon = useMemo(
    () => trackingAddOnPlans.find((plan) => String(plan?.id || '') === String(form.trackingPlanId || '')) || trackingAddOnPlans[0] || null,
    [trackingAddOnPlans, form.trackingPlanId]
  );

  const selectedPlan = useMemo(
    () => availablePlans.find((plan) => String(plan?.id || '') === String(form.planId || '')) || null,
    [availablePlans, form.planId]
  );

  // A subscription-category plan can carry its own individually-priced tracking
  // add-on (trackingAddonPrice + trackingCreditsLimit set directly on the plan by
  // admin). When that's configured, it takes priority over the generic
  // tracking_plans list below — the checkbox always reflects THIS plan's own
  // numbers instead of asking the user to pick from a shared list.
  const ownPlanTrackingAddon = useMemo(() => {
    if (!selectedPlan || selectedPlan.category !== 'subscription') return null;
    const price = selectedPlan.trackingAddonPrice;
    const credits = Number(selectedPlan.trackingCreditsLimit);
    if (price === null || price === undefined || !Number.isFinite(Number(price))) return null;
    if (!Number.isFinite(credits) || credits <= 0) return null;
    return { id: selectedPlan.id, price: Number(price), credits, currency: selectedPlan.currency };
  }, [selectedPlan]);

  // The tracking add-on only ever applies to Subscription-category plans — never
  // Analytics, Amazon Monitoring, a tracking_plans plan itself (can't be selected
  // as the main plan anyway), or no plan selected yet. Gate the whole checkbox on
  // this so it can't be pre-checked/visible before the user has actually chosen a
  // qualifying plan.
  const canOfferTrackingAddon = selectedPlan?.category === 'subscription';

  const isSubscriptionRequest = requestType === 'subscription';
  const isCreditTopUpRequest = requestType === 'update_credits';
  const isResetRequest = requestType === 'reset_credits';

  const hasPrefilledName = String(defaultValues?.name || '').trim().length > 0;
  const hasPrefilledSurname = String(defaultValues?.surname || '').trim().length > 0;
  const hasPrefilledEmail = String(defaultValues?.email || '').trim().length > 0;
  const hasPrefilledPhone = String(defaultValues?.phoneNumber || '').trim().length > 0;

  React.useEffect(() => {
    setForm(initialForm(selectedPlanId, requestType, defaultValues, presetIncludeTracking));
    setError('');
    setInfoMessage('');
    setVerificationStep(false);
    setVerificationRequestId('');
    setVerificationCode('');
    setVerificationExpiresAt('');
    setPaymentStep(false);
  }, [selectedPlanId, open, requestType, defaultValuesSignature, presetIncludeTracking]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (isSubscriptionRequest && verificationStep) {
      if (!verificationRequestId) {
        setError('Please submit the request again to receive a new verification code.');
        return;
      }

      const code = String(verificationCode || '').trim();
      if (!/^[0-9]{6}$/.test(code)) {
        setError('Enter the 6-digit verification code sent to your email.');
        return;
      }

      try {
        setLoading(true);
        await settingsAPI.verifySubscriptionRequest({
          requestId: verificationRequestId,
          email: form.email,
          code,
        });

        // Custom plans have no fixed price to charge online — those stay on
        // the existing manual admin-review flow. Everything else moves on to
        // an online payment; the account is provisioned automatically once
        // that payment succeeds (see payments.js /epoint/callback).
        if (form.planId && form.planId !== 'custom') {
          setPaymentStep(true);
          return;
        }

        onSuccess?.();
        onClose?.();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Failed to verify the code');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isSubscriptionRequest) {
      if (!form.name || !form.surname || !form.email || !form.phoneNumber || !form.planId) {
        setError(t('subscriptionRequestModal.pleaseFillAllRequiredFields'));
        return;
      }

      const isCustomPlan = form.planId === 'custom';
      if (isCustomPlan) {
        const requiredNumbers = [
          form.trackingCreditsLimit,
          form.productsLimit,
          form.marketAnalysisCreditsLimit,
          form.ebayAccountsLimit,
        ];
        const hasInvalid = requiredNumbers.some((v) => v === '' || Number(v) < 0 || !Number.isFinite(Number(v)));
        if (hasInvalid) {
          setError(t('subscriptionRequestModal.customPlanRequiresFields'));
          return;
        }
      }

      try {
        setLoading(true);
        const payload = {
          name: form.name,
          surname: form.surname,
          email: form.email,
          phoneNumber: form.phoneNumber,
          planId: form.planId,
          includeTracking: !!(canOfferTrackingAddon && form.includeTracking),
          trackingPlanId: canOfferTrackingAddon && form.includeTracking
            ? String((ownPlanTrackingAddon || selectedTrackingAddon)?.id || '')
            : '',
        };

        if (isCustomPlan) {
          payload.requestedLimits = {
            trackingCreditsLimit: Number(form.trackingCreditsLimit),
            productsLimit: Number(form.productsLimit),
            marketAnalysisCreditsLimit: Number(form.marketAnalysisCreditsLimit),
            ebayAccountsLimit: Number(form.ebayAccountsLimit),
          };
          payload.customNote = form.customNote?.trim() || '';
        }

        const response = await settingsAPI.submitSubscriptionRequest(payload);
        const request = response?.data?.request || {};

        if (request.verificationRequired) {
          setVerificationStep(true);
          setVerificationRequestId(String(request.id || '').trim());
          setVerificationExpiresAt(String(request.verificationExpiresAt || '').trim());
          setVerificationCode('');
          setInfoMessage(response?.data?.message || 'A verification code has been sent to your email.');
          return;
        }

        onSuccess?.();
        onClose?.();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || t('subscriptionRequestModal.failedToSendRequest'));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isCreditTopUpRequest) {
      const nextCredits = Number(form.requestedCredits);
      if (!Number.isFinite(nextCredits) || nextCredits <= 0) {
        setError(t('subscriptionRequestModal.creditAmountGreaterThanZero'));
        return;
      }

      try {
        setLoading(true);
        await settingsAPI.submitUpdateCreditRequest({
          requestedCredits: nextCredits,
          customNote: form.customNote?.trim() || '',
        });
        onSuccess?.();
        onClose?.();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || t('subscriptionRequestModal.failedToSendRequest'));
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      await settingsAPI.submitResetCreditsRequest({
        customNote: form.customNote?.trim() || '',
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || t('subscriptionRequestModal.failedToSendRequest'));
    } finally {
      setLoading(false);
    }
  };

  const isCustomPlan = form.planId === 'custom';
  const headerIcon = isCreditTopUpRequest ? Coins : isResetRequest ? RotateCcw : isCustomPlan ? Sparkles : Send;
  const HeaderIcon = headerIcon;
  // Plan chosen on a plan card (lockPlan): the tracking add-on was already decided
  // there, so it's only summarised here — the checkbox is shown only when the user
  // picks the plan inside this modal (e.g. on the login page).
  const showTrackingToggle =
    !lockPlan && canOfferTrackingAddon && (ownPlanTrackingAddon || trackingAddOnPlans.length > 0) && !verificationStep;
  const trackingIncludedFromCard = lockPlan && canOfferTrackingAddon && form.includeTracking && (ownPlanTrackingAddon || selectedTrackingAddon);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/30 dark:border-white/10 dark:bg-slate-900">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -top-16 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl" aria-hidden="true" />

        <div className="relative p-6 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                <HeaderIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {title || (isCreditTopUpRequest ? t('subscriptionRequestModal.requestCreditTopUp') : isResetRequest ? t('subscriptionRequestModal.requestSubscriptionReset') : t('subscriptionRequestModal.requestAccess'))}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description || (isCreditTopUpRequest
                    ? t('subscriptionRequestModal.askAddMoreCredits')
                    : isResetRequest
                      ? t('subscriptionRequestModal.askRefreshSubscription')
                      : t('subscriptionRequestModal.sendRequestDescription'))}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {paymentStep ? (
              <PaymentMethodPicker
                requestId={verificationRequestId}
                onGooglePaySuccess={() => {
                  onSuccess?.();
                  onClose?.();
                }}
              />
            ) : isSubscriptionRequest ? (
              <>
                {verificationStep ? (
                  <div className="flex gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100">
                    <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <div>
                      <p className="font-semibold">Verification code sent</p>
                      <p className="mt-1 opacity-90">
                        Enter the 6-digit code sent to <span className="font-semibold">{form.email || 'your email'}</span> to send your subscription request to the admin team.
                      </p>
                      {verificationExpiresAt ? <p className="mt-1 text-xs opacity-75">Code expires at {verificationExpiresAt}.</p> : null}
                    </div>
                  </div>
                ) : null}

                {(!hasPrefilledName || !hasPrefilledSurname) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {!hasPrefilledName ? (
                      <Field icon={User}>
                        <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t('subscriptionRequestModal.name')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                    ) : null}
                    {!hasPrefilledSurname ? (
                      <Field icon={User}>
                        <input type="text" value={form.surname} onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))} placeholder={t('subscriptionRequestModal.surname')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                    ) : null}
                  </div>
                )}

                {!hasPrefilledEmail ? (
                  <Field icon={Mail}>
                    <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder={t('subscriptionRequestModal.email')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                  </Field>
                ) : null}

                {!hasPrefilledPhone ? (
                  <Field icon={Phone}>
                    <input type="tel" value={form.phoneNumber} onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))} placeholder={t('subscriptionRequestModal.phoneNumber')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                  </Field>
                ) : null}

                {lockPlan ? (
                  // Plan already chosen on a card: show it as a summary instead of a dropdown.
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-50 to-blue-50 px-4 py-3 dark:border-cyan-300/20 dark:from-cyan-400/10 dark:to-blue-500/10">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                        {isCustomPlan ? t('subscriptionRequestModal.planFallback') : formatPlanCategory(selectedPlan?.category, t)}
                      </p>
                      <p className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                        {isCustomPlan ? t('subscriptionRequestModal.customPlanRequest') : formatPlanName(selectedPlan?.name, t)}
                      </p>
                    </div>
                    {trackingIncludedFromCard ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-cyan-700 ring-1 ring-cyan-500/20 dark:bg-white/10 dark:text-cyan-200">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('subscriptionRequestModal.trackingIncluded')}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <Field icon={Layers}>
                      <select value={form.planId} onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))} className={`${INPUT_WITH_ICON} appearance-none pr-9`} disabled={verificationStep}>
                        <option value="">{t('subscriptionRequestModal.selectPlan')}</option>
                        {availablePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {formatPlanName(plan.name, t)} ({formatPlanCategory(plan.category, t)})
                          </option>
                        ))}
                        <option value="custom">{t('subscriptionRequestModal.customPlanRequest')}</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </Field>
                    {selectedPlan ? (
                      <p className="px-1 text-xs text-slate-500 dark:text-slate-400">
                        {t('subscriptionRequestModal.selectedCategory')} <span className="font-semibold text-slate-700 dark:text-slate-200">{formatPlanCategory(selectedPlan.category, t)}</span>
                      </p>
                    ) : null}
                  </>
                )}

                {showTrackingToggle ? (
                  <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <input
                        type="checkbox"
                        checked={form.includeTracking}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          includeTracking: e.target.checked,
                          trackingPlanId: ownPlanTrackingAddon ? ownPlanTrackingAddon.id : p.trackingPlanId || trackingAddOnPlans[0]?.id || '',
                        }))}
                        className="h-4 w-4 rounded accent-cyan-600"
                      />
                      {t('subscriptionRequestModal.includeTrackingAddon')}
                    </label>
                    {form.includeTracking ? (
                      ownPlanTrackingAddon ? (
                        <p className="pl-6 text-xs text-slate-500 dark:text-slate-400">
                          {t('subscriptionRequestModal.trackingAddonSummary', { amount: formatPrice(ownPlanTrackingAddon.price), credits: ownPlanTrackingAddon.credits })}
                        </p>
                      ) : (
                        <>
                          {trackingAddOnPlans.length > 1 ? (
                            <select value={form.trackingPlanId || trackingAddOnPlans[0]?.id || ''} onChange={(e) => setForm((p) => ({ ...p, trackingPlanId: e.target.value }))} className={INPUT}>
                              {trackingAddOnPlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.name} — {formatTrackingAddonAmount(plan, formatPrice)}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {selectedTrackingAddon ? (
                            <p className="pl-6 text-xs text-slate-500 dark:text-slate-400">
                              {t('subscriptionRequestModal.trackingAddonSummary', { amount: formatTrackingAddonAmount(selectedTrackingAddon, formatPrice), credits: selectedTrackingAddon.trackingCreditsLimit ?? 0 })}
                            </p>
                          ) : null}
                        </>
                      )
                    ) : null}
                  </div>
                ) : null}

                {isCustomPlan ? (
                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {t('subscriptionRequestModal.customPlanRequirements')}
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field icon={Truck}>
                        <input type="number" min="0" value={form.trackingCreditsLimit} onChange={(e) => setForm((p) => ({ ...p, trackingCreditsLimit: e.target.value }))} placeholder={t('subscriptionRequestModal.trackingCreditsLimit')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                      <Field icon={Package}>
                        <input type="number" min="0" value={form.productsLimit} onChange={(e) => setForm((p) => ({ ...p, productsLimit: e.target.value }))} placeholder={t('subscriptionRequestModal.productsLimit')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                      <Field icon={BarChart3}>
                        <input type="number" min="0" value={form.marketAnalysisCreditsLimit} onChange={(e) => setForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))} placeholder={t('subscriptionRequestModal.checkilaAnalysisCredits')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                      <Field icon={Store}>
                        <input type="number" min="0" value={form.ebayAccountsLimit} onChange={(e) => setForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))} placeholder={t('subscriptionRequestModal.ebayAccounts')} className={INPUT_WITH_ICON} disabled={verificationStep} />
                      </Field>
                    </div>
                    <textarea value={form.customNote} onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))} placeholder={t('subscriptionRequestModal.optionalNoteDetailed')} className={`${INPUT} min-h-[88px] resize-y`} disabled={verificationStep} />
                  </div>
                ) : null}

                {verificationStep ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className={`${INPUT} text-center font-mono text-lg tracking-[0.5em]`}
                  />
                ) : null}
              </>
            ) : isCreditTopUpRequest ? (
              <>
                <Field icon={Coins}>
                  <input type="number" min="1" value={form.requestedCredits} onChange={(e) => setForm((p) => ({ ...p, requestedCredits: e.target.value }))} placeholder={t('subscriptionRequestModal.requestedCredits')} className={INPUT_WITH_ICON} />
                </Field>
                <textarea value={form.customNote} onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))} placeholder={t('subscriptionRequestModal.optionalNoteForAdmin')} className={`${INPUT} min-h-[88px] resize-y`} />
              </>
            ) : (
              <textarea value={form.customNote} onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))} placeholder={t('subscriptionRequestModal.optionalNoteForAdmin')} className={`${INPUT} min-h-[112px] resize-y`} />
            )}

            {!paymentStep && infoMessage ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">{infoMessage}</p> : null}
            {!paymentStep && error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p> : null}

            {!paymentStep ? (
              <button
                type="submit"
                disabled={loading}
                className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-500/30 disabled:translate-y-0 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading
                  ? t('subscriptionRequestModal.submitting')
                  : verificationStep
                    ? 'Verify code'
                    : submitLabel || (isCreditTopUpRequest ? t('subscriptionRequestModal.sendCreditRequest') : isResetRequest ? t('subscriptionRequestModal.sendResetRequest') : t('subscriptionRequestModal.sendRequest'))}
                {!loading ? <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /> : null}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
