import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { ShieldCheck, Users, UserPlus, Pencil, ListChecks, PackageOpen } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

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

function defaultPlanForm() {
  return {
    id: '',
    name: '',
    category: 'subscription',
    price: '',
    duration: '',
    description: '',
    featuresText: '',
    amazonLookupLimitPerWeek: '',
    productsLimit: '',
    marketAnalysisCreditsLimit: '',
    ebayAccountsLimit: '',
    featured: false,
    isActive: true,
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
      category: plan.category === 'analytics' ? 'analytics' : 'subscription',
      price: plan.price || '',
      duration: plan.duration || '',
      description: plan.description || '',
      featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      amazonLookupLimitPerWeek: safeToString(plan.amazonLookupLimitPerWeek),
      productsLimit: safeToString(plan.productsLimit),
      marketAnalysisCreditsLimit: safeToString(plan.marketAnalysisCreditsLimit),
      ebayAccountsLimit: safeToString(plan.ebayAccountsLimit),
      featured: !!plan.featured,
      isActive: plan.isActive !== false,
    });
  };

  const onApproveRequest = async (requestId) => {
    const action = requestAction[requestId] || {};
    if (!action.temporaryPassword || action.temporaryPassword.length < 6) {
      setAlert({ type: 'warning', message: 'Temporary password is required (min 6 chars)' });
      return;
    }

    try {
      setLoading(true);
      await adminAPI.approveSubscriptionRequest(requestId, {
        temporaryPassword: action.temporaryPassword,
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
                  placeholder="Market analysis credits"
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

              <div className="space-y-3">
                {users.map((u) => {
                  const rowEdits = edits[u.id] || defaultEditForUser(u);
                  return (
                    <div key={u.id} className={`border rounded-xl p-3 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="text-sm font-semibold">{u.name || 'User'} ({u.email})</div>
                      <div className="mt-1 text-xs text-slate-500">Plan: {u.selectedPlanName || 'Custom/none'}</div>

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
                          placeholder="Market analysis credits limit"
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
                            Reset Market Analysis credits usage now
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

                      <p className="mt-2 text-xs text-slate-500">Plan: {req.planName || 'N/A'}</p>

                      {isPending ? (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2">
                          <input
                            type="password"
                            placeholder="Temporary password"
                            value={action.temporaryPassword || ''}
                            onChange={(e) => setRequestAction((prev) => ({ ...prev, [req.id]: { ...prev[req.id], temporaryPassword: e.target.value } }))}
                            className="input-base"
                          />
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
                  </select>
                  <input value={planForm.price} onChange={(e) => setPlanForm((p) => ({ ...p, price: e.target.value }))} className="input-base" placeholder="Price" type="text" />
                </div>

                <input value={planForm.duration} onChange={(e) => setPlanForm((p) => ({ ...p, duration: e.target.value }))} className="input-base" placeholder="Duration" type="text" />
                <textarea value={planForm.description} onChange={(e) => setPlanForm((p) => ({ ...p, description: e.target.value }))} className="input-base min-h-[88px]" placeholder="Description" />
                <textarea value={planForm.featuresText} onChange={(e) => setPlanForm((p) => ({ ...p, featuresText: e.target.value }))} className="input-base min-h-[110px]" placeholder="Features (one per line)" />

                <div className="grid grid-cols-2 gap-3">
                  <input value={planForm.amazonLookupLimitPerWeek} onChange={(e) => setPlanForm((p) => ({ ...p, amazonLookupLimitPerWeek: e.target.value }))} className="input-base" placeholder="Amazon / week" type="number" min="0" />
                  <input value={planForm.productsLimit} onChange={(e) => setPlanForm((p) => ({ ...p, productsLimit: e.target.value }))} className="input-base" placeholder="Products" type="number" min="0" />
                </div>
                <input
                  value={planForm.marketAnalysisCreditsLimit}
                  onChange={(e) => setPlanForm((p) => ({ ...p, marketAnalysisCreditsLimit: e.target.value }))}
                  className="input-base"
                  placeholder="Market analysis credits"
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
                        <p className="mt-1 text-xs text-slate-500">Amazon/week: {plan.amazonLookupLimitPerWeek ?? 'unlimited'} | Products: {plan.productsLimit ?? 'unlimited'} | Market credits: {plan.marketAnalysisCreditsLimit ?? 'unlimited'} | eBay accounts: {plan.ebayAccountsLimit ?? 'unlimited'}</p>
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
      </div>
    </div>
  );
}
