import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BadgeCheck, CreditCard, Loader2, RefreshCw, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import Swal from 'sweetalert2';
import { paymentsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import GooglePayModal from '../components/GooglePayModal';
import PricingPlanCard, { isTrialPlanName } from '../components/plans/PricingPlanCard';
import { getWalletPaymentLabel } from '../utils/walletPayment';
import { renderAccentedTitle } from '../utils/accentedTitle';

// ── normalizePlan — mirrors LandingPage exactly ───────────────
function normalizePlan(raw = {}) {
  const normalizedCategory = String(raw.category || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const category =
    normalizedCategory === 'analytics' || normalizedCategory === 'analysis' || normalizedCategory === 'data_analytics'
      ? 'analytics'
      : normalizedCategory === 'amazon_monitoring' || normalizedCategory === 'amazonmonitoring'
      ? 'amazon_monitoring'
      : normalizedCategory === 'tracking_plans' || normalizedCategory === 'tracking_plan' || normalizedCategory === 'trackingplans'
      ? 'tracking_plans'
      : normalizedCategory === 'support'
      ? 'support'
      : 'subscription';

  return {
    id: raw.id,
    name: raw.name || 'Plan',
    duration: raw.duration || '',
    price: raw.price || '',
    actualPrice: raw.actualPrice ?? null,
    discountedPrice: raw.discountedPrice ?? null,
    summary: raw.description || raw.summary || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    trackingCreditsLimit: raw.trackingCreditsLimit ?? null,
    trackingAddonPrice: raw.trackingAddonPrice ?? null,
    category,
    featured: !!raw.featured,
  };
}

// Generic add-on for subscription plans that have no own trackingAddonPrice:
// the first standalone tracking_plans plan (same fallback the request modal uses).
function toFallbackAddon(trackingPlan) {
  if (!trackingPlan) return null;
  const amount = trackingPlan.discountedPrice ?? trackingPlan.actualPrice ?? Number(String(trackingPlan.price || '').replace(/[^0-9.]/g, ''));
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return { id: trackingPlan.id, price: Number(amount), credits: Number(trackingPlan.trackingCreditsLimit) || 0 };
}

// ── 6-box OTP input ───────────────────────────────────────────
function OtpInput({ value, onChange, isDark }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = char;
    onChange(next.join(''));
    if (char && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          className={`w-11 rounded-xl border text-center text-xl font-bold outline-none transition-all ${
            digits[i]
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 shadow-[0_0_0_3px_rgba(6,182,212,0.15)] dark:text-cyan-300'
              : isDark
              ? 'border-white/10 bg-white/[0.04] text-white focus:border-cyan-400/60'
              : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-cyan-500'
          }`}
          style={{ height: 52 }}
        />
      ))}
    </div>
  );
}

