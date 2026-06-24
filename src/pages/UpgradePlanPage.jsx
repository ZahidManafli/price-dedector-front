import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import Swal from 'sweetalert2';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── normalizePlan — mirrors LandingPage exactly ───────────────
function normalizePlan(raw = {}) {
  const planName = raw.name || 'Plan';
  const isAdvantagePlan = /advantage/i.test(planName);
  const normalizedCategory = String(raw.category || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const category =
    normalizedCategory === 'analytics' || normalizedCategory === 'analysis' || normalizedCategory === 'data_analytics'
      ? 'analytics'
      : normalizedCategory === 'amazon_monitoring' || normalizedCategory === 'amazonmonitoring'
      ? 'amazon_monitoring'
      : 'subscription';

  return {
    id: raw.id,
    name: planName,
    duration: raw.duration || '',
    actualPrice: raw.actualPrice ?? null,
    discountedPrice: raw.discountedPrice ?? null,
    summary: raw.description || raw.summary || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    category,
    featured: !!raw.featured,
    accent:
      category === 'analytics'
        ? 'from-violet-400/20 to-slate-700/10'
        : isAdvantagePlan
        ? 'from-amber-300/35 to-yellow-500/20'
        : raw.featured
        ? 'from-cyan-400/35 to-blue-500/20'
        : 'from-sky-400/25 to-indigo-500/15',
  };
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
    <div className="flex gap-2.5 justify-center">
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
          className={`w-11 h-13 rounded-xl border text-center text-xl font-bold outline-none transition-all ${
            digits[i]
              ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300 shadow-[0_0_0_3px_rgba(34,211,238,0.15)]'
              : isDark
              ? 'border-white/10 bg-white/[0.04] text-white focus:border-cyan-400/60'
              : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-cyan-400'
          }`}
          style={{ height: 52 }}
        />
      ))}
    </div>
  );
}

