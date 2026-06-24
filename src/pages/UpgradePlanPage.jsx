import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Loader2, ShieldCheck, Zap, Globe } from 'lucide-react';
import Swal from 'sweetalert2';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES = [
  { key: 'subscription', label: 'Subscription', icon: ShieldCheck },
  { key: 'analytics', label: 'Analytics', icon: Zap },
  { key: 'amazon_monitoring', label: 'Amazon Monitoring', icon: Globe },
];

function normalizePlan(raw = {}) {
  const normalizedCategory = String(raw.category || '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const category =
    normalizedCategory === 'analytics' || normalizedCategory === 'analysis'
      ? 'analytics'
      : normalizedCategory === 'amazon_monitoring' || normalizedCategory === 'amazonmonitoring'
      ? 'amazon_monitoring'
      : 'subscription';

  return {
    id: raw.id,
    name: raw.name || 'Plan',
    duration: raw.duration || '',
    actualPrice: raw.actualPrice ?? null,
    discountedPrice: raw.discountedPrice ?? null,
    summary: raw.description || raw.summary || '',
    features: Array.isArray(raw.features) ? raw.features : [],
    category,
    featured: !!raw.featured,
    accent:
      category === 'analytics'
        ? 'from-violet-500/20 to-slate-700/10'
        : category === 'amazon_monitoring'
        ? 'from-amber-500/15 to-slate-700/10'
        : 'from-cyan-500/15 to-slate-700/10',
  };
}

function PriceDisplay({ plan }) {
  const price = plan.discountedPrice ?? plan.actualPrice;
  const hasDiscount =
    plan.actualPrice != null &&
    plan.discountedPrice != null &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);
  const discountPct = hasDiscount
    ? Math.round(((Number(plan.actualPrice) - Number(plan.discountedPrice)) / Number(plan.actualPrice)) * 100)
    : 0;

  return (
    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-3">
      {hasDiscount ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400 line-through">₼{Number(plan.actualPrice).toFixed(2)}</p>
            <span className="rounded-full border border-emerald-300/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100">
              -{discountPct}%
            </span>
          </div>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
            ₼{Number(plan.discountedPrice).toFixed(2)}
          </p>
        </>
      ) : (
        <p className="text-3xl font-semibold tracking-tight text-white">
          {price != null ? `₼${Number(price).toFixed(2)}` : 'Free'}
        </p>
      )}
      {plan.duration && <p className="mt-1 text-xs text-slate-400">{plan.duration}</p>}
    </div>
  );
}

function PlanCard({ plan, isCurrent, onUpgrade }) {
  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-5 shadow-lg backdrop-blur transition duration-300 ${
        isCurrent
          ? 'border-slate-600/40 bg-slate-900/40 opacity-50 cursor-not-allowed'
          : plan.featured
          ? 'border-cyan-300/40 bg-slate-900/90 shadow-[0_16px_60px_rgba(34,211,238,0.12)] hover:-translate-y-1'
          : 'border-white/10 bg-slate-900/70 hover:-translate-y-1'
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${plan.accent} opacity-100`} />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            {plan.featured && (
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Popular
              </span>
            )}
            {isCurrent && (
              <span className="rounded-full border border-slate-400/30 bg-slate-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Current
              </span>
            )}
          </div>
        </div>

        <PriceDisplay plan={plan} />

        {plan.summary && (
          <p className="mt-3 min-h-[2.5rem] text-sm leading-6 text-slate-300">{plan.summary}</p>
        )}

        <ul className="mt-4 flex-1 space-y-2.5 text-sm text-slate-200">
          {plan.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled={isCurrent}
          onClick={() => !isCurrent && onUpgrade(plan)}
          className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            isCurrent
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
          }`}
        >
          {isCurrent ? 'Current Plan' : 'Upgrade'}
        </button>
      </div>
    </article>
  );
}