// ── Renew box shown on the active plan card ───────────────────
// Same flow as Settings → Ödəniş: "Kart" charges the default saved card
// (POST /payments/pay-now), the wallet option opens Epoint's Google/Apple Pay
// widget (POST /payments/epoint/pay-now/widget) and polls until it settles.
function RenewBox({ isTrial, defaultCard, walletLabel, onPayCard, onPayWallet, payingCard, payingWallet }) {
  const { t } = useTranslation('pricing');
  const [open, setOpen] = useState(false);

  if (isTrial) {
    return (
      <div className="rounded-2xl bg-white/90 p-3 text-xs leading-5 text-slate-600 ring-1 ring-slate-200 dark:bg-white/[0.05] dark:text-slate-300 dark:ring-white/10">
        {t('upgrade.trialNoRenew')}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        <RefreshCw className="h-4 w-4 transition group-hover:rotate-180" />
        {t('upgrade.renew')}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl bg-white p-3 text-slate-700 shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-white/10">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('upgrade.chooseMethod')}</p>
      <button
        type="button"
        onClick={onPayCard}
        disabled={!defaultCard || payingCard}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold transition hover:border-cyan-400 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent dark:border-white/10 dark:hover:bg-cyan-400/10"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          {payingCard ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="block">{t('upgrade.card')}</span>
          <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {defaultCard ? defaultCard.cardMask || defaultCard.mask || '••••' : t('upgrade.noCard')}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onPayWallet}
        disabled={payingWallet}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-50 dark:border-white/10 dark:hover:bg-emerald-400/10"
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          {payingWallet ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        </span>
        <span>{t('upgrade.payWith', { wallet: walletLabel })}</span>
      </button>
      {!defaultCard && (
        <p className="px-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {t('upgrade.addCardHint')}{' '}
          <Link to="/settings" className="font-semibold text-cyan-600 hover:underline dark:text-cyan-300">{t('upgrade.settingsLink')}</Link>
        </p>
      )}
      <button type="button" onClick={() => setOpen(false)} className="w-full pt-1 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
        {t('upgrade.cancel')}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function UpgradePlanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('pricing');
  const { t: tl } = useTranslation('landing');
  const { user, syncPermissionsFromLimits } = useAuth();
  const { isDark } = useTheme();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('subscription');

  const [verifying, setVerifying] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [choosingPayment, setChoosingPayment] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Renewal of the active plan (same endpoints as Settings → Ödəniş)
  const [cards, setCards] = useState([]);
  const [payingCard, setPayingCard] = useState(false);
  const [payingWallet, setPayingWallet] = useState(false);
  const [renewalWidgetUrl, setRenewalWidgetUrl] = useState('');
  const [renewalAttemptId, setRenewalAttemptId] = useState('');
  const walletLabel = getWalletPaymentLabel();
  const defaultCard = cards.find((c) => c.isDefault) || null;

  // Custom plan request — same SubscriptionRequestModal + public
  // /subscription-requests + email-verification flow the Landing Page uses
  // for its "Request custom limits" buttons (planId: 'custom').
  const [customRequestOpen, setCustomRequestOpen] = useState(false);

  const swalTheme = isDark
    ? { background: '#0f172a', color: '#f1f5f9' }
    : { background: '#ffffff', color: '#0f172a' };

  useEffect(() => {
    settingsAPI.getPublicPlans()
      .then((res) => setPlans((res?.data?.plans || []).map(normalizePlan).filter((p) => p.id)))
      .catch(() => setError(t('upgrade.loadError')))
      .finally(() => setLoading(false));
    paymentsAPI.listCards()
      .then((res) => setCards(res?.data?.cards || []))
      .catch(() => setCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visiblePlans = plans.filter((p) => p.category === activeTab);
  const currentPlanId = user?.selectedPlanId || null;
  const currentPlan = plans.find((p) => String(p.id) === String(currentPlanId)) || null;
  const fallbackAddon = toFallbackAddon(plans.find((p) => p.category === 'tracking_plans'));

  const refreshLimits = async () => {
    const limitsRes = await settingsAPI.getLimits().catch(() => null);
    if (limitsRes?.data) syncPermissionsFromLimits(limitsRes.data);
  };

  const renewSuccess = (nextExpiresAt) => {
    Swal.fire({
      title: t('upgrade.renewSuccessTitle'),
      text: nextExpiresAt
        ? t('upgrade.renewSuccessDate', { date: new Date(nextExpiresAt).toLocaleDateString() })
        : t('upgrade.renewSuccess'),
      icon: 'success',
      confirmButtonColor: '#06b6d4',
      ...swalTheme,
    });
  };

  const renewError = (message) => {
    Swal.fire({ title: t('upgrade.errorTitle'), text: message || t('upgrade.renewFailed'), icon: 'error', confirmButtonColor: '#06b6d4', ...swalTheme });
  };

  const handlePayCard = async () => {
    try {
      setPayingCard(true);
      const response = await paymentsAPI.payNow();
      await refreshLimits();
      renewSuccess(response?.data?.nextExpiresAt);
    } catch (err) {
      renewError(err?.response?.data?.error);
    } finally {
      setPayingCard(false);
    }
  };

  const handlePayWallet = async () => {
    try {
      setPayingWallet(true);
      const response = await paymentsAPI.payNowWidget();
      const { attemptId, widgetUrl } = response?.data || {};
      if (!attemptId || !widgetUrl) throw new Error(t('upgrade.walletLoadFailed', { wallet: walletLabel }));
      setRenewalAttemptId(attemptId);
      setRenewalWidgetUrl(widgetUrl);
    } catch (err) {
      renewError(err?.response?.data?.error || err?.message);
    } finally {
      setPayingWallet(false);
    }
  };

  const pollRenewalWidgetStatus = async () => {
    const res = await paymentsAPI.getRenewalWidgetStatus(renewalAttemptId);
    const status = res?.data?.status;
    if (status === 'completed') {
      setRenewalWidgetUrl('');
      await refreshLimits();
      renewSuccess(null);
      return { done: true };
    }
    if (status === 'failed') {
      setRenewalWidgetUrl('');
      renewError(t('upgrade.walletRejected', { wallet: walletLabel }));
      return { done: true };
    }
    return { done: false };
  };

  const handleUpgrade = async (plan, includeTrackingChoice, addon) => {
    const result = await Swal.fire({
      title: t('upgrade.confirmTitle', { plan: plan.name }),
      text: t('upgrade.confirmText'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('upgrade.confirmYes'),
      cancelButtonText: t('upgrade.confirmNo'),
      confirmButtonColor: '#06b6d4',
      reverseButtons: true,
      ...swalTheme,
    });
    if (!result.isConfirmed) return;

    const includeTracking = plan.category === 'subscription' && !!includeTrackingChoice && !!addon;
    const trackingPlanId = includeTracking ? String(addon.id || '') : '';

    setSubmitting(true);
    try {
      const res = await settingsAPI.submitSubscriptionRequest({ planId: plan.id, includeTracking, trackingPlanId });
      const req = res?.data?.request;
      setPendingRequest({ id: req?.id, email: req?.email });
      setVerifying(true);
    } catch (err) {
      Swal.fire({ title: t('upgrade.errorTitle'), text: err?.response?.data?.error || t('upgrade.submitFailed'), icon: 'error', ...swalTheme });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length < 6) { setCodeError(t('upgrade.codeIncomplete')); return; }
    setCodeError('');
    setSubmitting(true);
    try {
      await settingsAPI.verifySubscriptionRequest({ requestId: pendingRequest.id, email: pendingRequest.email, code });
      // Every plan on this page is a real, priced plan — always move on to an
      // online payment. The account is upgraded automatically once payment
      // succeeds (see payments.js /epoint/callback).
      setVerifying(false);
      setChoosingPayment(true);
    } catch (err) {
      setCodeError(err?.response?.data?.error || t('upgrade.codeInvalid'));
    } finally {
      setSubmitting(false);
    }
  };

  const onCustomRequestSuccess = () => {
    Swal.fire({ title: t('upgrade.customSentTitle'), text: t('upgrade.customSentText'), icon: 'success', confirmButtonColor: '#06b6d4', ...swalTheme });
  };

  const tabs = [
    { key: 'subscription', label: tl('landing:pricing.subscriptionPlans') },
    { key: 'analytics', label: tl('landing:pricing.analyticsPlans') },
    { key: 'amazon_monitoring', label: tl('landing:pricing.amazonMonitoringPlans') },
    { key: 'tracking_plans', label: tl('landing:pricing.trackingPlans') },
    { key: 'support', label: tl('landing:pricing.supportPlans') },
  ];

  const stepCard = 'w-full max-w-sm rounded-[1.75rem] border border-slate-200/80 bg-white p-8 shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-slate-900 dark:shadow-black/40';
  const stepIcon = (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
      <ShieldCheck className="h-7 w-7" />
    </div>
  );
  const pageBg = 'min-h-screen bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-100';

  // ── Choose payment method ──────────────────────────────────
  if (choosingPayment) {
    return (
      <div className={`${pageBg} flex items-center justify-center px-4`}>
        <div className={stepCard}>
          <div className="mb-7 text-center">
            {stepIcon}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('upgrade.payTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{t('upgrade.payText')}</p>
          </div>
          <PaymentMethodPicker
            requestId={pendingRequest?.id}
            cardLabel={t('upgrade.card')}
            chooseLabel={t('upgrade.chooseMethod')}
            onGooglePaySuccess={() => navigate('/dashboard')}
          />
          <button
            type="button"
            onClick={() => { setChoosingPayment(false); setCode(''); setCodeError(''); }}
            className="mt-5 w-full text-center text-xs text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            ← {t('upgrade.otherPlan')}
          </button>
        </div>
      </div>
    );
  }

  // ── Verify ─────────────────────────────────────────────────
  if (verifying) {
    return (
      <div className={`${pageBg} flex items-center justify-center px-4`}>
        <div className={stepCard}>
          <div className="mb-7 text-center">
            {stepIcon}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('upgrade.verifyTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t('upgrade.verifyText')}{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{pendingRequest?.email}</span>
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-5">
            <OtpInput value={code} onChange={setCode} isDark={isDark} />
            {codeError && <p className="text-center text-xs text-rose-500">{codeError}</p>}
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('upgrade.verifySubmit')}
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setVerifying(false); setCode(''); setCodeError(''); }}
            className="mt-5 w-full text-center text-xs text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          >
            ← {t('upgrade.otherPlan')}
          </button>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────
  return (
    <div className={`relative overflow-x-clip ${pageBg}`}>
      <div className="pointer-events-none absolute left-1/2 top-10 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400/15 via-blue-500/10 to-transparent blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
        >
          <ArrowLeft size={15} />
          {t('upgrade.back')}
        </button>

        {/* Header */}
        <div className="mx-auto mt-6 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200">
            <BadgeCheck size={14} />
            {tl('landing:pricing.eyebrow')}
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-5xl" style={{ textWrap: 'balance' }}>
            {renderAccentedTitle(t('upgrade.title'), t('upgrade.titleAccents', { returnObjects: true }))}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">{t('upgrade.subtitle')}</p>
          {currentPlan && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-600/15 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {t('upgrade.currentIs', { plan: currentPlan.name })}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-10 flex justify-center">
          <div className="max-w-full overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-1.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.05]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition md:px-5 ${
                    activeTab === tab.key
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {['subscription', 'analytics', 'amazon_monitoring'].includes(activeTab) && (
          <div className="mt-8 flex justify-center md:justify-end">
            <button
              type="button"
              onClick={() => setCustomRequestOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-white/80 px-4 py-2 text-sm font-semibold text-cyan-700 shadow-sm transition hover:border-transparent hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 hover:text-white dark:border-cyan-300/25 dark:bg-white/5 dark:text-cyan-200"
            >
              <Sparkles size={14} />
              {tl('landing:pricing.requestCustom')}
            </button>
          </div>
        )}

        {/* Plan grid */}
        <div className="mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-9 w-9 animate-spin text-cyan-500" />
            </div>
          ) : error ? (
            <div className="py-24 text-center text-sm text-rose-500">{error}</div>
          ) : visiblePlans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-12 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400">
              {tl('landing:pricing.noPlans')}
            </div>
          ) : (
            <div className={`grid gap-5 ${activeTab === 'analytics' ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-4'}`}>
              {visiblePlans.map((plan) => {
                const isCurrent = String(plan.id) === String(currentPlanId);
                return (
                  <PricingPlanCard
                    key={plan.id}
                    plan={plan}
                    isCurrent={isCurrent}
                    fallbackAddon={fallbackAddon}
                    ctaLabel={t('upgrade.upgradeTo', { plan: plan.name })}
                    onSubscribe={handleUpgrade}
                    currentSlot={
                      <RenewBox
                        isTrial={isTrialPlanName(plan.name)}
                        defaultCard={defaultCard}
                        walletLabel={walletLabel}
                        onPayCard={handlePayCard}
                        onPayWallet={handlePayWallet}
                        payingCard={payingCard}
                        payingWallet={payingWallet}
                      />
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        </div>
      )}

      <GooglePayModal
        widgetUrl={renewalWidgetUrl}
        onCancel={() => setRenewalWidgetUrl('')}
        onPoll={pollRenewalWidgetStatus}
        title={walletLabel}
      />

      <SubscriptionRequestModal
        open={customRequestOpen}
        onClose={() => setCustomRequestOpen(false)}
        plans={plans}
        selectedPlanId="custom"
        lockPlan={true}
        defaultValues={{ name: user?.name || '', surname: user?.surname || '', email: user?.email || '' }}
        onSuccess={onCustomRequestSuccess}
      />
    </div>
  );
}