// ── Plan card — same structure as LandingPage ─────────────────
function PlanCard({ plan, isCurrent, onUpgrade }) {
  const hasDiscount =
    Number.isFinite(Number(plan.actualPrice)) &&
    Number.isFinite(Number(plan.discountedPrice)) &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);

  const discountPercent = hasDiscount
    ? Math.round(((Number(plan.actualPrice) - Number(plan.discountedPrice)) / Number(plan.actualPrice)) * 100)
    : 0;

  const displayPrice = plan.actualPrice != null ? `₼${Number(plan.actualPrice).toFixed(2)}` : '—';
  const discountedDisplay = plan.discountedPrice != null ? `₼${Number(plan.discountedPrice).toFixed(2)}` : null;

  const featuredClasses = plan.featured
    ? 'border-cyan-300/50 bg-slate-900/95 shadow-[0_20px_80px_rgba(34,211,238,0.14)]'
    : 'border-white/10 bg-slate-900/70';

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-5 shadow-lg backdrop-blur transition duration-300 ${
        isCurrent ? 'border-cyan-400/40 cursor-default' : `hover:-translate-y-1 hover:border-white/20 cursor-pointer ${featuredClasses}`
      }`}
      style={{ animation: 'upgradeFadeIn 0.35s ease both' }}
    >
      {/* gradient background — always present */}
      <div className={`absolute inset-0 bg-gradient-to-br ${plan.accent} opacity-100`} />

      {/* card content — blurred when current */}
      <div
        className="relative z-10 flex h-full flex-col"
        style={isCurrent ? { filter: 'blur(3px)', opacity: 0.35, userSelect: 'none', pointerEvents: 'none' } : {}}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{plan.duration}</p>
          </div>
          {plan.featured && (
            <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Popular
            </span>
          )}
        </div>

        {/* price box */}
        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-3">
          {hasDiscount && discountedDisplay ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300 line-through">{displayPrice}</p>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
                  -{discountPercent}%
                </span>
              </div>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-semibold tracking-tight text-white">{discountedDisplay}</span>
                <span className="text-xs text-slate-400">special offer</span>
              </div>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold tracking-tight text-white">{displayPrice}</span>
            </div>
          )}
        </div>

        {/* summary */}
        <p className="mt-3 min-h-[3rem] text-sm leading-6 text-slate-300">{plan.summary}</p>

        {/* features */}
        <ul className="mt-5 flex-1 space-y-3 text-sm text-slate-200">
          {plan.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        {/* upgrade button */}
        <button
          type="button"
          onClick={() => onUpgrade(plan)}
          className="mt-5 w-full rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
        >
          Upgrade to {plan.name}
        </button>
      </div>

      {/* Active plan overlay */}
      {isCurrent && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl">
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-8 py-5 text-center backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-cyan-400"
                style={{ boxShadow: '0 0 8px rgba(34,211,238,0.9)', animation: 'upgradePulse 1.8s ease-in-out infinite' }}
              />
              <span className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-300">Active Plan</span>
            </div>
            <p className="text-xs text-slate-400">Your current subscription</p>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function UpgradePlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('subscription');

  const [verifying, setVerifying] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    settingsAPI.getPublicPlans()
      .then((res) => setPlans((res?.data?.plans || []).map(normalizePlan).filter((p) => p.id)))
      .catch(() => setError('Failed to load plans. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const visiblePlans = plans.filter((p) => p.category === activeTab);
  const currentPlanId = user?.selectedPlanId || null;

  const handleUpgrade = async (plan) => {
    const result = await Swal.fire({
      title: `Switch to ${plan.name}?`,
      html: `<span style="color:#94a3b8;font-size:14px">A 6-digit verification code will be sent to your email.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, request upgrade',
      cancelButtonText: 'Not now',
      background: '#0f172a',
      color: '#f1f5f9',
      confirmButtonColor: '#22d3ee',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await settingsAPI.submitSubscriptionRequest({ planId: plan.id });
      const req = res?.data?.request;
      setPendingRequest({ id: req?.id, email: req?.email });
      setVerifying(true);
    } catch (err) {
      Swal.fire({
        title: 'Something went wrong',
        text: err?.response?.data?.error || 'Failed to submit request.',
        icon: 'error',
        background: '#0f172a',
        color: '#f1f5f9',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length < 6) { setCodeError('Please enter the complete 6-digit code.'); return; }
    setCodeError('');
    setSubmitting(true);
    try {
      await settingsAPI.verifySubscriptionRequest({ requestId: pendingRequest.id, email: pendingRequest.email, code });
      setSuccess(true);
    } catch (err) {
      setCodeError(err?.response?.data?.error || 'Invalid or expired code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pageBg = isDark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-900';
  const headerBg = isDark ? 'bg-slate-950/90 border-white/[0.06]' : 'bg-white/90 border-slate-200';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  // ── Success ────────────────────────────────────────────────
  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${pageBg}`}>
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Request Sent</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Your plan change request is under review. The admin will approve it — you'll be notified when it's live.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-8 rounded-xl bg-cyan-400 px-8 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Verify ─────────────────────────────────────────────────
  if (verifying) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${pageBg}`}>
        <div className={`w-full max-w-sm rounded-3xl border p-8 shadow-xl ${cardBg}`}>
          <div className="text-center mb-7">
            <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border ${isDark ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-cyan-300/30 bg-cyan-50'}`}>
              <ShieldCheck className="h-7 w-7 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold">Check your email</h2>
            <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              We sent a 6-digit code to{' '}
              <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{pendingRequest?.email}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            <OtpInput value={code} onChange={setCode} isDark={isDark} />
            {codeError && (
              <p className="text-center text-xs text-red-400">{codeError}</p>
            )}
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="w-full rounded-xl bg-cyan-400 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm &amp; Submit
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setVerifying(false); setCode(''); setCodeError(''); }}
            className={`mt-5 w-full text-center text-xs transition ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
          >
            ← Choose a different plan
          </button>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${pageBg}`}>
      <style>{`
        @keyframes upgradeFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes upgradePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.35; transform:scale(0.8); } }
        @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
      `}</style>

      {/* Header */}
      <div className={`sticky top-0 z-30 border-b px-6 py-4 backdrop-blur-xl flex items-center gap-4 ${headerBg}`}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
            isDark ? 'border-white/10 bg-white/[0.05] text-slate-400 hover:bg-white/10 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-base font-bold">Upgrade your plan</h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Choose the plan that fits your workflow</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* Tab bar — identical to LandingPage */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] p-1.5 backdrop-blur">
            {[
              { key: 'subscription', label: 'Subscription Plans' },
              { key: 'analytics', label: 'Analytics Plans' },
              { key: 'amazon_monitoring', label: 'Amazon Monitoring' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`rounded-full px-6 py-2 text-sm font-semibold transition ${
                  activeTab === key
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                    : isDark
                    ? 'text-slate-300 hover:text-white'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Plan grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-9 w-9 animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <div className="py-24 text-center text-sm text-red-400">{error}</div>
        ) : visiblePlans.length === 0 ? (
          <div className={`rounded-3xl border p-16 text-center text-sm ${isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            No plans available in this category yet.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === currentPlanId}
                onUpgrade={handleUpgrade}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen loader during submit */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
        </div>
      )}
    </div>
  );
}