export default function UpgradePlanPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('subscription');

  // Verification step state
  const [verifying, setVerifying] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null); // { id, email }
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await settingsAPI.getPublicPlans();
        const raw = res?.data?.plans || [];
        setPlans(raw.map(normalizePlan).filter((p) => p.id));
      } catch {
        setError('Failed to load plans. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const visiblePlans = plans.filter((p) => p.category === activeTab);
  const currentPlanId = user?.selectedPlanId || null;

  const handleUpgrade = async (plan) => {
    const result = await Swal.fire({
      title: 'Confirm Plan Change',
      html: `Switch to <strong>${plan.name}</strong>?<br/><small style="color:#94a3b8">A verification code will be sent to your email.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, request upgrade',
      cancelButtonText: 'Cancel',
      background: isDark ? '#0f172a' : '#fff',
      color: isDark ? '#f1f5f9' : '#0f172a',
      confirmButtonColor: '#22d3ee',
    });

    if (!result.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await settingsAPI.submitSubscriptionRequest({ planId: plan.id });
      const request = res?.data?.request;
      setPendingRequest({ id: request?.id, email: request?.email });
      setVerifying(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to submit request.';
      Swal.fire({
        title: 'Error',
        text: msg,
        icon: 'error',
        background: isDark ? '#0f172a' : '#fff',
        color: isDark ? '#f1f5f9' : '#0f172a',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code.trim()) { setCodeError('Please enter the verification code.'); return; }
    setCodeError('');
    setSubmitting(true);
    try {
      await settingsAPI.verifySubscriptionRequest({
        requestId: pendingRequest.id,
        email: pendingRequest.email,
        code: code.trim(),
      });
      setSuccess(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Invalid or expired code.';
      setCodeError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const base = isDark
    ? 'min-h-screen bg-slate-950 text-white'
    : 'min-h-screen bg-slate-50 text-slate-900';
  const cardBg = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  // ── Success screen ──
  if (success) {
    return (
      <div className={`${base} flex flex-col items-center justify-center px-4 py-20`}>
        <div className="flex flex-col items-center text-center max-w-md">
          <div className="h-20 w-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold">Request Submitted</h2>
          <p className="mt-3 text-sm text-slate-400">
            Your plan change request has been sent to the admin for review. You'll be notified when it's approved.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-2.5 rounded-xl bg-cyan-400 text-slate-950 font-semibold text-sm hover:bg-cyan-300 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Verification code screen ──
  if (verifying) {
    return (
      <div className={`${base} flex flex-col items-center justify-center px-4 py-20`}>
        <div className={`w-full max-w-sm rounded-2xl border p-8 shadow-lg ${cardBg}`}>
          <div className="text-center mb-6">
            <div className="h-14 w-14 rounded-full bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="h-7 w-7 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold">Check Your Email</h2>
            <p className="mt-2 text-sm text-slate-400">
              A 6-digit verification code was sent to{' '}
              <span className="font-medium text-slate-300">{pendingRequest?.email}</span>.
            </p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }}
                className={`w-full rounded-xl border px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] outline-none transition ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-white focus:border-cyan-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-cyan-500'
                }`}
              />
              {codeError && <p className="mt-1.5 text-xs text-red-400">{codeError}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="w-full rounded-xl bg-cyan-400 py-2.5 font-semibold text-sm text-slate-950 hover:bg-cyan-300 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify & Submit
            </button>
          </form>
          <button
            type="button"
            onClick={() => { setVerifying(false); setCode(''); setCodeError(''); }}
            className="mt-4 w-full text-xs text-slate-400 hover:text-slate-300 transition text-center"
          >
            ← Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Main plans page ──
  return (
    <div className={base}>
      {/* Header */}
      <div className={`sticky top-0 z-30 border-b px-6 py-4 flex items-center gap-4 backdrop-blur ${isDark ? 'border-slate-800 bg-slate-950/90' : 'border-slate-200 bg-white/90'}`}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Choose a Plan</h1>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select the plan you'd like to switch to</p>
        </div>
      </div>

      <div className="px-6 py-8 max-w-6xl mx-auto">
        {/* Category tabs */}
        <div className={`inline-flex rounded-2xl p-1 mb-8 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
          {CATEGORIES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === key
                  ? 'bg-cyan-400 text-slate-950 shadow'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Plan grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-400 text-sm">{error}</div>
        ) : visiblePlans.length === 0 ? (
          <div className={`rounded-2xl border p-10 text-center text-sm ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
            No plans available in this category.
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

        {/* Overlay spinner during submission */}
        {submitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
          </div>
        )}
      </div>
    </div>
  );
}
