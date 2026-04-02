import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { ShieldCheck, Users, UserPlus, Pencil } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

function safeToString(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

export default function AdminPanelPage() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [alert, setAlert] = useState(null);

  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user',
    amazonLookupRequestLimitPerDay: '',
    productsLimit: '',
  });

  const [edits, setEdits] = useState({});
  const [resetUsage, setResetUsage] = useState({});

  const defaultEditForUser = (u) => ({
    role: u.role || 'user',
    amazonLookupRequestLimitPerDay: safeToString(u.amazonLookupRequestLimitPerDay),
    productsLimit: safeToString(u.productsLimit),
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setAlert(null);
        const usersRes = await adminAPI.listUsers();
        setUsers(usersRes.data?.users || []);
        const nextEdits = {};
        for (const u of usersRes.data?.users || []) {
          nextEdits[u.id] = defaultEditForUser(u);
        }
        setEdits(nextEdits);
      } catch (err) {
        setAlert({
          type: 'error',
          message: err.response?.data?.error || err.message || 'Failed to load users',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
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
      const payload = {
        email: createForm.email.trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        role: createForm.role === 'admin' ? 'admin' : 'user',
        amazonLookupRequestLimitPerDay:
          createForm.amazonLookupRequestLimitPerDay === ''
            ? null
            : Number(createForm.amazonLookupRequestLimitPerDay),
        productsLimit:
          createForm.productsLimit === '' ? null : Number(createForm.productsLimit),
      };

      await adminAPI.createUser(payload);

      setCreateForm({
        email: '',
        password: '',
        name: '',
        role: 'user',
        amazonLookupRequestLimitPerDay: '',
        productsLimit: '',
      });

      // Refresh list
      const usersRes = await adminAPI.listUsers();
      setUsers(usersRes.data?.users || []);
      const nextEdits = {};
      for (const u of usersRes.data?.users || []) {
        nextEdits[u.id] = defaultEditForUser(u);
      }
      setEdits(nextEdits);

      setAlert({ type: 'success', message: 'User created successfully' });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to create user',
      });
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
        amazonLookupRequestLimitPerDay:
          uEdits.amazonLookupRequestLimitPerDay === ''
            ? null
            : Number(uEdits.amazonLookupRequestLimitPerDay),
        productsLimit: uEdits.productsLimit === '' ? null : Number(uEdits.productsLimit),
        resetAmazonUsage: !!resetUsage[userId],
      });

      const usersRes = await adminAPI.listUsers();
      setUsers(usersRes.data?.users || []);
      const nextEdits = {};
      for (const u of usersRes.data?.users || []) {
        nextEdits[u.id] = defaultEditForUser(u);
      }
      setEdits(nextEdits);
      setResetUsage({});

      setAlert({ type: 'success', message: 'Limits updated' });
    } catch (err) {
      setAlert({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to update limits',
      });
    } finally {
      setLoading(false);
    }
  };

  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);

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
              Manage user access & limits. Admin users: <span className="font-semibold">{adminCount}</span>
            </p>
          </div>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} autoClose={false} />
          </div>
        )}

        {loading && <LoadingSpinner />}

        {!loading && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4 lg:gap-6">
            {/* Create user */}
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <UserPlus size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Create User</h2>
              </div>

              <form onSubmit={onCreateUser} className="space-y-3">
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Name</label>
                  <input
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                    className="input-base"
                    placeholder="Full name"
                    type="text"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Email</label>
                  <input
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                    className="input-base"
                    placeholder="user@example.com"
                    type="email"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Password</label>
                  <input
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                    className="input-base"
                    placeholder="Temporary password"
                    type="password"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}
                    className="input-base"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                      Amazon lookup limit / day
                    </label>
                    <input
                      value={createForm.amazonLookupRequestLimitPerDay}
                      onChange={(e) => setCreateForm((p) => ({ ...p, amazonLookupRequestLimitPerDay: e.target.value }))}
                      className="input-base"
                      placeholder="Leave empty = unlimited"
                      type="number"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                      Products limit
                    </label>
                    <input
                      value={createForm.productsLimit}
                      onChange={(e) => setCreateForm((p) => ({ ...p, productsLimit: e.target.value }))}
                      className="input-base"
                      placeholder="Leave empty = unlimited"
                      type="number"
                      min="0"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                  <Users size={16} />
                  Create access
                </button>
              </form>
            </div>

            {/* Users list */}
            <div className={`glass-card p-4 md:p-5 ${isDark ? 'bg-slate-900 border-slate-700' : ''}`}>
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-blue-600" />
                <h2 className={`text-lg font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Users</h2>
              </div>

              {users.length === 0 ? (
                <div className="text-sm text-slate-600">No users found.</div>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => {
                    const rowEdits = edits[u.id] || defaultEditForUser(u);
                    return (
                      <div key={u.id} className={`border rounded-xl p-3 ${isDark ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="min-w-0">
                            <div className={`font-semibold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {u.name || 'User'} <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>({u.email})</span>
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Role: <span className="font-semibold">{u.role}</span>
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Amazon used today: <span className="font-semibold">{u.amazonLookupRequestsUsedToday ?? 0}</span>
                              {u.amazonLookupRequestLimitPerDay != null && (
                                <> / <span className="font-semibold">{u.amazonLookupRequestLimitPerDay}</span></>
                              )}
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Reset at:{' '}
                              <span className="font-semibold">
                                {u.amazonLookupRequestsResetAt ? new Date(u.amazonLookupRequestsResetAt).toLocaleString() : '—'}
                              </span>
                            </div>
                            <div className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                              Products: <span className="font-semibold">{u.productCount ?? 0}</span>
                              {u.productsLimit != null && (
                                <> / <span className="font-semibold">{u.productsLimit}</span></>
                              )}
                            </div>
                          </div>

                          <div className="w-full lg:w-[360px]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                  Role
                                </label>
                                <select
                                  value={rowEdits.role}
                                  onChange={(e) =>
                                    setEdits((prev) => ({
                                      ...prev,
                                      [u.id]: { ...prev[u.id], role: e.target.value },
                                    }))
                                  }
                                  className="input-base"
                                >
                                  <option value="user">user</option>
                                  <option value="admin">admin</option>
                                </select>
                              </div>
                              <div className="sm:col-span-1">
                                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                  Amazon limit / day
                                </label>
                                <input
                                  value={rowEdits.amazonLookupRequestLimitPerDay}
                                  onChange={(e) =>
                                    setEdits((prev) => ({
                                      ...prev,
                                      [u.id]: {
                                        ...prev[u.id],
                                        amazonLookupRequestLimitPerDay: e.target.value,
                                      },
                                    }))
                                  }
                                  className="input-base"
                                  placeholder="Unlimited"
                                  type="number"
                                  min="0"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
                                  Products limit
                                </label>
                                <input
                                  value={rowEdits.productsLimit}
                                  onChange={(e) =>
                                    setEdits((prev) => ({
                                      ...prev,
                                      [u.id]: { ...prev[u.id], productsLimit: e.target.value },
                                    }))
                                  }
                                  className="input-base"
                                  placeholder="Unlimited"
                                  type="number"
                                  min="0"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 mt-3">
                              <label className="flex items-center gap-2 select-none cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!resetUsage[u.id]}
                                  onChange={(e) =>
                                    setResetUsage((prev) => ({
                                      ...prev,
                                      [u.id]: e.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                                <span className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Reset Amazon usage now</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => onSaveLimits(u.id)}
                                className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2"
                              >
                                <Pencil size={14} />
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

