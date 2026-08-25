import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { referralAPI, settingsAPI, paymentsAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────
function toHumanText(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').split(' ')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}
function formatPlanCategory(category = '') {
  const n = String(category || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (n === 'amazon_monitoring' || n === 'amazonmonitoring') return 'Amazon Monitoring';
  if (n === 'analytics' || n === 'analysis' || n === 'data_analytics') return 'Analytics';
  if (n === 'subscription') return 'Subscription';
  if (n === 'tracking_plans' || n === 'tracking_plan' || n === 'trackingplans') return 'Tracking';
  if (n === 'custom') return 'Custom';
  return toHumanText(n || 'subscription');
}
function formatPlanName(name = '') {
  const raw = String(name || '').trim();
  if (!raw) return 'Plan';
  if (raw.includes('_') || raw.includes('-')) return toHumanText(raw);
  return raw;
}
function normalizePlan(raw = {}) {
  return {
    id: String(raw.id || '').trim(),
    name: raw.name || 'Plan',
    category: String(raw.category || 'subscription').trim().toLowerCase(),
    duration: raw.duration || '',
    price: raw.price || '',
    actualPrice: raw.actualPrice ?? raw.actual_price ?? null,
    discountedPrice: raw.discountedPrice ?? raw.discounted_price ?? null,
    trackingCreditsLimit: raw.trackingCreditsLimit ?? raw.tracking_credits_limit ?? null,
    trackingAddonPrice: raw.trackingAddonPrice ?? raw.tracking_addon_price ?? null,
    currency: raw.currency || 'AZN',
    description: raw.description || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    isActive: raw.isActive !== false,
    featured: !!raw.featured,
  };
}
// Plan prices are always entered in AZN — `formatPrice` (from LanguageContext)
// converts to whatever currency matches the user's selected language, the same
// way every other plan price on this page is displayed.
function formatTrackingAddonAmount(plan, formatPrice) {
  const amount =
    plan?.discountedPrice ?? plan?.actualPrice ?? Number(String(plan?.price || '').replace(/[^0-9.]/g, '')) ?? null;
  if (amount == null || !Number.isFinite(Number(amount))) return plan?.price || '';
  return formatPrice(Number(amount));
}
function initialForm(referralSlug = '') {
  return {
    name: '', surname: '', email: '', phoneNumber: '', planId: '',
    requestedCredits: '', amazonLookupLimitPerWeek: '', productsLimit: '',
    marketAnalysisCreditsLimit: '', ebayAccountsLimit: '',
    customNote: referralSlug ? `Referral: ${referralSlug}` : '',
    includeTracking: false,
    trackingPlanId: '',
  };
}
const CATEGORY_ORDER = ['subscription', 'analytics', 'amazon_monitoring', 'tracking_plans'];

// ─── Plan tile ────────────────────────────────────────────────────────────────
function PlanTile({ plan, selected, onSelect, isDark }) {
  const hasDiscount =
    Number.isFinite(Number(plan.actualPrice)) &&
    Number.isFinite(Number(plan.discountedPrice)) &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);
  const displayPrice = hasDiscount ? Number(plan.discountedPrice) : Number(plan.actualPrice);
  const priceLabel =
    Number.isFinite(displayPrice) && displayPrice > 0
      ? `${displayPrice} ${plan.currency || 'AZN'}`
      : plan.price || 'On request';

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.id)}
      className={`w-full rounded-xl border p-4 text-left transition-all duration-150 ${
        selected
          ? isDark
            ? 'border-blue-500 bg-blue-950/40 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
            : 'border-blue-500 bg-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
          : isDark
            ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10px] uppercase tracking-widest font-medium truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {formatPlanCategory(plan.category)}
          </p>
          <p className={`mt-0.5 font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {formatPlanName(plan.name)}
          </p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {plan.featured && (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide">
              Popular
            </span>
          )}
          <div className="flex items-baseline gap-1">
            {hasDiscount && (
              <span className={`text-xs line-through ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {Number(plan.actualPrice)}
              </span>
            )}
            <span className={`text-base font-bold ${selected ? 'text-blue-500' : isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              {priceLabel}
            </span>
          </div>
        </div>
      </div>
      {plan.features.length > 0 && (
        <ul className="mt-3 space-y-1">
          {plan.features.slice(0, 3).map((f, i) => (
            <li key={i} className={`flex items-start gap-1.5 text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span className="mt-0.5 text-blue-500 flex-shrink-0">✓</span>
              {f}
            </li>
          ))}
          {plan.features.length > 3 && (
            <li className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              +{plan.features.length - 3} more
            </li>
          )}
        </ul>
      )}
    </button>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ n, active, done, isDark }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
        done
          ? 'bg-blue-600 border-blue-600 text-white'
          : active
            ? isDark ? 'border-blue-500 text-blue-400 bg-blue-950/40' : 'border-blue-500 text-blue-600 bg-blue-50'
            : isDark ? 'border-slate-700 text-slate-600 bg-transparent' : 'border-slate-300 text-slate-400 bg-transparent'
      }`}>
        {done ? '✓' : n}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { formatPrice } = useLanguage();
  const referralSlug = new URLSearchParams(location.search).get('ref') || '';

  const [referral, setReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(Boolean(referralSlug));
  const [plans, setPlans] = useState([]);
  const [trackingAddOnPlans, setTrackingAddOnPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('subscription');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [formData, setFormData] = useState(initialForm(referralSlug));
  const [requestId, setRequestId] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  // Referral load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!referralSlug) { setReferral(null); setReferralLoading(false); return; }
      try {
        setReferralLoading(true);
        const res = await referralAPI.getPublicBySlug(referralSlug);
        if (!cancelled) setReferral(res?.data?.referral || null);
      } catch { if (!cancelled) setReferral(null); }
      finally { if (!cancelled) setReferralLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [referralSlug]);

  // Plans load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setPlansLoading(true);
        const res = await settingsAPI.getPublicPlans();
        if (cancelled) return;
        const allActive = (res?.data?.plans || []).map(normalizePlan).filter((p) => p.isActive !== false);
        // Tracking-category plans are shown as their own browsable category here too
        // (matching the landing page), AND separately kept in trackingAddOnPlans so
        // they can still be offered as an opt-in add-on attached to a Subscription
        // plan (see canOfferTrackingAddon below) — the two uses aren't exclusive.
        const next = allActive;
        setPlans(next);
        setTrackingAddOnPlans(allActive.filter((p) => p.category === 'tracking_plans'));
        const firstSub = next.find((p) => p.category === 'subscription') || next[0];
        if (!selectedPlanId && firstSub?.id) {
          setSelectedPlanId(firstSub.id);
          setFormData((prev) => ({ ...prev, planId: firstSub.id }));
          setActiveCategory(firstSub.category || 'subscription');
        }
      } catch (err) {
        if (!cancelled) setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to load plans' });
      } finally { if (!cancelled) setPlansLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const inPlans = new Set(plans.map((p) => p.category));
    const ordered = CATEGORY_ORDER.filter((c) => inPlans.has(c));
    plans.forEach((p) => { if (!ordered.includes(p.category)) ordered.push(p.category); });
    return ordered;
  }, [plans]);

  const visiblePlans = useMemo(() => plans.filter((p) => p.category === activeCategory), [plans, activeCategory]);
  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) || null, [plans, selectedPlanId]);

  const selectedTrackingAddon = useMemo(
    () =>
      trackingAddOnPlans.find((plan) => String(plan?.id || '') === String(formData.trackingPlanId || '')) ||
      trackingAddOnPlans[0] ||
      null,
    [trackingAddOnPlans, formData.trackingPlanId]
  );

  // A subscription-category plan can carry its own individually-priced tracking
  // add-on (trackingAddonPrice + trackingCreditsLimit set directly on the plan by
  // admin). When configured, it takes priority over the generic tracking_plans
  // list — the checkbox reflects THIS plan's own numbers, not a shared list.
  const ownPlanTrackingAddon = useMemo(() => {
    if (!selectedPlan || selectedPlan.category !== 'subscription') return null;
    const price = selectedPlan.trackingAddonPrice;
    const credits = Number(selectedPlan.trackingCreditsLimit);
    if (price === null || price === undefined || !Number.isFinite(Number(price))) return null;
    if (!Number.isFinite(credits) || credits <= 0) return null;
    return { id: selectedPlan.id, price: Number(price), credits, currency: selectedPlan.currency };
  }, [selectedPlan]);

  // The tracking add-on only ever applies to Subscription-category plans — never
  // Analytics, Amazon Monitoring, or no plan selected yet.
  const canOfferTrackingAddon = selectedPlan?.category === 'subscription';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlanSelect = (planId) => {
    setSelectedPlanId(planId);
    setFormData((prev) => ({ ...prev, planId }));
    setAlert(null);
  };

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    const plansInCat = plans.filter((p) => p.category === cat);
    if (!plansInCat.some((p) => p.id === selectedPlanId) && plansInCat.length > 0) {
      const next = plansInCat.find((p) => p.featured) || plansInCat[0];
      handlePlanSelect(next.id);
    }
  };

  const validateRequest = () => {
    if (!formData.name || !formData.surname || !formData.email || !formData.phoneNumber || !formData.planId)
      return t('subscriptionRequestModal.pleaseFillAllRequiredFields');
    if (formData.planId === 'custom') {
      const nums = [formData.amazonLookupLimitPerWeek, formData.productsLimit, formData.marketAnalysisCreditsLimit, formData.ebayAccountsLimit];
      if (nums.some((v) => v === '' || Number(v) < 0 || !Number.isFinite(Number(v))))
        return t('subscriptionRequestModal.customPlanRequiresFields');
    }
    return '';
  };

  const submitSubscriptionRequest = async () => {
    const err = validateRequest();
    if (err) { setAlert({ type: 'error', message: err }); return; }
    try {
      setLoading(true); setAlert(null);
      const payload = {
        name: formData.name.trim(), surname: formData.surname.trim(),
        email: formData.email.trim(), phoneNumber: formData.phoneNumber.trim(),
        planId: formData.planId, ...(referralSlug ? { referralSlug } : {}),
        includeTracking: !!(canOfferTrackingAddon && formData.includeTracking),
        trackingPlanId: canOfferTrackingAddon && formData.includeTracking
          ? String((ownPlanTrackingAddon || selectedTrackingAddon)?.id || '')
          : '',
      };
      if (formData.planId === 'custom') {
        payload.requestedLimits = {
          amazonLookupLimitPerWeek: Number(formData.amazonLookupLimitPerWeek),
          productsLimit: Number(formData.productsLimit),
          marketAnalysisCreditsLimit: Number(formData.marketAnalysisCreditsLimit),
          ebayAccountsLimit: Number(formData.ebayAccountsLimit),
        };
        payload.customNote = formData.customNote?.trim() || '';
      }
      const response = await settingsAPI.submitSubscriptionRequest(payload);
      const request = response?.data?.request || {};
      if (request.verificationRequired) {
        setVerificationStep(true);
        setRequestId(String(request.id || '').trim());
        setVerificationExpiresAt(String(request.verificationExpiresAt || '').trim());
        setVerificationCode('');
        setAlert({ type: 'success', message: response?.data?.message || 'A verification code has been sent to your email address.' });
        return;
      }
      await Swal.fire({ icon: 'success', title: t('common:success'), text: 'Your request has been sent to the admin team.', confirmButtonColor: '#2563eb' });
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: error?.response?.data?.error || error.message || t('subscriptionRequestModal.failedToSendRequest') });
    } finally { setLoading(false); }
  };

  const verifyCode = async () => {
    const code = String(verificationCode || '').trim();
    if (!/^[0-9]{6}$/.test(code)) { setAlert({ type: 'error', message: 'Enter the 6-digit verification code sent to your email.' }); return; }
    try {
      setLoading(true); setAlert(null);
      await settingsAPI.verifySubscriptionRequest({ requestId, email: formData.email.trim(), code });

      // Custom plans have no fixed price to charge online — those stay on
      // the existing manual admin-review flow. Every real plan moves on to
      // Epoint's hosted checkout; the account is created automatically once
      // that payment succeeds (see payments.js /epoint/callback).
      if (formData.planId && formData.planId !== 'custom') {
        window.location.href = paymentsAPI.epointCheckoutUrl(requestId);
        return;
      }

      await Swal.fire({ icon: 'success', title: t('common:success'), text: 'Email verified. Your subscription request has been sent to admin for approval.', confirmButtonColor: '#2563eb' });
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: error?.response?.data?.error || error.message || 'Failed to verify the code' });
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verificationStep) { await verifyCode(); return; }
    await submitSubscriptionRequest();
  };

  // Shared input class — mirrors LoginPage exactly
  const inputCls = `w-full rounded-lg border px-3 py-2.5 outline-none transition text-sm ${
    isDark
      ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400 focus:border-blue-500'
  }`;

  return (
    <div className={`min-h-screen flex items-start justify-center px-4 py-10 ${
      isDark
        ? 'bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900'
        : 'bg-gradient-to-b from-slate-50 to-indigo-50'
    }`}>
      <div className="w-full max-w-2xl">

        {/* ── Logo + header — same structure as LoginPage ── */}
        <div className="text-center mb-8">
          <img
            src="/logo-2.png"
            alt="Checkila"
            className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4 shadow-sm border border-slate-300/40"
          />
          <h1 className={`text-3xl font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            Request access
          </h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Choose a plan and submit your details. Admin will create your account.
          </p>
        </div>

        {/* ── Referral banner ── */}
        {referralSlug && (
          <div className={`mb-5 rounded-xl border px-4 py-3 flex items-center gap-3 text-sm ${
            isDark ? 'border-blue-800 bg-blue-950/40 text-blue-300' : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            <span className="text-base">🔗</span>
            <div className="min-w-0">
              <span className="font-semibold">Referral: </span>
              {referralLoading ? 'Loading...' : referral?.name || referralSlug}
              {referral?.description && (
                <span className={`block text-xs mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {referral.description}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Step indicator ── */}
        <div className="mb-6 flex items-center gap-0">
          {[
            { n: 1, label: 'Choose plan', active: !verificationStep, done: verificationStep },
            { n: 2, label: 'Your details', active: !verificationStep, done: verificationStep },
            { n: 3, label: 'Verify email', active: verificationStep, done: false },
            { n: 4, label: 'Admin review', active: false, done: false },
          ].map((step, i, arr) => (
            <React.Fragment key={step.n}>
              <div className="flex flex-col items-center gap-1">
                <StepDot n={step.n} active={step.active} done={step.done} isDark={isDark} />
                <span className={`text-[10px] font-medium whitespace-nowrap ${
                  step.done ? 'text-blue-500' : step.active ? isDark ? 'text-slate-300' : 'text-slate-600' : isDark ? 'text-slate-600' : 'text-slate-400'
                }`}>{step.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-px mx-1 mb-4 ${
                  step.done ? 'bg-blue-600' : isDark ? 'bg-slate-700' : 'bg-slate-300'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Card — same rounded-2xl border shadow-sm style as LoginPage ── */}
        <div className={`rounded-2xl border shadow-sm ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}>

          {/* Alert */}
          {alert && (
            <div className="px-6 pt-6">
              <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
            </div>
          )}

          {/* Verification notice */}
          {verificationStep && verificationExpiresAt && (
            <div className={`mx-6 mt-6 rounded-lg border px-4 py-3 text-sm ${
              isDark ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              Code sent to <strong>{formData.email}</strong>. Expires: {verificationExpiresAt}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            {/* ── Section: Plan picker (hidden during verify step) ── */}
            {!verificationStep && (
              <div>
                <p className={`text-xs uppercase tracking-widest font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  1 · Choose your plan
                </p>

                {/* Category tabs */}
                <div className={`flex gap-1 p-1 rounded-lg mb-4 w-fit ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeCategory === cat
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {formatPlanCategory(cat)}
                    </button>
                  ))}
                </div>

                {plansLoading ? (
                  <div className="py-6"><LoadingSpinner /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {visiblePlans.map((plan) => (
                      <PlanTile key={plan.id} plan={plan} selected={selectedPlanId === plan.id} onSelect={handlePlanSelect} isDark={isDark} />
                    ))}
                    {activeCategory === 'subscription' && (
                      <button
                        type="button"
                        onClick={() => handlePlanSelect('custom')}
                        className={`w-full rounded-xl border p-4 text-left transition-all ${
                          selectedPlanId === 'custom'
                            ? isDark ? 'border-blue-500 bg-blue-950/40' : 'border-blue-500 bg-blue-50'
                            : isDark ? 'border-slate-700 border-dashed bg-slate-800/30 hover:border-slate-600' : 'border-slate-300 border-dashed hover:border-slate-400'
                        }`}
                      >
                        <p className={`text-[10px] uppercase tracking-widest font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Custom</p>
                        <p className={`mt-0.5 font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Request custom limits</p>
                        <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Tailored plan · On request</p>
                      </button>
                    )}
                  </div>
                )}

                {/* Custom fields */}
                {selectedPlanId === 'custom' && (
                  <div className={`mt-4 rounded-xl border p-4 space-y-3 ${isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Custom requirements</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="0" name="amazonLookupLimitPerWeek" value={formData.amazonLookupLimitPerWeek} onChange={handleChange} placeholder="Lookups / week" className={inputCls} disabled={loading} />
                      <input type="number" min="0" name="productsLimit" value={formData.productsLimit} onChange={handleChange} placeholder="Products limit" className={inputCls} disabled={loading} />
                      <input type="number" min="0" name="marketAnalysisCreditsLimit" value={formData.marketAnalysisCreditsLimit} onChange={handleChange} placeholder="Analysis credits" className={inputCls} disabled={loading} />
                      <input type="number" min="0" name="ebayAccountsLimit" value={formData.ebayAccountsLimit} onChange={handleChange} placeholder="eBay accounts" className={inputCls} disabled={loading} />
                    </div>
                    <textarea name="customNote" value={formData.customNote} onChange={handleChange} placeholder="Optional note for admin" rows={3} className={inputCls} disabled={loading} style={{ resize: 'vertical' }} />
                  </div>
                )}

                {/* Tracking add-on opt-in — attaches to whichever plan is selected above */}
                {canOfferTrackingAddon && (ownPlanTrackingAddon || trackingAddOnPlans.length > 0) && (
                  <div className={`mt-4 space-y-2 rounded-xl border p-3 ${isDark ? 'border-teal-800 bg-teal-950/20' : 'border-teal-200 bg-teal-50'}`}>
                    <label className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-teal-200' : 'text-teal-800'}`}>
                      <input
                        type="checkbox"
                        checked={formData.includeTracking}
                        onChange={(e) => setFormData((p) => ({
                          ...p,
                          includeTracking: e.target.checked,
                          trackingPlanId: ownPlanTrackingAddon
                            ? ownPlanTrackingAddon.id
                            : p.trackingPlanId || trackingAddOnPlans[0]?.id || '',
                        }))}
                        disabled={loading}
                        className="h-4 w-4 rounded border-slate-600 accent-teal-500"
                      />
                      {t('subscriptionRequestModal.includeTrackingAddon')}
                    </label>
                    {formData.includeTracking ? (
                      ownPlanTrackingAddon ? (
                        <p className={`text-xs ${isDark ? 'text-teal-300/90' : 'text-teal-700'}`}>
                          {t('subscriptionRequestModal.trackingAddonSummary', {
                            amount: formatPrice(ownPlanTrackingAddon.price),
                            credits: ownPlanTrackingAddon.credits,
                          })}
                        </p>
                      ) : (
                      <>
                        {trackingAddOnPlans.length > 1 ? (
                          <select
                            value={formData.trackingPlanId || trackingAddOnPlans[0]?.id || ''}
                            onChange={(e) => setFormData((p) => ({ ...p, trackingPlanId: e.target.value }))}
                            className={inputCls}
                            disabled={loading}
                          >
                            {trackingAddOnPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name} — {formatTrackingAddonAmount(plan, formatPrice)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {selectedTrackingAddon ? (
                          <p className={`text-xs ${isDark ? 'text-teal-300/90' : 'text-teal-700'}`}>
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
                )}
              </div>
            )}

            {/* ── Section: Personal details (hidden during verify step) ── */}
            {!verificationStep && (
              <div>
                <p className={`text-xs uppercase tracking-widest font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  2 · Your details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" name="name" placeholder="First name" value={formData.name} onChange={handleChange} className={inputCls} disabled={loading} />
                  <input type="text" name="surname" placeholder="Last name" value={formData.surname} onChange={handleChange} className={inputCls} disabled={loading} />
                  <input type="email" name="email" placeholder="Email address" value={formData.email} onChange={handleChange} className={inputCls} disabled={loading} />
                  <input type="tel" name="phoneNumber" placeholder="Phone number" value={formData.phoneNumber} onChange={handleChange} className={inputCls} disabled={loading} />
                </div>
              </div>
            )}

            {/* ── Section: Verify code ── */}
            {verificationStep && (
              <div>
                <p className={`text-xs uppercase tracking-widest font-semibold mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  3 · Verify your email
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit verification code"
                  className={`${inputCls} text-center text-lg tracking-[0.5em] font-mono`}
                  disabled={loading}
                />
              </div>
            )}

            {/* ── Selected plan summary (when not custom, not loading) ── */}
            {!verificationStep && !plansLoading && selectedPlanId && selectedPlanId !== 'custom' && selectedPlan && (
              <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 ${
                isDark ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50'
              }`}>
                <div>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Selected</p>
                  <p className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {formatPlanName(selectedPlan.name)}
                    <span className={`ml-2 font-normal text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {formatPlanCategory(selectedPlan.category)}
                    </span>
                  </p>
                </div>
                <p className="font-bold text-blue-500 text-sm whitespace-nowrap">
                  {selectedPlan.price || selectedPlan.discountedPrice || selectedPlan.actualPrice || 'On request'}
                </p>
              </div>
            )}

            {/* ── Submit button — same class pattern as LoginPage btn-primary ── */}
            <button
              type="submit"
              disabled={loading || plansLoading || (!verificationStep && !selectedPlanId)}
              className="w-full btn-primary py-2.5"
            >
              {loading
                ? (verificationStep ? 'Verifying...' : 'Sending request...')
                : (verificationStep ? 'Verify & submit' : 'Send subscription request')}
            </button>
          </form>
        </div>

        {/* ── Footer link — same as LoginPage ── */}
        <div className={`mt-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
