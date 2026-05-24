import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminAPI, productAPI, settingsAPI, ebayAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/helpers';
import { ProductFormModal } from './ProductFormPage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Gauge, LineChart, ShieldCheck, X } from 'lucide-react';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import { useTranslation } from 'react-i18next';
import DailyFinanceFlowChart from '../components/DailyFinanceFlowChart';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [limits, setLimits] = useState(null);
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
  const { user } = useAuth();
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
  const [hideAnalyticsAccessAlert, setHideAnalyticsAccessAlert] = useState(false);
  const [requestUpgradeOpen, setRequestUpgradeOpen] = useState(false);
  const [publicPlans, setPublicPlans] = useState([]);
  const financeData = analytics?.finance || null;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productsRes, limitsRes, ebayRes] = await Promise.all([
          productAPI.getAll().catch(() => ({ data: [] })),
          settingsAPI.getLimits().catch(() => null),
          ebayAPI.getStatus().catch(() => null),
        ]);
        setProducts(productsRes?.data || []);
        setLimits(limitsRes?.data || null);
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
      if (!ebayStatus?.connected) return;
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      setHideAnalyticsAccessAlert(false);
      try {
        const res = await ebayAPI.getDashboardAnalytics();
        setAnalytics(res?.data || null);
      } catch (err) {
        setAnalyticsError(
          err?.response?.data?.error || err?.message || t('dashboard.failedToLoadAnalytics')
        );
        setAnalytics(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, [ebayStatus?.connected]);

  const trafficChartData = useMemo(() => {
    const points = analytics?.traffic?.points || [];
    return points.map((p) => ({
      day: p.day,
      conversion: Number(p.conversionRate || 0),
    }));
  }, [analytics]);

  const financeCurrency =
    financeData?.summaries?.orderEarnings?.orderEarnings?.currency ||
    financeData?.summaries?.sellerFunds?.totalFunds?.currency ||
    financeData?.balances?.availableFunds?.currency ||
    'USD';

  const formatFinanceAmount = (value, currency = financeCurrency) => {
    const numericValue = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const financeChartData = useMemo(() => {
    const points = Array.isArray(financeData?.chart?.points) ? financeData.chart.points : [];
    const grouped = new Map();

    for (const point of points) {
      const key = String(point?.label || 'Unknown').trim() || 'Unknown';
      if (!grouped.has(key)) {
        grouped.set(key, {
          day: key,
          orderEarnings: 0,
          payouts: 0,
        });
      }
      const row = grouped.get(key);
      const value = Number(point?.value || 0);
      if (point?.type === 'order_earnings') {
        row.orderEarnings += value;
      } else if (point?.type === 'payout') {
        row.payouts += value;
      }
    }

    return Array.from(grouped.values()).map((row) => ({
      ...row,
      net: Number((row.orderEarnings - row.payouts).toFixed(2)),
    }));
  }, [financeData]);

  const financeSummaryCards = useMemo(() => {
    const orderSummary = financeData?.summaries?.orderEarnings || {};
    const payoutSummary = financeData?.summaries?.payout || {};
    const transactionSummary = financeData?.summaries?.transaction || {};
    const sellerFunds = financeData?.summaries?.sellerFunds || {};

    return [
      {
        label: 'Net earnings',
        value: orderSummary?.orderEarnings?.value ?? financeData?.details?.orderEarnings?.orderEarningsSummary?.orderEarnings?.value ?? 0,
        currency: orderSummary?.orderEarnings?.currency || financeCurrency,
        hint: 'Order earnings after fees and refunds',
      },
      {
        label: 'Gross amount',
        value: orderSummary?.grossAmount?.value ?? 0,
        currency: orderSummary?.grossAmount?.currency || financeCurrency,
        hint: 'Gross order revenue',
      },
      {
        label: 'Expenses',
        value: orderSummary?.expenses?.value ?? 0,
        currency: orderSummary?.expenses?.currency || financeCurrency,
        hint: 'Fees, labels, donations',
      },
      {
        label: 'Refunds',
        value: orderSummary?.refunds?.value ?? 0,
        currency: orderSummary?.refunds?.currency || financeCurrency,
        hint: 'Refunds and claims',
      },
      {
        label: 'Available funds',
        value: sellerFunds?.availableFunds?.value ?? 0,
        currency: sellerFunds?.availableFunds?.currency || financeCurrency,
        hint: 'Ready for payout processing',
      },
      {
        label: 'On hold',
        value: sellerFunds?.fundsOnHold?.value ?? 0,
        currency: sellerFunds?.fundsOnHold?.currency || financeCurrency,
        hint: 'Pending release',
      },
      {
        label: 'Payout amount',
        value: payoutSummary?.amount?.value ?? 0,
        currency: payoutSummary?.amount?.currency || financeCurrency,
        hint: `${Number(payoutSummary?.payoutCount || 0)} payouts`,
      },
      {
        label: 'Transaction volume',
        value: transactionSummary?.creditAmount?.value ?? transactionSummary?.transactionAmount?.value ?? transactionSummary?.amount?.value ?? 0,
        currency:
          transactionSummary?.creditAmount?.currency ||
          transactionSummary?.transactionAmount?.currency ||
          transactionSummary?.amount?.currency ||
          financeCurrency,
        hint: `${Number(transactionSummary?.creditCount || 0)} credits`,
      },
    ];
  }, [financeData, financeCurrency]);

  const recentOrderEarnings = financeData?.orderEarningsList || financeData?.collections?.orderEarnings || [];
  const recentPayouts = financeData?.payoutList || financeData?.collections?.payouts || [];
  const recentTransactions = financeData?.transactionList || financeData?.collections?.transactions || [];
  const financeDetails = financeData?.details || {};

  // Upcoming payouts: payouts whose payoutDate falls within the next 7 days from now.
  // eBay schedules payouts in advance so the payoutDate can be a future date.
  const upcomingPayouts = useMemo(() => {
    const now = Date.now();
    const in7Days = now + 7 * 24 * 60 * 60 * 1000;
    // All payouts from both list and collections, deduped by payoutId
    const all = [...recentPayouts];
    const seen = new Set();
    return all.filter((p) => {
      if (!p?.payoutDate) return false;
      const ts = new Date(p.payoutDate).getTime();
      if (Number.isNaN(ts)) return false;
      if (ts < now || ts > in7Days) return false;
      if (seen.has(p.payoutId)) return false;
      seen.add(p.payoutId);
      return true;
    }).sort((a, b) => new Date(a.payoutDate) - new Date(b.payoutDate));
  }, [recentPayouts]);

  const upcomingPayoutTotal = useMemo(() => {
    return upcomingPayouts.reduce((sum, p) => sum + Number(p?.amount?.value || 0), 0);
  }, [upcomingPayouts]);

  const upcomingPayoutCurrency = upcomingPayouts[0]?.amount?.currency || financeCurrency;
  const executiveStats = useMemo(() => {
    const metrics = analytics?.sellerStandards?.profile?.metrics || [];
    const find = (key) => metrics.find((m) => m.metricKey === key)?.value;
    const conversionPoints = (analytics?.traffic?.points || []).map((p) => Number(p.conversionRate || 0));
    const avgConv =
      conversionPoints.length > 0
        ? conversionPoints.reduce((sum, n) => sum + n, 0) / conversionPoints.length
        : 0;
    let peakPoint = null;
    for (const p of analytics?.traffic?.points || []) {
      if (!peakPoint || Number(p.conversionRate || 0) > Number(peakPoint.conversionRate || 0)) {
        peakPoint = p;
      }
    }
    return {
      defectRate: find('DEFECTIVE_TRANSACTION_COUNT') ?? '-',
      salesAmount: find('MIN_GMV') ?? '-',
      transactions: find('MIN_TXN_COUNT') ?? '-',
      lateShipments: find('SHIPPING_MISS_COUNT') ?? '-',
      avgConversion: avgConv,
      peakDay: peakPoint?.day || '-',
      peakConversion: Number(peakPoint?.conversionRate || 0),
    };
  }, [analytics]);

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
  const isProductQuotaReached =
    productsLeft !== null && productsLeft !== undefined && productsLeft <= 0;

  const userPlan = limits?.plan || null;

  const onOpenUpgradeRequest = async () => {
    setRequestUpgradeOpen(true);
    if (publicPlans.length > 0) return;
    try {
      const response = await settingsAPI.getPublicPlans();
      setPublicPlans(response?.data?.plans || []);
    } catch {
      setPublicPlans([]);
    }
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

      {ebayStatus?.connected &&
        (!analytics?.analyticsAccessDenied || (analytics?.analyticsAccessDenied && !hideAnalyticsAccessAlert)) && (
        <div
          className={`glass-card p-5 border ${
            isDark ? 'bg-slate-950/40 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
          } mb-6`}
        >
          {/*
            If eBay Analytics is not accessible (common for buyer-only accounts / missing permissions),
            show only the alert and hide the analytics section entirely.
          */}
          {analytics?.analyticsAccessDenied && !hideAnalyticsAccessAlert && (
            <div className="mb-4">
              <Alert
                type="error"
                message={
                  analytics?.analyticsAccessErrorMessage ||
                    t('dashboard.analyticsDenied')
                }
                onClose={() => setHideAnalyticsAccessAlert(true)}
                autoClose={false}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isDark
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-900/30'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-600/20'
                  }`}
                >
                  {t('dashboard.goToSettings')}
                </button>
                <button
                  type="button"
                  onClick={() => setHideAnalyticsAccessAlert(true)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isDark
                      ? 'bg-slate-900/30 hover:bg-slate-900/50 text-slate-100 border border-slate-700'
                      : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
                  }`}
                >
                  {t('dashboard.dismiss')}
                </button>
              </div>
            </div>
          )}

          {!analytics?.analyticsAccessDenied && (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {t('dashboard.sellerAnalytics')}
                  </h2>
                  <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {t('dashboard.sellerAnalyticsSubtitle')}
                  </p>
                </div>
                <div className="text-xs opacity-80">
                  {analyticsLoading ? t('dashboard.loading') : analytics ? t('dashboard.updated') : ''}
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 mb-4">
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.transactions')}</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.transactions}</p>
                </div>
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sales Amount</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.salesAmount}</p>
                </div>
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Defect Count</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.defectRate}</p>
                </div>
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Late Shipments</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.lateShipments}</p>
                </div>
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Avg Conversion</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.avgConversion.toFixed(3)}</p>
                </div>
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Peak Day</p>
                  <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{executiveStats.peakDay}</p>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{executiveStats.peakConversion.toFixed(3)}</p>
                </div>
              </div>

              {analyticsError && (
                <div className="mb-4">
                  <Alert type="error" message={analyticsError} onClose={() => setAnalyticsError(null)} />
                </div>
              )}

              {analyticsLoading && (
                <div className="flex items-center justify-center py-6">
                  <LoadingSpinner />
                </div>
              )}

              {!analyticsLoading && analytics && !analytics?.analyticsAccessDenied && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div
                    className={`rounded-xl border p-4 ${
                      isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {t('dashboard.customerServiceMetric')}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {analytics?.customerService?.metricType || t('dashboard.itemNotAsDescribed')} • {t('dashboard.current')}
                    </p>
                    {analytics?.customerService?.dimension ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {analytics.customerService.dimension.name || t('dashboard.topCategory')}
                          </p>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                              isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            {analytics.customerService.dimension.rating || t('na', { ns: 'common' })}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.rate')}</p>
                            <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {Number(analytics.customerService.dimension.rate || 0).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {t('dashboard.transactions')}
                            </p>
                            <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {Number(analytics.customerService.dimension.transactionCount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm mt-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('dashboard.noData')}</p>
                    )}
                  </div>

                  <div
                    className={`rounded-xl border p-4 ${
                      isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.program')}</p>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {analytics?.sellerStandards?.profile?.program || '-'}
                        </p>
                      </div>
                      <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.cycle')}</p>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {analytics?.sellerStandards?.profile?.cycle?.cycleType || '-'}
                        </p>
                      </div>
                      <div className={`rounded-lg border p-2 ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
                        <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.metrics')}</p>
                        <p className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {(analytics?.sellerStandards?.profile?.metrics || []).length}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {t('dashboard.sellerStandardsProfile')}
                    </p>
                    {analytics?.sellerStandards?.profile ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                            {analytics.sellerStandards.profile.standardslevel || '-'}
                          </p>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                              isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            {analytics.sellerStandards.profile.cycle?.cycleType || t('dashboard.current')}
                          </span>
                        </div>
                        <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {t('dashboard.program')}: {analytics.sellerStandards.profile.program || '-'}
                        </p>
                        <div className="mt-4 space-y-2">
                          {analytics.sellerStandards.profile.metrics?.slice(0, 4)?.map((m) => (
                            <div
                              key={m.metricKey}
                              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                                isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
                              }`}
                            >
                              <span
                                className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                              >
                                {m.name || m.metricKey}
                              </span>
                              <span className={`text-xs font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                                {m.value == null ? '-' : String(m.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm mt-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('dashboard.noData')}</p>
                    )}
                  </div>

                  <div
                    className={`rounded-xl border p-4 ${
                      isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {t('dashboard.trafficConversion')}
                      </p>
                      <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {t('dashboard.last7Days')}
                      </span>
                    </div>
                    {trafficChartData.length > 0 ? (
                      <div className="h-[220px] mt-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trafficChartData}>
                            <defs>
                              <linearGradient id="convGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#cbd5e1'} />
                            <XAxis dataKey="day" stroke={isDark ? '#94a3b8' : '#64748b'} />
                            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} />
                            <Area
                              type="monotone"
                              dataKey="conversion"
                              stroke="#8b5cf6"
                              fill="url(#convGradient)"
                              strokeWidth={3}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className={`mt-3 h-[220px] rounded-xl border border-dashed flex items-center justify-center text-sm ${
                        isDark ? 'border-slate-700 text-slate-400 bg-slate-900/40' : 'border-slate-300 text-slate-500 bg-slate-50'
                      }`}>
                        {t('dashboard.noTrafficData')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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
          }}
        />
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5" data-tour="dashboard-credit-cards">
        <div
          className={`glass-card p-5 border ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.productUploadLeft')}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-3xl font-bold">
              {productsLeft === null || productsLeft === undefined ? t('unlimited', { ns: 'common' }) : productsLeft}
            </p>
            <button
              type="button"
              disabled={isProductQuotaReached}
              onClick={() => {
                if (isProductQuotaReached) {
                  setAlert({
                    type: 'warning',
                    message:
                      t('dashboard.productQuotaReached'),
                  });
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
        </div>
        <div
          className={`glass-card p-5 border ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.autoTrackingCredits')}</p>
          <p className="mt-2 text-3xl font-bold">
            {lookupLeft === null || lookupLeft === undefined ? t('unlimited', { ns: 'common' }) : lookupLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('dashboard.amazonLookupsRemaining')}</p>
        </div>
        <div
          className={`glass-card p-5 border ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('dashboard.checkilaAnalysisCredits')}</p>
          <p className="mt-2 text-3xl font-bold">
            {marketCreditsLeft === null || marketCreditsLeft === undefined ? t('unlimited', { ns: 'common' }) : marketCreditsLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            Used {marketCreditsUsed ?? 0}
            {marketCreditsLimit != null ? ` / ${marketCreditsLimit}` : ''}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
            {t('dashboard.sellerSearchCost')}
          </p>
        </div>
      </div>

      <div className={`glass-card p-5 border ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-900 border-slate-200'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className={`text-xs uppercase tracking-[0.22em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Finance overview</p>
            <h2 className="mt-1 text-2xl font-semibold">How much money eBay has generated, held, and paid out</h2>
            <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Live seller finances from order earnings, payouts, funds on hold, and transaction summaries.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Time range</p>
            <p className="text-sm font-semibold">{financeData?.timeframe?.label || 'Last 12 months'}</p>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="flex items-center justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : financeData?.financeAccessDenied ? (
          <div className="mt-5">
            <Alert
              type="error"
              message={financeData?.financeAccessErrorMessage || 'eBay finance access denied for this account.'}
              onClose={() => {}}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {financeSummaryCards.map((card) => (
                <div key={card.label} className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'}`}>
                  <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{card.label}</p>
                  <p className="mt-2 text-2xl font-bold">{formatFinanceAmount(card.value, card.currency)}</p>
                  <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{card.hint}</p>
                </div>
              ))}
            </div>

            {/* ── Upcoming payouts next 7 days ── */}
            <div className="mt-5">
              <div className={`rounded-2xl border p-5 ${
                isDark
                  ? 'border-emerald-800/60 bg-emerald-950/30'
                  : 'border-emerald-200 bg-emerald-50'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className={`text-xs uppercase tracking-widest font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      Upcoming payouts
                    </p>
                    <p className={`mt-1 text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {formatFinanceAmount(upcomingPayoutTotal, upcomingPayoutCurrency)}
                    </p>
                    <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {upcomingPayouts.length === 0
                        ? 'No scheduled payouts in the next 7 days'
                        : `${upcomingPayouts.length} payout${upcomingPayouts.length > 1 ? 's' : ''} scheduled in the next 7 days`}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                    isDark ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/60' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    <span>Next 7 days</span>
                  </div>
                </div>

                {upcomingPayouts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {upcomingPayouts.map((p) => {
                      const daysUntil = Math.ceil((new Date(p.payoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return (
                        <div
                          key={p.payoutId}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                            isDark ? 'border-emerald-800/40 bg-emerald-950/40' : 'border-emerald-200 bg-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {p.payoutId || '—'}
                            </p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              {new Date(p.payoutDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              {' · '}
                              {p.payoutStatus || 'SCHEDULED'}
                              {' · '}
                              {p.transactionCount ?? 0} txns
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <strong className={`text-sm ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                              {formatFinanceAmount(p?.amount?.value || 0, p?.amount?.currency || financeCurrency)}
                            </strong>
                            <span className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <DailyFinanceFlowChart finance={financeData} />
              </div>

              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>Live eBay finance summaries</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span>Orders in summary</span>
                      <strong>{financeData?.summaries?.orderEarnings?.orderCount ?? 0}</strong>
                    </div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Order earnings summary</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span>Payout count</span>
                      <strong>{financeData?.summaries?.payout?.payoutCount ?? 0}</strong>
                    </div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Payout summary</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span>Transaction count</span>
                      <strong>{financeData?.summaries?.transaction?.creditCount ?? 0}</strong>
                    </div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Transaction summary</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span>Funds snapshot</span>
                      <strong>{formatFinanceAmount(financeData?.balances?.totalFunds || 0)}</strong>
                    </div>
                    <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Available + processing + hold</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Recent order earnings</h3>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{recentOrderEarnings.length}</span>
                </div>
                <div className="mt-3 space-y-2 max-h-[280px] overflow-auto pr-1">
                  {recentOrderEarnings.length > 0 ? recentOrderEarnings.map((item) => (
                    <div key={item.orderId} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">{item.orderId}</span>
                        <strong>{formatFinanceAmount(item?.orderEarningsSummary?.orderEarnings?.value || 0, item?.orderEarningsSummary?.orderEarnings?.currency || financeCurrency)}</strong>
                      </div>
                      <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Gross {formatFinanceAmount(item?.orderEarningsSummary?.grossAmount?.value || 0, item?.orderEarningsSummary?.grossAmount?.currency || financeCurrency)} • Refunds {formatFinanceAmount(item?.orderEarningsSummary?.refunds?.value || 0, item?.orderEarningsSummary?.refunds?.currency || financeCurrency)}
                      </div>
                    </div>
                  )) : <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No order earnings returned yet.</p>}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Recent payouts</h3>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{recentPayouts.length}</span>
                </div>
                <div className="mt-3 space-y-2 max-h-[280px] overflow-auto pr-1">
                  {recentPayouts.length > 0 ? recentPayouts.map((item) => (
                    <div key={item.payoutId} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">{item.payoutId}</span>
                        <strong>{formatFinanceAmount(item?.amount?.value || 0, item?.amount?.currency || financeCurrency)}</strong>
                      </div>
                      <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.payoutStatus || 'UNKNOWN'} • {item.transactionCount || 0} transactions
                      </div>
                    </div>
                  )) : <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No payouts returned yet.</p>}
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Recent transactions</h3>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{recentTransactions.length}</span>
                </div>
                <div className="mt-3 space-y-2 max-h-[280px] overflow-auto pr-1">
                  {recentTransactions.length > 0 ? recentTransactions.map((item, index) => (
                    <div key={item.transactionId || `${item.transactionType}-${index}`} className={`rounded-xl border p-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium truncate">{item.transactionType || 'TRANSACTION'}</span>
                        <strong>{formatFinanceAmount(item.amount || 0, item.currency || financeCurrency)}</strong>
                      </div>
                      <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {item.transactionStatus || '—'} • {item.transactionDate ? new Date(item.transactionDate).toLocaleString() : 'No date'}
                      </div>
                    </div>
                  )) : <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No transactions returned yet.</p>}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <h3 className="text-sm font-semibold">Order earnings detail</h3>
                {financeDetails.orderEarnings ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div>Order: <strong>{financeDetails.orderEarnings.orderId || '—'}</strong></div>
                    <div>Gross: <strong>{formatFinanceAmount(financeDetails.orderEarnings.orderEarningsSummary?.grossAmount?.value || 0, financeDetails.orderEarnings.orderEarningsSummary?.grossAmount?.currency || financeCurrency)}</strong></div>
                    <div>Expenses: <strong>{formatFinanceAmount(financeDetails.orderEarnings.orderEarningsSummary?.expenses?.value || 0, financeDetails.orderEarnings.orderEarningsSummary?.expenses?.currency || financeCurrency)}</strong></div>
                    <div>Refunds: <strong>{formatFinanceAmount(financeDetails.orderEarnings.orderEarningsSummary?.refunds?.value || 0, financeDetails.orderEarnings.orderEarningsSummary?.refunds?.currency || financeCurrency)}</strong></div>
                    <div>Earnings: <strong>{formatFinanceAmount(financeDetails.orderEarnings.orderEarningsSummary?.orderEarnings?.value || 0, financeDetails.orderEarnings.orderEarningsSummary?.orderEarnings?.currency || financeCurrency)}</strong></div>
                  </div>
                ) : (
                  <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No order detail available yet.</p>
                )}
              </div>

              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <h3 className="text-sm font-semibold">Payout detail</h3>
                {financeDetails.payout ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <div>Payout ID: <strong>{financeDetails.payout.payoutId || '—'}</strong></div>
                    <div>Status: <strong>{financeDetails.payout.payoutStatus || '—'}</strong></div>
                    <div>Amount: <strong>{formatFinanceAmount(financeDetails.payout.amount?.value || 0, financeDetails.payout.amount?.currency || financeCurrency)}</strong></div>
                    <div>Payout date: <strong>{financeDetails.payout.payoutDate ? new Date(financeDetails.payout.payoutDate).toLocaleString() : '—'}</strong></div>
                    <div>Transactions: <strong>{financeDetails.payout.transactionCount ?? 0}</strong></div>
                  </div>
                ) : (
                  <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No payout detail available yet.</p>
                )}
              </div>

              <div className={`rounded-2xl border p-4 ${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-white'}`}>
                <h3 className="text-sm font-semibold">Transfer / billing detail</h3>
                {financeDetails.transfer || financeDetails.billingActivity ? (
                  <div className="mt-3 space-y-2 text-sm">
                    {financeDetails.transfer ? <div>Transfer ID: <strong>{financeDetails.transfer.transferId || '—'}</strong></div> : null}
                    {financeDetails.transfer ? <div>Transfer amount: <strong>{formatFinanceAmount(financeDetails.transfer.transferAmount?.value || 0, financeDetails.transfer.transferAmount?.currency || financeCurrency)}</strong></div> : null}
                    {financeDetails.transfer ? <div>Transaction date: <strong>{financeDetails.transfer.transactionDate ? new Date(financeDetails.transfer.transactionDate).toLocaleString() : '—'}</strong></div> : null}
                    <div>
                      Billing activity: <strong>{financeDetails.billingActivity ? 'Available' : 'Not returned'}</strong>
                    </div>
                    {financeDetails.billingActivity ? <pre className={`mt-2 max-h-40 overflow-auto rounded-xl p-3 text-xs ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>{JSON.stringify(financeDetails.billingActivity, null, 2)}</pre> : null}
                  </div>
                ) : (
                  <p className={`mt-3 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No transfer or billing activity returned yet.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <SubscriptionRequestModal
        open={requestUpgradeOpen}
        onClose={() => setRequestUpgradeOpen(false)}
        plans={publicPlans}
        lockPlan={false}
        defaultValues={{
          name: user?.name || '',
          surname: user?.surname || user?.lastName || '',
          email: user?.email || '',
          phoneNumber: user?.phoneNumber || user?.phone || '',
        }}
        onSuccess={() => {
          setAlert({ type: 'success', message: t('dashboard.upgradeRequestSent') });
        }}
      />
    </div>
  );
}
