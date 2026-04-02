import React, { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { adminAPI, productAPI, settingsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Alert from '../components/Alert';
import { formatCurrency } from '../utils/helpers';
import { ProductFormModal } from './ProductFormPage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [limits, setLimits] = useState(null);
  const [adminStats, setAdminStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { isDark } = useTheme();
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [productsRes, limitsRes] = await Promise.all([
          productAPI.getAll(),
          settingsAPI.getLimits(),
        ]);
        setProducts(productsRes.data || []);
        setLimits(limitsRes.data || null);
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
