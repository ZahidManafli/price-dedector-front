import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowLeft, Loader2, ShieldCheck, Zap, Globe, Check } from 'lucide-react';
import Swal from 'sweetalert2';
import { settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const CATEGORIES = [
  {
    key: 'subscription',
    label: 'Subscription',
    icon: ShieldCheck,
    glow: 'rgba(34,211,238,0.07)',
    accent: '#22D3EE',
    strip: 'linear-gradient(135deg,#0e7490,#0891b2)',
    featureColor: '#22D3EE',
    btnBg: '#22D3EE',
    btnText: '#070F1E',
    cardBorder: 'rgba(34,211,238,0.18)',
    cardBorderHover: 'rgba(34,211,238,0.45)',
    glowShadow: '0 20px 60px rgba(34,211,238,0.13)',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: Zap,
    glow: 'rgba(129,140,248,0.07)',
    accent: '#818CF8',
    strip: 'linear-gradient(135deg,#4338ca,#6d28d9)',
    featureColor: '#a5b4fc',
    btnBg: '#818CF8',
    btnText: '#fff',
    cardBorder: 'rgba(129,140,248,0.18)',
    cardBorderHover: 'rgba(129,140,248,0.45)',
    glowShadow: '0 20px 60px rgba(129,140,248,0.13)',
  },
  {
    key: 'amazon_monitoring',
    label: 'Amazon',
    icon: Globe,
    glow: 'rgba(251,191,36,0.06)',
    accent: '#FBBF24',
    strip: 'linear-gradient(135deg,#b45309,#d97706)',
    featureColor: '#FCD34D',
    btnBg: '#FBBF24',
    btnText: '#070F1E',
    cardBorder: 'rgba(251,191,36,0.18)',
    cardBorderHover: 'rgba(251,191,36,0.40)',
    glowShadow: '0 20px 60px rgba(251,191,36,0.10)',
  },
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
  };
}

