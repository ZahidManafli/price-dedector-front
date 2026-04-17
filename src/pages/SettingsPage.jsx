import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Link2, Mail, ShieldCheck, Users } from 'lucide-react';
import { authAPI, ebayAPI, settingsAPI } from '../services/api';
import Alert from '../components/Alert';
import SubscriptionRequestModal from '../components/SubscriptionRequestModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    emailOnPriceChange: true,
    emailNotificationFrequency: 'instant',
  });
  const [loading, setLoading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayStatus, setEbayStatus] = useState({
    connected: false,
    accountId: null,
    environment: null,
    expiresAt: null,
    ebayAccounts: [],
    activeEbayAccountId: null,
  });
  const [alert, setAlert] = useState(null);
  const [nameDrafts, setNameDrafts] = useState({});
  const [limits, setLimits] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [requestModal, setRequestModal] = useState(null);
  const [ebayTab, setEbayTab] = useState('overview');

  const activeEbayAccount = Array.isArray(ebayStatus.ebayAccounts)
    ? ebayStatus.ebayAccounts.find((acc) => acc.id && ebayStatus.activeEbayAccountId === acc.id) || ebayStatus.ebayAccounts[0] || null
    : null;
  const activeSellerSnapshot = activeEbayAccount?.sellerSnapshot || ebayStatus.sellerSnapshot || null;
  const activeTradingUserSummary = activeEbayAccount?.tradingUserSummary || null;
  const activeTradingAccountSummary = activeEbayAccount?.tradingAccountSummary || null;

  useEffect(() => {
    const load = async () => {
      try {
        const [prefRes, ebayRes] = await Promise.all([
          settingsAPI.getPreferences(),
          ebayAPI.getStatus(),
        ]);
        const limitsRes = await settingsAPI.getLimits().catch(() => null);
        setPreferences((prev) => ({ ...prev, ...(prefRes.data || {}) }));
        const nextStatus = ebayRes.data || {};
        setEbayStatus(nextStatus);
        const drafts = {};
        (nextStatus.ebayAccounts || []).forEach((a) => {
          drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
        });
        setNameDrafts(drafts);
        setLimits(limitsRes?.data || null);
      } catch (_error) {
        // Keep defaults if optional settings/status calls fail.
      }
    };
    load();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setAlert({ type: 'error', message: 'Please fill all password fields' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setAlert({ type: 'error', message: 'New password must be at least 8 characters long' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setAlert({ type: 'error', message: 'New password and confirmation do not match' });
      return;
    }

    try {
      setPasswordSaving(true);
      await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setAlert({ type: 'success', message: 'Password updated successfully' });
    } catch (error) {
      setAlert({ type: 'error', message: error.response?.data?.error || 'Failed to change password' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const openRequestModal = (requestType) => {
    setRequestModal({
      requestType,
      title:
        requestType === 'update_credits'
          ? 'Request Credit Top-Up'
          : 'Request Subscription Reset',
      description:
        requestType === 'update_credits'
          ? 'Ask the admin team to add more credits to your account.'
          : 'Ask the admin team to refresh your current subscription.',
    });
  };

  const handleConnectEbay = async () => {
    const remaining = limits?.ebayAccounts?.remaining;
    if (remaining !== null && remaining !== undefined && remaining <= 0) {
      setAlert({
        type: 'warning',
        message: 'Your eBay account connection limit is reached. Ask admin to increase your quota.',
      });
      return;
    }

    try {
      setEbayLoading(true);
      const response = await ebayAPI.getConnectUrl();
      const authUrl = response?.data?.authUrl;
      if (!authUrl) throw new Error('Missing eBay auth URL');
      window.location.href = authUrl;
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to start eBay connection',
      });
      setEbayLoading(false);
    }
  };

  const handleDisconnectEbay = async () => {
    try {
      setEbayLoading(true);
      await ebayAPI.disconnect();
      setEbayStatus((prev) => ({ ...prev, connected: false, accountId: null }));
      setAlert({ type: 'success', message: 'Disconnected eBay account' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to disconnect eBay',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSetActiveEbayAccount = async (ebayAccountId) => {
    try {
      setEbayLoading(true);
      await ebayAPI.setActiveAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      setAlert({ type: 'success', message: 'Active eBay account updated' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to set active eBay account',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleDeleteEbayAccount = async (ebayAccountId) => {
    const ok = window.confirm('Delete this eBay account? This will disconnect it and remove it from your saved accounts.');
    if (!ok) return;
    try {
      setEbayLoading(true);
      await ebayAPI.deleteAccount(ebayAccountId);
      const ebayRes = await ebayAPI.getStatus();
      const limitsRes = await settingsAPI.getLimits().catch(() => null);
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      const drafts = {};
      (nextStatus.ebayAccounts || []).forEach((a) => {
        drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
      });
      setNameDrafts(drafts);
      setLimits(limitsRes?.data || limits);
      setAlert({ type: 'success', message: 'eBay account deleted' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to delete eBay account',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSaveAccountName = async (ebayAccountId) => {
    const connectionName = String(nameDrafts[ebayAccountId] || '').trim();
    if (!connectionName) {
      setAlert({ type: 'error', message: 'Connection name cannot be empty' });
      return;
    }
    try {
      setEbayLoading(true);
      await ebayAPI.setAccountName(ebayAccountId, connectionName);
      const ebayRes = await ebayAPI.getStatus();
      const nextStatus = ebayRes.data || {};
      setEbayStatus(nextStatus);
      const drafts = {};
      (nextStatus.ebayAccounts || []).forEach((a) => {
        drafts[a.id] = a.connectionName || a.username || a.profileUserId || '';
      });
      setNameDrafts(drafts);
      setAlert({ type: 'success', message: 'eBay connection name updated' });
    } catch (error) {
      setAlert({
        type: 'error',
        message: error.response?.data?.error || 'Failed to update eBay connection name',
      });
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await settingsAPI.updatePreferences(preferences);
      setAlert({ type: 'success', message: 'Settings saved successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto">
        <h1 className="page-title mb-8">Settings</h1>

        {alert && (
          <div className="mb-6">
            <Alert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          </div>
        )}

        <div className="glass-card p-4 md:p-5 mb-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <ShieldCheck size={16} />
              Account Security
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Current password"
                className="input-base"
                disabled={passwordSaving}
              />
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                placeholder="New password"
                className="input-base"
                disabled={passwordSaving}
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
                className="input-base"
                disabled={passwordSaving}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {passwordSaving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

        <div className="glass-card p-4 md:p-5 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                <Mail size={16} />
                Credit Requests
              </h2>
              <p className={`text-sm mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Request more credits or ask the admin team to refresh your subscription.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openRequestModal('update_credits')}
                className="rounded-xl bg-emerald-600 text-white px-4 py-2.5 hover:bg-emerald-700 transition"
              >
                Request Credit Top-Up
              </button>
              <button
                type="button"
                onClick={() => openRequestModal('reset_credits')}
                className="rounded-xl bg-slate-800 text-white px-4 py-2.5 hover:bg-slate-700 transition"
              >
                Request Subscription Reset
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 md:p-5">
          <form onSubmit={handleSave} className="space-y-5">
            {/* Email Notifications */}
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Bell size={16} />
                Email Notifications
              </h2>

              <label className={`flex items-center gap-3 mb-3 rounded-lg p-2.5 ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
              }`}>
                <input
                  type="checkbox"
                  name="emailOnPriceChange"
                  checked={preferences.emailOnPriceChange}
                  onChange={handleChange}
                  className="w-4 h-4"
                  disabled={loading}
                />
                <span className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                  Send email when prices change
                </span>
              </label>

              <div className="ml-6">
                <label className={`block text-sm font-semibold mb-2 ${
                  isDark ? 'text-slate-300' : 'text-gray-700'
                }`}>
                  Notification Frequency
                </label>
                <select
                  name="emailNotificationFrequency"
                  value={preferences.emailNotificationFrequency}
                  onChange={handleChange}
                  className="input-base"
                  disabled={!preferences.emailOnPriceChange || loading}
                >
                  <option value="instant">Instant</option>
                  <option value="daily">Daily Summary</option>
                  <option value="weekly">Weekly Summary</option>
                </select>
              </div>
            </div>

            {/* eBay Integration */}
            <div className={`rounded-lg p-3 md:p-4 ${
              isDark ? 'border border-slate-700 bg-slate-900/60' : 'border border-slate-200 bg-white'
            }`}>
              <h2 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                <Link2 size={16} />
                eBay Integration
              </h2>
              <p className={`text-sm mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Connect your eBay account to auto-update listing prices when Amazon prices change.
              </p>
              <div className={`inline-flex rounded-xl p-1 mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
                <button
                  type="button"
                  onClick={() => setEbayTab('overview')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    ebayTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                        ? 'text-slate-300 hover:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Connection
                </button>
                <button
                  type="button"
                  onClick={() => setEbayTab('details')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition ${
                    ebayTab === 'details'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : isDark
                        ? 'text-slate-300 hover:text-slate-100'
                        : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Seller details
                </button>
              </div>
              {ebayTab === 'overview' ? (
                <>
                  <div className={`rounded-lg p-3 mb-3 ${
                    isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${ebayStatus.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {ebayStatus.connected && <CheckCircle2 size={14} />}
                        {ebayStatus.connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    {/* Hide noisy environment text like 'sandbox' */}
                  </div>
                  {ebayStatus.activeAccountLabel && (
                    <p className={`text-sm mt-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      Active account: <span className="font-medium">{ebayStatus.activeAccountLabel}</span>
                    </p>
                  )}
                </div>

              {/* Multi-account selector */}
              <div className={`rounded-lg p-3 mb-3 ${
                isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
              }`}>
                <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  eBay account slots
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Connected: {limits?.ebayAccounts?.connected ?? (Array.isArray(ebayStatus.ebayAccounts) ? ebayStatus.ebayAccounts.filter((a) => !!a?.connected).length : 0)}
                  {limits?.ebayAccounts?.limit != null ? ` / ${limits.ebayAccounts.limit}` : ' (unlimited)'}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Remaining: {limits?.ebayAccounts?.remaining == null ? 'Unlimited' : limits.ebayAccounts.remaining}
                </p>
              </div>

              {Array.isArray(ebayStatus.ebayAccounts) && ebayStatus.ebayAccounts.length > 0 && (
                <div className={`rounded-lg p-3 mb-3 ${
                  isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    <Users size={14} />
                    Active eBay account
                  </div>
                  <div className="space-y-2">
                    {ebayStatus.ebayAccounts.map((acc) => {
                      const isActive = acc.id && ebayStatus.activeEbayAccountId === acc.id;
                      const label = acc.connectionName || acc.username || acc.profileUserId || 'Unknown';
                      const tradingAccountId = acc.tradingAccountId || null;
                      const connected = !!acc.connected;
                      return (
                        <div
                          key={acc.id}
                          className={`w-full flex items-center justify-between rounded-lg px-3 py-2 border transition ${
                            isActive
                              ? isDark
                                ? 'bg-emerald-900/30 border-emerald-700'
                                : 'bg-emerald-50 border-emerald-200'
                              : isDark
                                ? 'bg-slate-900/40 border-slate-700'
                                : 'bg-white border-slate-200'
                          } ${!connected ? 'opacity-60' : ''}`}
                        >
                          <div className="flex-1 text-left">
                            <div className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                              {label}
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={nameDrafts[acc.id] ?? label}
                                onChange={(e) =>
                                  setNameDrafts((prev) => ({ ...prev, [acc.id]: e.target.value }))
                                }
                                disabled={ebayLoading}
                                className={`text-xs rounded px-2 py-1 border w-48 ${
                                  isDark
                                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                                    : 'bg-white border-slate-300 text-slate-900'
                                }`}
                                placeholder="Connection name"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveAccountName(acc.id)}
                                disabled={ebayLoading}
                                className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                  isDark
                                    ? 'border-indigo-700 text-indigo-200 hover:bg-indigo-900/30'
                                    : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                }`}
                              >
                                Save name
                              </button>
                            </div>
                            <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {connected ? 'Connected' : 'Disconnected'}
                              {acc.updatedAt ? ` · Updated ${new Date(acc.updatedAt).toLocaleString()}` : ''}
                              {tradingAccountId ? ` · AccountID ${tradingAccountId}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pl-3">
                            <button
                              type="button"
                              onClick={() => handleSetActiveEbayAccount(acc.id)}
                              disabled={ebayLoading || !connected || isActive}
                              className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                isDark
                                  ? 'border-emerald-800 text-emerald-200 hover:bg-emerald-900/30'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              Set active
                            </button>
                            {isActive && (
                              <span className={`text-xs font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
                                Active
                              </span>
                            )}
                            {connected && <CheckCircle2 size={16} className={isDark ? 'text-emerald-300' : 'text-emerald-600'} />}
                            <button
                              type="button"
                              onClick={() => handleDeleteEbayAccount(acc.id)}
                              disabled={ebayLoading}
                              className={`text-xs font-semibold rounded-md px-2 py-1 border ${
                                isDark
                                  ? 'border-rose-800 text-rose-200 hover:bg-rose-900/30'
                                  : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              }`}
                              title="Delete account"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-xs mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    Listings, orders, and edit actions will use your active eBay account.
                  </p>
                </div>
              )}
                  <div className="flex gap-3">
                    {!ebayStatus.connected ? (
                      <button
                        data-tour="settings-ebay-connect"
                        type="button"
                        onClick={handleConnectEbay}
                        disabled={ebayLoading || (limits?.ebayAccounts?.remaining != null && limits.ebayAccounts.remaining <= 0)}
                        className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                      >
                        {ebayLoading ? 'Connecting...' : 'Connect eBay'}
                      </button>
                    ) : (
                      <>
                        <button
                          data-tour="settings-ebay-connect"
                          type="button"
                          onClick={handleConnectEbay}
                          disabled={ebayLoading || (limits?.ebayAccounts?.remaining != null && limits.ebayAccounts.remaining <= 0)}
                          className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 hover:bg-indigo-700 transition disabled:opacity-50"
                          title="Connect another eBay account (will be added to your saved accounts)"
                        >
                          {ebayLoading ? 'Connecting...' : 'Connect another eBay'}
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectEbay}
                          disabled={ebayLoading}
                          className="rounded-xl bg-red-600 text-white px-5 py-2.5 hover:bg-red-700 transition disabled:opacity-50"
                          title="Disconnect the legacy single-account connection (kept for backward compatibility)"
                        >
                          {ebayLoading ? 'Disconnecting...' : 'Disconnect (legacy)'}
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 mb-3">
                  <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className={`text-sm font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          Seller snapshot
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Saved when the account connected. Reconnect to refresh this data.
                        </p>
                      </div>
                      <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        Fetched: {activeSellerSnapshot?.fetchedAt ? new Date(activeSellerSnapshot.fetchedAt).toLocaleString() : '—'}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Connection</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{activeEbayAccount?.connectionName || activeEbayAccount?.username || activeEbayAccount?.profileUserId || 'Unknown'}</p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Account ID: {activeEbayAccount?.tradingAccountId || activeEbayAccount?.profileUserId || activeEbayAccount?.accountId || '—'}</p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Environment: {activeEbayAccount?.environment || ebayStatus.environment || '—'}</p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Seller registration</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {activeSellerSnapshot?.sellerRegistrationCompleted === true ? 'Completed' : activeSellerSnapshot?.sellerRegistrationCompleted === false ? 'Not completed' : 'Unknown'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Selling limit: {activeSellerSnapshot?.sellingLimit?.amount ? `${activeSellerSnapshot.sellingLimit.amount.value} ${activeSellerSnapshot.sellingLimit.amount.currency}` : '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Quantity limit: {activeSellerSnapshot?.sellingLimit?.quantity ?? '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Business policies: {activeEbayAccount?.userPreferencesSummary?.sellerProfileOptedIn ? 'Enabled' : activeEbayAccount?.userPreferencesSummary?.sellerProfileOptedIn === false ? 'Disabled' : 'Unknown'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          eBay good standing: {activeTradingUserSummary?.ebayGoodStanding === true ? 'Yes' : activeTradingUserSummary?.ebayGoodStanding === false ? 'No' : 'Unknown'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Feedback: {activeTradingUserSummary?.feedbackScore ?? '—'} ({activeTradingUserSummary?.positiveFeedbackPercent ?? '—'}%)
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Policies</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          Custom: {activeSellerSnapshot?.policyCounts?.customPolicies ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Fulfillment: {activeSellerSnapshot?.policyCounts?.fulfillmentPolicies ?? 0} · Payment: {activeSellerSnapshot?.policyCounts?.paymentPolicies ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Return: {activeSellerSnapshot?.policyCounts?.returnPolicies ?? 0}
                        </p>
                      </div>
                      <div className={`rounded-lg p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                        <p className={`text-xs uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Rate tables</p>
                        <p className={`mt-1 text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {activeSellerSnapshot?.policyCounts?.rateTables ?? 0}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Marketplace: {activeSellerSnapshot?.marketplaceId || '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Country: {activeSellerSnapshot?.countryCode || 'All'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Billing state: {activeTradingAccountSummary?.accountState || '—'}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          Invoice balance: {activeTradingAccountSummary?.invoiceBalance || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(activeSellerSnapshot?.errors) && activeSellerSnapshot.errors.length > 0 && (
                    <div className={`rounded-lg p-3 ${isDark ? 'bg-amber-950/30 border border-amber-800' : 'bg-amber-50 border border-amber-200'}`}>
                      <p className={`text-sm font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>Partial snapshot warnings</p>
                      <ul className={`mt-2 space-y-1 text-xs ${isDark ? 'text-amber-100' : 'text-amber-800'}`}>
                        {activeSellerSnapshot.errors.map((err, index) => (
                          <li key={`${err.resource || 'error'}-${index}`}>{err.resource}: {err.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {['customPolicies', 'fulfillmentPolicies', 'paymentPolicies', 'returnPolicies', 'rateTables'].map((section) => {
                    const items = Array.isArray(activeSellerSnapshot?.[section]) ? activeSellerSnapshot[section] : [];
                    const labels = {
                      customPolicies: 'Custom policies',
                      fulfillmentPolicies: 'Fulfillment policies',
                      paymentPolicies: 'Payment policies',
                      returnPolicies: 'Return policies',
                      rateTables: 'Shipping rate tables',
                    };
                    return (
                      <div key={section} className={`rounded-lg p-3 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                          {labels[section]}
                        </p>
                        {items.length > 0 ? (
                          <div className="grid gap-2 md:grid-cols-2">
                            {items.map((item) => (
                              <div key={item.customPolicyId || item.fulfillmentPolicyId || item.paymentPolicyId || item.returnPolicyId || item.rateTableId || item.name} className={`rounded-md p-3 ${isDark ? 'bg-slate-900/60' : 'bg-white'}`}>
                                {section === 'customPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.label || item.name || 'Custom policy'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.customPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Type: {item.policyType || '—'}</p>
                                  </>
                                )}
                                {section === 'fulfillmentPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || 'Fulfillment policy'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.fulfillmentPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Marketplace: {item.marketplaceId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Shipping options: {Array.isArray(item.shippingOptions) ? item.shippingOptions.length : 0}</p>
                                  </>
                                )}
                                {section === 'paymentPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || 'Payment policy'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.paymentPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Description: {item.description || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Methods: {Array.isArray(item.paymentMethods) ? item.paymentMethods.map((method) => method.paymentMethodType).filter(Boolean).join(', ') || '—' : '—'}</p>
                                  </>
                                )}
                                {section === 'returnPolicies' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || 'Return policy'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.returnPolicyId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Returns accepted: {item.returnsAccepted ? 'Yes' : 'No'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Period: {item.returnPeriod?.value ? `${item.returnPeriod.value} ${item.returnPeriod.unit || ''}`.trim() : '—'}</p>
                                  </>
                                )}
                                {section === 'rateTables' && (
                                  <>
                                    <p className={`text-sm font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.name || 'Rate table'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>ID: {item.rateTableId || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Country: {item.countryCode || '—'}</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Locality: {item.locality || '—'}</p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>No saved {labels[section].toLowerCase()} found for this account.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className={`pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                >
                  Back
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <Mail size={14} />
              Notification Channel
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Email alerts for price changes and sync events.
            </p>
          </div>
          <div className="glass-card p-3">
            <p className={`text-sm font-medium flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              <ShieldCheck size={14} />
              Account Security
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              OAuth tokens are stored server-side and refreshed automatically.
            </p>
          </div>
        </div>

        <SubscriptionRequestModal
          open={!!requestModal}
          onClose={() => setRequestModal(null)}
          requestType={requestModal?.requestType || 'subscription'}
          title={requestModal?.title}
          description={requestModal?.description}
          defaultValues={{
            name: user?.name || '',
            surname: user?.surname || '',
            email: user?.email || '',
          }}
          submitLabel={requestModal?.requestType === 'update_credits' ? 'Send Credit Request' : 'Send Reset Request'}
          onSuccess={() => setAlert({ type: 'success', message: 'Request sent to admin' })}
        />
      </div>
    </div>
  );
}
