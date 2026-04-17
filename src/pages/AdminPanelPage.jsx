import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { ShieldCheck, Users, UserPlus, Pencil, ListChecks, PackageOpen, RefreshCw, Search, Trash2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { TAB_KEYS, USER_DEFAULT_ALLOWED_TABS } from '../utils/planAccess';

function safeToString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

function defaultEditForUser(u) {
  return {
    role: u.role || 'user',
    amazonLookupRequestLimitPerWeek: safeToString(u.amazonLookupRequestLimitPerWeek),
    productsLimit: safeToString(u.productsLimit),
    marketAnalysisCreditsLimit: safeToString(u.marketAnalysisCreditsLimit),
    ebayAccountsLimit: safeToString(u.ebayAccountsLimit),
  };
}

const PLAN_TAB_OPTIONS = [
  { key: TAB_KEYS.PRODUCTS, label: 'Products' },
  { key: TAB_KEYS.LISTINGS, label: 'Listings' },
  { key: TAB_KEYS.ORDERS, label: 'Orders' },
  { key: TAB_KEYS.AMAZON_LOOKUP, label: 'Amazon Lookup' },
  { key: TAB_KEYS.EBAY_CALCULATOR, label: 'eBay Calculator' },
  { key: TAB_KEYS.MARKET_ANALYSIS, label: 'Checkila Analysis' },
  { key: TAB_KEYS.DEWISO, label: 'Dewiso' },
  { key: TAB_KEYS.SETTINGS, label: 'Settings' },
];

function defaultPlanForm() {
  return {
    id: '',
    name: '',
    category: 'subscription',
    price: '',
    actualPrice: '',
    discountedPrice: '',
    currency: 'AZN',
    duration: '',
    description: '',
    featuresText: '',
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    featured: false,
    isActive: true,
    allowedTabs: [...USER_DEFAULT_ALLOWED_TABS.filter((key) => key !== TAB_KEYS.DASHBOARD)],
  };
}

export default function AdminPanelPage() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [plans, setPlans] = useState([]);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    amazonLookupRequestLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
  });

  const [edits, setEdits] = useState({});
  const [resetUsage, setResetUsage] = useState({});
  const [requestAction, setRequestAction] = useState({});
  const [planForm, setPlanForm] = useState(defaultPlanForm());
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [dangerWindow, setDangerWindow] = useState('3d');
  const [dangerSubmitting, setDangerSubmitting] = useState(false);

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

  const refreshData = async () => {
    const [usersRes, plansRes, requestsRes] = await Promise.all([
      adminAPI.listUsers(),
      adminAPI.listPlans(),
      adminAPI.listSubscriptionRequests(),
    ]);

    const usersList = usersRes?.data?.users || [];
    const editsMap = {};
    for (const u of usersList) editsMap[u.id] = defaultEditForUser(u);

    setUsers(usersList);
    setEdits(editsMap);
    setPlans(plansRes?.data?.plans || []);
    setRequests(requestsRes?.data?.requests || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setAlert(null);
        await refreshData();
      } catch (err) {
        setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to load admin data' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onCreateUser = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!createForm.email || !createForm.password || !createForm.name) {
      setAlert({ type: 'warning', message: 'Email, password, and name are required' });
      return;
    }

    try {
      setLoading(true);
      await adminAPI.createUser({
        email: createForm.email.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        role: createForm.role === 'admin' ? 'admin' : 'user',
        amazonLookupRequestLimitPerWeek:
          createForm.amazonLookupRequestLimitPerWeek === ''
            ? null
            : Number(createForm.amazonLookupRequestLimitPerWeek),
        productsLimit: createForm.productsLimit === '' ? null : Number(createForm.productsLimit),
        marketAnalysisCreditsLimit:
          createForm.marketAnalysisCreditsLimit === ''
            ? null
            : Number(createForm.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          createForm.ebayAccountsLimit === '' ? null : Number(createForm.ebayAccountsLimit),
      });

      setCreateForm({
        email: '',
        password: '',
        name: '',
        role: 'user',
        amazonLookupRequestLimitPerWeek: '',
        productsLimit: '',
        marketAnalysisCreditsLimit: '',
        ebayAccountsLimit: '',
      });

      await refreshData();
      setAlert({ type: 'success', message: 'User created successfully' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to create user' });
    } finally {
      setLoading(false);
    }
  };

  const onSaveLimits = async (userId) => {
    setAlert(null);
    try {
      setLoading(true);
      const uEdits = edits[userId];
      if (!uEdits) return;

      await adminAPI.updateUserLimits(userId, {
        role: uEdits.role === 'admin' ? 'admin' : 'user',
        amazonLookupRequestLimitPerWeek:
          uEdits.amazonLookupRequestLimitPerWeek === ''
            ? null
            : Number(uEdits.amazonLookupRequestLimitPerWeek),
        productsLimit: uEdits.productsLimit === '' ? null : Number(uEdits.productsLimit),
        marketAnalysisCreditsLimit:
          uEdits.marketAnalysisCreditsLimit === '' ? null : Number(uEdits.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          uEdits.ebayAccountsLimit === '' ? null : Number(uEdits.ebayAccountsLimit),
        resetAmazonUsage: !!resetUsage[userId],
        resetMarketAnalysisUsage: !!resetUsage[`${userId}__marketAnalysis`],
      });

      await refreshData();
      setResetUsage({});
      setAlert({ type: 'success', message: 'User limits updated' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to update limits' });
    } finally {
      setLoading(false);
    }
  };

  const onSavePlan = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!planForm.name.trim()) {
      setAlert({ type: 'warning', message: 'Plan name is required' });
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: planForm.name.trim(),
        category: planForm.category,
        price: planForm.price.trim(),
        actualPrice: planForm.actualPrice === '' ? null : Number(planForm.actualPrice),
        discountedPrice: planForm.discountedPrice === '' ? null : Number(planForm.discountedPrice),
        currency: planForm.currency || 'AZN',
        duration: planForm.duration.trim(),
        description: planForm.description.trim(),
        features: planForm.featuresText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        amazonLookupLimitPerWeek:
          planForm.amazonLookupLimitPerWeek === '' ? null : Number(planForm.amazonLookupLimitPerWeek),
        productsLimit: planForm.productsLimit === '' ? null : Number(planForm.productsLimit),
        marketAnalysisCreditsLimit:
          planForm.marketAnalysisCreditsLimit === ''
            ? null
            : Number(planForm.marketAnalysisCreditsLimit),
        ebayAccountsLimit:
          planForm.ebayAccountsLimit === '' ? null : Number(planForm.ebayAccountsLimit),
        featured: !!planForm.featured,
        isActive: !!planForm.isActive,
        allowedTabs: planForm.allowedTabs,
      };

      if (planForm.id) {
        await adminAPI.updatePlan(planForm.id, payload);
      } else {
        await adminAPI.createPlan(payload);
      }

      await refreshData();
      setPlanForm(defaultPlanForm());
      setAlert({ type: 'success', message: 'Plan saved successfully' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to save plan' });
    } finally {
      setLoading(false);
    }
  };

  const startEditPlan = (plan) => {
    setPlanForm({
      id: plan.id,
      name: plan.name || '',
      category:
        plan.category === 'analytics'
          ? 'analytics'
          : plan.category === 'amazon_monitoring'
            ? 'amazon_monitoring'
            : 'subscription',
      price: plan.price || '',
      actualPrice: safeToString(plan.actualPrice),
      discountedPrice: safeToString(plan.discountedPrice),
      currency: plan.currency || 'AZN',
      duration: plan.duration || '',
      description: plan.description || '',
      featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      amazonLookupLimitPerWeek: safeToString(plan.amazonLookupLimitPerWeek),
      allowedTabs: Array.isArray(plan.allowedTabs)
        ? plan.allowedTabs.filter((key) => key !== TAB_KEYS.DASHBOARD)
        : [...USER_DEFAULT_ALLOWED_TABS.filter((key) => key !== TAB_KEYS.DASHBOARD)],
      productsLimit: safeToString(plan.productsLimit),
      marketAnalysisCreditsLimit: safeToString(plan.marketAnalysisCreditsLimit),
      ebayAccountsLimit: safeToString(plan.ebayAccountsLimit),
      featured: !!plan.featured,
      isActive: plan.isActive !== false,
    });
  };

  const onApproveRequest = async (requestId) => {
    const action = requestAction[requestId] || {};

    try {
      setLoading(true);
      await adminAPI.approveSubscriptionRequest(requestId, {
        adminNote: action.adminNote || '',
      });
      await refreshData();
      setAlert({ type: 'success', message: 'Request approved and user created/updated' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to approve request' });
    } finally {
      setLoading(false);
    }
  };

  const onRejectRequest = async (requestId) => {
    const action = requestAction[requestId] || {};
    try {
      setLoading(true);
      await adminAPI.rejectSubscriptionRequest(requestId, { adminNote: action.adminNote || '' });
      await refreshData();
      setAlert({ type: 'success', message: 'Request rejected' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to reject request' });
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = useMemo(
    () => requests.filter((r) => (r.status || 'pending') === 'pending'),
    [requests]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const plan = String(u.selectedPlanName || '').toLowerCase();
      return name.includes(q) || email.includes(q) || plan.includes(q);
    });
  }, [users, userSearch]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIds.includes(u.id));

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllFiltered = () => {
    setSelectedUserIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredUsers.some((u) => u.id === id));
      }
      const next = new Set(prev);
      for (const u of filteredUsers) next.add(u.id);
      return Array.from(next);
    });
  };

  const onRefreshSubscriptions = async (all = false) => {
    try {
      setLoading(true);
      await adminAPI.refreshSubscriptions(all ? { selectAll: true } : { userIds: selectedUserIds });
      await refreshData();
      setAlert({ type: 'success', message: 'Subscription period refreshed (+1 month) and usage reset.' });
      if (!all) setSelectedUserIds([]);
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to refresh subscriptions' });
    } finally {
      setLoading(false);
    }
  };

  const onDeleteUsers = async (all = false) => {
    const hasTarget = all || selectedUserIds.length > 0;
    if (!hasTarget) {
      setAlert({ type: 'warning', message: 'Select users first.' });
      return;
    }

    const confirmed = window.confirm(
      all
        ? 'Are you sure you want to remove ALL users? This also removes their products.'
        : 'Are you sure you want to remove selected users? This also removes their products.'
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await adminAPI.deleteUsers(all ? { selectAll: true } : { userIds: selectedUserIds });
      await refreshData();
      setSelectedUserIds([]);
      setAlert({ type: 'success', message: all ? 'All users removed.' : 'Selected users removed.' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to remove users' });
    } finally {
      setLoading(false);
    }
  };

  const onDeleteSingleUser = async (userId) => {
    const confirmed = window.confirm(
      'Are you sure you want to remove this user? This also removes their products.'
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await adminAPI.deleteUsers({ userIds: [userId] });
      await refreshData();
      setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
      setAlert({ type: 'success', message: 'User removed.' });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to remove user' });
    } finally {
      setLoading(false);
    }
  };

  const onPurgeSearchCache = async () => {
    const labelMap = {
      '3d': 'within 3 days',
      '7d': 'within 7 days',
      '1m': 'within 1 month',
      '1y': 'within 1 year',
      all: 'all search records',
    };
    const label = labelMap[dangerWindow] || dangerWindow;
    const confirmed = window.confirm(`Delete ${label} from SQL? This cannot be undone.`);
    if (!confirmed) return;

    try {
      setDangerSubmitting(true);
      setAlert(null);
      const response = await adminAPI.purgeSearchCache({ window: dangerWindow });
      setAlert({
        type: 'success',
        message: response?.data?.message || 'Search cache deleted successfully',
      });
    } catch (err) {
      setAlert({ type: 'error', message: err?.response?.data?.error || err.message || 'Failed to delete search cache' });
    } finally {
      setDangerSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-600" />
              Admin Panel
            </h1>
            <p className="page-subtitle">
              Admin users: <span className="font-semibold">{adminCount}</span>
            </p>
          </div>
        </div>

        <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('requests')}
          >
            Requests
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'plans' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('plans')}
          >
            Plans
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${activeTab === 'danger' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}
            onClick={() => setActiveTab('danger')}
          >
            Danger Zone
          </button>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
          </div>
        )}

        {loading && <LoadingSpinner />}

        {!loading && activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Create User</h2>
              </div>

              <form onSubmit={onCreateUser} className="space-y-3">
                <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} className="input-base" placeholder="Name" type="text" />
                <input value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} className="input-base" placeholder="Email" type="email" />
                <input value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} className="input-base" placeholder="Temporary password" type="password" />

                <select value={createForm.role} onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))} className="input-base">
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input value={createForm.amazonLookupRequestLimitPerWeek} onChange={(e) => setCreateForm((p) => ({ ...p, amazonLookupRequestLimitPerWeek: e.target.value }))} className="input-base" placeholder="Amazon / week" type="number" min="0" />
                  <input value={createForm.productsLimit} onChange={(e) => setCreateForm((p) => ({ ...p, productsLimit: e.target.value }))} className="input-base" placeholder="Products" type="number" min="0" />
                </div>
                <input
                  value={createForm.marketAnalysisCreditsLimit}
                  onChange={(e) => setCreateForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  className="input-base"
                  placeholder="Checkila Analysis credits"
                  type="number"
                  min="0"
                />
                <input
                  value={createForm.ebayAccountsLimit}
                  onChange={(e) => setCreateForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                  className="input-base"
                  placeholder="eBay accounts limit"
                  type="number"
                  min="0"
                />

                <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                  <Users size={16} />
                  Create access
                </button>
              </form>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Users</h2>
              </div>

              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="input-base pl-9"
                    placeholder="Search users by name, email, plan"
                  />
                </div>
                <button type="button" onClick={toggleSelectAllFiltered} className="btn-secondary px-3 py-2 text-xs">
                  {allFilteredSelected ? 'Unselect all' : 'Select filtered'}
                </button>
                <button
                  type="button"
                  onClick={() => onRefreshSubscriptions(false)}
                  disabled={selectedUserIds.length === 0}
                  className="btn-primary px-3 py-2 text-xs inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <RefreshCw size={13} /> Refresh +1 month
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteUsers(false)}
                  disabled={selectedUserIds.length === 0}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  Remove selected
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRefreshSubscriptions(true)}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  Refresh all users +1 month
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteUsers(true)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Remove all users
                </button>
              </div>

              <div className="space-y-3">
                {filteredUsers.map((u) => {
                  const rowEdits = edits[u.id] || defaultEditForUser(u);
                  return (
                    <div key={u.id} className={`border rounded-xl p-3 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                            className="mt-0.5"
                          />
                          <span className="text-sm font-semibold">{u.name || 'User'} ({u.email})</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => onDeleteSingleUser(u.id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 inline-flex items-center gap-1"
                          title="Remove user"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">Plan: {u.selectedPlanName || 'Custom/none'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Expires: {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString() : 'N/A'}
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          value={rowEdits.role}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], role: e.target.value } }))}
                          className="input-base"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>

                        <input
                          value={rowEdits.amazonLookupRequestLimitPerWeek}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], amazonLookupRequestLimitPerWeek: e.target.value } }))}
                          className="input-base"
                          placeholder="Amazon / week"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.productsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], productsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="Products limit"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.marketAnalysisCreditsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], marketAnalysisCreditsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="Checkila Analysis credits limit"
                          type="number"
                          min="0"
                        />

                        <input
                          value={rowEdits.ebayAccountsLimit}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], ebayAccountsLimit: e.target.value } }))}
                          className="input-base sm:col-span-2"
                          placeholder="eBay accounts limit"
                          type="number"
                          min="0"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!resetUsage[u.id]}
                              onChange={(e) => setResetUsage((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                            />
                            Reset Amazon usage now
                          </label>
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!resetUsage[`${u.id}__marketAnalysis`]}
                              onChange={(e) =>
                                setResetUsage((prev) => ({
                                  ...prev,
                                  [`${u.id}__marketAnalysis`]: e.target.checked,
                                }))
                              }
                            />
                            Reset Checkila Analysis credits usage now
                          </label>
                        </div>

                        <button type="button" onClick={() => onSaveLimits(u.id)} className="btn-primary inline-flex items-center gap-2 px-4 py-2">
                          <Pencil size={14} /> Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'requests' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <div className="flex items-center gap-2 mb-4">
              <ListChecks size={18} className="text-blue-600" />
              <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Requests ({pendingRequests.length} pending)
              </h2>
            </div>

            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">No requests found.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const action = requestAction[req.id] || {};
                  const isPending = (req.status || 'pending') === 'pending';

                  return (
                    <div key={req.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{req.name} {req.surname}</p>
                          <p className="text-xs text-slate-500">{req.email} • {req.phoneNumber}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isPending ? 'bg-amber-100 text-amber-700' : req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {req.status}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {(req.requestType || 'subscription').replace(/_/g, ' ')}
                        </span>
                        {req.requestType === 'update_credits' && req.requestedCredits != null ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            Credits: {req.requestedCredits}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-xs text-slate-500">Plan: {req.planName || 'N/A'}</p>
                      {(req.planId === 'custom' || req.planCategory === 'custom') ? (
                        <div className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50/70 p-2 text-xs text-slate-700 dark:border-cyan-900/40 dark:bg-cyan-900/20 dark:text-cyan-100">
                          <p className="font-semibold">Custom requested limits</p>
                          <p className="mt-1">
                            Amazon/week: {req.requestedLimits?.amazonLookupLimitPerWeek ?? 'N/A'} | Products: {req.requestedLimits?.productsLimit ?? 'N/A'} | Checkila Analysis credits: {req.requestedLimits?.marketAnalysisCreditsLimit ?? 'N/A'} | eBay accounts: {req.requestedLimits?.ebayAccountsLimit ?? 'N/A'}
                          </p>
                          {req.customNote ? <p className="mt-1">Note: {req.customNote}</p> : null}
                        </div>
                      ) : null}

                      {isPending ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                          <input
                            type="text"
                            placeholder="Admin note (optional)"
                            value={action.adminNote || ''}
                            onChange={(e) => setRequestAction((prev) => ({ ...prev, [req.id]: { ...prev[req.id], adminNote: e.target.value } }))}
                            className="input-base"
                          />
                          <button type="button" onClick={() => onApproveRequest(req.id)} className="btn-primary px-4 py-2">Approve</button>
                          <button type="button" onClick={() => onRejectRequest(req.id)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">Reject</button>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-slate-500">
                          {req.status === 'approved' ? `Approved by ${req.approvedBy || 'admin'}` : `Rejected by ${req.rejectedBy || 'admin'}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'plans' && (
          <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 lg:gap-6">
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <PackageOpen size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {planForm.id ? 'Edit Plan' : 'Create Plan'}
                </h2>
              </div>

              <form onSubmit={onSavePlan} className="space-y-3">
                <input value={planForm.name} onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))} className="input-base" placeholder="Plan name" type="text" />

                <div className="grid grid-cols-2 gap-3">
                  <select value={planForm.category} onChange={(e) => setPlanForm((p) => ({ ...p, category: e.target.value }))} className="input-base">
                    <option value="subscription">subscription</option>
                    <option value="analytics">analytics</option>
                    <option value="amazon_monitoring">amazon_monitoring</option>
                  </select>
                  <input value={planForm.price} onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))} className="input-base" placeholder="Price" type="text" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={planForm.actualPrice}
                    onChange={(e) => setPlanForm((p) => ({ ...p, actualPrice: e.target.value }))}
                    className="input-base"
                    placeholder="Actual price"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                  <input
                    value={planForm.discountedPrice}
                    onChange={(e) => setPlanForm((p) => ({ ...p, discountedPrice: e.target.value }))}
                    className="input-base"
                    placeholder="Discounted price"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                  <input
                    value={planForm.currency}
                    onChange={(e) => setPlanForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))}
                    className="input-base"
                    placeholder="Currency"
                    type="text"
                  />
                </div>

                <input value={planForm.duration} onChange={(e) => setPlanForm((p) => ({ ...p, duration: e.target.value }))} className="input-base" placeholder="Duration" type="text" />
                <textarea value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} className="input-base min-h-[88px]" placeholder="Description" />
                <textarea value={planForm.featuresText} onChange={(e) => setPlanForm((p) => ({ ...p, featuresText: e.target.value }))} className="input-base min-h-[110px]" placeholder="Features (one per line)" />

                <div className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-sm font-semibold mb-2">Visible tabs for this plan</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_TAB_OPTIONS.map((tab) => {
                      const checked = planForm.allowedTabs.includes(tab.key);
                      return (
                        <label key={tab.key} className="text-xs flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setPlanForm((prev) => ({
                                ...prev,
                                allowedTabs: e.target.checked
                                  ? Array.from(new Set([...prev.allowedTabs, tab.key]))
                                  : prev.allowedTabs.filter((item) => item !== tab.key),
                              }))
                            }
                          />
                          {tab.label}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Dashboard is always visible and used as redirect target.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input value={planForm.amazonLookupLimitPerWeek} onChange={(e) => setPlanForm((p) => ({ ...p, amazonLookupLimitPerWeek: e.target.value }))} className="input-base" placeholder="Amazon / week" type="number" min="0" />
                  <input value={planForm.productsLimit} onChange={(e) => setPlanForm((p) => ({ ...p, productsLimit: e.target.value }))} className="input-base" placeholder="Products" type="number" min="0" />
                </div>
                <input
                  value={planForm.marketAnalysisCreditsLimit}
                  onChange={(e) => setPlanForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  className="input-base"
                  placeholder="Checkila Analysis credits"
                  type="number"
                  min="0"
                />
                <input
                  value={planForm.ebayAccountsLimit}
                  onChange={(e) => setPlanForm((p) => ({ ...p, ebayAccountsLimit: e.target.value }))}
                  className="input-base"
                  placeholder="eBay accounts limit"
                  type="number"
                  min="0"
                />

                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={planForm.featured} onChange={(e) => setPlanForm((p) => ({ ...p, featured: e.target.checked }))} /> Featured</label>
                <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm((p) => ({ ...p, isActive: e.target.checked }))} /> Active</label>

                <button type="submit" className="btn-primary w-full py-2.5">Save Plan</button>
                {planForm.id ? (
                  <button type="button" onClick={() => setPlanForm(defaultPlanForm())} className="btn-secondary w-full py-2.5">
                    Cancel edit
                  </button>
                ) : null}
              </form>
            </div>

            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <PackageOpen size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Plans</h2>
              </div>

              <div className="space-y-3">
                {plans.map((plan) => (
                  <div key={plan.id} className={`rounded-xl border p-3 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.category} • {plan.price || 'no price'} • {plan.duration || 'no duration'}</p>
                        <p className="text-xs text-slate-500">Pricing: {plan.actualPrice ?? '-'} → {plan.discountedPrice ?? '-'} {plan.currency || 'AZN'}</p>
                        <p className="mt-1 text-xs text-slate-500">Amazon/week: {plan.amazonLookupLimitPerWeek ?? 'unlimited'} | Products: {plan.productsLimit ?? 'unlimited'} | Checkila Analysis credits: {plan.marketAnalysisCreditsLimit ?? 'unlimited'} | eBay accounts: {plan.ebayAccountsLimit ?? 'unlimited'}</p>
                        <p className="mt-1 text-xs text-slate-500">Visible tabs: {Array.isArray(plan.allowedTabs) ? plan.allowedTabs.join(', ') : 'all default tabs'}</p>
                      </div>
                      <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => startEditPlan(plan)}>
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && activeTab === 'danger' && (
          <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-red-600" />
              <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Danger Zone
              </h2>
            </div>

            <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Delete searched records from SQL by age. This removes cached search data permanently.
            </p>

            <div className={`rounded-xl border p-4 ${isDark ? 'border-red-900 bg-red-950/20' : 'border-red-200 bg-red-50'}`}>
              <label className={`block text-sm font-semibold mb-2 ${isDark ? 'text-red-200' : 'text-red-700'}`}>
                Delete search records
              </label>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <select
                    value={dangerWindow}
                    onChange={(e) => setDangerWindow(e.target.value)}
                    className="input-base"
                  >
                    <option value="3d">Within 3 days</option>
                    <option value="7d">Within 7 days</option>
                    <option value="1m">Within 1 month</option>
                    <option value="1y">Within 1 year</option>
                    <option value="all">All</option>
                  </select>
                  <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    This action deletes matching rows from <span className="font-semibold">ebay_search_cache</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onPurgeSearchCache}
                  disabled={dangerSubmitting}
                  className="rounded-lg border border-red-600 bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {dangerSubmitting ? 'Deleting...' : 'Delete search data'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