// ── 6-box OTP input ──────────────────────────────────────────
function OtpInput({ value, onChange, isDark }) {
  const inputs = useRef([]);
  const digits = value.split('');

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = digits.slice();
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        inputs.current[i - 1]?.focus();
      }
    }
  };

  const handleChange = (i, e) => {
    const char = e.target.value.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = char;
    onChange(next.join(''));
    if (char && i < 5) inputs.current[i + 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted.padEnd(6, '').slice(0, 6).replace(/\s/g, ''));
      inputs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  };

  return (
    <div className="flex gap-3 justify-center">
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
          style={{
            width: 48,
            height: 56,
            borderRadius: 14,
            border: digits[i]
              ? '2px solid #22D3EE'
              : isDark
              ? '1.5px solid rgba(255,255,255,0.10)'
              : '1.5px solid rgba(0,0,0,0.12)',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            color: isDark ? '#E2E8F4' : '#0F172A',
            fontSize: 24,
            fontWeight: 700,
            textAlign: 'center',
            outline: 'none',
            caretColor: '#22D3EE',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: digits[i] ? '0 0 0 3px rgba(34,211,238,0.15)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────
function PlanCard({ plan, isCurrent, onUpgrade, cat }) {
  const [hovered, setHovered] = useState(false);
  const price = plan.discountedPrice ?? plan.actualPrice;
  const hasDiscount =
    plan.actualPrice != null &&
    plan.discountedPrice != null &&
    Number(plan.actualPrice) > Number(plan.discountedPrice);
  const discountPct = hasDiscount
    ? Math.round(((Number(plan.actualPrice) - Number(plan.discountedPrice)) / Number(plan.actualPrice)) * 100)
    : 0;

  const priceWhole = price != null ? String(Math.floor(Number(price))) : '—';
  const priceFrac = price != null ? (Number(price) % 1).toFixed(2).slice(1) : '';

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 28,
        overflow: 'hidden',
        border: `1.5px solid ${isCurrent ? 'rgba(34,211,238,0.35)' : hovered ? cat.cardBorderHover : cat.cardBorder}`,
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        boxShadow: hovered && !isCurrent ? cat.glowShadow : isCurrent ? '0 0 0 1px rgba(34,211,238,0.2)' : 'none',
        transform: hovered && !isCurrent ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s ease, border-color 0.2s ease',
        cursor: isCurrent ? 'default' : 'pointer',
      }}
    >
      {/* Category color strip */}
      <div style={{ height: 4, background: cat.strip, flexShrink: 0 }} />

      {/* Blurred content for current plan */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 22px 22px',
          filter: isCurrent ? 'blur(2.5px)' : 'none',
          opacity: isCurrent ? 0.4 : 1,
          userSelect: isCurrent ? 'none' : 'auto',
          pointerEvents: isCurrent ? 'none' : 'auto',
          transition: 'filter 0.2s, opacity 0.2s',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: cat.accent, marginBottom: 4 }}>
              {plan.category.replace(/_/g, ' ')}
            </p>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#E2E8F4', lineHeight: 1.2 }}>{plan.name}</h3>
          </div>
          {plan.featured && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: cat.accent, background: `${cat.accent}18`, border: `1px solid ${cat.accent}30`,
              borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Popular
            </span>
          )}
        </div>

        {/* Price */}
        <div style={{ marginTop: 20, marginBottom: 4 }}>
          {hasDiscount && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#64748B', textDecoration: 'line-through' }}>
                ₼{Number(plan.actualPrice).toFixed(2)}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#34D399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: 999, padding: '2px 8px',
              }}>
                -{discountPct}%
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, lineHeight: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', alignSelf: 'flex-start', marginTop: 8 }}>₼</span>
            <span style={{ fontSize: 52, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.03em', lineHeight: 1 }}>{priceWhole}</span>
            {priceFrac && <span style={{ fontSize: 20, fontWeight: 700, color: '#64748B', marginBottom: 6 }}>{priceFrac}</span>}
          </div>
          {plan.duration && (
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontWeight: 500 }}>{plan.duration}</p>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

        {/* Features */}
        {plan.features.length > 0 && (
          <ul style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {plan.features.map((feat, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 999, background: `${cat.featureColor}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
                }}>
                  <Check size={10} color={cat.featureColor} strokeWidth={3} />
                </span>
                <span style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.5 }}>{feat}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Upgrade button */}
        <button
          type="button"
          onClick={() => onUpgrade(plan)}
          style={{
            width: '100%', borderRadius: 14, padding: '11px 0',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
            background: hovered ? cat.btnBg : `${cat.btnBg}E0`,
            color: cat.btnText,
            border: 'none', cursor: 'pointer',
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: hovered ? `0 4px 20px ${cat.accent}40` : 'none',
          }}
        >
          Upgrade to {plan.name}
        </button>
      </div>

      {/* Active plan overlay */}
      {isCurrent && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,16,30,0.45)',
          backdropFilter: 'blur(1px)',
          borderRadius: 28,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            background: 'rgba(34,211,238,0.07)',
            border: '1px solid rgba(34,211,238,0.25)',
            borderRadius: 18,
            padding: '18px 28px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#22D3EE',
                boxShadow: '0 0 8px rgba(34,211,238,0.8)',
                animation: 'upgradePulse 1.8s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#22D3EE' }}>
                Active Plan
              </span>
            </div>
            <p style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Your current subscription</p>
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

  const cat = CATEGORIES.find((c) => c.key === activeTab) || CATEGORIES[0];
  const visiblePlans = plans.filter((p) => p.category === activeTab);
  const currentPlanId = user?.selectedPlanId || null;

  const handleUpgrade = async (plan) => {
    const result = await Swal.fire({
      title: `Switch to ${plan.name}?`,
      html: `<span style="color:#94a3b8;font-size:14px">A 6-digit verification code will be sent to your email to confirm this request.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, request this plan',
      cancelButtonText: 'Not now',
      background: '#07101E',
      color: '#E2E8F4',
      confirmButtonColor: cat.btnBg,
      cancelButtonColor: 'rgba(255,255,255,0.06)',
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await settingsAPI.submitSubscriptionRequest({ planId: plan.id });
      const request = res?.data?.request;
      setPendingRequest({ id: request?.id, email: request?.email });
      setVerifying(true);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to submit request. Please try again.';
      Swal.fire({ title: 'Something went wrong', text: msg, icon: 'error', background: '#07101E', color: '#E2E8F4' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.replace(/\s/g, '').length < 6) { setCodeError('Enter the complete 6-digit code.'); return; }
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
      const msg = err?.response?.data?.error || 'That code is invalid or has expired.';
      setCodeError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const pageStyle = {
    minHeight: '100vh',
    background: isDark ? '#07101E' : '#F0F4F8',
    color: isDark ? '#E2E8F4' : '#0F172A',
    position: 'relative',
    overflow: 'hidden',
  };

  const glowStyle = {
    position: 'fixed',
    top: -200,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 700,
    height: 500,
    borderRadius: '50%',
    background: `radial-gradient(ellipse at center, ${cat.glow} 0%, transparent 70%)`,
    pointerEvents: 'none',
    zIndex: 0,
    transition: 'background 0.5s ease',
  };

  // ── Success ────────────────────────────────────────
  if (success) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={glowStyle} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 440 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: 'rgba(52,211,153,0.1)', border: '1.5px solid rgba(52,211,153,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <CheckCircle2 size={40} color="#34D399" />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Request Sent</h2>
          <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.7, marginBottom: 32 }}>
            Your plan change request is under review. The admin will approve it shortly — you'll be notified when it's live.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              background: '#22D3EE', color: '#07101E', border: 'none',
              borderRadius: 14, padding: '12px 32px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Verify ─────────────────────────────────────────
  if (verifying) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={glowStyle} />
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 400,
          background: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
          border: isDark ? '1.5px solid rgba(255,255,255,0.08)' : '1.5px solid rgba(0,0,0,0.08)',
          borderRadius: 28, padding: '36px 32px',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,211,238,0.08)', border: '1.5px solid rgba(34,211,238,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <ShieldCheck size={28} color="#22D3EE" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Verify your email</h2>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
              We sent a 6-digit code to<br />
              <strong style={{ color: isDark ? '#CBD5E1' : '#334155' }}>{pendingRequest?.email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerify}>
            <OtpInput value={code} onChange={setCode} isDark={isDark} />
            {codeError && (
              <p style={{ textAlign: 'center', fontSize: 12, color: '#F87171', marginTop: 12 }}>{codeError}</p>
            )}

            <button
              type="submit"
              disabled={submitting || code.replace(/\s/g, '').length < 6}
              style={{
                width: '100%', marginTop: 24, borderRadius: 14,
                padding: '13px 0', fontSize: 14, fontWeight: 700,
                background: code.replace(/\s/g, '').length === 6 ? '#22D3EE' : 'rgba(34,211,238,0.25)',
                color: code.replace(/\s/g, '').length === 6 ? '#07101E' : '#22D3EE',
                border: 'none', cursor: code.replace(/\s/g, '').length === 6 ? 'pointer' : 'default',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              Confirm &amp; Submit
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setVerifying(false); setCode(''); setCodeError(''); }}
            style={{
              display: 'block', width: '100%', marginTop: 16, textAlign: 'center',
              fontSize: 12, color: '#475569', background: 'none', border: 'none',
              cursor: 'pointer',
            }}
          >
            ← Choose a different plan
          </button>
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────
  return (
    <div style={pageStyle}>
      {/* Category color glow */}
      <div style={glowStyle} />

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes upgradePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.07)',
        background: isDark ? 'rgba(7,16,30,0.88)' : 'rgba(240,244,248,0.9)',
        backdropFilter: 'blur(16px)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer', color: isDark ? '#94A3B8' : '#475569',
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>Upgrade your plan</h1>
          <p style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Choose the plan that fits your workflow</p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px', position: 'relative', zIndex: 1 }}>
        {/* Category tabs */}
        <div style={{
          display: 'inline-flex', gap: 4, padding: 5,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
          borderRadius: 18,
          border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
          marginBottom: 36,
        }}>
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            const tabCat = CATEGORIES.find((c) => c.key === key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 18px', borderRadius: 13,
                  fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  background: isActive ? tabCat.btnBg : 'transparent',
                  color: isActive ? tabCat.btnText : isDark ? '#64748B' : '#64748B',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? `0 2px 12px ${tabCat.accent}30` : 'none',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Plans */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={36} color="#22D3EE" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#F87171', fontSize: 14 }}>
            {error}
          </div>
        ) : visiblePlans.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '64px 0',
            color: '#475569', fontSize: 14,
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 20,
          }}>
            No plans available in this category yet.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {visiblePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === currentPlanId}
                onUpgrade={handleUpgrade}
                cat={cat}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full-screen loading overlay during submission */}
      {submitting && !verifying && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(7,16,30,0.65)', backdropFilter: 'blur(6px)',
        }}>
          <Loader2 size={44} color="#22D3EE" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}
    </div>
  );
}
