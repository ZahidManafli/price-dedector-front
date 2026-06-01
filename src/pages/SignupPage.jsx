import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { referralAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useTranslation } from 'react-i18next';

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

function formatPlanCategory(category = '') {
  const normalized = String(category || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (normalized === 'amazon_monitoring' || normalized === 'amazonmonitoring') return 'Amazon Monitoring';
  if (normalized === 'analytics' || normalized === 'analysis' || normalized === 'data_analytics') return 'Data Analytics';
  if (normalized === 'subscription') return 'Subscription';
  if (normalized === 'custom') return 'Custom';
  return toHumanText(normalized || 'subscription');
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
    currency: raw.currency || 'AZN',
    description: raw.description || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    isActive: raw.isActive !== false,
    featured: !!raw.featured,
  };
}

function initialForm(referralSlug = '', selectedPlanId = '') {
  return {
    name: '',
    surname: '',
    email: '',
    phoneNumber: '',
    planId: selectedPlanId,
    requestedCredits: '',
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    customNote: referralSlug ? `Referral: ${referralSlug}` : '',
  };
}

function stepClass(active) {
  return active
    ? 'border-cyan-300 bg-cyan-400/15 text-cyan-50 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
    : 'border-white/10 bg-white/5 text-slate-300';
}

// Category tab bar
const CATEGORY_ORDER = ['subscription', 'analytics', 'amazon_monitoring'];

