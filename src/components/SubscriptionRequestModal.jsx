import React, { useMemo, useState } from 'react';
import { settingsAPI, paymentsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';

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
    amazonLookupLimitPerWeek: '',
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
        // Epoint's hosted checkout; the account is provisioned automatically
        // once that payment succeeds (see payments.js /epoint/callback).
        if (form.planId && form.planId !== 'custom') {
          window.location.href = paymentsAPI.epointCheckoutUrl(verificationRequestId);
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
          form.amazonLookupLimitPerWeek,
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
            amazonLookupLimitPerWeek: Number(form.amazonLookupLimitPerWeek),
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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">
              {title || (isCreditTopUpRequest ? t('subscriptionRequestModal.requestCreditTopUp') : isResetRequest ? t('subscriptionRequestModal.requestSubscriptionReset') : t('subscriptionRequestModal.requestAccess'))}
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              {description || (isCreditTopUpRequest
                ? t('subscriptionRequestModal.askAddMoreCredits')
                : isResetRequest
                  ? t('subscriptionRequestModal.askRefreshSubscription')
                  : t('subscriptionRequestModal.sendRequestDescription'))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
          >
            {t('common.close')}
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {isSubscriptionRequest ? (
            <>
              {verificationStep ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  <p className="font-semibold">Verification code sent</p>
                  <p className="mt-1 text-emerald-50/90">
                    Enter the 6-digit code sent to <span className="font-semibold">{form.email || 'your email'}</span> to send your subscription request to the admin team.
                  </p>
                  {verificationExpiresAt ? (
                    <p className="mt-1 text-xs text-emerald-100/75">Code expires at {verificationExpiresAt}.</p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {!hasPrefilledName ? (
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder={t('subscriptionRequestModal.name')}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    disabled={verificationStep}
                  />
                ) : null}
                {!hasPrefilledSurname ? (
                  <input
                    type="text"
                    value={form.surname}
                    onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))}
                    placeholder={t('subscriptionRequestModal.surname')}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    disabled={verificationStep}
                  />
                ) : null}
              </div>

              {!hasPrefilledEmail ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder={t('subscriptionRequestModal.email')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                  disabled={verificationStep}
                />
              ) : null}

              {!hasPrefilledPhone ? (
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                  placeholder={t('subscriptionRequestModal.phoneNumber')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                  disabled={verificationStep}
                />
              ) : null}

              <select
                value={form.planId}
                onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                disabled={lockPlan || verificationStep}
              >
                <option value="">{t('subscriptionRequestModal.selectPlan')}</option>
                {availablePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {formatPlanName(plan.name, t)} ({formatPlanCategory(plan.category, t)})
                  </option>
                ))}
                <option value="custom">{t('subscriptionRequestModal.customPlanRequest')}</option>
              </select>

              {selectedPlan ? (
                <p className="text-xs text-slate-300">
                  {t('subscriptionRequestModal.selectedCategory')} <span className="font-semibold">{formatPlanCategory(selectedPlan.category, t)}</span>
                </p>
              ) : null}

              {canOfferTrackingAddon && (ownPlanTrackingAddon || trackingAddOnPlans.length > 0) && !verificationStep ? (
                <div className="space-y-2 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-teal-100">
                    <input
                      type="checkbox"
                      checked={form.includeTracking}
                      onChange={(e) => setForm((p) => ({
                        ...p,
                        includeTracking: e.target.checked,
                        trackingPlanId: ownPlanTrackingAddon
                          ? ownPlanTrackingAddon.id
                          : p.trackingPlanId || trackingAddOnPlans[0]?.id || '',
                      }))}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-teal-400"
                    />
                    {t('subscriptionRequestModal.includeTrackingAddon')}
                  </label>
                  {form.includeTracking ? (
                    ownPlanTrackingAddon ? (
                      <p className="text-xs text-teal-200/90">
                        {t('subscriptionRequestModal.trackingAddonSummary', {
                          amount: formatPrice(ownPlanTrackingAddon.price),
                          credits: ownPlanTrackingAddon.credits,
                        })}
                      </p>
                    ) : (
                      <>
                        {trackingAddOnPlans.length > 1 ? (
                          <select
                            value={form.trackingPlanId || trackingAddOnPlans[0]?.id || ''}
                            onChange={(e) => setForm((p) => ({ ...p, trackingPlanId: e.target.value }))}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-400"
                          >
                            {trackingAddOnPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} — {formatTrackingAddonAmount(plan, formatPrice)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {selectedTrackingAddon ? (
                          <p className="text-xs text-teal-200/90">
                            {t('subscriptionRequestModal.trackingAddonSummary', {
                              amount: formatTrackingAddonAmount(selectedTrackingAddon, formatPrice),
                              credits: selectedTrackingAddon.trackingCreditsLimit ?? 0,
                            })}
                          </p>
                        ) : null}
                      </>
                    )
                  ) : null}
                </div>
              ) : null}

              {form.planId === 'custom' ? (
                <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{t('subscriptionRequestModal.customPlanRequirements')}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="number"
                      min="0"
                      value={form.amazonLookupLimitPerWeek}
                      onChange={(e) => setForm((p) => ({ ...p, amazonLookupLimitPerWeek: e.target.value }))}
                      placeholder={t('subscriptionRequestModal.amazonLookupsPerWeek')}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <input
                      type="number"
                      min="0"
                      value={form.productsLimit}
                      onChange={(e) => setForm((p) => ({ ...p, productsLimit: e.target.value }))}
                      placeholder={t('subscriptionRequestModal.productsLimit')}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <input
                      type="number"
                      min="0"
                      value={form.marketAnalysisCreditsLimit}
                      onChange={(e) => setForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                      placeholder={t('subscriptionRequestModal.checkilaAnalysisCredits')}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    />
                    <input
                      type="number"
                      min="0"
                      value={form.ebayAccountsLimit}
                      onChange={(e) => setForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                      placeholder={t('subscriptionRequestModal.ebayAccounts')}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </div>
                  <textarea
                    value={form.customNote}
                    onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
                    placeholder={t('subscriptionRequestModal.optionalNoteDetailed')}
                    className="min-h-[84px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                    disabled={verificationStep}
                  />
                </div>
              ) : null}

              {verificationStep ? (
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter verification code"
                  className="w-full rounded-lg border border-emerald-500/30 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400"
                />
              ) : null}
            </>
          ) : isCreditTopUpRequest ? (
            <>
              <input
                type="number"
                min="1"
                value={form.requestedCredits}
                onChange={(e) => setForm((p) => ({ ...p, requestedCredits: e.target.value }))}
                placeholder={t('subscriptionRequestModal.requestedCredits')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              />
              <textarea
                value={form.customNote}
                onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
                placeholder={t('subscriptionRequestModal.optionalNoteForAdmin')}
                className="min-h-[84px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              />
            </>
          ) : (
            <textarea
              value={form.customNote}
              onChange={(e) => setForm((p) => ({ ...p, customNote: e.target.value }))}
              placeholder={t('subscriptionRequestModal.optionalNoteForAdmin')}
              className="min-h-[112px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
            />
          )}

          {infoMessage ? <p className="text-sm text-emerald-300">{infoMessage}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading
              ? t('subscriptionRequestModal.submitting')
              : verificationStep
                ? 'Verify code'
                : submitLabel || (isCreditTopUpRequest ? t('subscriptionRequestModal.sendCreditRequest') : isResetRequest ? t('subscriptionRequestModal.sendResetRequest') : t('subscriptionRequestModal.sendRequest'))}
          </button>
        </form>
      </div>
    </div>
  );
}
