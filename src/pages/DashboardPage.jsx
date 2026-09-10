import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI, productAPI, settingsAPI, ebayAPI, paymentsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/helpers';
import { ProductFormModal } from './ProductFormPage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Gauge, LineChart, Lock, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SellerAnalyticsSection from '../components/SellerAnalyticsSection';
import FinanceAnalyticsSection from '../components/FinanceAnalyticsSection';

// Formula: (credits / 3) * rate AZN — e.g. 6 credits at 0.35 -> (6/3)*0.35 = 0.70 AZN.
// Mirrors computeTrackingCreditsTopUpPrice on the backend, which recomputes
// and trusts only its own number (from the caller's own role/mentor flag,
// never anything the client sends) — this is purely for the live preview.
function computeTrackingCreditsPrice(credits, isPrivileged = false) {
  const rate = isPrivileged ? 0.22 : 0.35;
  return (Number(credits) || 0) / 3 * rate;
}

const MIN_TRACKING_CREDITS_REQUEST = 15;

function TrackingCreditsModal({ open, onClose, onSuccess, existingPhoneNumber, isPrivilegedRate, defaultCard }) {
  const { formatPrice } = useLanguage();
  const [credits, setCredits] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [payWithSavedCard, setPayWithSavedCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasPhoneOnFile = !!String(existingPhoneNumber || '').trim();

  useEffect(() => {
    if (open) {
      setCredits('');
      setPhoneNumber('');
      setCustomNote('');
      setPayWithSavedCard(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const creditsNum = Number(credits);
  const hasValidCredits = credits !== '' && Number.isFinite(creditsNum) && creditsNum >= MIN_TRACKING_CREDITS_REQUEST;
  const price = hasValidCredits ? computeTrackingCreditsPrice(creditsNum, isPrivilegedRate) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!hasValidCredits) {
      setError(`Enter at least ${MIN_TRACKING_CREDITS_REQUEST} tracking credits.`);
      return;
    }

    if (!hasPhoneOnFile && !phoneNumber.trim()) {
      setError('Enter a phone number.');
      return;
    }

    try {
      setLoading(true);
      const response = await settingsAPI.submitTrackingCreditsRequest({
        requestedCredits: creditsNum,
        phoneNumber: hasPhoneOnFile ? existingPhoneNumber : phoneNumber.trim(),
        customNote: customNote.trim(),
      });
      const requestId = response?.data?.request?.id;
      if (requestId && defaultCard && payWithSavedCard) {
        // Charge the user's own saved card server-to-server right now — no
        // redirect to Epoint's hosted checkout at all.
        await paymentsAPI.payWithSavedCard(requestId);
        onSuccess?.({ paid: true, requestedCredits: creditsNum });
        onClose?.();
        return;
      }
      if (requestId) {
        // No email-verification step for this (authenticated) request type —
        // go straight to Epoint. Credits are added automatically once the
        // payment succeeds (see payments.js /epoint/callback).
        window.location.href = paymentsAPI.epointCheckoutUrl(requestId);
        return;
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Get more tracking credits</h3>
            <p className="mt-1 text-sm text-slate-400">Send a request and the admin team will review it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              How many tracking credits do you need? <span className="text-slate-500">(min: {MIN_TRACKING_CREDITS_REQUEST} credit)</span>
            </label>
            <input
              type="number"
              min={MIN_TRACKING_CREDITS_REQUEST}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder={`e.g. ${MIN_TRACKING_CREDITS_REQUEST}`}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              disabled={loading}
            />
          </div>

          {hasPhoneOnFile ? (
            <p className="text-xs text-slate-500">
              We'll contact you at <span className="font-semibold text-slate-300">{existingPhoneNumber}</span> (on file).
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 0501234567"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                disabled={loading}
              />
            </div>
          )}

          {hasValidCredits ? (
            <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 text-sm text-teal-100">
              You will pay <span className="font-semibold">{formatPrice(price)}</span> for {creditsNum} tracking credits.
            </div>
          ) : null}

          {defaultCard ? (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={payWithSavedCard}
                onChange={(e) => setPayWithSavedCard(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
              />
              Saxlanılmış kart ilə ödə (**** {defaultCard.cardMask})
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? 'Sending...' : defaultCard && payWithSavedCard ? 'Ödə' : 'Send Request'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Formula: (credits / 1000) * 1 AZN — fixed rate, no mentor/admin discount.
// Mirrors computeMarketAnalysisCreditsTopUpPrice on the backend, which
// recomputes and trusts only its own number — this is purely for the
// live preview.
const MARKET_ANALYSIS_CREDITS_UNIT = 1000;
const MARKET_ANALYSIS_CREDITS_RATE_PER_UNIT = 1;

function computeMarketAnalysisCreditsPrice(credits) {
  return (Number(credits) || 0) / MARKET_ANALYSIS_CREDITS_UNIT * MARKET_ANALYSIS_CREDITS_RATE_PER_UNIT;
}

function MarketAnalysisCreditsModal({ open, onClose, onSuccess, existingPhoneNumber, defaultCard }) {
  const { formatPrice } = useLanguage();
  const [credits, setCredits] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [payWithSavedCard, setPayWithSavedCard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasPhoneOnFile = !!String(existingPhoneNumber || '').trim();

  useEffect(() => {
    if (open) {
      setCredits('');
      setPhoneNumber('');
      setCustomNote('');
      setPayWithSavedCard(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const creditsNum = Number(credits);
  const isWholeThousand = Number.isFinite(creditsNum) && creditsNum > 0 && creditsNum % MARKET_ANALYSIS_CREDITS_UNIT === 0;
  const hasValidCredits = credits !== '' && isWholeThousand;
  const price = hasValidCredits ? computeMarketAnalysisCreditsPrice(creditsNum) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (credits === '' || !Number.isFinite(creditsNum) || creditsNum <= 0) {
      setError(`Enter at least ${MARKET_ANALYSIS_CREDITS_UNIT} Market Analysis credits.`);
      return;
    }
    if (!isWholeThousand) {
      setError(`Only whole thousands are allowed (e.g. 1000, 2000, 3000) — not ${creditsNum}.`);
      return;
    }

    if (!hasPhoneOnFile && !phoneNumber.trim()) {
      setError('Enter a phone number.');
      return;
    }

    try {
      setLoading(true);
      const response = await settingsAPI.submitMarketAnalysisCreditsRequest({
        requestedCredits: creditsNum,
        phoneNumber: hasPhoneOnFile ? existingPhoneNumber : phoneNumber.trim(),
        customNote: customNote.trim(),
      });
      const requestId = response?.data?.request?.id;
      if (requestId && defaultCard && payWithSavedCard) {
        // Charge the user's own saved card server-to-server right now — no
        // redirect to Epoint's hosted checkout at all.
        await paymentsAPI.payWithSavedCard(requestId);
        onSuccess?.({ paid: true, requestedCredits: creditsNum });
        onClose?.();
        return;
      }
      if (requestId) {
        // No email-verification step for this (authenticated) request type —
        // go straight to Epoint. Credits are added automatically once the
        // payment succeeds (see payments.js /epoint/callback).
        window.location.href = paymentsAPI.epointCheckoutUrl(requestId);
        return;
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Get more Market Analysis credits</h3>
            <p className="mt-1 text-sm text-slate-400">1000 credits = 1 AZN. Only whole thousands (1000, 2000, 3000, ...).</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-1.5 text-slate-300 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              How many Market Analysis credits do you need? <span className="text-slate-500">(min: {MARKET_ANALYSIS_CREDITS_UNIT}, in thousands)</span>
            </label>
            <input
              type="number"
              min={MARKET_ANALYSIS_CREDITS_UNIT}
              step={MARKET_ANALYSIS_CREDITS_UNIT}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder={`e.g. ${MARKET_ANALYSIS_CREDITS_UNIT}`}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
              disabled={loading}
            />
          </div>

          {hasPhoneOnFile ? (
            <p className="text-xs text-slate-500">
              We'll contact you at <span className="font-semibold text-slate-300">{existingPhoneNumber}</span> (on file).
            </p>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 0501234567"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-cyan-400"
                disabled={loading}
              />
            </div>
          )}

          {hasValidCredits ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm text-violet-100">
              You will pay <span className="font-semibold">{formatPrice(price)}</span> for {creditsNum} Market Analysis credits.
            </div>
          ) : credits !== '' && Number.isFinite(creditsNum) && creditsNum > 0 ? (
            <p className="text-xs text-amber-300">Only whole thousands are allowed (1000, 2000, 3000, ...).</p>
          ) : null}

          {defaultCard ? (
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={payWithSavedCard}
                onChange={(e) => setPayWithSavedCard(e.target.checked)}
                disabled={loading}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
              />
              Saxlanılmış kart ilə ödə (**** {defaultCard.cardMask})
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {loading ? 'Sending...' : defaultCard && payWithSavedCard ? 'Ödə' : 'Send Request'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [limits, setLimits] = useState(null);
  const [trackingCreditsModalOpen, setTrackingCreditsModalOpen] = useState(false);
  const [marketAnalysisCreditsModalOpen, setMarketAnalysisCreditsModalOpen] = useState(false);
  const [defaultCard, setDefaultCard] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [ebayRateLimits, setEbayRateLimits] = useState(null);
  const [ebayRateLimitsLoading, setEbayRateLimitsLoading] = useState(false);
  const [ebayRateLimitsError, setEbayRateLimitsError] = useState(null);
  const [rateLimitQuery, setRateLimitQuery] = useState('');
  const [openAllRateLimitGroups, setOpenAllRateLimitGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isDark } = useTheme();
  const { user, syncPermissionsFromLimits, hasTabAccess } = useAuth();
  const { t } = useTranslation('system');
  const navigate = useNavigate();
  const [ebayStatus, setEbayStatus] = useState({ connected: false });
  const [showEbayBanner, setShowEbayBanner] = useState(() => {
    // Let users dismiss the banner until they reconnect eBay.
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('hideEbayAnalyticsBanner') !== '1';
  });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [financeDays, setFinanceDays] = useState(365);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productsRes, limitsRes, ebayRes, cardsRes] = await Promise.all([
          productAPI.getAll().catch(() => ({ data: [] })),
          settingsAPI.getLimits().catch(() => null),
          ebayAPI.getStatus().catch(() => null),
          paymentsAPI.listCards().catch(() => null),
        ]);
        setProducts(productsRes?.data || []);
        setLimits(limitsRes?.data || null);
        syncPermissionsFromLimits(limitsRes?.data || null);
        setDefaultCard((cardsRes?.data?.cards || []).find((c) => c.isDefault) || null);
        const ebayData = ebayRes?.data || {};
        setEbayStatus(ebayData);
        if (ebayData?.connected) {
          setShowEbayBanner(false);
          try {
            localStorage.setItem('hideEbayAnalyticsBanner', '1');
          } catch {}
        }
        if (user?.role === 'admin') {
          const statsRes = await adminAPI.getStats();
          setAdminStats(statsRes.data || null);
          setEbayRateLimitsLoading(true);
          adminAPI
            .getEbayRateLimits()
            .then((res) => {
              setEbayRateLimits(res?.data || null);
              setEbayRateLimitsError(null);
            })
            .catch((err) => {
              setEbayRateLimits(null);
              setEbayRateLimitsError(err?.response?.data?.error || err?.message || t('dashboard.failedToLoadRateLimits'));
            })
            .finally(() => setEbayRateLimitsLoading(false));
        }
      } catch {
        setAlert({ type: 'error', message: t('dashboard.failedToLoadData') });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadAnalytics = async () => {
      // Plans that don't grant Checkila Analysis (e.g. tracking_plans) shouldn't
      // even attempt this — it always 403s for them, and that's expected, not an
      // error worth showing on a dashboard everyone lands on regardless of plan.
      if (!ebayStatus?.connected || !hasTabAccess('market_analysis')) return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const res = await ebayAPI.getDashboardAnalytics(financeDays);
        setAnalytics(res?.data || null);
      } catch (err) {
        // Belt-and-suspenders for the case above going stale (cached allowedTabs
        // lagging the live plan): a plan-access denial here just means this
        // section isn't available for this plan — hide it quietly instead of
        // surfacing "Your subscription plan does not allow access to this page."
        // as a scary top-level error on a page every plan is supposed to load.
        if (err?.response?.data?.code === 'PLAN_TAB_ACCESS_DENIED') {
          setAnalyticsError(null);
          setAnalytics(null);
        } else {
          setAnalyticsError(
            err?.response?.data?.error || err?.message || t('dashboard.failedToLoadAnalytics')
          );
          setAnalytics(null);
        }
      } finally {
        setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, [ebayStatus?.connected, hasTabAccess, financeDays]);

  const handleDismissEbayBanner = () => {
    setShowEbayBanner(false);
    try {
      localStorage.setItem('hideEbayAnalyticsBanner', '1');
    } catch {}
  };

  const handleConnectEbay = async () => {
    try {
      setAlert(null);
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (err) {
      setAlert({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to connect eBay',
      });
    }
  };

  const productsLimit = limits?.products?.limit;
  const productsUsed = limits?.products?.used ?? products.length;
  const productsLeft = limits?.products?.remaining;
  const lookupLeft = limits?.amazonLookup?.remainingThisWeek;
  const marketCreditsLeft = limits?.marketAnalysis?.creditsRemaining;
  const marketCreditsUsed = limits?.marketAnalysis?.creditsUsed;
  const marketCreditsLimit = limits?.marketAnalysis?.creditsLimit;
  const trackingCreditsLeft = limits?.trackingCredits?.remaining;
  const trackingCreditsUsed = limits?.trackingCredits?.used;
  const trackingCreditsLimitValue = limits?.trackingCredits?.limit;
  const isProductQuotaReached =
    productsLeft !== null && productsLeft !== undefined && productsLeft <= 0;

  const productsLow = !isProductQuotaReached && productsLeft != null && productsLeft <= 5;
  const lookupLow = lookupLeft != null && lookupLeft > 0 && lookupLeft <= 5;
  const lookupEmpty = lookupLeft != null && lookupLeft <= 0;
  const marketLow = marketCreditsLeft != null && marketCreditsLeft > 0 && marketCreditsLeft <= 3;
  const marketEmpty = marketCreditsLeft != null && marketCreditsLeft <= 0;
  const trackingLow = trackingCreditsLeft != null && trackingCreditsLeft > 0 && trackingCreditsLeft <= 3;
  const trackingEmpty = trackingCreditsLeft != null && trackingCreditsLeft <= 0;

  const userPlan = limits?.plan || null;
  const userPlanCategory = String(userPlan?.category || '').toLowerCase();
  const isTrialPlan = String(userPlan?.name || '').toLowerCase().includes('trial');
  const canRequestTrackingCredits =
    userPlanCategory !== 'analytics' && userPlanCategory !== 'amazon_monitoring' && !isTrialPlan;

  const onOpenUpgradeRequest = () => {
    navigate('/upgrade-plan');
  };

  const rateLimitRows = useMemo(() => {
    const groups = Array.isArray(ebayRateLimits?.rateLimits) ? ebayRateLimits.rateLimits : [];
    const rows = [];
    for (const g of groups) {
      const apiContext = g?.apiContext || '';
      const apiName = g?.apiName || '';
      const apiVersion = g?.apiVersion || '';
      const resources = Array.isArray(g?.resources) ? g.resources : [];
      for (const r of resources) {
        const resourceName = r?.name || '';
        const rates = Array.isArray(r?.rates) ? r.rates : [];
        if (rates.length === 0) {
          rows.push({
            key: `${apiContext}/${apiName}/${apiVersion}/${resourceName}/none`,
            apiContext,
            apiName,
            apiVersion,
            resourceName,
            rate: null,
          });
          continue;
        }
        for (const rate of rates) {
          rows.push({
            key: `${apiContext}/${apiName}/${apiVersion}/${resourceName}/${rate?.timeWindow || '0'}`,
            apiContext,
            apiName,
            apiVersion,
            resourceName,
            rate: {
              count: Number(rate?.count || 0),
              limit: Number(rate?.limit || 0),
              remaining: Number(rate?.remaining || 0),
              reset: rate?.reset || null,
              timeWindow: Number(rate?.timeWindow || 0),
            },
          });
        }
      }
    }
    // Put the Developer Analytics rate limit card(s) first.
    const score = (row) => (String(row.resourceName || '') === 'developer.analytics.app_rate_limit' ? 0 : 1);
    return rows.sort((a, b) => score(a) - score(b));
  }, [ebayRateLimits]);

  const groupedRateLimits = useMemo(() => {
    const q = String(rateLimitQuery || '').trim().toLowerCase();
    const rows = q
      ? rateLimitRows.filter((r) => String(r.resourceName || '').toLowerCase().includes(q))
      : rateLimitRows;

    const groups = new Map();
    for (const r of rows) {
      const groupKey = `${r.apiContext}::${r.apiName}::${r.apiVersion}`;
      const label = `${r.apiContext || '—'} / ${r.apiName || '—'} / ${r.apiVersion || '—'}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label,
          rows: [],
        });
      }
      groups.get(groupKey).rows.push(r);
    }

    const computeMaxUsedPct = (group) => {
      let max = 0;
      for (const row of group.rows) {
        const rate = row.rate;
        if (!rate?.limit) continue;
        const used = Math.max(0, Number(rate.limit) - Number(rate.remaining ?? 0));
        const pct = (used / Number(rate.limit)) * 100;
        if (Number.isFinite(pct)) max = Math.max(max, pct);
      }
      return max;
    };

    const list = Array.from(groups.values());
    // Prioritize the developer.analytics app_rate_limit group at top.
    const score = (g) => (g.label.toLowerCase().includes('developer / analytics') ? 0 : 1);
    return list
      .map((g) => ({ ...g, maxUsedPct: computeMaxUsedPct(g) }))
      .sort((a, b) => score(a) - score(b) || b.maxUsedPct - a.maxUsedPct || a.label.localeCompare(b.label));
  }, [rateLimitRows, rateLimitQuery]);

  const RateLimitCard = ({ row }) => {
    const rate = row.rate;
    const limit = rate?.limit || 0;
    const remaining = rate?.remaining ?? null;
    const used = remaining == null ? null : Math.max(0, limit - remaining);
    const usedPct = limit > 0 && used != null ? Math.min(100, Math.max(0, (used / limit) * 100)) : null;
    const resetText = rate?.reset ? new Date(rate.reset).toLocaleString() : '—';
    const windowText = rate?.timeWindow ? `${Math.round(rate.timeWindow / 60)} ${t('dashboard.windowMin')}` : '—';

    const danger = usedPct != null && usedPct >= 85;
    const warn = usedPct != null && usedPct >= 65 && usedPct < 85;
    const accent = danger ? 'rose' : warn ? 'amber' : 'emerald';

    const barClass =
      accent === 'rose'
        ? 'bg-rose-500'
        : accent === 'amber'
          ? 'bg-amber-500'
          : 'bg-emerald-500';

    return (
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute -top-16 -right-16 h-44 w-44 rounded-full blur-2xl ${
            accent === 'rose'
              ? 'bg-rose-500/15'
              : accent === 'amber'
                ? 'bg-amber-500/15'
                : 'bg-emerald-500/15'
          }`} />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-2xl" />
        </div>

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {row.apiContext} • {row.apiName} • {row.apiVersion}
              </p>
              <p className="mt-1 font-semibold truncate">{row.resourceName || '—'}</p>
            </div>
            {rate ? (
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                  isDark ? 'border-slate-700 bg-slate-900/50 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {windowText}
              </span>
            ) : (
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                  isDark ? 'border-slate-700 bg-slate-900/50 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {t('dashboard.noUsageData')}
              </span>
            )}
          </div>

          {rate && (
            <>
              <div className="mt-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.remaining')}</p>
                    <p className="text-2xl font-bold leading-tight">
                      {remaining}
                      <span className={`ml-2 text-sm font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        / {limit}
                      </span>
                    </p>
                  </div>
                  <div className={`text-xs text-right ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <div>{t('dashboard.used')}: {used}</div>
                    <div>{t('dashboard.reset')}: {resetText}</div>
                  </div>
                </div>

                <div className={`mt-3 h-2.5 w-full rounded-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                  <div
                    className={`h-2.5 rounded-full ${barClass}`}
                    style={{ width: `${usedPct ?? 0}%` }}
                  />
                </div>

                {danger && (
                  <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs ${
                    isDark ? 'bg-rose-950/50 border border-rose-800/50 text-rose-300' : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}>
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>Kritik: API sorğularını dərhal azaldın. Mümkün olduğunda batch əməliyyatlardan istifadə et, cavabları 5+ dəqiqə cache et.</span>
                  </div>
                )}
                {warn && !danger && (
                  <div className={`mt-2 flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-xs ${
                    isDark ? 'bg-amber-950/50 border border-amber-800/50 text-amber-300' : 'bg-amber-50 border border-amber-200 text-amber-700'
                  }`}>
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span>Diqqət: İstifadəni izlə. Lazımsız sorğuları azalt, response caching aktivləşdir.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-shell">
      {showEbayBanner && !ebayStatus?.connected && (
        <div
          role="alert"
          className={`relative overflow-hidden rounded-2xl border p-5 mb-5 ${
            isDark
              ? 'border-slate-700 text-slate-100 bg-gradient-to-r from-indigo-500/20 via-sky-500/10 to-emerald-500/10'
              : 'border-slate-200 text-slate-900 bg-gradient-to-r from-indigo-500/10 via-sky-500/5 to-emerald-500/5'
          }`}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-2xl"
            />
            <div
              className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-2xl"
            />
          </div>

          <button
            type="button"
              aria-label={t('dashboard.dismiss')}
            onClick={handleDismissEbayBanner}
            className={`absolute top-3 right-3 h-9 w-9 rounded-xl flex items-center justify-center transition ${
              isDark
                ? 'bg-slate-900/40 hover:bg-slate-900/60 border border-slate-700'
                : 'bg-white/70 hover:bg-white border border-slate-200'
            }`}
          >
            <X size={16} />
          </button>

          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="lg:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold mb-3 bg-white/30 border border-white/20">
                <ShieldCheck size={14} />
                {t('dashboard.bannerBadge')}
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} mb-2`}>
                {t('dashboard.bannerTitle')}
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} max-w-2xl`}>
                {t('dashboard.bannerText')}
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleConnectEbay}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isDark
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-900/30'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20'
                  }`}
                >
                  {t('dashboard.connectEbay')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/listings')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isDark
                      ? 'bg-slate-900/30 hover:bg-slate-900/50 text-slate-100 border border-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
                  }`}
                >
                  {t('dashboard.learnMore')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <LineChart size={16} />
                  <span className="text-xs font-semibold">{t('dashboard.traffic')}</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>7.41%</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.salesConversionSample')}</p>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <Gauge size={16} />
                  <span className="text-xs font-semibold">{t('dashboard.customerService')}</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>0.78</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.projectedRateSample')}</p>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <ShieldCheck size={16} />
                  <span className="text-xs font-semibold">{t('dashboard.standards')}</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{t('dashboard.topRated')}</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.sellerLevelSample')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {ebayStatus?.connected && (
        <div
          className={`glass-card p-5 border ${
            isDark ? 'bg-slate-950/40 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
          } mb-6`}
        >
          <SellerAnalyticsSection
            analytics={analytics}
            loading={analyticsLoading}
            error={analyticsError}
            isDark={isDark}
            onConnectEbay={handleConnectEbay}
            onGoToSettings={() => navigate('/settings')}
          />
        </div>
      )}

      {isFormOpen && (
        <ProductFormModal
          productId={null}
          onClose={() => setIsFormOpen(false)}
          onSuccess={async () => {
            setIsFormOpen(false);
            const [productsRes, limitsRes] = await Promise.all([
              productAPI.getAll(),
              settingsAPI.getLimits(),
            ]);
            setProducts(productsRes.data || []);
            setLimits(limitsRes.data || null);
            syncPermissionsFromLimits(limitsRes.data || null);
          }}
        />
      )}

      <TrackingCreditsModal
        open={trackingCreditsModalOpen}
        onClose={() => setTrackingCreditsModalOpen(false)}
        existingPhoneNumber={limits?.phoneNumber}
        isPrivilegedRate={user?.role === 'admin' || !!user?.isMentor}
        defaultCard={defaultCard}
        onSuccess={async ({ paid, requestedCredits } = {}) => {
          if (paid) {
            const limitsRes = await settingsAPI.getLimits().catch(() => null);
            setLimits(limitsRes?.data || null);
            syncPermissionsFromLimits(limitsRes?.data || null);
            setAlert({ type: 'success', message: `${requestedCredits} tracking krediti hesabınıza əlavə olundu.` });
            return;
          }
          setAlert({ type: 'success', message: 'Your tracking credit request has been sent to the admin team.' });
        }}
      />

      <MarketAnalysisCreditsModal
        open={marketAnalysisCreditsModalOpen}
        onClose={() => setMarketAnalysisCreditsModalOpen(false)}
        existingPhoneNumber={limits?.phoneNumber}
        defaultCard={defaultCard}
        onSuccess={async ({ paid, requestedCredits } = {}) => {
          if (paid) {
            const limitsRes = await settingsAPI.getLimits().catch(() => null);
            setLimits(limitsRes?.data || null);
            syncPermissionsFromLimits(limitsRes?.data || null);
            setAlert({ type: 'success', message: `${requestedCredits} Market Analysis krediti hesabınıza əlavə olundu.` });
            return;
          }
          setAlert({ type: 'success', message: 'Your Market Analysis credit request has been sent to the admin team.' });
        }}
      />

      {alert && (
        <div className="mb-6">
          <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />
        </div>
      )}

      <h1 className="page-title mb-5">{t('dashboard.title')}</h1>

      <div className="mb-5" data-tour="dashboard-plan-card">
        <div className={`glass-card p-5 border ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-100 text-slate-900 border-slate-300'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.currentPlan')}</p>
              <p className="mt-1 text-2xl font-bold">{userPlan?.name || t('dashboard.noActivePlan')}</p>
              <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                {t('dashboard.expires')} {userPlan?.expiresAt ? new Date(userPlan.expiresAt).toLocaleDateString() : t('na', { ns: 'common' })}
              </p>
              {userPlan?.isExpired ? (
                <p className="mt-1 text-xs font-semibold text-amber-500">{t('dashboard.planExpired')}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onOpenUpgradeRequest}
              className="btn-primary px-4 py-2 text-sm"
            >
              {t('dashboard.requestPlanUpgrade')}
            </button>
          </div>
        </div>
      </div>

      {user?.role === 'admin' && adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">{t('dashboard.usersRegisteredWeek')}</p>
            <p className="text-2xl font-bold mt-1">{adminStats.usersRegistered?.week ?? 0}</p>
            <p className="text-xs opacity-70 mt-1">{t('dashboard.month')}: {adminStats.usersRegistered?.month ?? 0} • {t('dashboard.year')}: {adminStats.usersRegistered?.year ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">{t('dashboard.productsAddedWeek')}</p>
            <p className="text-2xl font-bold mt-1">{adminStats.productsAdded?.week ?? 0}</p>
            <p className="text-xs opacity-70 mt-1">{t('dashboard.month')}: {adminStats.productsAdded?.month ?? 0} • {t('dashboard.year')}: {adminStats.productsAdded?.year ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">{t('dashboard.usersReachedAmazonQuota')}</p>
            <p className="text-2xl font-bold mt-1">{adminStats.quotaReachedUsers?.amazonLookup ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">{t('dashboard.usersReachedProductQuota')}</p>
            <p className="text-2xl font-bold mt-1">{adminStats.quotaReachedUsers?.products ?? 0}</p>
          </div>
        </div>
      )}

      {user?.role === 'admin' && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('dashboard.adminLabel')}
              </p>
              <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {t('dashboard.ebayApiRateLimits')}
              </h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {t('dashboard.ebayApiRateLimitsDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEbayRateLimitsLoading(true);
                setEbayRateLimitsError(null);
                adminAPI
                  .getEbayRateLimits()
                  .then((res) => setEbayRateLimits(res?.data || null))
                  .catch((err) => setEbayRateLimitsError(err?.response?.data?.error || err?.message || t('dashboard.failedToRefreshRateLimits')))
                  .finally(() => setEbayRateLimitsLoading(false));
              }}
              disabled={ebayRateLimitsLoading}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                isDark
                  ? 'bg-slate-900/60 border border-slate-700 text-slate-100 hover:bg-slate-900'
                  : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {ebayRateLimitsLoading ? t('dashboard.refreshing') : t('dashboard.refresh')}
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  value={rateLimitQuery}
                  onChange={(e) => setRateLimitQuery(e.target.value)}
                  placeholder={t('dashboard.rateLimitFilterPlaceholder')}
                  className={`w-full rounded-xl px-4 py-2 text-sm border outline-none transition ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500'
                  }`}
                />
              </div>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('dashboard.showing')} {rateLimitQuery.trim() ? t('dashboard.filtered') : t('dashboard.all')} {t('dashboard.resources')} {rateLimitQuery.trim() ? groupedRateLimits.reduce((s, g) => s + g.rows.length, 0) : rateLimitRows.length}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpenAllRateLimitGroups((v) => !v)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isDark
                  ? 'bg-slate-900/60 border border-slate-700 text-slate-100 hover:bg-slate-900'
                  : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {openAllRateLimitGroups ? t('dashboard.collapseAll') : t('dashboard.expandAll')}
            </button>
          </div>

          {ebayRateLimitsError && (
            <div className="mb-3">
              <Alert type="error" message={ebayRateLimitsError} onClose={() => setEbayRateLimitsError(null)} />
            </div>
          )}

          {rateLimitRows.length === 0 ? (
            <div
              className={`rounded-2xl border p-5 ${
                isDark ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {t('dashboard.noRateLimitData')}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedRateLimits.map((group, idx) => {
                const isOpen = openAllRateLimitGroups || idx === 0;
                return (
                  <details
                    key={group.key}
                    open={isOpen}
                    className={`rounded-2xl border ${
                      isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <summary className={`cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3 ${
                      isDark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'
                    }`}>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{group.label}</p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('dashboard.resourcesLabel')}: {group.rows.length} • {t('dashboard.maxUsed')}: {group.maxUsedPct.toFixed(0)}%
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-xs border ${
                        isDark ? 'border-slate-700 bg-slate-900/50 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}>
                        {group.rows.length}
                      </span>
                    </summary>
                    <div className="px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {group.rows.map((row) => (
                          <RateLimitCard key={row.key} row={row} />
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5" data-tour="dashboard-credit-cards">
        {/* Product Credits */}
        <div className={`glass-card p-5 border transition-all ${
          isProductQuotaReached
            ? isDark ? 'bg-slate-950 text-white border-rose-700/60' : 'bg-rose-50 text-slate-900 border-rose-300'
            : productsLow
              ? isDark ? 'bg-slate-950 text-white border-amber-700/60' : 'bg-amber-50 text-slate-900 border-amber-300'
              : isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-200 text-slate-900 border-slate-300'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.productUploadLeft')}</p>
            {(isProductQuotaReached || productsLow) && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                isProductQuotaReached
                  ? isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-700'
                  : isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                <AlertCircle size={10} />
                {isProductQuotaReached ? 'Limit doldu' : 'Az qalıb'}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className={`text-3xl font-bold ${isProductQuotaReached ? 'text-rose-500' : productsLow ? 'text-amber-500' : ''}`}>
              {productsLeft === null || productsLeft === undefined ? t('unlimited', { ns: 'common' }) : productsLeft}
            </p>
            <button
              type="button"
              disabled={isProductQuotaReached}
              onClick={() => {
                if (isProductQuotaReached) {
                  setAlert({ type: 'warning', message: t('dashboard.productQuotaReached') });
                  return;
                }
                setIsFormOpen(true);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-900/40'
                  : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 hover:border-blue-300 shadow-sm'
              }`}
            >
              {isProductQuotaReached ? t('dashboard.quotaReached') : t('dashboard.uploadNow')}
            </button>
          </div>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Used {productsUsed}{productsLimit != null ? ` / ${productsLimit}` : ''}
          </p>
          {(isProductQuotaReached || productsLow) && (
            <button
              type="button"
              onClick={onOpenUpgradeRequest}
              className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                isProductQuotaReached
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              Planı Yüksəlt
            </button>
          )}
        </div>

        {/* Amazon Lookup Credits */}
        <div className={`glass-card p-5 border transition-all ${
          lookupEmpty
            ? isDark ? 'bg-slate-950 text-white border-rose-700/60' : 'bg-rose-50 text-slate-900 border-rose-300'
            : lookupLow
              ? isDark ? 'bg-slate-950 text-white border-amber-700/60' : 'bg-amber-50 text-slate-900 border-amber-300'
              : isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-200 text-slate-900 border-slate-300'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.autoTrackingCredits')}</p>
            {(lookupEmpty || lookupLow) && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                lookupEmpty
                  ? isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-700'
                  : isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                <AlertCircle size={10} />
                {lookupEmpty ? 'Limit doldu' : 'Az qalıb'}
              </span>
            )}
          </div>
          <p className={`mt-2 text-3xl font-bold ${lookupEmpty ? 'text-rose-500' : lookupLow ? 'text-amber-500' : ''}`}>
            {lookupLeft === null || lookupLeft === undefined ? t('unlimited', { ns: 'common' }) : lookupLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('dashboard.amazonLookupsRemaining')}</p>
          {(lookupEmpty || lookupLow) && (
            <button
              type="button"
              onClick={onOpenUpgradeRequest}
              className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                lookupEmpty
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              Planı Yüksəlt
            </button>
          )}
        </div>

        {/* Market Analysis Credits */}
        <div className={`glass-card p-5 border transition-all ${
          marketEmpty
            ? isDark ? 'bg-slate-950 text-white border-rose-700/60' : 'bg-rose-50 text-slate-900 border-rose-300'
            : marketLow
              ? isDark ? 'bg-slate-950 text-white border-amber-700/60' : 'bg-amber-50 text-slate-900 border-amber-300'
              : isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-200 text-slate-900 border-slate-300'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.checkilaAnalysisCredits')}</p>
            {(marketEmpty || marketLow) && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                marketEmpty
                  ? isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-700'
                  : isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                <AlertCircle size={10} />
                {marketEmpty ? 'Limit doldu' : 'Az qalıb'}
              </span>
            )}
          </div>
          <p className={`mt-2 text-3xl font-bold ${marketEmpty ? 'text-rose-500' : marketLow ? 'text-amber-500' : ''}`}>
            {marketCreditsLeft === null || marketCreditsLeft === undefined ? t('unlimited', { ns: 'common' }) : marketCreditsLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Used {marketCreditsUsed ?? 0}{marketCreditsLimit != null ? ` / ${marketCreditsLimit}` : ''}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('dashboard.sellerSearchCost')}
          </p>
          <button
            type="button"
            onClick={() => setMarketAnalysisCreditsModalOpen(true)}
            className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              marketEmpty
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : isDark
                  ? 'bg-violet-500 text-slate-950 hover:bg-violet-400'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            Get more credit
          </button>
        </div>

        {/* Tracking Credits */}
        <div className={`glass-card p-5 border transition-all ${
          trackingEmpty
            ? isDark ? 'bg-slate-950 text-white border-rose-700/60' : 'bg-rose-50 text-slate-900 border-rose-300'
            : trackingLow
              ? isDark ? 'bg-slate-950 text-white border-amber-700/60' : 'bg-amber-50 text-slate-900 border-amber-300'
              : isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-200 text-slate-900 border-slate-300'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tracking Credits</p>
            {(trackingEmpty || trackingLow) && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                trackingEmpty
                  ? isDark ? 'bg-rose-900/50 text-rose-300' : 'bg-rose-100 text-rose-700'
                  : isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'
              }`}>
                <AlertCircle size={10} />
                {trackingEmpty ? 'Limit doldu' : 'Az qalıb'}
              </span>
            )}
          </div>
          <p className={`mt-2 text-3xl font-bold ${trackingEmpty ? 'text-rose-500' : trackingLow ? 'text-amber-500' : ''}`}>
            {trackingCreditsLeft === null || trackingCreditsLeft === undefined ? t('unlimited', { ns: 'common' }) : trackingCreditsLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Used {trackingCreditsUsed ?? 0}{trackingCreditsLimitValue != null ? ` / ${trackingCreditsLimitValue}` : ''}
          </p>
          {canRequestTrackingCredits ? (
            <button
              type="button"
              onClick={() => setTrackingCreditsModalOpen(true)}
              className={`mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                trackingEmpty
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : isDark
                    ? 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                    : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              Get more credit
            </button>
          ) : (
            <p className={`mt-3 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Not available on Analytics or Amazon Monitoring plans.
            </p>
          )}
        </div>
      </div>

      <div className={`glass-card p-5 border ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}>
        <FinanceAnalyticsSection
          analytics={analytics}
          loading={analyticsLoading}
          error={analyticsError}
          isDark={isDark}
          days={financeDays}
          onDaysChange={setFinanceDays}
        />
      </div>

    </div>
  );
}