function CategoryTabs({ categories, activeCategory, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      {categories.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition border ${
            activeCategory === cat
              ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]'
              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
          }`}
        >
          {formatPlanCategory(cat)}
        </button>
      ))}
    </div>
  );
}

function PlanTile({ plan, selected, onSelect }) {
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
      className={`rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{formatPlanCategory(plan.category)}</p>
          <h3 className="mt-1 text-lg font-semibold text-white">{formatPlanName(plan.name)}</h3>
        </div>
        {plan.featured ? (
          <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100 whitespace-nowrap">
            Featured
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end gap-2">
        {hasDiscount && (
          <span className="text-sm line-through text-slate-500">
            {Number(plan.actualPrice)} {plan.currency || 'AZN'}
          </span>
        )}
        <span className="text-2xl font-semibold tracking-tight text-white">{priceLabel}</span>
      </div>
      {plan.duration ? <p className="mt-1 text-xs text-slate-400">{plan.duration}</p> : null}
      {plan.description ? <p className="mt-3 text-sm leading-6 text-slate-300">{plan.description}</p> : null}

      {plan.features.length > 0 && (
        <ul className="mt-3 space-y-1">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
              <span className="mt-0.5 text-cyan-400 flex-shrink-0">✓</span>
              {f}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const referralSlug = new URLSearchParams(location.search).get('ref') || '';
  const [referral, setReferral] = useState(null);
  const [referralLoading, setReferralLoading] = useState(Boolean(referralSlug));
  const [plans, setPlans] = useState([]);
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

  useEffect(() => {
    let cancelled = false;
    const loadReferral = async () => {
      if (!referralSlug) { setReferral(null); setReferralLoading(false); return; }
      try {
        setReferralLoading(true);
        const response = await referralAPI.getPublicBySlug(referralSlug);
        if (!cancelled) setReferral(response?.data?.referral || null);
      } catch {
        if (!cancelled) setReferral(null);
      } finally {
        if (!cancelled) setReferralLoading(false);
      }
    };
    loadReferral();
    return () => { cancelled = true; };
  }, [referralSlug]);

  useEffect(() => {
    let cancelled = false;
    const loadPlans = async () => {
      try {
        setPlansLoading(true);
        const response = await settingsAPI.getPublicPlans();
        if (cancelled) return;
        const nextPlans = (response?.data?.plans || [])
          .map(normalizePlan)
          .filter((plan) => plan.isActive !== false);
        setPlans(nextPlans);
        // Default to first subscription plan
        const firstSub = nextPlans.find((p) => p.category === 'subscription') || nextPlans[0];
        if (!selectedPlanId && firstSub?.id) {
          setSelectedPlanId(firstSub.id);
          setFormData((prev) => ({ ...prev, planId: firstSub.id }));
          setActiveCategory(firstSub.category || 'subscription');
        }
      } catch (error) {
        if (!cancelled) {
          setAlert({ type: 'error', message: error?.response?.data?.error || error.message || 'Failed to load plans' });
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    };
    loadPlans();
    return () => { cancelled = true; };
  }, []);

  // Derive ordered unique categories from loaded plans
  const categories = useMemo(() => {
    const inPlans = new Set(plans.map((p) => p.category));
    const ordered = CATEGORY_ORDER.filter((c) => inPlans.has(c));
    // Append any unknown categories not in CATEGORY_ORDER
    plans.forEach((p) => { if (!ordered.includes(p.category)) ordered.push(p.category); });
    return ordered;
  }, [plans]);

  const visiblePlans = useMemo(
    () => plans.filter((p) => p.category === activeCategory),
    [plans, activeCategory]
  );

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

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
    // When switching tabs, if currently selected plan isn't in this category,
    // auto-select the featured or first plan in the new tab
    const plansInCat = plans.filter((p) => p.category === cat);
    const isCurrentInCat = plansInCat.some((p) => p.id === selectedPlanId);
    if (!isCurrentInCat && plansInCat.length > 0) {
      const next = plansInCat.find((p) => p.featured) || plansInCat[0];
      handlePlanSelect(next.id);
    }
  };

  const validateRequest = () => {
    if (!formData.name || !formData.surname || !formData.email || !formData.phoneNumber || !formData.planId) {
      return t('subscriptionRequestModal.pleaseFillAllRequiredFields');
    }
    if (formData.planId === 'custom') {
      const requiredNumbers = [
        formData.amazonLookupLimitPerWeek,
        formData.productsLimit,
        formData.marketAnalysisCreditsLimit,
        formData.ebayAccountsLimit,
      ];
      const hasInvalid = requiredNumbers.some((v) => v === '' || Number(v) < 0 || !Number.isFinite(Number(v)));
      if (hasInvalid) return t('subscriptionRequestModal.customPlanRequiresFields');
    }
    return '';
  };

  const submitSubscriptionRequest = async () => {
    const validationError = validateRequest();
    if (validationError) { setAlert({ type: 'error', message: validationError }); return; }
    try {
      setLoading(true);
      setAlert(null);
      const payload = {
        name: formData.name.trim(),
        surname: formData.surname.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        planId: formData.planId,
        // Send the referral slug so the backend can enroll the user on approval
        ...(referralSlug ? { referralSlug } : {}),
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
      await Swal.fire({
        icon: 'success',
        title: t('common:success'),
        text: 'Your request has been sent to the admin team. They will create your account after approval.',
        confirmButtonColor: '#22d3ee',
      });
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: error?.response?.data?.error || error.message || t('subscriptionRequestModal.failedToSendRequest') });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const code = String(verificationCode || '').trim();
    if (!/^[0-9]{6}$/.test(code)) {
      setAlert({ type: 'error', message: 'Enter the 6-digit verification code sent to your email.' });
      return;
    }
    try {
      setLoading(true);
      setAlert(null);
      await settingsAPI.verifySubscriptionRequest({ requestId, email: formData.email.trim(), code });
      await Swal.fire({
        icon: 'success',
        title: t('common:success'),
        text: 'Email verified. Your subscription request has been sent to admin for approval.',
        confirmButtonColor: '#22d3ee',
      });
      navigate('/login');
    } catch (error) {
      setAlert({ type: 'error', message: error?.response?.data?.error || error.message || 'Failed to verify the code' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (verificationStep) { await verifyCode(); return; }
    await submitSubscriptionRequest();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white px-4 py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col lg:flex-row lg:items-stretch lg:gap-6">

        {/* ── Left panel: steps + referral info ── */}
        <div className="mb-6 flex-1 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl lg:mb-0 lg:max-w-md">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Checkila subscription</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Request access to your plan</h1>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Choose a plan, verify your email, and send the subscription request to admin. After approval, the team will create your account.
          </p>

          <div className="mt-6 grid gap-3">
            <div className={`rounded-2xl border p-4 ${stepClass(true)}`}>
              <p className="text-xs uppercase tracking-[0.25em] opacity-70">Step 1</p>
              <p className="mt-1 font-semibold">Select a plan</p>
            </div>
            <div className={`rounded-2xl border p-4 ${stepClass(verificationStep)}`}>
              <p className="text-xs uppercase tracking-[0.25em] opacity-70">Step 2</p>
              <p className="mt-1 font-semibold">Verify email</p>
            </div>
            <div className={`rounded-2xl border p-4 ${stepClass(verificationStep)}`}>
              <p className="text-xs uppercase tracking-[0.25em] opacity-70">Step 3</p>
              <p className="mt-1 font-semibold">Admin approval</p>
            </div>
          </div>

          {referralSlug ? (
            <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-sm text-cyan-50">
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/80">Referral link</p>
              <p className="mt-1 text-base font-semibold text-white">
                {referralLoading ? 'Loading referral...' : referral?.name || referralSlug}
              </p>
              <p className="mt-1 text-cyan-50/90">
                {referral?.description || 'This request will be associated with the referral link.'}
              </p>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Selected plan</p>
            <p className="mt-1 text-xl font-semibold">
              {selectedPlan ? formatPlanName(selectedPlan.name) : selectedPlanId === 'custom' ? 'Custom Plan' : 'No plan selected'}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {selectedPlan
                ? `${formatPlanCategory(selectedPlan.category)} · ${selectedPlan.price || selectedPlan.actualPrice || 'On request'}`
                : selectedPlanId === 'custom'
                ? 'Custom · On request'
                : 'Pick a plan on the right to continue.'}
            </p>
          </div>

          <p className="mt-6 text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-cyan-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        {/* ── Right panel: form ── */}
        <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl shadow-2xl md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-indigo-200/80">Subscription request</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                {verificationStep ? 'Verify your email' : 'Fill in your details'}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {verificationStep
                  ? 'Enter the verification code we sent to your email. After verification, admin will review your request.'
                  : 'Choose a subscription plan, then submit your details for admin approval.'}
              </p>
            </div>
            {plansLoading ? <span className="text-xs text-slate-400">Loading plans...</span> : null}
          </div>

          {alert && (
            <div className="mb-5">
              <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
            </div>
          )}

          {verificationStep && verificationExpiresAt ? (
            <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
              Verification code sent to <span className="font-semibold">{formData.email || 'your email'}</span>. Code expires at {verificationExpiresAt}.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input type="text" name="name" placeholder={t('signupPage.fullName') || 'Full name'} value={formData.name} onChange={handleChange} className="input-base" disabled={loading || verificationStep} />
              <input type="text" name="surname" placeholder="Surname" value={formData.surname} onChange={handleChange} className="input-base" disabled={loading || verificationStep} />
              <input type="email" name="email" placeholder={t('auth.email') || 'Email'} value={formData.email} onChange={handleChange} className="input-base" disabled={loading || verificationStep} />
              <input type="tel" name="phoneNumber" placeholder="Phone number" value={formData.phoneNumber} onChange={handleChange} className="input-base" disabled={loading || verificationStep} />
            </div>

            {/* ── Plan picker with category tabs ── */}
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-200">Choose a plan</p>
              {plansLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  {/* Category tabs */}
                  <CategoryTabs
                    categories={categories}
                    activeCategory={activeCategory}
                    onChange={handleCategoryChange}
                  />

                  {/* Plan grid for active category */}
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {visiblePlans.map((plan) => (
                      <PlanTile key={plan.id} plan={plan} selected={selectedPlanId === plan.id} onSelect={handlePlanSelect} />
                    ))}

                    {/* Custom plan tile — only show in subscription tab */}
                    {activeCategory === 'subscription' && (
                      <button
                        type="button"
                        onClick={() => handlePlanSelect('custom')}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedPlanId === 'custom'
                            ? 'border-cyan-300 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Custom</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">Request custom plan</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-300">Send a tailored request with your own limits.</p>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Custom plan fields */}
            {selectedPlanId === 'custom' ? (
              <div className="space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">Custom plan requirements</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="number" min="0" value={formData.amazonLookupLimitPerWeek} onChange={handleChange} name="amazonLookupLimitPerWeek" placeholder="Amazon lookups / week" className="input-base" disabled={loading || verificationStep} />
                  <input type="number" min="0" value={formData.productsLimit} onChange={handleChange} name="productsLimit" placeholder="Products limit" className="input-base" disabled={loading || verificationStep} />
                  <input type="number" min="0" value={formData.marketAnalysisCreditsLimit} onChange={handleChange} name="marketAnalysisCreditsLimit" placeholder="Analysis credits" className="input-base" disabled={loading || verificationStep} />
                  <input type="number" min="0" value={formData.ebayAccountsLimit} onChange={handleChange} name="ebayAccountsLimit" placeholder="eBay accounts" className="input-base" disabled={loading || verificationStep} />
                </div>
                <textarea value={formData.customNote} onChange={handleChange} name="customNote" placeholder="Optional note for admin" className="input-base min-h-[96px]" disabled={loading || verificationStep} />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <p className="text-sm text-slate-300">
                  {selectedPlan
                    ? `Selected: ${formatPlanName(selectedPlan.name)} · ${selectedPlan.price || selectedPlan.actualPrice || 'On request'}`
                    : 'Select a plan above to continue.'}
                </p>
              </div>
            )}

            {verificationStep ? (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter verification code"
                className="input-base"
                disabled={loading}
              />
            ) : null}

            <button
              type="submit"
              disabled={loading || plansLoading || (!verificationStep && !selectedPlanId)}
              className="w-full rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              {loading
                ? verificationStep ? 'Verifying...' : 'Sending request...'
                : verificationStep ? 'Verify code' : 'Send subscription request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
