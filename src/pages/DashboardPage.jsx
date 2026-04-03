import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { adminAPI, productAPI, settingsAPI, ebayAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/helpers';
import { ProductFormModal } from './ProductFormPage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Gauge, LineChart, ShieldCheck, X } from 'lucide-react';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [limits, setLimits] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isDark } = useTheme();
  const { user } = useAuth();
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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productsRes, limitsRes, ebayRes] = await Promise.all([
          productAPI.getAll(),
          settingsAPI.getLimits(),
          ebayAPI.getStatus().catch(() => null),
        ]);
        setProducts(productsRes.data || []);
        setLimits(limitsRes.data || null);
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
        }
      } catch {
        setAlert({ type: 'error', message: 'Failed to load dashboard analytics' });
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
          err?.response?.data?.error || err?.message || 'Failed to load eBay analytics'
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

  const chartData = useMemo(() => {
    const byDay = {};
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    for (const p of products) {
      const d = new Date(p.createdAt || p.lastUpdated);
      const key = d.toISOString().slice(0, 10);
      if (byDay[key] !== undefined) {
        byDay[key] += Math.max(0, Number(p.profit || 0));
      }
    }
    return Object.entries(byDay).map(([day, sales]) => ({
      day: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sales: Number(sales.toFixed(2)),
    }));
  }, [products]);

  const totalProfit = useMemo(
    () => products.reduce((sum, p) => sum + Number(p.profit || 0), 0),
    [products]
  );
  const productsLimit = limits?.products?.limit;
  const productsUsed = limits?.products?.used ?? products.length;
  const productsLeft = limits?.products?.remaining;
  const lookupLeft = limits?.amazonLookup?.remainingThisWeek;
  const isProductQuotaReached =
    productsLeft !== null && productsLeft !== undefined && productsLeft <= 0;

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
            aria-label="Dismiss"
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
                eBay analytics unlocked with connection
              </div>
              <h2 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'} mb-2`}>
                Connect eBay to unlock seller insights
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'} max-w-2xl`}>
                Get traffic reports, customer-service benchmarks (INAD/INR), and seller standards performance so you can
                improve listings and boost results.
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
                  Connect eBay
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
                  Learn more
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <LineChart size={16} />
                  <span className="text-xs font-semibold">Traffic</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>7.41%</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sales conversion sample</p>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <Gauge size={16} />
                  <span className="text-xs font-semibold">Customer Service</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>0.78</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Projected rate sample (INR)</p>
              </div>

              <div className={`rounded-xl border p-3 ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div className={`flex items-center gap-2 mb-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                  <ShieldCheck size={16} />
                  <span className="text-xs font-semibold">Standards</span>
                </div>
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>TOP_RATED</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Seller level sample</p>
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
          {analytics?.analyticsAccessDenied && !hideAnalyticsAccessAlert && (
            <div className="mb-4">
              <Alert
                type="error"
                message={
                  analytics?.analyticsAccessErrorMessage ||
                  'eBay analytics access denied. This eBay account may not have seller analytics permissions.'
                }
                onClose={() => setHideAnalyticsAccessAlert(true)}
                autoClose={false}
              />
            </div>
          )}

          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                eBay Seller Analytics
              </h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Standards, customer service metrics, and traffic insights.
              </p>
            </div>
            <div className="text-xs opacity-80">
              {analyticsLoading ? 'Loading…' : analytics ? 'Updated' : ''}
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
                  Customer Service Metric
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {analytics?.customerService?.metricType || 'ITEM_NOT_AS_DESCRIBED'} • CURRENT
                </p>
                {analytics?.customerService?.dimension ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {analytics.customerService.dimension.name || 'Top category'}
                      </p>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                          isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {analytics.customerService.dimension.rating || 'N/A'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rate</p>
                        <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {Number(analytics.customerService.dimension.rate || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Transactions
                        </p>
                        <p className={`text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {Number(analytics.customerService.dimension.transactionCount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className={`text-sm mt-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>No data</p>
                )}
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Seller Standards Profile
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
                        {analytics.sellerStandards.profile.cycle?.cycleType || 'CURRENT'}
                      </span>
                    </div>
                    <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Program: {analytics.sellerStandards.profile.program || '-'}
                    </p>
                    <div className="mt-4 space-y-2">
                      {analytics.sellerStandards.profile.metrics?.slice(0, 4)?.map((m) => (
                        <div
                          key={m.metricKey}
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                            isDark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
                          }`}
                        >
                          <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
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
                  <p className={`text-sm mt-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>No data</p>
                )}
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Traffic & Conversion
                  </p>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    last 7 days
                  </span>
                </div>
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
              </div>
            </div>
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

      <h1 className="page-title mb-5">Dashboard</h1>

      {user?.role === 'admin' && adminStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">Users registered (1 week)</p>
            <p className="text-2xl font-bold mt-1">{adminStats.usersRegistered?.week ?? 0}</p>
            <p className="text-xs opacity-70 mt-1">Month: {adminStats.usersRegistered?.month ?? 0} • Year: {adminStats.usersRegistered?.year ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">Products added (1 week)</p>
            <p className="text-2xl font-bold mt-1">{adminStats.productsAdded?.week ?? 0}</p>
            <p className="text-xs opacity-70 mt-1">Month: {adminStats.productsAdded?.month ?? 0} • Year: {adminStats.productsAdded?.year ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">Users reached Amazon quota</p>
            <p className="text-2xl font-bold mt-1">{adminStats.quotaReachedUsers?.amazonLookup ?? 0}</p>
          </div>
          <div className={`glass-card p-4 border ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-200 border-slate-300 text-slate-900'}`}>
            <p className="text-xs opacity-80">Users reached Product quota</p>
            <p className="text-2xl font-bold mt-1">{adminStats.quotaReachedUsers?.products ?? 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div
          className={`glass-card p-5 border ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-200 text-slate-900 border-slate-300'
          }`}
        >
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Product upload left</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-3xl font-bold">
              {productsLeft === null || productsLeft === undefined ? 'Unlimited' : productsLeft}
            </p>
            <button
              type="button"
              disabled={isProductQuotaReached}
              onClick={() => {
                if (isProductQuotaReached) {
                  setAlert({
                    type: 'warning',
                    message:
                      'Product quota reached. Delete one product or ask admin to increase your limit.',
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
              {isProductQuotaReached ? 'Quota Reached' : 'Upload Now'}
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
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Auto Tracking Credits</p>
          <p className="mt-2 text-3xl font-bold">
            {lookupLeft === null || lookupLeft === undefined ? 'Unlimited' : lookupLeft}
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Amazon lookups remaining this week</p>
        </div>
        <div
          className={`glass-card p-5 border ${
            isDark
              ? 'bg-slate-950 text-white border-slate-800'
              : 'bg-slate-200 text-slate-900 border-slate-300'
          } relative overflow-hidden`}
        >
          <div className="blur-[2px] opacity-70 select-none">
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tracked products</p>
            <p className="mt-2 text-2xl font-bold">{products.length}</p>
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
              Total products in your account
            </p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px] bg-slate-900/10 dark:bg-slate-950/20 pointer-events-none">
            <span className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Available soon
            </span>
          </div>
        </div>
      </div>

      <div
        className={`glass-card p-5 border ${
          isDark
            ? 'bg-slate-950 text-white border-slate-800'
            : 'bg-slate-100 text-slate-900 border-slate-300'
        } relative overflow-hidden`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-black'}`}>PRODUCT SALES</p>
            <p className="text-3xl font-bold mt-2">{formatCurrency(totalProfit)}</p>
          </div>
          <p className="text-amber-500 text-sm font-semibold">
            {formatCurrency(chartData.reduce((s, c) => s + c.sales, 0))} in last 7 days
          </p>
        </div>
        <div className="h-[320px] pointer-events-none blur-[2px] opacity-70 select-none">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#cbd5e1'} />
              <XAxis dataKey="day" stroke={isDark ? '#94a3b8' : '#64748b'} />
              <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} />
              <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="url(#salesGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px] bg-slate-900/10 dark:bg-slate-950/20 pointer-events-none">
          <div className="text-center">
            <p className={`text-2xl font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Available soon</p>
            <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Sales analytics module is under development</p>
          </div>
        </div>
      </div>
    </div>
  );
}
